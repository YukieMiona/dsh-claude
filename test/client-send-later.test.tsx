import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClaudeSendLater, SendLaterChip, delayLabel, localDateTime, repeatLabel, sendTiming } from '../src/client/ClaudeSendLater.tsx'
import { en, type ClaudeCodeSettingsKey } from '../src/client/locales.ts'

const t = (key: ClaudeCodeSettingsKey, values: Record<string, string | number> = {}): string =>
  Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), en[key] as string)

describe('send later', () => {
  it('labels delays, repeats and timing', () => {
    expect(delayLabel(15, t)).toBe('15 min')
    expect(delayLabel(180, t)).toBe('3 h')
    expect(repeatLabel(undefined, t)).toBeUndefined()
    expect(repeatLabel(3_600_000, t)).toBe('Every hour')
    expect(repeatLabel(24 * 3_600_000, t)).toBe('Every day')
    expect(repeatLabel(15 * 60_000, t)).toBe('Every 15 min')
    expect(sendTiming({ id: 'a', text: 'x', at: 125_000 }, 0, t)).toBe('next in 2:05')
    expect(sendTiming({ id: 'a', text: 'x', at: 125_000, repeatMs: 3_600_000 }, 0, t)).toBe('Every hour · next in 2:05')
    expect(sendTiming({ id: 'a', text: 'x', at: 1, waiting: true }, 5_000, t)).toBe('waiting for the session to open')
    expect(localDateTime(new Date(2026, 10, 17, 9, 5).getTime())).toBe('2026-11-17T09:05')
  })

  it('lists pending messages with a cancel each, above the form', () => {
    const markup = renderToStaticMarkup(<ClaudeSendLater sessionId="s1" sends={[{ id: 'a', text: 'run the tests', at: Date.now() + 60_000 }]} t={t} onChange={() => undefined} />)
    expect(markup).toContain('run the tests')
    expect(markup).toContain('Cancel')
    expect(markup).toContain('Message to send later')
    expect(markup).toContain('Schedule')
    expect(markup.indexOf('run the tests')).toBeLessThan(markup.indexOf('data-dsh-claude-send-later=""'))
  })

  it('draws a chip only while something is pending', () => {
    expect(renderToStaticMarkup(<SendLaterChip sends={[]} t={t} />)).toBe('')
    expect(renderToStaticMarkup(<SendLaterChip sends={[{ id: 'a', text: 'x', at: Date.now() + 65_000 }]} t={t} />)).toContain('data-dsh-claude-send-later-chip')
  })
})
