/**
 * Bookkeeping for Claude Code's own scheduler (`/loop`, ScheduleWakeup,
 * CronCreate) as seen from the supervisor.
 *
 * Claude Code owns the schedule: while its process lives and its input stream
 * stays open it fires every wakeup itself, on time, as a turn of its own. The
 * supervisor only needs to know *that* something is scheduled, so it can
 * (1) keep the process holding the schedule alive, (2) show the turn the
 * scheduler starts, and (3) restart the loop when the process that held the
 * schedule is gone anyway. Nothing here fires a wakeup on its own while the
 * process that owns it is alive.
 */

/** How long past a wakeup's due time the supervisor waits for the CLI to fire
 *  it before treating the wakeup as lost. Covers the CLI aligning fire times
 *  to a cron minute plus a slow process start. */
export const LOOP_WAKEUP_GRACE_MS = 90_000

/** The CLI clamps ScheduleWakeup delays to this range (sdk-tools.d.ts). */
const MIN_WAKEUP_DELAY_S = 60
const MAX_WAKEUP_DELAY_S = 3_600
/** The CLI auto-expires session crons after seven days (CronCreateInput). */
export const CRON_LIFETIME_MS = 7 * 24 * 3_600_000

export interface PendingWakeup {
  /** Epoch ms the CLI said it will fire at. */
  scheduledFor: number
  /** The `prompt` the model handed ScheduleWakeup; may be a `<<…>>` sentinel. */
  prompt: string
  reason?: string
  /** Armed by the plugin itself (a usage-limit restart), not held by any
   *  Claude Code process — so it never keeps a process alive. */
  synthetic?: true
}

export interface TrackedCron {
  prompt: string
  recurring: boolean
  durable: boolean
  expiresAt: number
  /** The 5-field cron expression, when known. */
  schedule?: string
  /** Claude Code's own wording, e.g. "Every 3 minutes". */
  human?: string
  /** The first fire time CronCreate reported (epoch ms). */
  nextFireAt?: number
  /** When this job last started a turn (epoch ms). */
  lastFiredAt?: number
}

/** What the composer's loop indicator shows. */
export interface ClaudeLoopView {
  /** A pending dynamic /loop wakeup. */
  wakeup?: { at: number; reason?: string; prompt?: string }
  jobs: { id: string; prompt: string; recurring: boolean; schedule?: string; human?: string; nextAt?: number }[]
}

