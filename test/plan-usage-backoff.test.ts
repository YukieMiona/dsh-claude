import { describe, expect, it } from 'vitest'
import { findRateLimitResetDelayMs, type PlanUsageReport } from '../src/plan-usage.ts'

describe('findRateLimitResetDelayMs', () => {
  const baseTime = new Date('2026-11-11T10:00:00.000Z').getTime()

  it('calculates delay from plan usage windows with 100% capacity', () => {
    const report: PlanUsageReport = {
      available: true,
      subscription: 'pro',
      windows: [
        { id: 'five_hour', utilization: 100, resetsAt: '2026-11-11T12:30:00.000Z' },
        { id: 'seven_day', utilization: 40, resetsAt: '2026-11-18T10:00:00.000Z' },
      ],
      fetchedAt: baseTime,
    }
    // 2.5 hours = 2.5 * 3600 * 1000 = 9_000_000 + 30_000 buffer
    const delay = findRateLimitResetDelayMs(report, undefined, baseTime)
    expect(delay).toBe(9_030_000)
  })

  it('parses relative reset delay from rate limit text', () => {
    const text = "You've hit your 5-hour limit for Claude. Your limit will reset in 2 hours and 15 minutes."
    const delay = findRateLimitResetDelayMs(undefined, text, baseTime)
    // 2 hours 15 mins + 30s buffer = (2 * 3600 + 15 * 60 + 30) * 1000 = 8_130_000 ms
    expect(delay).toBe(8_130_000)
  })

  it('parses clock time from rate limit text', () => {
    const now = new Date()
    const futureHour = (now.getHours() + 2) % 24
    const text = `You've hit your 5-hour limit for Claude. Retry after ${String(futureHour).padStart(2, '0')}:00.`
    const delay = findRateLimitResetDelayMs(undefined, text, now.getTime())
    expect(delay).toBeDefined()
    // Delay should be approximately 2 hours (+- 60s for minute boundaries + buffer)
    expect(delay!).toBeGreaterThan(60_000)
    expect(delay!).toBeLessThan(25 * 3_600_000)
  })

  it('falls back to 30 minutes when limit text carries no specific time', () => {
    const text = "You've hit your 5-hour limit for Claude. Please wait until your quota resets."
    const delay = findRateLimitResetDelayMs(undefined, text, baseTime)
    expect(delay).toBe(1_800_000)
  })

  it('returns undefined when there is no rate limit', () => {
    expect(findRateLimitResetDelayMs(undefined, 'Operation completed successfully.')).toBeUndefined()
  })
})
