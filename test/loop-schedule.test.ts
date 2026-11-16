import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanUseTool, Options, Query, SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { AsyncQueue } from '../src/async-queue.ts'
import { ClaudeSidecarRepository } from '../src/sidecar.ts'
import { CLAUDE_METADATA_TIMEOUT_MS, ClaudeSupervisor, type ClaudeQueryFactory } from '../src/supervisor.ts'
import {
  LOOP_WAKEUP_GRACE_MS,
  holdsProcess,
  isLoopSentinel,
  rateLimitResetAt,
  resumePrompt,
  scheduledTurnLabel,
  scheduledWakeup,
} from '../src/loop-schedule.ts'
import { normalizeSdkMessage } from '../src/sdk-messages.ts'

class FakeQuery extends AsyncQueue<SDKMessage> {
  readonly sent: SDKUserMessage[] = []
  readonly interrupt = vi.fn(async () => ({ still_queued: [] }))
  readonly setPermissionMode = vi.fn(async () => undefined)
  readonly initializationResult = vi.fn(async () => ({
    commands: [], agents: [], output_style: 'default', available_output_styles: [], models: [], account: {},
  }))
  readonly supportedCommands = vi.fn(async () => [])
  readonly getContextUsage = vi.fn(async () => ({ rawMaxTokens: 200_000, maxTokens: 200_000, model: 'claude-test' }))

  constructor(input: AsyncIterable<SDKUserMessage>, readonly options: Options) {
    super()
    void (async () => { for await (const message of input) this.sent.push(message) })()
  }

  get sentText(): string[] {
    return this.sent.map(message => String(message.message.content))
  }
}

interface Followup { id: string; text: string }

const roots: string[] = []

function harness(idleTimeoutMs = 60_000) {
  const queries: FakeQuery[] = []
  const create: ClaudeQueryFactory = ({ prompt, options }) => {
    const fake = new FakeQuery(prompt as AsyncIterable<SDKUserMessage>, options)
    queries.push(fake)
    return fake as unknown as Query
  }
  const events: Array<{ type: string; data: unknown; seq: number; time: number }> = [
    { type: 'turn/start', data: { turn: 1 }, seq: 0, time: 1 },
    { type: 'step/start', data: { turn: 1, step: 1 }, seq: 1, time: 2 },
  ]
  const followups: Followup[] = []
  const agent = {
    id: 'loop-session',
    session: {
      header: { cwd: '/workspace' },
      snapshotEvents: () => Object.freeze([...events]),
      append: async (type: string, data: unknown) => {
        const event = { type, data, seq: events.length, time: Date.now() }
        events.push(event)
        return event
      },
    },
    ctx: { tools: { register: () => () => undefined } },
    followup: vi.fn((message: { id: string; content: Array<{ text: string }> }) => {
      followups.push({ id: message.id, text: message.content[0]!.text })
    }),
  } as unknown as Agent
  const root = join(tmpdir(), `dsh-claude-loop-${randomUUID()}`)
  roots.push(root)
  const warnings: string[] = []
  const approvals: unknown[] = []
  const supervisor = new ClaudeSupervisor({
    runtime: { spawn: () => { throw new Error('fake query must not spawn') } },
    approval: { request: async (request: unknown) => { approvals.push(request); return 'allowed-once' } },
    userQuestions: { ask: async () => ({ answers: [] }) },
    config: { executablePath: '/local/claude', idleTimeoutMs, maxProcesses: 4, defaultModel: 'default', renderMode: 'plugin' },
    queryFactory: create,
    sidecar: new ClaudeSidecarRepository({ root }),
    resolveAgent: id => (id === 'loop-session' ? agent : undefined),
    logger: { warn: message => { warnings.push(message) } },
  })
  /** What DSH does with a follow-up: open a turn for that very message. */
  const answer = (followup: Followup, model = 'default') => supervisor.runTurn({ agent, prompt: followup.text, messageId: followup.id, model })
  return { supervisor, queries, agent, followups, warnings, approvals, answer }
}

const init = () => ({ type: 'system', subtype: 'init', session_id: 'claude-1', claude_code_version: '2.1.318', cwd: '/workspace' }) as SDKMessage

const result = (text: string, extra: Record<string, unknown> = {}) => ({
  type: 'result', subtype: 'success', session_id: 'claude-1', result: text, total_cost_usd: 0, usage: { input_tokens: 1, output_tokens: 1 }, ...extra,
}) as SDKMessage

const assistant = (text: string) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } }) as SDKMessage

