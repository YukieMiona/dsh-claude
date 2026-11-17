import { useEffect, useState } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { CLAUDE_SCHEDULED_SEND_PATH } from '../constants.ts'
import type { ClaudeLoopView } from '../loop-schedule.ts'
import { countdown } from './ClaudeLoopBar.tsx'
import type { ClaudeCodeSettingsKey } from './locales.ts'
import { pluginWrite } from './plugin-transport.ts'
import * as styles from './styles.ts'

type Translate = (key: ClaudeCodeSettingsKey, values?: Record<string, string | number>) => string
export type ScheduledSendItem = NonNullable<ClaudeLoopView['sends']>[number]

const MINUTE = 60_000
/** Delay choices, in minutes; `custom` opens a date and time field. */
export const SEND_LATER_DELAYS = [5, 15, 30, 60, 180, 480] as const
export const SEND_LATER_REPEATS = [0, 60, 24 * 60] as const

function parseSends(value: unknown): ScheduledSendItem[] | undefined {
  const list = (value as { sends?: unknown } | undefined)?.sends
  if (!Array.isArray(list)) return undefined
  return list.filter((item): item is ScheduledSendItem => item !== null && typeof item === 'object'
    && typeof (item as ScheduledSendItem).id === 'string' && typeof (item as ScheduledSendItem).text === 'string' && typeof (item as ScheduledSendItem).at === 'number')
}

export async function scheduleSend(sessionId: string, text: string, at: number, repeatMs?: number): Promise<ScheduledSendItem[]> {
  const answer = await pluginWrite<unknown>(CLAUDE_SCHEDULED_SEND_PATH, 'fast', undefined, {
    json: { sessionId, action: 'add', text, at, ...(repeatMs === undefined ? {} : { repeatMs }) },
  })
  return parseSends(answer) ?? []
}

export async function cancelScheduledSend(sessionId: string, id: string): Promise<ScheduledSendItem[]> {
  return parseSends(await pluginWrite<unknown>(CLAUDE_SCHEDULED_SEND_PATH, 'fast', undefined, { json: { sessionId, action: 'cancel', id } })) ?? []
}

export function delayLabel(minutes: number, t: Translate): string {
  return minutes % 60 === 0 ? t('sendLaterHours', { count: minutes / 60 }) : t('sendLaterMinutes', { count: minutes })
}

export function repeatLabel(repeatMs: number | undefined, t: Translate): string | undefined {
  if (repeatMs === undefined) return undefined
  const minutes = Math.round(repeatMs / MINUTE)
  if (minutes === 24 * 60) return t('sendLaterDaily')
  if (minutes === 60) return t('sendLaterHourly')
  return t('sendLaterEvery', { time: delayLabel(minutes, t) })
}

export function sendTiming(item: ScheduledSendItem, now: number, t: Translate): string {
  const repeat = repeatLabel(item.repeatMs, t)
  const when = item.waiting === true ? t('sendLaterWaiting') : item.at <= now ? t('loopDue') : t('loopNextIn', { time: countdown(item.at - now) })
  return repeat === undefined ? when : `${repeat} · ${when}`
}

/** `2026-11-17T09:30`, in local time, for a `datetime-local` field. */
export function localDateTime(at: number): string {
  const date = new Date(at)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.2l2 1.3" />
    </svg>
  )
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => { setNow(Date.now()) }, 1_000)
    return () => { clearInterval(timer) }
  }, [active])
  return now
}

/** The soonest pending send as a chip for the dock's one line. */
export function SendLaterChip({ sends, t }: { sends: readonly ScheduledSendItem[] | undefined; t: Translate }) {
  const first = sends?.[0]
  const now = useNow(first !== undefined)
  if (first === undefined) return null
  return (
    <span style={styles.dockLoop} data-dsh-claude-send-later-chip="">
      <span style={styles.loopBarIcon}><ClockIcon /></span>
      <span style={styles.loopBarTiming}>{first.waiting === true || first.at <= now ? t('loopDue') : countdown(first.at - now)}</span>
    </span>
  )
}

