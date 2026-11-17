import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { CLAUDE_SCHEDULED_SEND_PATH } from './constants.ts'
import { registerPluginRoute, type PluginRouteIo } from './http.ts'

/** A message the user asked to have sent to a session later.
 *
 *  Claude Code's own scheduler lives inside one CLI process and is set up by
 *  asking the model. This one belongs to the Host: it is kept on disk, so it
 *  survives a restart, and it sends the user's words as an ordinary message. */
export interface ScheduledSend {
  id: string
  sessionId: string
  text: string
  /** Epoch ms of the next send. */
  at: number
  /** Present on a repeating send: the gap between sends. */
  repeatMs?: number
  createdAt: number
}

export interface ScheduledSendView {
  id: string
  text: string
  at: number
  repeatMs?: number
  /** Due, but the session has no live agent yet; sent as soon as it has one. */
  waiting?: boolean
}

export const SCHEDULED_SEND_MAX_TEXT_CHARS = 8_000
export const SCHEDULED_SEND_MAX_PER_SESSION = 20
export const SCHEDULED_SEND_MIN_REPEAT_MS = 60_000
export const SCHEDULED_SEND_MAX_REPEAT_MS = 7 * 24 * 3_600_000
export const SCHEDULED_SEND_MAX_AHEAD_MS = 60 * 24 * 3_600_000
/** A one-off send nobody could deliver for this long is dropped, not sent stale. */
export const SCHEDULED_SEND_STALE_MS = 7 * 24 * 3_600_000
const TICK_MS = 5_000
const MAX_BODY_BYTES = 64 * 1024
const MAX_SESSION_ID_CHARS = 1_024

export type ScheduledSendDelivery = 'sent' | 'unavailable'

export interface ScheduledSendStoreOptions {
  /** The JSON file the pending sends are kept in. */
  file: string
  /** Hand one message to the session. `unavailable` keeps it for a later tick. */
  deliver: (sessionId: string, text: string) => ScheduledSendDelivery
  now?: () => number
  logger?: { warn: (message: string) => void }
}

