import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SCHEDULED_SEND_MAX_PER_SESSION, SCHEDULED_SEND_STALE_MS, ScheduledSendStore, type ScheduledSendDelivery } from '../src/scheduled-sends.ts'

const roots: string[] = []
const stores: ScheduledSendStore[] = []
afterEach(async () => {
  await Promise.all(stores.splice(0).map(store => store.flushed()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function harness(live = true) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-claude-sends-'))
  roots.push(root)
  const file = join(root, 'nested', 'scheduled-sends.json')
  const state = { now: 1_000_000, live }
  const delivered: Array<{ sessionId: string; text: string }> = []
  const make = () => {
    const store = new ScheduledSendStore({
      file,
      now: () => state.now,
      deliver: (sessionId, text): ScheduledSendDelivery => {
        if (!state.live) return 'unavailable'
        delivered.push({ sessionId, text })
        return 'sent'
      },
    })
    stores.push(store)
    return store
  }
  return { file, state, delivered, make, store: make() }
}

describe('scheduled sends', () => {
  it('sends a message once when it is due and forgets it', async () => {
    const h = await harness()
    h.store.add('s1', '  run the tests  ', h.state.now + 60_000)
    expect(h.store.tick()).toBe(0)
    h.state.now += 60_000
    expect(h.store.tick()).toBe(1)
    expect(h.delivered).toEqual([{ sessionId: 's1', text: 'run the tests' }])
    expect(h.store.list('s1')).toEqual([])
    expect(h.store.tick()).toBe(0)
  })

  it('keeps a repeating send and folds missed occurrences into one', async () => {
    const h = await harness()
    h.store.add('s1', 'status?', h.state.now + 60_000, 3_600_000)
    h.state.now += 60_000 + 3 * 3_600_000 + 5_000
    expect(h.store.tick()).toBe(1)
    expect(h.delivered).toHaveLength(1)
    const [next] = h.store.list('s1')
    expect(next?.at).toBe(1_000_000 + 60_000 + 4 * 3_600_000)
    expect(h.store.tick()).toBe(0)
  })

  it('holds a due message until the session has a live agent, and drops a one-off left too long', async () => {
    const h = await harness(false)
    h.store.add('s1', 'hello', h.state.now + 1_000)
    h.state.now += 2_000
    expect(h.store.tick()).toBe(0)
    expect(h.store.list('s1')).toMatchObject([{ text: 'hello', waiting: true }])
    h.state.live = true
    expect(h.store.tick()).toBe(1)
    expect(h.store.list('s1')).toEqual([])

    h.state.live = false
    h.store.add('s1', 'stale', h.state.now + 1_000)
    h.state.now += SCHEDULED_SEND_STALE_MS + 2_000
    h.store.tick()
    expect(h.store.list('s1')).toEqual([])
  })

  it('survives a restart, and cancels only within the owning session', async () => {
    const h = await harness()
    const kept = h.store.add('s1', 'later', h.state.now + 60_000)
    const other = h.store.add('s2', 'other', h.state.now + 60_000)
    if (typeof kept === 'string' || typeof other === 'string') throw new Error('add failed')
    await h.store.flushed()
    expect(JSON.parse(await readFile(h.file, 'utf8'))).toMatchObject({ version: 1, sends: [{ text: 'later' }, { text: 'other' }] })

    const restarted = h.make()
    await restarted.load()
    expect(restarted.list('s1')).toMatchObject([{ id: kept.id, text: 'later' }])
    expect(restarted.cancel('s1', other.id)).toBe(false)
    expect(restarted.cancel('s2', other.id)).toBe(true)
    expect(restarted.list('s2')).toEqual([])
  })

  it('refuses empty text, far-off times, too-short repeats and a full session', async () => {
    const h = await harness()
    expect(h.store.add('s1', '   ', h.state.now)).toBe('invalid')
    expect(h.store.add('s1', 'x', h.state.now + 400 * 24 * 3_600_000)).toBe('invalid')
    expect(h.store.add('s1', 'x', h.state.now, 1_000)).toBe('invalid')
    for (let index = 0; index < SCHEDULED_SEND_MAX_PER_SESSION; index += 1) expect(typeof h.store.add('s1', `m${index}`, h.state.now + 60_000)).toBe('object')
    expect(h.store.add('s1', 'one more', h.state.now + 60_000)).toBe('full')
    expect(typeof h.store.add('s2', 'elsewhere', h.state.now + 60_000)).toBe('object')
  })

  it('treats a damaged file as empty', async () => {
    const h = await harness()
    h.store.add('s1', 'x', h.state.now + 60_000)
    await h.store.flushed()
    await writeFile(h.file, '{ not json')
    const restarted = h.make()
    await restarted.load()
    expect(restarted.list('s1')).toEqual([])
  })
})
