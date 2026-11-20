import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { ServerResponse } from 'node:http'
import { CLAUDE_HISTORY_PATH, CLAUDE_PROJECTION_PATH } from './constants.ts'
import { registerPluginRoute, type PluginRouteIo } from './http.ts'
import { MAX_MULTIPLEX_SESSIONS } from './plugin-budget.ts'
import type { ClaudeSidecarProjection, ClaudeSidecarRepository } from './sidecar.ts'
import type { ClaudeActivityEvent } from './events.ts'
import type { ClaudeCommandView } from './command-bridge.ts'
import type { RepositoryStatus } from './repository-status.ts'
import type { ReviewComment } from './review-comments.ts'
import type { ClaudePermissionModeView, ClaudePermissionSelector } from './permission-mode.ts'
import type { ClaudeLoopView } from './loop-schedule.ts'

const MAX_SESSION_ID_CHARS = 1_024
/** Slow-moving metadata refresh and stream heartbeat cadence; deliberately off
 *  the transcript hot path so git/gh latency never delays visible text. */
const META_REFRESH_MS = 5_000
/** The multiplexed carrier's path segment. Session ids are `session-<uuid>`,
 *  so this cannot collide with one. */
const MULTI_SEGMENT = 'multi'
/** Sessions whose last probed metadata is kept for a later carrier. */
const MAX_REMEMBERED_SESSIONS = 64

/** How many pages may hold a carrier at once; past it the oldest is closed. */
export const MAX_PROJECTION_CARRIERS = 8
let anonymousCarriers = 0

/** The identity a carrier is admitted under: the page's own, when it gives one. */
export function carrierKey(url: URL): string {
  const client = url.searchParams.get('client') ?? ''
  if (/^[A-Za-z0-9_-]{8,64}$/u.test(client)) return `${MULTI_SEGMENT}:${client}`
  // A page that predates the parameter: never share a key, or the eviction returns.
  anonymousCarriers += 1
  return `${MULTI_SEGMENT}:anonymous-${anonymousCarriers}`
}

type ProjectionTarget =
  | { readonly kind: 'snapshot'; readonly sessionId: string }
  | { readonly kind: 'multi'; readonly sessionIds: readonly string[] }

function validSessionId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_SESSION_ID_CHARS
}

function targetFromUrl(url: URL): ProjectionTarget | undefined {
  const prefix = `${CLAUDE_PROJECTION_PATH}/`
  if (!url.pathname.startsWith(prefix)) return undefined
  const encoded = url.pathname.slice(prefix.length)
  if (encoded.length === 0 || encoded.includes('/')) return undefined
  if (encoded === MULTI_SEGMENT) {
    const raw = url.searchParams.get('sessions')
    if (raw === null) return undefined
    const sessionIds = [...new Set(raw.split(',').filter(id => id.length > 0))]
    if (sessionIds.length === 0 || sessionIds.length > MAX_MULTIPLEX_SESSIONS) return undefined
    if (!sessionIds.every(validSessionId)) return undefined
    return { kind: 'multi', sessionIds }
  }
  try {
    const sessionId = decodeURIComponent(encoded)
    return validSessionId(sessionId) ? { kind: 'snapshot', sessionId } : undefined
  } catch {
    return undefined
  }
}

interface ProjectionMeta {
  readonly owned: boolean
  readonly commands: readonly ClaudeCommandView[]
  readonly repository?: RepositoryStatus
  /** Other checkouts the session wrote into; see touched-repositories.ts. */
  readonly repositories?: readonly RepositoryStatus[]
  readonly reviewComments: readonly ReviewComment[]
  /** The Claude permission mode and whether a turn holds it; see permission-mode.ts. */
  readonly permissionMode?: ClaudePermissionModeView
  /** Which access control Claude sessions draw; absent for sessions this plugin does not own. */
  readonly permissionSelector?: ClaudePermissionSelector
  /** What Claude Code has scheduled for this session (/loop wakeups, crons). */
  readonly loop?: ClaudeLoopView
}