/** Pending sends with a cancel each, and the form that adds one. */
export function ClaudeSendLater({ sessionId, sends, t, onChange }: {
  sessionId: string
  sends: readonly ScheduledSendItem[]
  t: Translate
  /** The Host's list after a change, ahead of the next projection sweep. */
  onChange: (sends: ScheduledSendItem[]) => void
}) {
  const now = useNow(sends.length > 0)
  const [text, setText] = useState('')
  const [delay, setDelay] = useState<string>(String(SEND_LATER_DELAYS[2]))
  const [custom, setCustom] = useState('')
  const [repeat, setRepeat] = useState<string>('0')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const at = delay === 'custom' ? (custom === '' ? Number.NaN : new Date(custom).getTime()) : Date.now() + Number(delay) * MINUTE
  const ready = text.trim().length > 0 && Number.isFinite(at) && !busy

  const run = (work: Promise<ScheduledSendItem[]>, done?: () => void): void => {
    setBusy(true)
    setFailed(false)
    work.then(next => { onChange(next); done?.() }, () => { setFailed(true) }).finally(() => { setBusy(false) })
  }
  const add = (): void => {
    if (!ready) return
    const repeatMinutes = Number(repeat)
    const when = delay === 'custom' ? at : Date.now() + Number(delay) * MINUTE
    run(scheduleSend(sessionId, text, when, repeatMinutes > 0 ? repeatMinutes * MINUTE : undefined), () => { setText('') })
  }

  return (
    <>
      {sends.map(item => (
        <div key={item.id} style={styles.loopBar} data-dsh-claude-send-later-item="">
          <span style={styles.loopBarIcon}><ClockIcon /></span>
          <Tooltip label={item.text} side="top" delayMs={250} maxWidth={420}>
            <span style={styles.loopBarLabel}>{item.text}</span>
          </Tooltip>
          <span style={styles.loopBarTiming} aria-live="off">{sendTiming(item, now, t)}</span>
          <span style={styles.loopBarActions}>
            <button type="button" style={styles.loopBarButton} disabled={busy} onClick={() => { run(cancelScheduledSend(sessionId, item.id)) }}>{t('sendLaterCancel')}</button>
          </span>
        </div>
      ))}
      <form style={styles.sendLaterForm} data-dsh-claude-send-later="" onSubmit={event => { event.preventDefault(); add() }}>
        <input
          type="text"
          style={styles.sendLaterInput}
          value={text}
          maxLength={8000}
          placeholder={t('sendLaterPlaceholder')}
          aria-label={t('sendLaterPlaceholder')}
          onChange={event => { setText(event.target.value) }}
        />
        <select style={styles.sendLaterSelect} value={delay} aria-label={t('sendLaterWhen')} onChange={event => {
          setDelay(event.target.value)
          if (event.target.value === 'custom' && custom === '') setCustom(localDateTime(Date.now() + 60 * MINUTE))
        }}>
          {SEND_LATER_DELAYS.map(minutes => <option key={minutes} value={String(minutes)}>{t('sendLaterIn', { time: delayLabel(minutes, t) })}</option>)}
          <option value="custom">{t('sendLaterCustom')}</option>
        </select>
        {delay !== 'custom' ? null : (
          <input type="datetime-local" style={styles.sendLaterSelect} value={custom} aria-label={t('sendLaterCustom')} onChange={event => { setCustom(event.target.value) }} />
        )}
        <select style={styles.sendLaterSelect} value={repeat} aria-label={t('sendLaterRepeat')} onChange={event => { setRepeat(event.target.value) }}>
          <option value="0">{t('sendLaterOnce')}</option>
          <option value="60">{t('sendLaterHourly')}</option>
          <option value={String(24 * 60)}>{t('sendLaterDaily')}</option>
        </select>
        <button type="submit" style={styles.loopBarButton} disabled={!ready}>{t('sendLaterAdd')}</button>
        {failed ? <span style={styles.repositoryItemError}>{t('sendLaterFailed')}</span> : null}
      </form>
    </>
  )
}