function validSend(value: unknown): value is ScheduledSend {
  if (value === null || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.sessionId === 'string' && typeof item.text === 'string'
    && typeof item.at === 'number' && Number.isFinite(item.at)
    && typeof item.createdAt === 'number'
    && (item.repeatMs === undefined || (typeof item.repeatMs === 'number' && item.repeatMs >= SCHEDULED_SEND_MIN_REPEAT_MS))
}

export class ScheduledSendStore {
  readonly #file: string
  readonly #deliver: ScheduledSendStoreOptions['deliver']
  readonly #now: () => number
  readonly #logger: ScheduledSendStoreOptions['logger']
  #sends: ScheduledSend[] = []
  #waiting = new Set<string>()
  #timer: ReturnType<typeof setInterval> | undefined
  #writes: Promise<void> = Promise.resolve()

  constructor(options: ScheduledSendStoreOptions) {
    this.#file = options.file
    this.#deliver = options.deliver
    this.#now = options.now ?? Date.now
    this.#logger = options.logger
  }

  /** Read what an earlier run left on disk. A missing or damaged file is an empty list. */
  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.#file, 'utf8')) as unknown
      const list = (parsed as { sends?: unknown } | null)?.sends
      this.#sends = Array.isArray(list) ? list.filter(validSend) : []
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.#logger?.warn(`dsh-claude: scheduled sends could not be read: ${error instanceof Error ? error.message : String(error)}`)
      }
      this.#sends = []
    }
  }

  start(): void {
    if (this.#timer !== undefined) return
    this.#timer = setInterval(() => { this.tick() }, TICK_MS)
    this.#timer.unref?.()
  }

  async dispose(): Promise<void> {
    if (this.#timer !== undefined) clearInterval(this.#timer)
    this.#timer = undefined
    await this.#writes
  }

  list(sessionId: string): ScheduledSendView[] {
    return this.#sends
      .filter(item => item.sessionId === sessionId)
      .sort((left, right) => left.at - right.at)
      .map(item => ({
        id: item.id,
        text: item.text,
        at: item.at,
        ...(item.repeatMs === undefined ? {} : { repeatMs: item.repeatMs }),
        ...(this.#waiting.has(item.id) ? { waiting: true } : {}),
      }))
  }

  /** Whether anything is pending for the session. */
  has(sessionId: string): boolean {
    return this.#sends.some(item => item.sessionId === sessionId)
  }

  add(sessionId: string, text: string, at: number, repeatMs?: number): ScheduledSend | 'invalid' | 'full' {
    const now = this.#now()
    const trimmed = text.trim()
    if (trimmed.length === 0 || trimmed.length > SCHEDULED_SEND_MAX_TEXT_CHARS) return 'invalid'
    if (!Number.isFinite(at) || at > now + SCHEDULED_SEND_MAX_AHEAD_MS) return 'invalid'
    if (repeatMs !== undefined && (!Number.isFinite(repeatMs) || repeatMs < SCHEDULED_SEND_MIN_REPEAT_MS || repeatMs > SCHEDULED_SEND_MAX_REPEAT_MS)) return 'invalid'
    if (this.#sends.filter(item => item.sessionId === sessionId).length >= SCHEDULED_SEND_MAX_PER_SESSION) return 'full'
    const send: ScheduledSend = {
      id: randomUUID(),
      sessionId,
      text: trimmed,
      // A time already past means "now": the next tick sends it.
      at: Math.max(at, now),
      ...(repeatMs === undefined ? {} : { repeatMs: Math.round(repeatMs) }),
      createdAt: now,
    }
    this.#sends.push(send)
    this.#persist()
    return send
  }

  cancel(sessionId: string, id: string): boolean {
    const before = this.#sends.length
    this.#sends = this.#sends.filter(item => !(item.sessionId === sessionId && item.id === id))
    this.#waiting.delete(id)
    if (this.#sends.length === before) return false
    this.#persist()
    return true
  }

  /** Send everything that is due. Returns how many messages went out. */
  tick(): number {
    const now = this.#now()
    let sent = 0
    let changed = false
    for (const send of [...this.#sends]) {
      if (send.at > now) continue
      let outcome: ScheduledSendDelivery
      try {
        outcome = this.#deliver(send.sessionId, send.text)
      } catch (error) {
        this.#logger?.warn(`dsh-claude: scheduled send ${send.id} failed: ${error instanceof Error ? error.message : String(error)}`)
        outcome = 'unavailable'
      }
      if (outcome === 'unavailable') {
        if (send.repeatMs === undefined && now - send.at > SCHEDULED_SEND_STALE_MS) {
          this.#sends = this.#sends.filter(item => item !== send)
          this.#waiting.delete(send.id)
          changed = true
        } else {
          this.#waiting.add(send.id)
        }
        continue
      }
      sent += 1
      changed = true
      this.#waiting.delete(send.id)
      if (send.repeatMs === undefined) {
        this.#sends = this.#sends.filter(item => item !== send)
      } else {
        // Missed occurrences collapse into the one just sent.
        const missed = Math.floor((now - send.at) / send.repeatMs) + 1
        send.at += missed * send.repeatMs
      }
    }
    if (changed) this.#persist()
    return sent
  }

  #persist(): void {
    const body = JSON.stringify({ version: 1, sends: this.#sends }, null, 2)
    this.#writes = this.#writes.then(async () => {
      try {
        await mkdir(dirname(this.#file), { recursive: true })
        const temporary = `${this.#file}.${process.pid}.tmp`
        await writeFile(temporary, body, { mode: 0o600 })
        await rename(temporary, this.#file)
      } catch (error) {
        this.#logger?.warn(`dsh-claude: scheduled sends could not be saved: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
  }

  /** Test seam: resolves once every pending write has landed. */
  flushed(): Promise<void> {
    return this.#writes
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

async function readJson(io: PluginRouteIo): Promise<Record<string, unknown> | undefined> {
  try {
    return record(await io.body<unknown>(MAX_BODY_BYTES))
  } catch (error) {
    if (error instanceof SyntaxError) throw error
    return undefined
  }
}

/** `POST <path>` with `{ sessionId, action: 'add', text, at, repeatMs? }` or
 *  `{ sessionId, action: 'cancel', id }`. Either answers the session's list. */
export function registerScheduledSendRoute(
  ctx: Context,
  store: ScheduledSendStore,
  ownsSession: (sessionId: string) => boolean,
): void {
  registerPluginRoute(ctx, {
    mode: 'unary',
    kind: 'exact',
    path: CLAUDE_SCHEDULED_SEND_PATH,
    methods: ['POST'],
    budget: 'fast',
    handler: async io => {
      try {
        const input = await readJson(io)
        const sessionId = input?.sessionId
        if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > MAX_SESSION_ID_CHARS) {
          return { status: 400, value: { error: 'invalid-request' } }
        }
        if (!ownsSession(sessionId)) return { status: 409, value: { error: 'session-unavailable' } }
        if (input?.action === 'cancel') {
          if (typeof input.id !== 'string') return { status: 400, value: { error: 'invalid-request' } }
          store.cancel(sessionId, input.id)
          return { status: 200, value: { sends: store.list(sessionId) } }
        }
        if (input?.action === 'add') {
          if (typeof input.text !== 'string' || typeof input.at !== 'number' || (input.repeatMs !== undefined && typeof input.repeatMs !== 'number')) {
            return { status: 400, value: { error: 'invalid-request' } }
          }
          const added = store.add(sessionId, input.text, input.at, input.repeatMs as number | undefined)
          if (added === 'invalid') return { status: 400, value: { error: 'invalid-request' } }
          if (added === 'full') return { status: 409, value: { error: 'too-many' } }
          return { status: 200, value: { sends: store.list(sessionId) } }
        }
        return { status: 400, value: { error: 'invalid-request' } }
      } catch (error) {
        if (error instanceof SyntaxError) return { status: 400, value: { error: 'invalid-json' } }
        throw error
      }
    },
  })
}
