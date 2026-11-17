import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CLEAR_GOAL_PROMPT, ClaudeGoalBar, GoalChip, goalTiming, ClaudeLoopBar, STOP_LOOP_PROMPT, countdown, loopItems, loopTiming } from '../src/client/ClaudeLoopBar.tsx'
import { en, type ClaudeCodeSettingsKey } from '../src/client/locales.ts'
import { loopView, nextCronMatch, type LoopSchedule } from '../src/loop-schedule.ts'
import { parseClaudeClientProjection } from '../src/client/projection.ts'

const t = (key: ClaudeCodeSettingsKey, values: Record<string, string | number> = {}): string =>
  Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), en[key] as string)

describe('loop view', () => {
  const at = (hour: number, minute: number): number => new Date(2026, 10, 16, hour, minute, 0, 0).getTime()

  it('finds the next minute a cron expression matches, in local time', () => {
    expect(nextCronMatch('*/3 * * * *', at(1, 28) + 11_000)).toBe(at(1, 30))
    expect(nextCronMatch('30 14 * * *', at(15, 0))).toBe(at(14, 30) + 24 * 3_600_000)
    expect(nextCronMatch('0 9 * * 1-5', at(1, 0))).toBe(at(9, 0))
    expect(nextCronMatch('not a cron', 0)).toBeUndefined()
  })

  it('carries a job\'s observed offset from its cron minute into the next estimate', () => {
    const schedule: LoopSchedule = {
      crons: new Map([['c1', { prompt: 'A test loop.', recurring: true, durable: false, expiresAt: at(23, 0), schedule: '*/3 * * * *', human: 'Every 3 minutes', lastFiredAt: at(1, 28) + 11_000 }]]),
    }
    expect(loopView(schedule, at(1, 29))).toEqual({
      jobs: [{ id: 'c1', prompt: 'A test loop.', recurring: true, schedule: '*/3 * * * *', human: 'Every 3 minutes', nextAt: at(1, 31) + 11_000 }],
    })
  })

  it('shows a pending wakeup without exposing a sentinel prompt, and nothing when nothing is scheduled', () => {
    expect(loopView({ crons: new Map(), wakeup: { scheduledFor: 5_000, prompt: '<<autonomous-loop-dynamic>>', reason: 'waiting on CI' } }, 0))
      .toEqual({ wakeup: { at: 5_000, reason: 'waiting on CI' }, jobs: [] })
    expect(loopView({ crons: new Map() }, 0)).toBeUndefined()
    expect(loopView(undefined)).toBeUndefined()
  })
})

describe('loop bar', () => {
  it('formats a countdown', () => {
    expect(countdown(151_000)).toBe('2:31')
    expect(countdown(3_725_000)).toBe('1:02:05')
    expect(countdown(-5)).toBe('0:00')
  })

  it('orders items soonest first and words exact and estimated times differently', () => {
    const items = loopItems({ wakeup: { at: 200_000, reason: 'waiting on CI' }, jobs: [{ id: 'c1', prompt: 'A test loop.', recurring: true, human: 'Every 3 minutes', nextAt: 90_000 }] }, t)
    expect(items.map(item => item.key)).toEqual(['c1', 'wakeup'])
    expect(loopTiming(items[0]!, 0, t)).toBe('next in about 1:30')
    expect(loopTiming(items[1]!, 0, t)).toBe('next in 3:20')
    expect(loopTiming(items[1]!, 300_000, t)).toBe('due now')
    // A sentinel wakeup has no prompt a user could run by hand.
    expect(items[1]!.prompt).toBeUndefined()
  })

  it('renders the next fire with run-now and stop controls, and nothing without a loop', () => {
    const submitPrompt = vi.fn(() => true)
    const markup = renderToStaticMarkup(<ClaudeLoopBar loop={{ jobs: [{ id: 'c1', prompt: 'A test loop.', recurring: true, human: 'Every 3 minutes' }] }} running={false} t={t} submitPrompt={submitPrompt} />)
    expect(markup).toContain('data-dsh-claude-loop-bar')
    expect(markup).toContain('A test loop.')
    expect(markup).toContain('Every 3 minutes')
    expect(markup).toContain('Run now')
    expect(markup).toContain('Stop loop')
    expect(renderToStaticMarkup(<ClaudeLoopBar loop={undefined} running={false} t={t} />)).toBe('')
    expect(STOP_LOOP_PROMPT).toContain('CronDelete')
  })

  it('accepts a loop on the projection and rejects a malformed one', () => {
    const base = { schemaVersion: 1, revision: 0, owned: true, commands: [], activities: [] }
    expect(parseClaudeClientProjection({ ...base, loop: { wakeup: { at: 1 }, jobs: [{ id: 'c1', prompt: 'p', recurring: true, nextAt: 2 }] } }).loop?.jobs).toHaveLength(1)
    expect(() => parseClaudeClientProjection({ ...base, loop: { jobs: [{ id: 'c1' }] } })).toThrow('invalid Claude loop projection')
  })
})

describe('goal indicator', () => {
  const goal = { condition: 'all tests pass', setAt: 1_000, rounds: 2 }

  it('shows the condition, the rounds and a way to clear it', () => {
    const markup = renderToStaticMarkup(<ClaudeGoalBar goal={goal} t={t} submitPrompt={() => true} />)
    expect(markup).toContain('all tests pass')
    expect(markup).toContain('Clear goal')
    expect(goalTiming(goal, 66_000, t)).toBe('2 rounds · running 1:05')
    expect(goalTiming({ ...goal, rounds: 0 }, 66_000, t)).toBe('running 1:05')
    expect(CLEAR_GOAL_PROMPT).toBe('/goal clear')
  })

  it('draws a chip on the dock line only while a goal is set', () => {
    expect(renderToStaticMarkup(<GoalChip loop={{ jobs: [], goal }} t={t} />)).toContain('Goal ×2')
    expect(renderToStaticMarkup(<GoalChip loop={{ jobs: [] }} t={t} />)).toBe('')
  })
})