function scheduleWakeup(id: string, scheduledFor: number, prompt = '/loop check CI'): SDKMessage[] {
  return [
    {
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'ScheduleWakeup', input: { delaySeconds: 120, prompt, reason: 'waiting on CI' } }] },
    } as SDKMessage,
    {
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'scheduled' }] },
      tool_use_result: { scheduledFor, clampedDelaySeconds: 120, wasClamped: false },
    } as SDKMessage,
  ]
}

const wakeupStarted = (scheduledFor: number) => ({
  type: 'command_lifecycle', command_uuid: 'cli-command-1', state: 'started', wakeup_source: 'loop_wakeup', scheduled_for: scheduledFor, session_id: 'claude-1',
}) as unknown as SDKMessage

const rejected = (resetsAt: number, extra: Record<string, unknown> = {}) => ({
  type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt, ...extra }, session_id: 'claude-1',
}) as unknown as SDKMessage

async function drain(stream: AsyncIterable<unknown>): Promise<unknown[]> {
  const events: unknown[] = []
  for await (const event of stream) events.push(event)
  return events
}

/** Run a turn that schedules one wakeup, the way the CLI reports it. */
async function startLoop(h: ReturnType<typeof harness>, scheduledFor: number, opening = '/loop check CI', wakeupPrompt = '/loop check CI') {
  const stream = await h.supervisor.runTurn({ agent: h.agent, prompt: opening, model: 'default' })
  const query = h.queries[0]!
  query.push(init())
  for (const message of scheduleWakeup('tool-wake-1', scheduledFor, wakeupPrompt)) query.push(message)
  query.push(result('Waiting for CI.', { user_message_uuid: query.sent[0]?.uuid }))
  await drain(stream)
  return query
}

/** The CLI's scheduler starts the wakeup; returns the follow-up the supervisor asked for. */
async function fireWakeup(h: ReturnType<typeof harness>, query: FakeQuery, scheduledFor: number, count = 1): Promise<Followup> {
  query.push(wakeupStarted(scheduledFor))
  await vi.waitFor(() => { expect(h.followups).toHaveLength(count) })
  return h.followups[count - 1]!
}

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })))
})

describe('loop schedule helpers', () => {
  it('reads the CLI-reported fire time and recognises stop', () => {
    expect(scheduledWakeup({ delaySeconds: 30, prompt: '/loop x' }, { scheduledFor: 5_000 })).toEqual({ scheduledFor: 5_000, prompt: '/loop x' })
    expect(scheduledWakeup({ stop: true }, { stopped: true })).toBeNull()
    // Plain-text result: estimate from the clamped request delay.
    expect(scheduledWakeup({ delaySeconds: 10, prompt: 'p' }, 'scheduled', 0)).toMatchObject({ scheduledFor: 120_000 })
  })

  it('never resumes with a sentinel the fresh process would not understand', () => {
    expect(isLoopSentinel('<<autonomous-loop-dynamic>>')).toBe(true)
    expect(resumePrompt({ crons: new Map(), wakeup: { scheduledFor: 0, prompt: '<<autonomous-loop-dynamic>>' } })).toBeUndefined()
    expect(resumePrompt({ crons: new Map(), command: '/loop babysit', wakeup: { scheduledFor: 0, prompt: '<<autonomous-loop-dynamic>>' } })).toBe('/loop babysit')
  })

  it('labels scheduled turns without exposing sentinels or guessing which cron fired', () => {
    expect(scheduledTurnLabel({ scheduledFor: 0, prompt: '<<autonomous-loop-dynamic>>', reason: 'CI' }, undefined)).toBe('Scheduled wakeup: CI')
    expect(scheduledTurnLabel(undefined, 'check the deploy')).toBe('check the deploy')
    expect(scheduledTurnLabel(undefined, undefined)).toBe('Scheduled task')
  })

  it('holds the process only while its own wakeup is due or a cron is live', () => {
    const cron = (expiresAt: number) => ({ prompt: 'p', recurring: true, durable: false, expiresAt })
    expect(holdsProcess({ crons: new Map(), wakeup: { scheduledFor: 1_000, prompt: 'p' } }, 1_000 + LOOP_WAKEUP_GRACE_MS - 1)).toBe(true)
    expect(holdsProcess({ crons: new Map(), wakeup: { scheduledFor: 1_000, prompt: 'p' } }, 1_000 + LOOP_WAKEUP_GRACE_MS)).toBe(false)
    // A usage-limit restart is the plugin's, not any process's.
    expect(holdsProcess({ crons: new Map(), wakeup: { scheduledFor: 1_000, prompt: 'p', synthetic: true } }, 0)).toBe(false)
    expect(holdsProcess({ crons: new Map([['c1', cron(10)]]) }, 9)).toBe(true)
    expect(holdsProcess({ crons: new Map([['c1', cron(10)]]) }, 10)).toBe(false)
  })

  it('takes the quota reset only from a rejected rate_limit_event with no overage carrying requests', () => {
    expect(rateLimitResetAt({ status: 'rejected', resetsAt: 1_800 })).toBe(1_800_000)
    expect(rateLimitResetAt({ status: 'allowed_warning', resetsAt: 1_800 })).toBeUndefined()
    expect(rateLimitResetAt({ status: 'rejected', resetsAt: 1_800, isUsingOverage: true })).toBeUndefined()
    expect(rateLimitResetAt({ status: 'rejected', resetsAt: 1_800, overageStatus: 'allowed' })).toBeUndefined()
  })

  it('normalizes a scheduler-fired turn start and leaves other lifecycle frames as telemetry', () => {
    expect(normalizeSdkMessage(wakeupStarted(42))).toEqual([{ kind: 'scheduled-turn', commandUuid: 'cli-command-1', source: 'loop_wakeup', scheduledFor: 42 }])
    expect(normalizeSdkMessage({ type: 'command_lifecycle', command_uuid: 'u', state: 'started' } as unknown as SDKMessage))
      .toEqual([{ kind: 'progress', subtype: 'command_lifecycle' }])
  })
})

