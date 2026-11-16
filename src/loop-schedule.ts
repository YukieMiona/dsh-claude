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

export interface LoopSchedule {
  wakeup?: PendingWakeup
  /** Session crons by the id CronCreate returned. A non-durable cron lives
   *  only in the process that created it. */
  crons: Map<string, { prompt: string; recurring: boolean; durable: boolean; expiresAt: number }>
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

export function createdCron(input: unknown, output: unknown): { id: string; prompt: string; recurring: boolean; durable: boolean } | undefined {
  const id = text(record(output)?.id)
  const prompt = text(record(input)?.prompt)
  if (id === undefined || prompt === undefined) return undefined
  const recurring = record(output)?.recurring ?? record(input)?.recurring
  const durable = record(output)?.durable ?? record(input)?.durable
  return { id, prompt, recurring: recurring !== false, durable: durable === true }
}

export function deletedCronId(input: unknown): string | undefined {
  return text(record(input)?.id)
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
