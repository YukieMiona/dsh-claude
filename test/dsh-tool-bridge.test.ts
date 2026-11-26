import { describe, expect, it, vi } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { bridgedDshTools, createDshToolBridge, mcpContent, type DshToolRegistry } from '../src/dsh-tool-bridge.ts'

const agent = { id: 'session-1' } as unknown as Agent

function registry(overrides: Partial<DshToolRegistry> = {}): DshToolRegistry & { execute: ReturnType<typeof vi.fn> } {
  return {
    schemas: () => [
      {
        name: 'sentinel_watch',
        description: 'Register a durable condition watch.',
        parameters: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['file', 'session'] },
            target: { type: 'string' },
            note: { type: 'string' },
          },
          required: ['kind', 'target', 'note'],
        },
      },
      { name: 'run_code', description: 'Run a program.', parameters: { type: 'object', properties: { code: { type: 'string' } } } },
    ],
    execute: vi.fn(async (input: { calls: readonly { id: string }[] }) => ({ results: [{ callId: input.calls[0]!.id, result: { isError: false, content: [{ type: 'text', text: 'watch-1 registered' }] } }] })),
    ...overrides,
  } as DshToolRegistry & { execute: ReturnType<typeof vi.fn> }
}

describe('DSH tool bridge', () => {
  it('offers only the named tools the session can see', () => {
    const tools = bridgedDshTools(registry(), () => agent, ['sentinel_watch', 'sentinel_list'])
    expect(tools.map(definition => definition.name)).toEqual(['sentinel_watch'])
    expect(Object.keys(tools[0]!.inputSchema)).toEqual(['kind', 'target', 'note'])
  })

  it("runs a call through the Host registry as the session's own agent", async () => {
    const host = registry()
    const [watch] = bridgedDshTools(host, () => agent, ['sentinel_watch'])
    const args = { kind: 'file', target: '/tmp/flag', note: 'wake me' }
    const result = await watch!.handler(args as never, {})
    expect(host.execute).toHaveBeenCalledWith(expect.objectContaining({
      calls: [expect.objectContaining({ type: 'tool-call', name: 'sentinel_watch', arguments: JSON.stringify(args) })],
      agent,
    }))
    expect(result).toEqual({ content: [{ type: 'text', text: 'watch-1 registered' }] })
  })

  it('reports a failed call as an MCP error', async () => {
    const host = registry({ execute: vi.fn(async (input: { calls: readonly { id: string }[] }) => ({ results: [{ callId: input.calls[0]!.id, result: { isError: true, content: [{ type: 'text', text: 'bad target' }] } }] })) })
    const [watch] = bridgedDshTools(host, () => agent, ['sentinel_watch'])
    await expect(watch!.handler({ kind: 'file', target: 'x', note: 'n' } as never, {})).resolves.toEqual({
      isError: true,
      content: [{ type: 'text', text: 'bad target' }],
    })
  })

  it('refuses a call once the DSH session is gone', async () => {
    let live: Agent | undefined = agent
    const host = registry()
    const [watch] = bridgedDshTools(host, () => live, ['sentinel_watch'])
    live = undefined
    const result = await watch!.handler({ kind: 'file', target: 'x', note: 'n' } as never, {})
    expect(result.isError).toBe(true)
    expect(host.execute).not.toHaveBeenCalled()
  })

  it('serves nothing without a registry, an agent or a match', () => {
    expect(createDshToolBridge(undefined, () => agent)).toBeUndefined()
    expect(createDshToolBridge(registry(), () => undefined)).toBeUndefined()
    expect(createDshToolBridge(registry(), () => agent, [])).toBeUndefined()
    expect(createDshToolBridge(registry(), () => agent, ['missing'])).toBeUndefined()
    expect(createDshToolBridge(registry(), () => agent)).toMatchObject({ type: 'sdk', name: 'dsh' })
  })

  it('keeps text and base64 images, and shows anything else as JSON', () => {
    expect(mcpContent([
      { type: 'text', text: 'ok' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
      { type: 'reference', id: 7 },
    ])).toEqual([
      { type: 'text', text: 'ok' },
      { type: 'image', data: 'AAAA', mimeType: 'image/png' },
      { type: 'text', text: '{"type":"reference","id":7}' },
    ])
    expect(mcpContent([])).toEqual([{ type: 'text', text: '(no output)' }])
  })
})