/** A carrier's snapshot carries this many of the newest turns in full. */
export const PROJECTION_RECENT_TURNS = 4
/** A history this short is sent whole: trimming it would save nothing worth a second request. */
export const PROJECTION_WHOLE_BELOW = 600
/** Roughly how many activities one history request answers with. */
export const PROJECTION_HISTORY_CHUNK = 800

type Activities = ClaudeSidecarProjection['activities']

const WIRE_TASK_LABEL_CHARS = 400

/** Task records as they travel: one progress line per task, short labels and
 *  no raw SDK frame. New records are stored this way already; this gives the
 *  same weight to the history written before that. */
export function wireActivities(activities: Activities): Activities {
  const lastProgress = new Map<string, number>()
  activities.forEach((activity, index) => {
    if (activity.kind === 'subagent' && activity.phase === 'updated' && activity.taskId !== undefined) {
      lastProgress.set(`${activity.turn}:${activity.step}:${activity.taskId}`, index)
    }
  })
  const cap = (value: string | undefined): string | undefined => value !== undefined && value.length > WIRE_TASK_LABEL_CHARS
    ? `${value.slice(0, WIRE_TASK_LABEL_CHARS)}…`
    : value
  const out: Activities[number][] = []
  activities.forEach((activity, index) => {
    // Task lifecycle records only: a tool call a subagent made keeps its
    // arguments and its result keeps its output, which are what its row shows.
    if (activity.kind !== 'subagent' || activity.toolName !== undefined || activity.parentToolUseId !== undefined) {
      out.push(activity)
      return
    }
    if (activity.phase === 'updated' && activity.taskId !== undefined
      && lastProgress.get(`${activity.turn}:${activity.step}:${activity.taskId}`) !== index) return
    const { detail: _detail, title, summary, ...rest } = activity
    const shortTitle = cap(title)
    const shortSummary = cap(summary)
    out.push({
      ...rest,
      ...(shortTitle === undefined ? {} : { title: shortTitle }),
      ...(shortSummary === undefined ? {} : { summary: shortSummary }),
    })
  })
  return out
}

/** The newest turns of a history, and the turn older activity sits before.
 *
 *  A long session's whole history measured 5 MB, sent again on every
 *  reconnect; a phone never finished loading it and showed neither new
 *  messages nor the git bar. The page needs the recent turns to paint, and
 *  fetches the rest in pieces afterwards. */
export function recentActivities(activities: Activities): { activities: Activities; historyBefore?: number } {
  if (activities.length <= PROJECTION_WHOLE_BELOW) return { activities }
  const turns = [...new Set(activities.map(activity => activity.turn))].sort((left, right) => left - right)
  if (turns.length <= PROJECTION_RECENT_TURNS) return { activities }
  const cutoff = turns[turns.length - PROJECTION_RECENT_TURNS] as number
  return { activities: wireActivities(activities.filter(activity => activity.turn >= cutoff)), historyBefore: cutoff }
}

/** One piece of older history: the newest whole turns before `before`. */
export function historyChunk(activities: Activities, before: number): { activities: Activities; historyBefore?: number } {
  const older = activities.filter(activity => activity.turn < before)
  const turns = [...new Set(older.map(activity => activity.turn))].sort((left, right) => right - left)
  let from = before
  let count = 0
  for (const turn of turns) {
    const size = older.reduce((total, activity) => total + (activity.turn === turn ? 1 : 0), 0)
    if (count > 0 && count + size > PROJECTION_HISTORY_CHUNK) break
    from = turn
    count += size
  }
  const chunk = older.filter(activity => activity.turn >= from)
  return { activities: wireActivities(chunk), ...(older.length > chunk.length ? { historyBefore: from } : {}) }
}