export interface LoopSchedule {
  wakeup?: PendingWakeup
  /** Session crons by the id CronCreate returned. A non-durable cron lives
   *  only in the process that created it. */
  crons: Map<string, TrackedCron>
  /** The `/loop …` command the user typed; the only prompt that can restart a
   *  loop in a fresh process, since sentinels mean something only to the
   *  scheduler that armed them. */
  command?: string
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

export function isLoopSentinel(prompt: string): boolean {
  return /^<<[a-z-]+>>$/u.test(prompt.trim())
}

export function isLoopCommand(prompt: string): boolean {
  return /^\/loop(?:\s|$)/u.test(prompt.trim())
}

/** Plain text of a user prompt (string or content blocks). */
export function promptText(prompt: unknown): string {
  if (typeof prompt === 'string') return prompt
  if (!Array.isArray(prompt)) return ''
  return prompt
    .map(block => (record(block)?.type === 'text' ? text(record(block)?.text) ?? '' : ''))
    .filter(part => part.length > 0)
    .join('\n')
}

/**
 * Read a ScheduleWakeup call and its result into the pending wakeup it armed.
 *
 * @returns `null` when the call ended the loop, `undefined` when it scheduled
 *   nothing readable.
 */
export function scheduledWakeup(input: unknown, output: unknown, now = Date.now()): PendingWakeup | null | undefined {
  const call = record(input)
  const result = record(output)
  if (call?.stop === true || result?.stopped === true) return null
  const prompt = text(call?.prompt)
  if (prompt === undefined) return undefined
  // Prefer the CLI's own answer; estimate from the request only when the
  // result arrived as plain text (older CLIs).
  let scheduledFor = finite(result?.scheduledFor)
  if (scheduledFor === undefined) {
    const delay = finite(call?.delaySeconds)
    if (delay === undefined) return undefined
    const clamped = Math.min(Math.max(delay, MIN_WAKEUP_DELAY_S), MAX_WAKEUP_DELAY_S)
    scheduledFor = now + clamped * 1_000 + 60_000
  }
  const reason = text(call?.reason)
  return { scheduledFor, prompt, ...(reason === undefined ? {} : { reason }) }
}

export function createdCron(input: unknown, output: unknown, now = Date.now()): ({ id: string } & TrackedCron) | undefined {
  const id = text(record(output)?.id)
  const prompt = text(record(input)?.prompt)
  if (id === undefined || prompt === undefined) return undefined
  const recurring = record(output)?.recurring ?? record(input)?.recurring
  const durable = record(output)?.durable ?? record(input)?.durable
  const schedule = text(record(input)?.cron)
  const human = text(record(output)?.humanSchedule)
  const nextFireAt = finite(record(output)?.nextFireAt)
  return {
    id,
    prompt,
    recurring: recurring !== false,
    durable: durable === true,
    expiresAt: now + CRON_LIFETIME_MS,
    ...(schedule === undefined ? {} : { schedule }),
    ...(human === undefined ? {} : { human }),
    ...(nextFireAt === undefined ? {} : { nextFireAt }),
  }
}

export function deletedCronId(input: unknown): string | undefined {
  return text(record(input)?.id)
}

/**
 * Replace the tracked crons with the list Claude Code reports at the end of a
 * turn (the Stop hook's `session_crons`). That list is authoritative: it also
 * names jobs this plugin never saw created, which is every job after a process
 * is replaced, since Claude Code restores a session's jobs on resume while the
 * plugin's own record was dropped with the old process.
 *
 * A dynamic /loop wakeup appears there too, as a one-shot. The tracked wakeup
 * already covers it, so the one-shot carrying its prompt is left out.
 */
export function syncCrons(schedule: LoopSchedule, reported: unknown, now = Date.now()): void {
  if (!Array.isArray(reported)) return
  const next: LoopSchedule['crons'] = new Map()
  let wakeupPrompt = schedule.wakeup?.synthetic === true ? undefined : schedule.wakeup?.prompt
  for (const item of reported) {
    const id = text(record(item)?.id)
    const prompt = text(record(item)?.prompt)
    if (id === undefined || prompt === undefined) continue
    const recurring = record(item)?.recurring !== false
    if (!recurring && prompt === wakeupPrompt) {
      wakeupPrompt = undefined
      continue
    }
    const known = schedule.crons.get(id)
    const expression = text(record(item)?.schedule)
    next.set(id, {
      ...(known ?? { prompt, recurring, durable: false, expiresAt: now + CRON_LIFETIME_MS }),
      ...(expression === undefined ? {} : { schedule: expression }),
    })
  }
  schedule.crons = next
}

/** Whether the process holding this schedule must outlive its idle timeout. */
export function holdsProcess(schedule: LoopSchedule | undefined, now = Date.now()): boolean {
  if (schedule === undefined) return false
  for (const cron of schedule.crons.values()) if (cron.expiresAt > now) return true
  const wakeup = schedule.wakeup
  return wakeup !== undefined && wakeup.synthetic !== true && wakeup.scheduledFor + LOOP_WAKEUP_GRACE_MS > now
}

/** The prompt that restarts the loop in a process that never saw its schedule. */
export function resumePrompt(schedule: LoopSchedule): string | undefined {
  if (schedule.command !== undefined) return schedule.command
  const prompt = schedule.wakeup?.prompt
  return prompt === undefined || isLoopSentinel(prompt) ? undefined : prompt
}

/** What the transcript shows for a turn the scheduler started. A cron fire
 *  does not say which cron fired, so its prompt is shown only when there is
 *  just one. */
export function scheduledTurnLabel(wakeup: PendingWakeup | undefined, onlyCronPrompt: string | undefined): string {
  const prompt = wakeup?.prompt ?? onlyCronPrompt
  if (prompt !== undefined && !isLoopSentinel(prompt)) return prompt
  if (wakeup === undefined) return 'Scheduled task'
  return wakeup.reason === undefined ? 'Scheduled wakeup' : `Scheduled wakeup: ${wakeup.reason}`
}

/** When a `rate_limit_event` says requests are rejected — and overage is not
 *  carrying them instead — the epoch ms the quota resets. */
export function rateLimitResetAt(detail: unknown): number | undefined {
  const info = record(detail)
  if (info?.status !== 'rejected') return undefined
  if (info.isUsingOverage === true || info.overageStatus === 'allowed' || info.overageStatus === 'allowed_warning') return undefined
  const resetsAt = finite(info.resetsAt)
  // The CLI reports epoch seconds.
  return resetsAt === undefined ? undefined : resetsAt * 1_000
}

type CronField = (value: number) => boolean

function cronField(source: string, min: number, max: number): CronField | undefined {
  const allowed = new Set<number>()
  for (const part of source.split(',')) {
    const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/u.exec(part)
    if (match === null) return undefined
    const step = match[2] === undefined ? 1 : Number(match[2])
    if (step < 1) return undefined
    let from = min
    let to = max
    if (match[1] !== '*') {
      const [low, high] = match[1]!.split('-').map(Number)
      from = low!
      to = high ?? (match[2] === undefined ? low! : max)
    }
    if (from < min || to > max || from > to) return undefined
    for (let value = from; value <= to; value += step) allowed.add(value)
  }
  return value => allowed.has(value)
}

/** A 5-field cron expression as a predicate over local time, or undefined
 *  when it uses syntax this reader does not know (names, `L`, `#`). */
function cronPredicate(expression: string): ((date: Date) => boolean) | undefined {
  const parts = expression.trim().split(/\s+/u)
  if (parts.length !== 5) return undefined
  const minute = cronField(parts[0]!, 0, 59)
  const hour = cronField(parts[1]!, 0, 23)
  const dayOfMonth = cronField(parts[2]!, 1, 31)
  const month = cronField(parts[3]!, 1, 12)
  const dayOfWeek = cronField(parts[4]!.replace(/7/gu, '0'), 0, 6)
  if (minute === undefined || hour === undefined || dayOfMonth === undefined || month === undefined || dayOfWeek === undefined) return undefined
  const anyDom = parts[2] === '*'
  const anyDow = parts[4] === '*'
  return date => {
    if (!minute(date.getMinutes()) || !hour(date.getHours()) || !month(date.getMonth() + 1)) return false
    const dom = dayOfMonth(date.getDate())
    const dow = dayOfWeek(date.getDay())
    // Standard cron: with both day fields restricted, either may match.
    return anyDom || anyDow ? dom && dow : dom || dow
  }
}

const MINUTE_MS = 60_000
/** How far a cron search looks: a week ahead, a day back. */
const CRON_SEARCH_AHEAD_MINUTES = 8 * 24 * 60
const CRON_SEARCH_BACK_MINUTES = 24 * 60

/** The first minute strictly after `after` the expression matches (epoch ms). */
export function nextCronMatch(expression: string, after: number): number | undefined {
  const matches = cronPredicate(expression)
  if (matches === undefined) return undefined
  const start = Math.floor(after / MINUTE_MS) * MINUTE_MS
  for (let step = 1; step <= CRON_SEARCH_AHEAD_MINUTES; step += 1) {
    const at = start + step * MINUTE_MS
    if (matches(new Date(at))) return at
  }
  return undefined
}

function previousCronMatch(expression: string, atOrBefore: number): number | undefined {
  const matches = cronPredicate(expression)
  if (matches === undefined) return undefined
  const start = Math.floor(atOrBefore / MINUTE_MS) * MINUTE_MS
  for (let step = 0; step <= CRON_SEARCH_BACK_MINUTES; step += 1) {
    const at = start - step * MINUTE_MS
    if (matches(new Date(at))) return at
  }
  return undefined
}

/** When a job should next fire. Claude Code shifts each job by a fixed
 *  offset from its cron minute, so the offset seen on the last fire is
 *  carried forward; before the first fire, its own stated time is used. */
function nextJobFire(cron: TrackedCron, now: number): number | undefined {
  if (cron.nextFireAt !== undefined && cron.nextFireAt > now && cron.lastFiredAt === undefined) return cron.nextFireAt
  if (cron.schedule === undefined) return undefined
  const lastMatch = cron.lastFiredAt === undefined ? undefined : previousCronMatch(cron.schedule, cron.lastFiredAt)
  const offset = lastMatch === undefined || cron.lastFiredAt === undefined ? 0 : cron.lastFiredAt - lastMatch
  const next = nextCronMatch(cron.schedule, now - offset)
  return next === undefined ? undefined : next + offset
}

/** The schedule as the composer's loop indicator shows it, or undefined when
 *  nothing is scheduled. */
export function loopView(schedule: LoopSchedule | undefined, now = Date.now()): ClaudeLoopView | undefined {
  if (schedule === undefined) return undefined
  const wakeup = schedule.wakeup
  const jobs: ClaudeLoopView['jobs'] = []
  for (const [id, cron] of schedule.crons) {
    if (cron.expiresAt <= now) continue
    const nextAt = nextJobFire(cron, now)
    jobs.push({
      id,
      prompt: cron.prompt.slice(0, 200),
      recurring: cron.recurring,
      ...(cron.schedule === undefined ? {} : { schedule: cron.schedule }),
      ...(cron.human === undefined ? {} : { human: cron.human }),
      ...(nextAt === undefined ? {} : { nextAt }),
    })
  }
  if (wakeup === undefined && jobs.length === 0) return undefined
  return {
    ...(wakeup === undefined ? {} : {
      wakeup: {
        at: wakeup.scheduledFor,
        ...(wakeup.reason === undefined ? {} : { reason: wakeup.reason.slice(0, 200) }),
        ...(isLoopSentinel(wakeup.prompt) ? {} : { prompt: wakeup.prompt.slice(0, 200) }),
      },
    }),
    jobs,
  }
}
