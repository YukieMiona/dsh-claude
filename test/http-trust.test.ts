import type { IncomingMessage } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { trustedRequest } from '../src/http.ts'

function request(remoteAddress: string | undefined, headers: Record<string, string>): IncomingMessage {
  return { socket: { remoteAddress }, headers } as unknown as IncomingMessage
}

/** A Host connection service whose verdict is fixed: `undefined` admits,
 *  a status code rejects. */
function service(verdict: number | undefined | (() => never)) {
  const requestRejection = vi.fn((_req: IncomingMessage) => typeof verdict === 'function' ? verdict() : verdict)
  return { connection: { requestRejection } }
}

const loopback = (headers: Record<string, string>) => request('127.0.0.1', headers)
const rebinding = () => loopback({ host: 'rebinding.example', origin: 'http://rebinding.example' })

describe('trustedRequest without a connection service', () => {
  it('accepts a loopback, same-origin request to a loopback authority', () => {
    expect(trustedRequest(loopback({ host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' }))).toBe(true)
    expect(trustedRequest(request('::1', { host: '[::1]:5173', origin: 'http://[::1]:5173' }))).toBe(true)
    expect(trustedRequest(request('::ffff:127.0.0.1', { host: 'localhost:5173' }))).toBe(true)
    expect(trustedRequest(loopback({ host: 'localhost:5173', 'sec-fetch-site': 'same-origin' }), {})).toBe(true)
  })

  it('rejects DNS rebinding: a non-loopback authority from a loopback socket', () => {
    expect(trustedRequest(rebinding())).toBe(false)
    expect(trustedRequest(loopback({ host: 'rebinding.example' }))).toBe(false)
    // A loopback Host with a foreign Origin is cross-origin.
    expect(trustedRequest(loopback({ host: 'localhost:5173', origin: 'http://rebinding.example' }))).toBe(false)
  })

  it('rejects a non-loopback socket even with a loopback authority', () => {
    expect(trustedRequest(request('192.0.2.10', { host: 'localhost:5173', origin: 'http://localhost:5173' }))).toBe(false)
    expect(trustedRequest(request(undefined, { host: 'localhost:5173' }))).toBe(false)
  })

  it('rejects cross-site and Host-less requests', () => {
    expect(trustedRequest(loopback({
      host: 'localhost:5173',
      origin: 'http://localhost:5173',
      'sec-fetch-site': 'cross-site',
    }))).toBe(false)
    expect(trustedRequest(loopback({}))).toBe(false)
    expect(trustedRequest(loopback({ host: 'localhost:5173', origin: 'not a url' }))).toBe(false)
  })
})

describe('trustedRequest with a connection service', () => {
  it('accepts whatever the service admits, even a non-loopback host', () => {
    const ctx = service(undefined)
    const req = request('203.0.113.7', { host: 'dsh.example.com', origin: 'https://dsh.example.com' })
    expect(trustedRequest(req, ctx)).toBe(true)
    expect(ctx.connection.requestRejection).toHaveBeenCalledWith(req)
  })

  it('reaches the service through ctx.get when property access throws, as cordis does without inject', () => {
    const requestRejection = vi.fn(() => undefined)
    const ctx = {
      get connection(): never { throw new Error('cannot get property "connection" without inject') },
      get: (name: string) => (name === 'connection' ? { requestRejection } : undefined),
    }
    const remote = { socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'dsh.example.top', origin: 'https://dsh.example.top' } }
    expect(trustedRequest(remote as never, ctx)).toBe(true)
    expect(requestRejection).toHaveBeenCalledOnce()
  })

  it('reads the service through ctx.get when there is no ctx.connection', () => {
    const conn = service(undefined).connection
    const get = vi.fn((name: string) => name === 'connection' ? conn : undefined)
    expect(trustedRequest(request('203.0.113.7', { host: 'dsh.example.com' }), { get })).toBe(true)
    expect(get).toHaveBeenCalledWith('connection')
  })

  it('still rejects DNS rebinding when the service rejects it', () => {
    for (const status of [401, 403]) {
      const ctx = service(status)
      expect(trustedRequest(rebinding(), ctx)).toBe(false)
      expect(ctx.connection.requestRejection).toHaveBeenCalledOnce()
    }
  })

  it('falls back to the loopback check when the service rejects a local request', () => {
    // The Desktop renderer without a `dsh-auth-*` cookie: 401 from the service,
    // but plainly local, so the route must not answer 403.
    const req = loopback({ host: 'localhost:5173', origin: 'http://localhost:5173' })
    expect(trustedRequest(req, service(401))).toBe(true)
    expect(trustedRequest(request('203.0.113.7', { host: 'localhost:5173' }), service(401))).toBe(false)
  })

  it('treats a throwing service as not admitting and falls back to the loopback check', () => {
    const boom = () => { throw new Error('connection service unavailable') }
    expect(trustedRequest(loopback({ host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' }), service(boom))).toBe(true)
    expect(trustedRequest(rebinding(), service(boom))).toBe(false)
    expect(trustedRequest(request('203.0.113.7', { host: 'dsh.example.com' }), service(boom))).toBe(false)
    const throwingGet = { get: () => { throw new Error('not injected') } }
    expect(trustedRequest(loopback({ host: 'localhost' }), throwingGet)).toBe(true)
    expect(trustedRequest(rebinding(), throwingGet)).toBe(false)
  })

  it('rejects cross-site requests the service does not admit', () => {
    const req = loopback({ host: 'localhost:5173', origin: 'http://localhost:5173', 'sec-fetch-site': 'cross-site' })
    expect(trustedRequest(req, service(403))).toBe(false)
  })
})

describe('trustedRequest with a Host 0.2.3+ connection service (admit)', () => {
  const remote = () => request('203.0.113.7', { host: 'dsh.example.com', origin: 'https://dsh.example.com' })

  it('accepts a request admit() returns a Peer for', () => {
    const admit = vi.fn((_req: IncomingMessage) => ({ peer: {} }))
    const req = remote()
    expect(trustedRequest(req, { connection: { admit } })).toBe(true)
    expect(admit).toHaveBeenCalledWith(req)
  })

  it('rejects a non-loopback request admit() rejects', () => {
    const admit = vi.fn(() => ({ rejection: 403 }))
    expect(trustedRequest(remote(), { connection: { admit } })).toBe(false)
  })

  it('prefers admit() over requestRejection() when a Host offers both', () => {
    const admit = vi.fn(() => ({ rejection: 401 }))
    const requestRejection = vi.fn(() => undefined)
    expect(trustedRequest(remote(), { connection: { admit, requestRejection } })).toBe(false)
    expect(requestRejection).not.toHaveBeenCalled()
  })
})

/** The route wrapper on Host 0.2.3+, which passes the Peer it admitted as the
 *  handler's third argument, against a real `node:http` server. */
describe('registerPluginRoute with a Host-admitted Peer', () => {
  async function statusFor(peer: unknown): Promise<number> {
    const { createServer, request } = await import('node:http')
    const { registerPluginRoute } = await import('../src/http.ts')
    const server = createServer()
    const context = {
      effect: (register: () => unknown) => { register() },
      webServer: {
        register: (route: { handler: (req: never, res: never, peer?: unknown) => Promise<void> }) => {
          server.on('request', (req, res) => { void route.handler(req as never, res as never, peer) })
          return () => {}
        },
      },
      logger: { warn: () => {} },
    }
    registerPluginRoute(context as never, {
      mode: 'unary',
      kind: 'exact',
      path: '/plugins/dsh-claude/test',
      methods: ['GET'],
      budget: 'fast',
      handler: async () => ({ status: 200, value: { ok: true } }),
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address !== null ? address.port : 0
    try {
      // A non-loopback authority: the plugin's own check refuses it.
      return await new Promise<number>((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port, path: '/plugins/dsh-claude/test', headers: { host: 'dsh.example' } }, res => {
          res.resume()
          resolve(res.statusCode ?? 0)
        })
        req.on('error', reject)
        req.end()
      })
    } finally {
      await new Promise<void>(resolve => { server.close(() => resolve()) })
    }
  }

  it('serves a request the Host passed a Peer for', async () => {
    expect(await statusFor({ principal: { kind: 'owner' } })).toBe(200)
  })

  it('applies its own check when the Host passed no Peer', async () => {
    expect(await statusFor(undefined)).toBe(403)
  })
})