function envelope(projection: ClaudeSidecarProjection, meta: ProjectionMeta, scope: 'whole' | 'recent' = 'whole'): Record<string, unknown> {
  const shown = scope === 'recent' ? recentActivities(projection.activities) : { activities: projection.activities }
  return {
    schemaVersion: projection.schemaVersion,
    revision: projection.revision,
    owned: meta.owned,
    commands: meta.commands,
    activities: shown.activities,
    ...(shown.historyBefore === undefined ? {} : { historyBefore: shown.historyBefore }),
    ...(projection.tasks === undefined ? {} : { tasks: projection.tasks }),
    ...(projection.promptSuggestion === undefined ? {} : { promptSuggestion: projection.promptSuggestion }),
    ...(meta.repository === undefined ? {} : { repository: meta.repository }),
    ...(meta.repositories === undefined ? {} : { repositories: meta.repositories }),
    reviewComments: meta.reviewComments,
    ...(meta.permissionMode === undefined ? {} : { permissionMode: meta.permissionMode }),
    ...(meta.permissionSelector === undefined ? {} : { permissionSelector: meta.permissionSelector }),
    ...(meta.loop === undefined ? {} : { loop: meta.loop }),
    // Ranges only: the chain anchors behind a rewind are Claude transcript
    // identities and stay on this side of the boundary.
    ...(projection.rewind === undefined ? {} : { rewind: { ranges: projection.rewind.ranges } }),
  }
}

/** Register the browser-readable, credential-free sidecar projection endpoint.
 *
 *  `GET <path>/:sessionId` returns one snapshot. `GET <path>/multi?sessions=a,b`
 *  returns ONE NDJSON stream carrying every listed session, each line stamped
 *  with its `session`.
 *
 *  There is deliberately no per-session stream URL. The browser shares a small
 *  fixed connection budget between this plugin and the Host, and a stream per
 *  session spent it in proportion to how many Claude sessions existed — which
 *  is what left the settings panel unable to get a connection at all. One
 *  carrier is one connection, whatever the session count. */
