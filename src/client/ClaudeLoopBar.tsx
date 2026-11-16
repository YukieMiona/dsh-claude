import { useEffect, useState } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ClaudeLoopView } from '../loop-schedule.ts'
import type { ClaudeCodeSettingsKey } from './locales.ts'
import * as styles from './styles.ts'

type Translate = (key: ClaudeCodeSettingsKey, values?: Record<string, string | number>) => string

/** Sent to Claude when the user stops the loop. Claude Code's scheduler has no
 *  control request for it: only its own tools can cancel what they scheduled,
 *  and a killed process gets its jobs back when the session resumes. */
export const STOP_LOOP_PROMPT = [
  'Stop the loop now.',
  'Cancel everything scheduled in this session: call CronList and CronDelete for each job it returns, and if a /loop wakeup is pending call ScheduleWakeup with stop: true.',
  'Then confirm in one short line. Do not start any other work.',
].join(' ')

export interface LoopItem {
  key: string
  label: string
  /** Epoch ms of the next fire, when known. */
  at?: number
  /** Exact (a wakeup) or estimated from the cron expression (a job). */
  exact: boolean
  /** The prompt to submit for "Run now"; absent when only Claude Code can expand it. */
  prompt?: string
  cadence?: string
}

/** Everything scheduled, soonest first; items with no known time go last. */
export function loopItems(loop: ClaudeLoopView, t: Translate): LoopItem[] {
  const items: LoopItem[] = []
  if (loop.wakeup !== undefined) {
    items.push({
      key: 'wakeup',
      label: loop.wakeup.prompt ?? loop.wakeup.reason ?? t('loopWakeup'),
      at: loop.wakeup.at,
      exact: true,
      ...(loop.wakeup.prompt === undefined ? {} : { prompt: loop.wakeup.prompt }),
    })
  }
  for (const job of loop.jobs) {
    const cadence = job.human ?? job.schedule
    items.push({
      key: job.id,
      label: job.prompt,
      exact: false,
      prompt: job.prompt,
      ...(job.nextAt === undefined ? {} : { at: job.nextAt }),
      ...(cadence === undefined ? {} : { cadence }),
    })
  }
  return items.sort((left, right) => (left.at ?? Infinity) - (right.at ?? Infinity))
}

/** `2:05`, or `1:02:05` past the hour. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1_000))
  const hours = Math.floor(total / 3_600)
  const minutes = Math.floor((total % 3_600) / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

export function loopTiming(item: LoopItem, now: number, t: Translate): string | undefined {
  if (item.at === undefined) return item.cadence
  const remaining = item.at - now
  // A job's time is an estimate, and a due wakeup waits for a running turn to end.
  if (remaining <= 0) return t('loopDue')
  return t(item.exact ? 'loopNextIn' : 'loopNextAbout', { time: countdown(remaining) })
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

function LoopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 8a5 5 0 0 1-8.6 3.5M3 8a5 5 0 0 1 8.6-3.5" />
      <path d="M11.5 2v2.7H8.8M4.5 14v-2.7h2.7" />
    </svg>
  )
}

/** The composer's loop indicator: what is scheduled, when it next fires, and
 *  the two things a user wants to do about it. */
export function ClaudeLoopBar({ loop, running, t, submitPrompt }: {
  loop: ClaudeLoopView | undefined
  running: boolean
  t: Translate
  submitPrompt?: (draft: string, mode?: 'append' | 'idle') => boolean
}) {
  const items = loop === undefined ? [] : loopItems(loop, t)
  const now = useNow(items.some(item => item.at !== undefined))
  const first = items[0]
  if (first === undefined) return null
  const timing = loopTiming(first, now, t)
  const others = items.slice(1)
  const all = items.map(item => [item.label, loopTiming(item, now, t)].filter(Boolean).join(' · ')).join('\n')
  return (
    <div style={styles.loopBar} data-dsh-claude-loop-bar="">
      <span style={styles.loopBarIcon}><LoopIcon /></span>
      <span style={styles.loopBarTitle}>{t('loopBarLabel')}</span>
      <Tooltip label={all} side="top" delayMs={250} maxWidth={420}>
        <span style={styles.loopBarLabel}>{first.label}</span>
      </Tooltip>
      {others.length === 0 ? null : <span style={styles.loopBarMore}>{t('loopMore', { count: others.length })}</span>}
      {timing === undefined ? null : <span style={styles.loopBarTiming} aria-live="off">{timing}</span>}
      {submitPrompt === undefined ? null : (
        <span style={styles.loopBarActions}>
          {first.prompt === undefined ? null : (
            <button type="button" style={styles.loopBarButton} disabled={running} onClick={() => { submitPrompt(first.prompt as string, 'idle') }}>{t('loopRunNow')}</button>
          )}
          <button type="button" style={styles.loopBarButton} onClick={() => { submitPrompt(STOP_LOOP_PROMPT) }}>{t('loopStop')}</button>
        </span>
      )}
    </div>
  )
}