describe('Claude Code /loop under the supervisor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  })

  it('draws the turn the CLI scheduler fires into the DSH turn it asked for, sending nothing', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 120_000
    const query = await startLoop(h, scheduledFor)
    const followup = await fireWakeup(h, query, scheduledFor)
    expect(followup.text).toBe('/loop check CI')

    const stream = await h.answer(followup)
    query.push(init())
    query.push(assistant('CI is green.'))
    // A scheduler-fired turn's result names no user message.
    query.push(result('CI is green.'))
    const events = await drain(stream)

    expect(events).toContainEqual({ type: 'complete', text: 'CI is green.' })
    expect(query.sentText).toEqual(['/loop check CI'])
    await h.supervisor.dispose()
  })

  it('shows a sentinel wakeup by its reason and never sends the sentinel', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 120_000
    const query = await startLoop(h, scheduledFor, '/loop', '<<autonomous-loop-dynamic>>')
    const followup = await fireWakeup(h, query, scheduledFor)
    expect(followup.text).toBe('Scheduled wakeup: waiting on CI')
    const stream = await h.answer(followup)
    query.push(result('done'))
    await drain(stream)
    expect(query.sentText).toEqual(['/loop'])
    await h.supervisor.dispose()
  })

  it('closes a follow-up empty once its scheduled turn is gone, instead of re-running the loop', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 120_000
    const query = await startLoop(h, scheduledFor)
    const followup = await fireWakeup(h, query, scheduledFor)
    // DSH takes longer than the attach window to open the turn.
    await vi.advanceTimersByTimeAsync(121_000)
    query.push(result('ran unseen'))

    const events = await drain(await h.answer(followup))
    expect(events).toEqual([{ type: 'complete', text: '' }])
    expect(query.sentText).toEqual(['/loop check CI'])
    await h.supervisor.dispose()
  })

  it('lets a user prompt that arrives first draw the scheduled turn, and closes the follow-up empty', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 120_000
    const query = await startLoop(h, scheduledFor)
    const followup = await fireWakeup(h, query, scheduledFor)

    const user = await h.supervisor.runTurn({ agent: h.agent, prompt: 'what is the weather', messageId: 'user-message', model: 'default' })
    await vi.waitFor(() => { expect(query.sentText).toEqual(['/loop check CI', 'what is the weather']) })
    query.push(result('CI is green.', { queued_turn_count: 1 }))
    query.push(result('Sunny.', { user_message_uuid: query.sent[1]!.uuid }))
    expect(await drain(user)).toContainEqual({ type: 'complete', text: 'Sunny.' })

    expect(await drain(await h.answer(followup))).toEqual([{ type: 'complete', text: '' }])
    expect(query.sentText).toEqual(['/loop check CI', 'what is the weather'])
    await h.supervisor.dispose()
  })

  it('defers a model switch requested while a scheduled turn is being attached', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 120_000
    const query = await startLoop(h, scheduledFor)
    const followup = await fireWakeup(h, query, scheduledFor)
    const stream = await h.answer(followup, 'other-model')
    query.push(result('done'))
    await drain(stream)
    expect(h.queries).toHaveLength(1)
    expect(query.sentText).toEqual(['/loop check CI'])
    await h.supervisor.dispose()
  })

  it('makes a permission request during the attach window wait for the turn instead of denying it', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 120_000
    const query = await startLoop(h, scheduledFor)
    const followup = await fireWakeup(h, query, scheduledFor)

    const canUseTool = query.options.canUseTool as CanUseTool
    let decision: unknown
    void canUseTool('Bash', { command: 'gh run list' }, { signal: new AbortController().signal, toolUseID: 'tool-bash' } as never)
      .then(value => { decision = value })
    await vi.advanceTimersByTimeAsync(10)
    expect(decision).toBeUndefined()

    const stream = await h.answer(followup)
    await vi.waitFor(() => { expect(decision).toMatchObject({ behavior: 'allow' }) })
    query.push(result('done'))
    await drain(stream)
    await h.supervisor.dispose()
  })

  it('keeps the process holding a pending wakeup past its idle timeout', async () => {
    const h = harness(1_000)
    const scheduledFor = Date.now() + 120_000
    await startLoop(h, scheduledFor)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.supervisor.snapshots()).toHaveLength(1)

    // Long overdue: the hold lapses and the process is ordinary idle again.
    await vi.advanceTimersByTimeAsync(120_000 + LOOP_WAKEUP_GRACE_MS)
    expect(h.supervisor.snapshots()).toHaveLength(0)
    await h.supervisor.dispose()
  })

  it('keeps a process that holds a schedule when an idle metadata request times out', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 600_000
    const query = await startLoop(h, scheduledFor)
    query.supportedCommands.mockImplementation(() => new Promise<never>(() => {}))

    const refresh = h.supervisor.supportedCommands(h.agent).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(CLAUDE_METADATA_TIMEOUT_MS + 1_000)
    expect(await refresh).toBeInstanceOf(Error)
    expect(h.supervisor.snapshots()).toHaveLength(1)
    expect(h.warnings.some(warning => warning.includes('holds a schedule'))).toBe(true)
    await h.supervisor.dispose()
  })

  it('still discards an idle process with nothing scheduled when a metadata request times out', async () => {
    const h = harness()
    const stream = await h.supervisor.runTurn({ agent: h.agent, prompt: 'hello', model: 'default' })
    const query = h.queries[0]!
    query.push(init())
    query.push(result('hi', { user_message_uuid: query.sent[0]?.uuid }))
    await drain(stream)
    query.supportedCommands.mockImplementation(() => new Promise<never>(() => {}))

    const refresh = h.supervisor.supportedCommands(h.agent).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(CLAUDE_METADATA_TIMEOUT_MS + 1_000)
    await refresh
    expect(h.supervisor.snapshots()).toHaveLength(0)
    await h.supervisor.dispose()
  })

  it('does not fire anything itself when the CLI wakes up on time', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 120_000
    const query = await startLoop(h, scheduledFor)
    await vi.advanceTimersByTimeAsync(120_000)
    const followup = await fireWakeup(h, query, scheduledFor)
    const stream = await h.answer(followup)
    query.push(result('CI is green.'))
    await drain(stream)
    await vi.advanceTimersByTimeAsync(10 * LOOP_WAKEUP_GRACE_MS)
    expect(h.followups).toHaveLength(1)
    await h.supervisor.dispose()
  })

  it('restarts the loop with the typed /loop command when the process holding the wakeup died', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 120_000
    const query = await startLoop(h, scheduledFor, '/loop check CI', 'keep checking CI')
    query.close()
    await vi.advanceTimersByTimeAsync(100)
    expect(h.supervisor.snapshots()).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(120_000 + LOOP_WAKEUP_GRACE_MS)
    expect(h.followups.map(followup => followup.text)).toEqual(['/loop check CI'])
    await h.supervisor.dispose()
  })

  it('does not bring a loop back after the user stops it', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 120_000
    const query = await startLoop(h, scheduledFor)
    const controller = new AbortController()
    const stream = await h.supervisor.runTurn({ agent: h.agent, prompt: 'look at this', model: 'default', signal: controller.signal })
    controller.abort()
    await drain(stream).catch(() => undefined)
    await vi.waitFor(() => { expect(query.interrupt).toHaveBeenCalled() })

    await vi.advanceTimersByTimeAsync(120_000 + 2 * LOOP_WAKEUP_GRACE_MS)
    expect(h.followups).toEqual([])
    await h.supervisor.dispose()
  })

  it('does not restart a finished loop when a later, unrelated wakeup is lost', async () => {
    const h = harness()
    // A /loop that ends without scheduling anything.
    const first = await h.supervisor.runTurn({ agent: h.agent, prompt: '/loop check CI', model: 'default' })
    const query = h.queries[0]!
    query.push(init())
    query.push(result('Nothing to watch.', { user_message_uuid: query.sent[0]?.uuid }))
    await drain(first)

    // Later the model arms a sentinel wakeup, and its process dies.
    const scheduledFor = Date.now() + 120_000
    const later = await h.supervisor.runTurn({ agent: h.agent, prompt: 'keep an eye on it', model: 'default' })
    for (const message of scheduleWakeup('tool-wake-2', scheduledFor, '<<autonomous-loop-dynamic>>')) query.push(message)
    query.push(result('Watching.', { user_message_uuid: query.sent[1]?.uuid }))
    await drain(later)
    query.close()
    await vi.advanceTimersByTimeAsync(120_000 + 2 * LOOP_WAKEUP_GRACE_MS)

    expect(h.followups).toEqual([])
    expect(h.warnings.some(warning => warning.includes('no /loop command is known'))).toBe(true)
    await h.supervisor.dispose()
  })

  it('forgets the schedule when the session is disposed', async () => {
    const h = harness()
    const scheduledFor = Date.now() + 120_000
    await startLoop(h, scheduledFor)
    await h.supervisor.disposeSession('loop-session')
    await vi.advanceTimersByTimeAsync(120_000 + 2 * LOOP_WAKEUP_GRACE_MS)
    expect(h.followups).toEqual([])
    await h.supervisor.dispose()
  })

  it('restarts a loop cut short by a usage limit once the reported quota resets', async () => {
    const h = harness()
    const stream = await h.supervisor.runTurn({ agent: h.agent, prompt: '/loop check CI', model: 'default' })
    const query = h.queries[0]!
    const resetsAt = Math.floor(Date.now() / 1_000) + 3_600
    query.push(init())
    query.push(rejected(resetsAt))
    query.push(result("You've hit your limit", { is_error: true, user_message_uuid: query.sent[0]?.uuid }))
    await drain(stream).catch(() => undefined)

    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(h.followups).toEqual([])
    await vi.advanceTimersByTimeAsync(61_000)
    expect(h.followups.map(followup => followup.text)).toEqual(['/loop check CI'])
    await h.supervisor.dispose()
  })

  it('does not restart a loop that finished on its own even though a limit was reported', async () => {
    const h = harness()
    const stream = await h.supervisor.runTurn({ agent: h.agent, prompt: '/loop check CI', model: 'default' })
    const query = h.queries[0]!
    query.push(init())
    query.push(rejected(Math.floor(Date.now() / 1_000) + 3_600))
    query.push(result('All done; ending the loop.', { user_message_uuid: query.sent[0]?.uuid }))
    await drain(stream)
    await vi.advanceTimersByTimeAsync(2 * 3_600_000)
    expect(h.followups).toEqual([])
    await h.supervisor.dispose()
  })

  it('does not treat assistant prose about rate limits as a usage limit', async () => {
    const h = harness()
    const stream = await h.supervisor.runTurn({ agent: h.agent, prompt: '/loop check CI', model: 'default' })
    const query = h.queries[0]!
    query.push(init())
    query.push(result('The API returned 429 Too Many Requests; rate limit exceeded, retry in 5 minutes.', { user_message_uuid: query.sent[0]?.uuid }))
    await drain(stream)
    await vi.advanceTimersByTimeAsync(24 * 3_600_000)
    expect(h.followups).toEqual([])
    await h.supervisor.dispose()
  })

  it('records a wakeup scheduled by a turn no DSH turn draws, and protects that process', async () => {
    const h = harness(1_000)
    const scheduledFor = Date.now() + 120_000
    const query = await startLoop(h, scheduledFor)
    await fireWakeup(h, query, scheduledFor)
    // Nobody answers the follow-up; the CLI runs the turn anyway and reschedules.
    await vi.advanceTimersByTimeAsync(121_000)
    const next = Date.now() + 600_000
    for (const message of scheduleWakeup('tool-wake-3', next)) query.push(message)
    query.push(result('Checked; again in 10 minutes.'))
    await vi.advanceTimersByTimeAsync(300_000)
    expect(h.supervisor.snapshots()).toHaveLength(1)
    await h.supervisor.dispose()
  })
})