export function registerClaudeProjectionRoute(
  ctx: Context,
  sidecar: ClaudeSidecarRepository,
  ownsSession: (sessionId: string) => boolean,
  commandsForSession: (sessionId: string) => readonly ClaudeCommandView[] = () => [],
  repositoryForSession: (sessionId: string) => Promise<RepositoryStatus | undefined> = async () => undefined,
  reviewCommentsForSession: (sessionId: string) => readonly ReviewComment[] = () => [],
  extraRepositoriesForSession: (sessionId: string, activities: readonly ClaudeActivityEvent[]) => Promise<readonly RepositoryStatus[]> = async () => [],
  permissionModeForSession: (sessionId: string) => Promise<ClaudePermissionModeView | undefined> = async () => undefined,
  /** Read from memory: it is on the first snapshot line, so the composer never draws the wrong selector. */
  permissionSelector: () => ClaudePermissionSelector = () => 'plugin',
  /** Calls back once a session's preset switch has settled, so ownership
   *  reaches the composer now rather than on the next sweep. */
  presetSettled: (listener: (sessionId: string) => void) => () => void = () => () => undefined,
  /** Read from memory, so it rides the first snapshot line and every sweep. */
  loopForSession: (sessionId: string) => ClaudeLoopView | undefined = () => undefined,
): void {
  const info = (message: string): void => {
    ctx.logger?.info?.(message)
  }

  /** Everything the host already knows, without touching the repository. */
  const localMeta = (sessionId: string): ProjectionMeta => {
    const owned = ownsSession(sessionId)
    const loop = owned ? loopForSession(sessionId) : undefined
    return {
      owned,
      commands: commandsForSession(sessionId),
      reviewComments: owned ? reviewCommentsForSession(sessionId) : [],
      ...(owned ? { permissionSelector: permissionSelector() } : {}),
      ...(loop === undefined ? {} : { loop }),
    }
  }

  /** The last probed metadata per session, kept across carriers.
   *
   *  A carrier's first line for a session is a snapshot written before the
   *  repository probe returns. Sent with only what the host knows locally, it
   *  told the Client "no repository, no permission mode" on every reconnect,
   *  and the composer dropped its git bar and mode until the probe's meta line
   *  landed a moment later. The probe's last answer is the better first guess;
   *  the probe that follows still corrects it. */
  const lastProbed = new Map<string, ProjectionMeta>()
  const rememberProbed = (sessionId: string, meta: ProjectionMeta): void => {
    lastProbed.delete(sessionId)
    if (!meta.owned) return
    lastProbed.set(sessionId, meta)
    // Insertion-ordered: the coldest session goes first.
    if (lastProbed.size > MAX_REMEMBERED_SESSIONS) lastProbed.delete(lastProbed.keys().next().value as string)
  }
  /** Local metadata, carrying the probed fields from the last answer. */
  const firstMeta = (sessionId: string): ProjectionMeta => {
    const meta = localMeta(sessionId)
    const known = lastProbed.get(sessionId)
    if (!meta.owned || known === undefined) return meta
    return {
      ...meta,
      ...(known.repository === undefined ? {} : { repository: known.repository }),
      ...(known.repositories === undefined ? {} : { repositories: known.repositories }),
      ...(known.permissionMode === undefined ? {} : { permissionMode: known.permissionMode }),
    }
  }

  const assembleMeta = async (
    sessionId: string,
    activities?: readonly ClaudeActivityEvent[],
    /** Called once the session's own repository and mode are known, before
     *  the other checkouts are. Those cost a git chain and a network call
     *  each; measured at 34 s for nine, during which a session that was
     *  otherwise ready showed no git bar at all. */
    onOwn?: (meta: ProjectionMeta) => void,
  ): Promise<ProjectionMeta> => {
    const meta = localMeta(sessionId)
    if (!meta.owned) {
      lastProbed.delete(sessionId)
      return meta
    }
    const others = extraRepositoriesForSession(sessionId, activities ?? (await sidecar.read(sessionId)).activities)
    // Attached now, so a failure here is never an unhandled rejection while the own probe is awaited.
    others.catch(() => undefined)
    const [repository, permissionMode] = await Promise.all([
      repositoryForSession(sessionId),
      permissionModeForSession(sessionId),
    ])
    if (onOwn !== undefined) {
      const known = lastProbed.get(sessionId)?.repositories
      onOwn({
        ...meta,
        ...(repository === undefined ? {} : { repository }),
        ...(known === undefined ? {} : { repositories: known }),
        ...(permissionMode === undefined ? {} : { permissionMode }),
      })
    }
    const repositories = await others
    const probed = {
      ...meta,
      ...(repository === undefined ? {} : { repository }),
      ...(repositories.length === 0 ? {} : { repositories }),
      ...(permissionMode === undefined ? {} : { permissionMode }),
    }
    rememberProbed(sessionId, probed)
    return probed
  }

  const streamMulti = async (res: ServerResponse, io: PluginRouteIo, sessionIds: readonly string[]): Promise<void> => {
    info(`dsh-claude: projection stream opened for ${sessionIds.length} session(s)`)
    let textDeltas = 0
    let textBytes = 0
    let textSince = Date.now()
    // Headers first, before any await. One session whose repository probe is
    // slow must not delay every other session's first paint — and until the
    // headers are out the client cannot even tell the carrier is alive.
    // `no-transform` keeps a compressing proxy from buffering the sole carrier.
    res.writeHead(200, {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-content-type-options': 'nosniff',
    })
    res.flushHeaders?.()
    let closed = false
    const writeLine = (value: unknown): void => {
      if (closed) return
      try {
        res.write(`${JSON.stringify(value)}\n`)
      } catch {
        closed = true
      }
    }
    const metas = new Map<string, ProjectionMeta>()
    const writeMeta = (sessionId: string, meta: ProjectionMeta): void => {
      metas.set(sessionId, meta)
      writeLine({
        type: 'meta',
        session: sessionId,
        owned: meta.owned,
        commands: meta.commands,
        ...(meta.repository === undefined ? {} : { repository: meta.repository }),
        ...(meta.permissionMode === undefined ? {} : { permissionMode: meta.permissionMode }),
        ...(meta.permissionSelector === undefined ? {} : { permissionSelector: meta.permissionSelector }),
        ...(meta.repositories === undefined ? {} : { repositories: meta.repositories }),
        ...(meta.loop === undefined ? {} : { loop: meta.loop }),
        reviewComments: meta.reviewComments,
      })
    }
    const writeSnapshot = async (sessionId: string): Promise<void> => {
      const projection = await sidecar.read(sessionId)
      // The repository probe runs a chain of git commands and a `gh pr view`
      // over the network -- seconds, where the transcript is already in
      // memory. It rides a later meta line so the prose paints first.
      const meta = metas.get(sessionId) ?? firstMeta(sessionId)
      metas.set(sessionId, meta)
      // Where the notification stream stands as of this read, so the first
      // delta after this line has a number to be contiguous with.
      writeLine({ type: 'snapshot', session: sessionId, seq: sidecar.sequence(sessionId), ...envelope(projection, meta, 'recent') })
      const writeIfNew = (next: ProjectionMeta): void => {
        if (closed || JSON.stringify(next) === JSON.stringify(metas.get(sessionId))) return
        writeMeta(sessionId, next)
      }
      writeIfNew(await assembleMeta(sessionId, projection.activities, writeIfNew))
    }
    // Subscribe every lane synchronously, before the first await: a delta that
    // lands while the snapshots are still assembling belongs to this carrier.
    const unsubscribes = sessionIds.map(sessionId => sidecar.subscribe(sessionId, delta => {
      switch (delta.kind) {
        case 'text':
          textDeltas += 1
          textBytes += (delta.append ?? delta.text ?? '').length
          if (textDeltas % 25 === 0) {
            const elapsed = Date.now() - textSince
            info(`dsh-claude: stream 25 text deltas ${textBytes}B in ${elapsed}ms`)
            textBytes = 0
            textSince = Date.now()
          }
          writeLine({
            type: 'text',
            session: sessionId,
            turn: delta.turn,
            step: delta.step,
            ordinal: delta.ordinal,
            ...(delta.append === undefined ? {} : { append: delta.append }),
            ...(delta.text === undefined ? {} : { text: delta.text }),
            ...(delta.renderer === undefined ? {} : { renderer: delta.renderer }),
            ...(delta.answer === true ? { answer: true } : {}),
            seq: delta.seq,
          })
          return
        case 'activity':
          writeLine({ type: 'activity', session: sessionId, activity: delta.activity, seq: delta.seq })
          return
        case 'tasks':
          writeLine({ type: 'tasks', session: sessionId, value: delta.value, seq: delta.seq })
          return
        case 'promptSuggestion':
          writeLine({ type: 'promptSuggestion', session: sessionId, ...(delta.value === undefined ? {} : { value: delta.value }), seq: delta.seq })
          return
        case 'checkpoint':
          writeLine({ type: 'checkpoint', session: sessionId, seq: delta.seq })
          return
        case 'sync':
          void writeSnapshot(sessionId).catch(() => undefined)
      }
    }))
    const refreshMeta = async (sessionId: string): Promise<void> => {
      const next = await assembleMeta(sessionId)
      if (closed || JSON.stringify(next) === JSON.stringify(metas.get(sessionId))) return
      writeMeta(sessionId, next)
    }
    // A preset picked on the hero flips `owned`, which decides whose controls
    // the composer draws; waiting for the sweep left the Host's up for seconds.
    unsubscribes.push(presetSettled((sessionId) => {
      if (sessionIds.includes(sessionId)) void refreshMeta(sessionId).catch(() => undefined)
    }))
    // Per-session, in parallel: a wedged repository probe costs its own lane
    // its first paint, not everyone else's.
    for (const sessionId of sessionIds) {
      void writeSnapshot(sessionId).catch(() => undefined)
    }
    // One sweep at a time. Each lane's probe chains git commands and a network
    // `gh pr view`, and the interval has no idea how long the last one took --
    // so a tick that lands on a sweep still in flight starts a second set of
    // the same probes rather than waiting. At a lane or two that never showed;
    // at a full carrier it is sixteen serial probes per tick, arriving faster
    // than they drain. Skipping a tick costs at most one refresh of metadata
    // that is deliberately off the transcript's hot path.
    let sweeping = false
    const timer = setInterval(() => {
      // The heartbeat leads, and does not ride the sweep. It is the only thing
      // keeping bytes on a carrier between turns, and an idle connection the
      // far end reaps is the ending that costs the Client its transcript.
      writeLine({ type: 'ping' })
      if (sweeping) return
      sweeping = true
      void (async () => {
        for (const sessionId of sessionIds) {
          if (closed) return
          await refreshMeta(sessionId)
        }
      })().catch(() => undefined).finally(() => { sweeping = false })
    }, META_REFRESH_MS)
    timer.unref?.()
    // Teardown rides the wrapper's signal, which is armed before any await —
    // the previous hand-written `res.on('close')` was attached only after the
    // first metadata probe resolved, so a client that gave up during that
    // window left the interval and every subscription running for good.
    await new Promise<void>(resolve => {
      const finish = (): void => {
        if (closed) return
        closed = true
        clearInterval(timer)
        for (const unsubscribe of unsubscribes) unsubscribe()
        info(`dsh-claude: projection stream closed after ${textDeltas} text deltas`)
        resolve()
      }
      if (io.signal.aborted) finish()
      else io.signal.addEventListener('abort', finish, { once: true })
    })
  }

  registerPluginRoute(ctx, {
    mode: 'stream',
    kind: 'prefix',
    path: CLAUDE_PROJECTION_PATH,
    methods: ['GET'],
    // One carrier per page, not one in all. Under a single shared key two
    // pages (a second tab, a second device) closed each other's carrier in
    // turn: each reconnected two seconds later and was sent a whole snapshot
    // again, which measured about 480 MB an hour on an idle tablet. A page
    // names itself, so its own reconnect still supersedes its own old carrier;
    // the cap keeps a teardown bug from becoming an unbounded leak.
    maxConcurrent: MAX_PROJECTION_CARRIERS,
    streamKey: carrierKey,
    handler: async (res, io) => {
      const target = targetFromUrl(io.url)
      if (target === undefined) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.write(JSON.stringify({ error: 'invalid session id' }))
        return
      }
      if (target.kind === 'multi') return await streamMulti(res, io, target.sessionIds)
      // A steady 2s cadence here means a stale (pre-streaming) client bundle.
      info(`dsh-claude: projection poll for ${target.sessionId.slice(0, 64)}`)
      try {
        const projection = await sidecar.read(target.sessionId)
        const body = envelope(projection, await assembleMeta(target.sessionId, projection.activities))
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        })
        res.write(JSON.stringify(body))
      } catch {
        if (res.headersSent) return
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.write(JSON.stringify({ error: 'projection unavailable' }))
      }
    },
  })

  // Older turns, a piece at a time: `GET <path>?session=<id>&before=<turn>`.
  registerPluginRoute(ctx, {
    mode: 'unary',
    kind: 'exact',
    path: CLAUDE_HISTORY_PATH,
    methods: ['GET'],
    budget: 'fast',
    handler: async io => {
      const sessionId = io.url.searchParams.get('session') ?? ''
      const before = Number(io.url.searchParams.get('before'))
      if (!validSessionId(sessionId) || !Number.isInteger(before) || before < 0) return { status: 400, value: { error: 'invalid-request' } }
      const projection = await sidecar.read(sessionId)
      return { status: 200, value: historyChunk(projection.activities, before) }
    },
  })
}
