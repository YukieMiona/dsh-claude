import { randomUUID } from 'node:crypto'
import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance, type SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { z } from 'zod'

/** The MCP server name Claude sees: the bridged tools read `mcp__dsh__<name>`. */
export const DSH_TOOL_BRIDGE_SERVER = 'dsh'

/** DSH tools a Claude session may call unless the plugin config names others.
 *
 *  Claude Code runs its own loop and has its own file, shell, web and subagent
 *  tools, so only DSH tools with no Claude twin are offered. The sentinel is
 *  the first: a watch belongs to the session that registers it, and before
 *  this bridge nothing could register one for a Claude session. */
export const DEFAULT_BRIDGED_DSH_TOOLS: readonly string[] = ['sentinel_watch', 'sentinel_list', 'sentinel_cancel']

/** The parts of the Host's tool registry the bridge uses. */
export interface DshToolRegistry {
  schemas(scope?: Agent): readonly { name: string; description?: string; parameters?: unknown }[]
  execute(exec: {
    callId: string
    name: string
    arguments: unknown
    agent?: Agent
    signal: AbortSignal
  }): Promise<{ isError: boolean; content: readonly unknown[] }>
}

type ContentBlock = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

/** The registry's model-facing content as MCP content: text stays text, an
 *  image with base64 data stays an image, anything else is shown as JSON. */
export function mcpContent(blocks: readonly unknown[]): ContentBlock[] {
  const out: ContentBlock[] = []
  for (const block of blocks) {
    const value = block !== null && typeof block === 'object' ? block as Record<string, unknown> : undefined
    if (value?.type === 'text' && typeof value.text === 'string') {
      out.push({ type: 'text', text: value.text })
      continue
    }
    const source = value?.source !== null && typeof value?.source === 'object' ? value.source as Record<string, unknown> : undefined
    if (value?.type === 'image' && typeof source?.data === 'string' && typeof source.media_type === 'string') {
      out.push({ type: 'image', data: source.data, mimeType: source.media_type })
      continue
    }
    out.push({ type: 'text', text: JSON.stringify(block) })
  }
  return out.length === 0 ? [{ type: 'text', text: '(no output)' }] : out
}

/** A tool's JSON Schema parameters as the zod shape the SDK's `tool()` takes.
 *  Undefined when the schema is not an object schema zod can read. */
function inputShape(parameters: unknown): z.ZodRawShape | undefined {
  const schema = parameters ?? { type: 'object', properties: {} }
  try {
    const parsed = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0])
    return parsed instanceof z.ZodObject ? parsed.shape : undefined
  } catch {
    return undefined
  }
}

/**
 * An in-process MCP server that hands one Claude session the named DSH tools.
 *
 * The tools are listed as the session's agent sees them when the process
 * starts. Each call resolves the session's agent again, then runs through the
 * Host registry's own pipeline (its policy, guards and approvals), so a call
 * from Claude is the same call a DSH model would make in that session.
 *
 * Undefined when the registry is missing or offers none of the named tools.
 */
export function createDshToolBridge(
  registry: DshToolRegistry | undefined,
  agent: () => Agent | undefined,
  names: readonly string[] = DEFAULT_BRIDGED_DSH_TOOLS,
): McpSdkServerConfigWithInstance | undefined {
  const tools = bridgedDshTools(registry, agent, names)
  if (tools.length === 0) return undefined
  return createSdkMcpServer({ name: DSH_TOOL_BRIDGE_SERVER, version: '1.0.0', tools })
}

/** The tool definitions {@link createDshToolBridge} serves; empty when there are none. */
export function bridgedDshTools(
  registry: DshToolRegistry | undefined,
  agent: () => Agent | undefined,
  names: readonly string[] = DEFAULT_BRIDGED_DSH_TOOLS,
): SdkMcpToolDefinition[] {
  const current = agent()
  if (registry === undefined || current === undefined || names.length === 0) return []
  const wanted = new Set(names)
  return registry.schemas(current)
    .filter(schema => wanted.has(schema.name))
    .flatMap(schema => {
      const shape = inputShape(schema.parameters)
      if (shape === undefined) return []
      return [tool(schema.name, schema.description ?? schema.name, shape, async (args, extra) => {
        const owner = agent()
        if (owner === undefined) {
          return { isError: true, content: [{ type: 'text', text: 'The DSH session behind this Claude session is not available.' }] }
        }
        const signal = (extra as { signal?: AbortSignal } | undefined)?.signal ?? new AbortController().signal
        const result = await registry.execute({ callId: randomUUID(), name: schema.name, arguments: args, agent: owner, signal })
        return { ...(result.isError ? { isError: true } : {}), content: mcpContent(result.content) }
      })]
    })
}
