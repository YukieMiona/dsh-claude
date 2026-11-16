import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import type { SpawnOptions } from '@anthropic-ai/claude-agent-sdk'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import {
  ManagedClaudeProcess,
  createManagedClaudeSpawner,
  scrubClaudeSpawnEnv,
  appendToolPaths,
  MACOS_TOOL_PATHS,
  toolPathEnv,
  hostSpawnEnv,
  HOST_GIT_CONFIG_GLOBAL,
  type HostSpawnProbe,
} from '../src/spawn.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fakeHandle() {
  const exit = deferred<{ exitCode: number | null; signal: NodeJS.Signals | null }>()
  const terminate = vi.fn()
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const handle: SubprocessHandle = {
    pid: 42,
    stdin,
    stdout,
    stderr: undefined,
    collected: { stderr: { readFrom: () => ({ text: 'tail', nextOffset: 4, lossy: false }) } },
    done: exit.promise,
    terminate,
    waitForExit: async () => true,
  }
  return { handle, exit, terminate }
}

describe('managed Claude process', () => {
  it('maps DSH completion into SDK exit events', async () => {
    const fake = fakeHandle()
    const process = new ManagedClaudeProcess(fake.handle)
    const exited = new Promise(resolve => process.once('exit', (code, signal) => resolve({ code, signal })))
    fake.exit.resolve({ exitCode: 0, signal: null })
    await expect(exited).resolves.toEqual({ code: 0, signal: null })
    expect(process.exitCode).toBe(0)
    expect(process.stderrTail()).toBe('tail')
  })

  it('uses DSH tree termination for SDK kill', () => {
    const fake = fakeHandle()
    const process = new ManagedClaudeProcess(fake.handle)
    expect(process.kill('SIGKILL')).toBe(true)
    expect(process.killed).toBe(true)
    expect(fake.terminate).toHaveBeenCalledOnce()
  })
})

