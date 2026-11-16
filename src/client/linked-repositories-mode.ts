import { useEffect, useState } from 'react'
import {
  DEFAULT_CLAUDE_LINKED_REPOSITORIES_MODE,
  isClaudeLinkedRepositoriesMode,
  type ClaudeLinkedRepositoriesMode,
} from '../constants.ts'
import type { GlobalSettingView } from './ClaudeCodeSettings.tsx'

let currentMode: ClaudeLinkedRepositoriesMode = DEFAULT_CLAUDE_LINKED_REPOSITORIES_MODE
const listeners = new Set<(mode: ClaudeLinkedRepositoriesMode) => void>()

export function currentLinkedRepositoriesMode(): ClaudeLinkedRepositoriesMode {
  return currentMode
}

export function linkedRepositoriesModeOf(settings: readonly GlobalSettingView[]): ClaudeLinkedRepositoriesMode {
  const value = settings.find(setting => setting.key === 'linkedRepositories')?.value
  return isClaudeLinkedRepositoriesMode(value) ? value : DEFAULT_CLAUDE_LINKED_REPOSITORIES_MODE
}

export function applyLinkedRepositoriesMode(next: ClaudeLinkedRepositoriesMode): void {
  if (currentMode === next) return
  currentMode = next
  for (const listener of listeners) listener(currentMode)
}

export function subscribeLinkedRepositoriesMode(listener: (mode: ClaudeLinkedRepositoriesMode) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useLinkedRepositoriesMode(): ClaudeLinkedRepositoriesMode {
  const [mode, setMode] = useState<ClaudeLinkedRepositoriesMode>(currentMode)
  useEffect(() => subscribeLinkedRepositoriesMode(setMode), [])
  return mode
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 640 || window.innerHeight <= 600
  })

  useEffect(() => {
    // Some embedded webviews (and jsdom) have no matchMedia; the initial
    // viewport read above is then the whole answer.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 640px), (max-height: 600px)')
    const handler = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }
    setIsMobile(mq.matches)
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    const legacyMq = mq as { addListener?: (cb: (e: MediaQueryListEvent) => void) => void; removeListener?: (cb: (e: MediaQueryListEvent) => void) => void }
    legacyMq.addListener?.(handler)
    return () => legacyMq.removeListener?.(handler)
  }, [])

  return isMobile
}
