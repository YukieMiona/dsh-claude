import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { ClaudeSupervisor } from '../src/supervisor.ts'
import { AsyncQueue } from '../src/async-queue.ts'
import type { Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk'

class FakeQuery extends AsyncQueue<SDKMessage> {
  readonly initializationResult = vi.fn(async () => ({
    commands: [],
    agents: [],
    output_style: 'default',
    available_output_styles: [],
    models: [],
    account: {},
  }))
  readonly supportedCommands = vi.fn(async () => [])
}

function fakeAgent(id = 'session-123') {
  const followups: unknown[] = []
  const events = [
    { type: 'turn/start', data: { turn: 1 }, seq: 0, time: 1 },
    { type: 'step/start', data: { turn: 1, step: 1 }, seq: 1, time: 2 },
  ]
  return {
    id,
    session: {
      header: { cwd: '/workspace' },
      snapshotEvents: () => Object.freeze([...events]),
      append: async (type: string, data: unknown) => {
        const ev = { type, data, seq: events.length, time: Date.now() }
        events.push(ev)
        return ev
      },
    },
    followup: vi.fn((msg: unknown) => { followups.push(msg) }),
    followups,
  } as unknown as Agent & { followups: unknown[] }
}

describe('Claude Code Cron & Wakeup Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps active cron timer alive across process disconnect/dispose and wakes via resolveAgent', async () => {
    const agent = fakeAgent('session-test-cron')
    let currentQuery: FakeQuery | undefined

    const supervisor = new ClaudeSupervisor({
      runtime: { spawn: () => { throw new Error('fake query must not spawn') } },
      approval: { request: async () => 'rejected' },
      userQuestions: { ask: async () => ({ answers: [] }) },
      config: {
        executablePath: '/local/claude',
        idleTimeoutMs: 60_000,
        maxProcesses: 4,
        defaultModel: 'default',
        renderMode: 'plugin',
      },
      resolveAgent: id => (id === agent.id ? agent : undefined),
      queryFactory: () => {
        currentQuery = new FakeQuery()
        return currentQuery as unknown as Query
      },
    })

    const stream = await supervisor.runTurn({
      agent,
      model: 'default',
      userPrompt: 'test prompt',
      signal: new AbortController().signal,
    })

    // Simulate system/init
    currentQuery!.push({
      type: 'system',
      subtype: 'init',
      session_id: 'claude-sess-1',
      claude_code_version: '2.1.318',
      cwd: '/workspace',
    } as SDKMessage)

    // Simulate tool_use: CronCreate (6m = 360000ms)
    currentQuery!.push({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'toolu_cron',
          name: 'CronCreate',
          input: { cron: '*/6 * * * *', prompt: 'Continue', recurring: true },
        }],
      },
    } as SDKMessage)

    // Complete the turn
    currentQuery!.push({
      type: 'result',
      subtype: 'success',
      session_id: 'claude-sess-1',
      result: 'Scheduled loop',
      total_cost_usd: 0.01,
      usage: { input_tokens: 10, output_tokens: 5 },
    } as SDKMessage)

    for await (const _ of stream) { /* drain */ }

    // End process stream (simulate process disposal / restart)
    currentQuery!.close()
    await vi.advanceTimersByTimeAsync(100)

    // Now advance timer by 6 minutes (360,000ms)
    await vi.advanceTimersByTimeAsync(360_000)

    // Verify agent.followup was called even though the previous process was disposed!
    expect(agent.followup).toHaveBeenCalledTimes(1)
    expect(agent.followups[0]).toMatchObject({
      content: [{ type: 'text', text: 'Continue' }],
    })

    // Advance another 6 minutes (recurring = true)
    await vi.advanceTimersByTimeAsync(360_000)
    expect(agent.followup).toHaveBeenCalledTimes(2)

    await supervisor.dispose()
  })
})