describe('managed spawner', () => {
  // The repo owner's root VPS: forge git config present, running as root.
  const rootHost: HostSpawnProbe = { exists: path => path === HOST_GIT_CONFIG_GLOBAL, uid: 0 }
  const userHost: HostSpawnProbe = { exists: () => false, uid: 501 }

  function capture(probe: HostSpawnProbe) {
    const fake = fakeHandle()
    const captured: { spec?: SubprocessSpawnSpec } = {}
    const spawn = createManagedClaudeSpawner(
      { spawn: value => { captured.spec = value; return fake.handle } },
      '/local/claude',
      undefined,
      probe,
    )
    return { spawn, captured }
  }

  function spawnOptions(env: Record<string, string>): SpawnOptions {
    return { command: '/local/claude', args: [], cwd: '/workspace', env, signal: new AbortController().signal }
  }

  it('passes exact argv and removes credential-shaped environment', () => {
    const { spawn, captured } = capture(rootHost)
    const options: SpawnOptions = {
      command: '/local/claude',
      args: ['--sdk-url', 'stdio'],
      cwd: '/workspace',
      env: {
        HOME: '/Users/test',
        ANTHROPIC_API_KEY: 'secret',
        GITHUB_TOKEN: 'secret-two',
        AUTHORIZATION: 'Bearer secret-three',
        COOKIE: 'session=secret-four',
        DATABASE_URL: 'postgres://user:pass@host/db',
        CLAUDE_AGENT_SDK_CLIENT_APP: 'dsh-claude/0.1.0',
        DSH_SESSION_ID: 'private-host-context',
      },
      signal: new AbortController().signal,
    }
    spawn(options)
    const spec = captured.spec
    expect(spec?.argv).toEqual(['/local/claude', '--sdk-url', 'stdio'])
    expect(spec?.cwd).toBe('/workspace')
    expect(spec?.env).toEqual({
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
      CLAUDE_CODE_ENABLE_TODO_TOOLS: '1',
      HOME: '/Users/test',
      USER: process.env.USER || 'root',
      GIT_CONFIG_GLOBAL: HOST_GIT_CONFIG_GLOBAL,
      CLAUDE_AGENT_SDK_CLIENT_APP: 'dsh-claude/0.1.0',
      IS_SANDBOX: '1',
    })
  })

  it('sets the forge git config and IS_SANDBOX on a root host where the config exists', () => {
    const { spawn, captured } = capture(rootHost)
    spawn(spawnOptions({ IS_SANDBOX: '0' }))
    expect(captured.spec?.env).toMatchObject({ GIT_CONFIG_GLOBAL: HOST_GIT_CONFIG_GLOBAL, IS_SANDBOX: '1' })
  })

  it('sets neither for a non-root user without the forge config', () => {
    const { spawn, captured } = capture(userHost)
    spawn(spawnOptions({ HOME: '/home/me', USER: 'me' }))
    expect(captured.spec?.env).not.toHaveProperty('GIT_CONFIG_GLOBAL')
    expect(captured.spec?.env).not.toHaveProperty('IS_SANDBOX')
    expect(captured.spec?.env).toMatchObject({ HOME: '/home/me', USER: 'me' })
  })

  it('keeps a caller-provided GIT_CONFIG_GLOBAL', () => {
    const { spawn, captured } = capture(rootHost)
    spawn(spawnOptions({ GIT_CONFIG_GLOBAL: '/home/me/.gitconfig-work' }))
    expect(captured.spec?.env?.GIT_CONFIG_GLOBAL).toBe('/home/me/.gitconfig-work')
  })

  it('decides host-only variables from the injected probes', () => {
    const exists = vi.fn(() => true)
    expect(hostSpawnEnv({ exists, uid: 0 })).toEqual({ GIT_CONFIG_GLOBAL: HOST_GIT_CONFIG_GLOBAL, IS_SANDBOX: '1' })
    expect(exists).toHaveBeenCalledWith(HOST_GIT_CONFIG_GLOBAL)
    expect(hostSpawnEnv({ exists: () => false, uid: 0 })).toEqual({ IS_SANDBOX: '1' })
    expect(hostSpawnEnv({ exists: () => true, uid: 1000 })).toEqual({ GIT_CONFIG_GLOBAL: HOST_GIT_CONFIG_GLOBAL })
    // No uid at all (Windows) is not root.
    expect(hostSpawnEnv({ exists: () => false, uid: undefined })).toEqual({})
    // A caller's own value is never replaced, and the file is not even probed.
    const untouched = vi.fn(() => true)
    expect(hostSpawnEnv({ exists: untouched, uid: 1000 }, { GIT_CONFIG_GLOBAL: '/x' })).toEqual({})
    expect(untouched).not.toHaveBeenCalled()
  })

  it('rejects an SDK request to spawn a different executable', () => {
    const fake = fakeHandle()
    const spawn = createManagedClaudeSpawner({ spawn: () => fake.handle }, '/local/claude')
    expect(() => spawn({
      command: '/tmp/not-claude',
      args: [],
      env: {},
      signal: new AbortController().signal,
    })).toThrow(/unexpected executable/)
  })

  it('scrubs environment keys case-insensitively', () => {
    expect(scrubClaudeSpawnEnv({ password: 'x', Dsh_fact: 'x', PATH: '/bin' })).toEqual({ PATH: '/bin' })
  })

  it('appends the macOS tool directories a Dock-launched app never inherits', () => {
    const exists = (dir: string) => dir === '/opt/homebrew/bin'
    expect(appendToolPaths({ PATH: '/usr/bin:/bin' }, 'darwin', exists)).toEqual({ PATH: '/usr/bin:/bin:/opt/homebrew/bin' })
    // The user's own order wins, and a directory already there is not repeated.
    expect(appendToolPaths({ PATH: '/opt/homebrew/bin:/usr/bin' }, 'darwin', exists)).toEqual({ PATH: '/opt/homebrew/bin:/usr/bin' })
    expect(appendToolPaths({ PATH: '/usr/bin' }, 'linux', () => true)).toEqual({ PATH: '/usr/bin' })
    expect(appendToolPaths({}, 'darwin', () => true)).toEqual({})
    expect(MACOS_TOOL_PATHS[0]).toBe('/opt/homebrew/bin')
  })

  it('hands executable lookup a PATH even when the Host has none', () => {
    expect(toolPathEnv({}).PATH).toContain('/usr/bin')
    expect(toolPathEnv({ PATH: '/x' }).PATH?.startsWith('/x')).toBe(true)
  })
})
