import z from "@deepseek-ai/schemastery";
import { SubprocessRuntime } from "@deepseek-ai/dsh-subprocess";
import { EffortLevel, Options, Query, SDKUserMessage, SlashCommand } from "@anthropic-ai/claude-agent-sdk";
import { Context } from "@deepseek-ai/cordis";
import { Agent } from "@deepseek-ai/dsh-agent";
import { CommandDescriptor } from "@deepseek-ai/dsh-commands";
import { ApprovalService } from "@deepseek-ai/dsh-user-approval";
import { UserQuestionService } from "@deepseek-ai/dsh-user-questions";
import { SessionEvent } from "@deepseek-ai/dsh-session";
import { JobRegistry } from "@deepseek-ai/dsh-jobs";
//#region src/command-bridge.d.ts
/**
 * Agent-scope command-directory contract. The commands service is unreachable
 * from the host plugin's view of `agent.ctx` ("without inject"), but the
 * preset route plugin runs inside the agent's preset composition with
 * `commands` injected. The Host reads only the exact agent's effective names
 * for collision checks; Claude catalog entries are never registered there.
 */
interface ClaudeAgentCommandService {
  list(agent: unknown): readonly Pick<CommandDescriptor, 'name'>[];
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    claudeCommands?: ClaudeAgentCommandService;
  }
}
interface ClaudeCommandView {
  publicName: string;
  claudeName: string;
  description: string;
  hint?: string;
  prefixed: boolean;
}
//#endregion
//#region src/constants.d.ts
/** Cordis service this package publishes so a steered message can reach the
 *  turn a Claude session is running. That turn owns the only process that can
 *  read it into Claude at the next model step. */
declare const CLAUDE_STEERING_SERVICE = "claudeSteering";
/** Which renderer draws Claude's visible output.
 *
 *  'plugin' keeps the sidecar-backed transcript this package owns (interleaved
 *  prose, grouped tool cards, activity rows). 'native' hands the same turn to
 *  DSH's own conversation renderer: prose streams as ordinary assistant text
 *  blocks, thinking as reasoning blocks, and root Claude tools are mirrored
 *  into the durable `tool/call`/`tool/result` channel so the Host's tool
 *  presentation pipeline draws them exactly like DSH-executed calls. */
type ClaudeRenderMode = 'plugin' | 'native';
//#endregion
//#region src/events.d.ts
type ClaudeActivityKind = 'text' |
/** A message the reader steered into this turn while it ran. It is drawn
 *  where it arrived, between the work before it and the work after it. */
'steering' | 'status' |
/** Context compaction boundary; the transcript draws it as a divider. */
'compaction' | 'thinking' | 'tool-call' | 'tool-result' | 'permission' | 'question' | 'subagent' | 'usage' | 'warning' | 'error';
type ClaudeActivityPhase = 'started' | 'updated' | 'completed' | 'denied' | 'failed';
interface ClaudeUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  cumulativeCostUsd?: number;
  /** Wall time from the turn being admitted to it settling. Measured here
   *  rather than derived on the client: activities carry no timestamps. */
  durationMs?: number;
  /** Wall time to the first visible token of the turn. */
  ttftMs?: number;
}
interface ClaudeSessionBoundEvent {
  claudeSessionId: string;
  cliVersion?: string;
  sdkVersion: string;
  cwd: string;
}
interface ClaudeActivityEvent {
  turn: number;
  step: number;
  ordinal: number;
  kind: ClaudeActivityKind;
  phase?: ClaudeActivityPhase;
  /** Claude task-board identity for lifecycle activity; never a transcript path. */
  taskId?: string;
  toolUseId?: string;
  /** Enclosing Claude tool call for subagent-nested activity. */
  parentToolUseId?: string;
  toolName?: string;
  title?: string;
  summary?: string;
  detail?: string;
  /** Redacted visible Claude prose used by the plugin-owned interleaved transcript. */
  text?: string;
  isError?: boolean;
  usage?: ClaudeUsage;
  /** Which renderer this record was produced for. Stamped only when the Host
   *  drew the step natively, so a record written before the setting existed —
   *  and every record written under the plugin renderer — reads as 'plugin'.
   *  It travels with the data so a step always renders the way it was
   *  recorded, whatever the setting says now. */
  renderer?: ClaudeRenderMode;
  /** Set on the turn's closing prose under the plugin renderer. Host 0.1.7
   *  folds a completed turn down to its final assistant answer, so that prose
   *  is also handed to the Host as the answer and the plugin transcript skips
   *  it instead of drawing it a second time inside the fold. */
  answer?: true;
}
declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'claude-code/session-bound': ClaudeSessionBoundEvent;
    'claude-code/activity': ClaudeActivityEvent;
    'claude-code/tasks': ClaudeTasksEvent;
  }
}
type ClaudeTaskStatus = 'running' | 'completed' | 'failed' | 'stopped' | 'killed';
interface ClaudeTaskUsage {
  totalTokens?: number;
  toolUses?: number;
  durationMs?: number;
}
interface ClaudeTaskInfo {
  taskId: string;
  /** The tool call that dispatched the task; joins the task to its call's input. */
  toolUseId?: string;
  description: string;
  status: ClaudeTaskStatus;
  /** DSH turn during which this task was first observed, when known. */
  originTurn?: number;
  subagentType?: string;
  taskType?: string;
  lastToolName?: string;
  summary?: string;
  usage?: ClaudeTaskUsage;
  /** True while the task runs detached (background command/subagent). */
  backgrounded?: boolean;
}
/** Level snapshot of one session's Claude task board, REPLACE semantics. */
interface ClaudeTasksEvent {
  tasks: readonly ClaudeTaskInfo[];
}
type ClaudeActivityInput = Omit<ClaudeActivityEvent, 'turn' | 'step' | 'ordinal' | 'summary' | 'detail'> & {
  summary?: unknown;
  detail?: unknown;
};
//#endregion
//#region src/plan-feedback.d.ts
/** One note the reviewer left on a plan: what they said, and the passage they
 *  said it about. */
interface PlanNote {
  /** The exact passage the note is anchored to, absent for a whole-plan note. */
  readonly quote?: string;
  readonly text: string;
}
/** The seam between the panel's "send for changes" and the permission bridge
 *  waiting on that plan's approval.
 *
 *  The approval promise lives inside the bridge and cannot be resolved from
 *  outside, so the bridge races it against this gate instead: whichever
 *  answers first decides, and the loser is aborted. One waiter per tool use —
 *  a plan is approved once. */
declare class PlanFeedbackGate {
  #private;
  /** Notes for the plan under `toolUseId`, or undefined when the wait is
   *  abandoned because the approval surface answered first. */
  wait(toolUseId: string, signal: AbortSignal): Promise<readonly PlanNote[] | undefined>;
  /** Hand notes to a waiting plan approval. False when nothing is waiting —
   *  the plan was already decided, or never existed. */
  submit(toolUseId: string, notes: readonly PlanNote[]): boolean;
  /** Whether a plan is currently open for review. */
  pending(toolUseId: string): boolean;
}
//#endregion
//#region src/permission-mode.d.ts
/** Every mode the selector offers, in the order it lists them: tightest
 *  first. `auto` hands each ask to Claude Code's own classifier and is a
 *  per-model capability, so the selector greys it out where the catalog says
 *  the session's model lacks it. */
declare const CLAUDE_PERMISSION_MODES: readonly ["plan", "default", "acceptEdits", "dontAsk", "auto", "bypassPermissions"];
type ClaudePermissionMode = typeof CLAUDE_PERMISSION_MODES[number];
/** Which access control a Claude session shows and obeys: the Host's own
 *  three-preset selector with the sandbox mapping alone (`native`), or this
 *  plugin's selector over Claude Code's modes with the default mode and the
 *  creation-time alignment (`plugin`). */
declare const CLAUDE_PERMISSION_SELECTORS: readonly ["plugin", "native"];
type ClaudePermissionSelector = typeof CLAUDE_PERMISSION_SELECTORS[number];
//#endregion
//#region src/rewind.d.ts
/** One inclusive span of hidden surface seqs. */
interface ClaudeRewindRange {
  readonly start: number;
  readonly end: number;
}
/** The last Claude chain entry of one completed DSH turn. */
interface ClaudeRewindAnchor {
  readonly turn: number;
  readonly uuid: string;
}
/** The git tree one DSH turn was admitted against. */
interface ClaudeRewindSnapshot {
  readonly turn: number;
  readonly tree: string;
}
/** Fork target for the next Claude spawn; `fresh` starts an empty session. */
type ClaudeRewindResume = {
  readonly resumeAt: string;
} | {
  readonly fresh: true;
};
interface ClaudeRewindState {
  /** Hidden seq ranges, ascending and non-overlapping. */
  readonly ranges: readonly ClaudeRewindRange[];
  /** Chain anchors of the turns Claude still holds, ascending by turn. */
  readonly anchors: readonly ClaudeRewindAnchor[];
  /** Working trees the surviving turns started from, ascending by turn. */
  readonly snapshots: readonly ClaudeRewindSnapshot[];
  /** Armed once by a rewind, consumed by the next Claude spawn. */
  readonly pending?: ClaudeRewindResume;
}
//#endregion
//#region src/sidecar.d.ts
declare const SIDECAR_SCHEMA_VERSION = 1;
interface ClaudeSidecarProjection {
  readonly schemaVersion: typeof SIDECAR_SCHEMA_VERSION;
  readonly revision: number;
  readonly binding?: ClaudeSessionBoundEvent;
  readonly activities: readonly ClaudeActivityEvent[];
  readonly tasks?: ClaudeTasksEvent;
  readonly rewind?: ClaudeRewindState;
  /** The Claude permission mode the user picked in this plugin's selector;
   *  see permission-mode.ts for how it folds with the Host's sandbox mode. */
  readonly permissionMode?: ClaudePermissionMode;
  /** Claude Code's guess at the user's next prompt, offered as ghost text in
   *  the composer until the next turn starts. */
  readonly promptSuggestion?: string;
}
/** Change notification published to live subscribers after each accepted write.
 *
 *  `checkpoint` is the one kind that carries no change: it restates where the
 *  stream stands so a reader can notice it is behind. See {@link ClaudeSidecarRepository.checkpoint}. */
type ClaudeSidecarDelta = {
  kind: 'text';
  turn: number;
  step: number;
  ordinal: number;
  append?: string;
  text?: string;
  renderer?: ClaudeRenderMode;
  answer?: true;
} | {
  kind: 'activity';
  activity: ClaudeActivityEvent;
} | {
  kind: 'tasks';
  value: ClaudeTasksEvent;
} | {
  kind: 'promptSuggestion';
  value?: string;
} | {
  kind: 'sync';
} | {
  kind: 'checkpoint';
};
/** One delta as subscribers see it: numbered, so a reader that applies them in
 *  order can tell a missing one from a slow one.
 *
 *  The projection's own `revision` cannot do this job. Streaming prose notifies
 *  subscribers without touching disk (see {@link ClaudeSidecarRepository.appendTranscriptText}),
 *  so revisions and notifications advance on different clocks; this counter
 *  advances once per notification and nothing else reads it. */
type ClaudeSidecarNotification = ClaudeSidecarDelta & {
  readonly seq: number;
};
interface ClaudeSidecarRepositoryOptions {
  readonly root?: string;
  readonly legacyRoot?: string;
}
declare class ClaudeSidecarRepository {
  #private;
  readonly root: string;
  readonly legacyRoot: string | undefined;
  constructor(options?: ClaudeSidecarRepositoryOptions);
  read(sessionId: string): Promise<ClaudeSidecarProjection>;
  /** Observe accepted changes for one session; returns the unsubscriber. */
  subscribe(sessionId: string, listener: (delta: ClaudeSidecarNotification) => void): () => void;
  /** Record streaming assistant prose without touching the disk on the hot
   *  path: subscribers are notified synchronously (as an append when the
   *  redacted text grows in place) and persistence is coalesced. */
  appendTranscriptText(sessionId: string, value: {
    turn: number;
    step: number;
    ordinal: number;
    text: string;
    renderer?: ClaudeRenderMode;
    answer?: true;
  }): void;
  /** Persist any pending streaming transcript now (segment close, turn end). */
  flushTranscriptText(sessionId: string): Promise<void>;
  /** How many notifications this session has published. */
  sequence(sessionId: string): number;
  /** Restate where the stream stands without changing anything.
   *
   *  A reader detects a lost delta from the hole the NEXT one leaves, which
   *  never comes when the lost delta was the last of a turn -- exactly the
   *  case that leaves a finished tool group pulsing forever. Called at turn
   *  settlement, this gives that reader the one line it needs to disagree. */
  checkpoint(sessionId: string): void;
  writeBinding(sessionId: string, value: Omit<ClaudeSessionBoundEvent, 'sdkVersion'> & {
    sdkVersion?: string;
  }): Promise<ClaudeSidecarProjection>;
  appendActivity(sessionId: string, value: ClaudeActivityInput & {
    turn: number;
    step: number;
    ordinal: number;
  }): Promise<ClaudeSidecarProjection>;
  /** Record the mode the selector picked. No delta: the projection carries
   *  it as metadata, which the carrier refreshes on its own cadence. */
  writePermissionMode(sessionId: string, mode: ClaudePermissionMode): Promise<ClaudeSidecarProjection>;
  /** Offer (or, with undefined, withdraw) the next-prompt suggestion. A write
   *  that changes nothing is skipped, so clearing at every turn start is free. */
  writePromptSuggestion(sessionId: string, value: string | undefined): Promise<ClaudeSidecarProjection>;
  writeTasks(sessionId: string, value: readonly ClaudeTaskInfo[]): Promise<ClaudeSidecarProjection>;
  /** Land one planned rewind: hidden ranges, surviving anchors, and the fork
   *  target the next Claude spawn consumes.
   *
   *  `droppedFromTurn` also drops the discarded turns' activity. The hidden
   *  ranges are surface seqs and activity records carry none, so a reader that
   *  works in turns — the plan panel, the task board — has nothing to filter
   *  on and would go on showing a plan the session no longer contains. This
   *  projection is rebuildable from the session log, so trimming it is not
   *  losing anything the log still holds. */
  writeRewind(sessionId: string, value: ClaudeRewindState, droppedFromTurn?: number): Promise<ClaudeSidecarProjection>;
  /** Remember where Claude's chain ended for one completed DSH turn. */
  recordRewindAnchor(sessionId: string, turn: number, uuid: string): Promise<ClaudeSidecarProjection>;
  /** Remember the working tree one DSH turn was admitted against. */
  recordRewindSnapshot(sessionId: string, turn: number, tree: string): Promise<ClaudeSidecarProjection>;
  /** Disarm the fork target once a Claude process has resumed at it, so a
   *  later respawn continues the rewound session instead of re-truncating it. */
  clearRewindPending(sessionId: string): Promise<ClaudeSidecarProjection>;
  importLegacy(sessionId: string, events: readonly SessionEvent[]): Promise<ClaudeSidecarProjection>;
}
//#endregion
//#region src/host-jobs.d.ts
declare module '@deepseek-ai/dsh-jobs/view' {
  interface JobKindMap {
    claude: 'claude';
  }
}
type ClaudeHostJobStatus = 'completed' | 'failed' | 'stopped' | 'killed';
/** `bash` and `subagent` are the Host's own kinds; `claude` covers the rest (workflows). */
type ClaudeHostJobKind = 'bash' | 'subagent' | 'claude';
declare class ClaudeHostJobs {
  #private;
  constructor(registry: () => Pick<JobRegistry, 'start'> | undefined, warn: (message: string) => void);
  /** Register one detached task; `stop` relays the Host's kill to the CLI. */
  started(sessionId: string, taskId: string, kind: ClaudeHostJobKind, label: string, stop: () => Promise<void>): void;
  progress(sessionId: string, taskId: string, line: string): void;
  /** Lift `<taskId>.output` paths out of a tool result. */
  noteOutput(sessionId: string, output: unknown): void;
  /** The level signal dropped the task; settle it as completed unless the
   *  notification with the real status arrives within the grace period. */
  removed(sessionId: string, taskId: string): void;
  settled(sessionId: string, taskId: string, status: ClaudeHostJobStatus, summary?: string, outputFile?: string): void;
  /** The CLI process behind these tasks is gone; nothing will report them. */
  abandon(sessionId: string): void;
}
//#endregion
//#region src/supervisor.d.ts
/** What {@link ClaudeSupervisor.deliverSteering} did with one steered message. */
type ClaudeSteeringOutcome = 'delivered' | 'unavailable';
/** The steering entry point this package publishes on the Cordis service named
 *  by `CLAUDE_STEERING_SERVICE`. */
interface ClaudeSteeringService {
  /**
   * Hand one user message to the turn `sessionId` is running.
   * @param sessionId - DSH session id whose Claude preset is running.
   * @param prompt - the message content, already the user's own.
   * @returns `delivered` once the running turn owns it, `unavailable` when there
   *   is no running turn to steer — keep the message for a later turn.
   */
  deliver(sessionId: string, prompt: SDKUserMessage['message']['content']): ClaudeSteeringOutcome;
}
type ClaudeSupervisorState = 'starting' | 'idle' | 'running' | 'interrupting' | 'disconnected' | 'outcome-unknown' | 'disposed';
interface ClaudeSupervisorConfig {
  executablePath: string;
  idleTimeoutMs: number;
  maxProcesses: number;
  defaultModel: string;
  /** Which renderer the visible turn is produced for; read per message so a
   *  Settings change lands on the next turn without a Host restart. */
  renderMode?: ClaudeRenderMode;
  /** After this long a blocking Bash call is moved to the background; 0 disables it. */
  foregroundBashBackgroundMs?: number;
}
type ClaudeTurnStreamEvent = {
  type: 'text-delta';
  text: string;
} |
/** One settled Claude thinking block, forwarded only for the native
 *  renderer, which draws it as a DSH reasoning block. */
{
  type: 'thinking';
  text: string;
} | {
  type: 'usage';
  usage: ClaudeUsage;
} | {
  type: 'segment-complete';
  text: string;
} |
/** The turn's closing prose, sent under the plugin renderer just before
 *  `complete` so the Host has a final answer to keep outside its fold. */
{
  type: 'answer';
  text: string;
} | {
  type: 'complete';
  text: string;
};
type ClaudeThinkingMode = 'off' | 'ultracode' | EffortLevel;
interface ClaudeTurnRequest {
  agent: Agent;
  prompt: SDKUserMessage['message']['content'];
  model?: string;
  thinkingMode?: ClaudeThinkingMode;
  /** The renderer this turn is produced for, frozen by the caller before the
   *  turn starts. The setting is live, so reading it per record would let a
   *  mid-turn switch stamp one step's records with both renderers -- which the
   *  Client reads as "natively drawn" for the whole step, while the adapter,
   *  which froze its own answer at turn start, streamed nothing natively.
   *  Omitted falls back to the shared config. */
  renderMode?: ClaudeRenderMode;
  signal?: AbortSignal;
}
interface ClaudeSupervisorSnapshot {
  sessionId: string;
  claudeSessionId?: string;
  state: ClaudeSupervisorState;
  cwd: string;
  model: string;
  thinkingMode?: ClaudeThinkingMode;
  lastUsedAt: number;
}
type ClaudeQueryFactory = (params: {
  prompt: AsyncIterable<SDKUserMessage>;
  options: Options;
}) => Query;
declare class ClaudeSupervisor {
  #private;
  /** Lets the plan panel answer a plan's approval with revisions. */
  readonly planFeedback: PlanFeedbackGate;
  constructor(dependencies: {
    runtime: Pick<SubprocessRuntime, 'spawn' | 'resolveExecutable'>;
    approval: Pick<ApprovalService, 'request'>;
    userQuestions: Pick<UserQuestionService, 'ask'>;
    config: ClaudeSupervisorConfig;
    queryFactory?: ClaudeQueryFactory;
    runDetached?: <T>(operation: () => T) => T;
    sidecar?: ClaudeSidecarRepository;
    /** The mode a session runs under until it chooses one; absent, the DSH
     *  sandbox alone decides (see permission-mode.ts). */
    defaultPermissionMode?: () => Promise<ClaudePermissionMode | undefined>;
    /** Which access control the session obeys; `native` ignores both the
     *  session's recorded choice and the default and reads the sandbox alone. */
    permissionSelector?: () => Promise<ClaudePermissionSelector>;
    /** Where a process death is reported. The transcript keeps the failure;
     *  this is what makes it findable afterwards. */
    logger?: {
      warn(message: string): void;
    };
    /** Mirror of detached tasks into the Host's background-job list. */
    hostJobs?: ClaudeHostJobs;
  });
  snapshots(): ClaudeSupervisorSnapshot[];
  supportedCommands(agent: Agent, model?: string): Promise<readonly SlashCommand[]>;
  contextWindow(model: string): number | undefined;
  /** Raw `/usage` payload, read over a session's existing process. Only the
   *  idle-time metadata bridge uses this; a user-triggered refresh runs
   *  probePlanUsage instead so it never waits on, or perturbs, a session. */
  planUsage(agent: Agent, model?: string): Promise<unknown>;
  /** Whether a steered message can reach this session's turn right now.
   *
   *  Asked before the caller takes the message out of the agent inbox: a
   *  message removed for a turn that cannot take it would have to be put back,
   *  and a restored message has already lost the insertion that would wake an
   *  idle driver. */
  canSteer(sessionId: string): boolean;
  /** Deliver one more user message into the turn a session is already running.
   *
   *  Claude Code reads a message pushed into its input stream at the next model
   *  step of the running turn, which is what steering means here: the turn is
   *  not restarted and its context is not reloaded. The turn then owns one more
   *  prompt uuid, so the result that answers the message it was already working
   *  on no longer looks like a protocol violation.
   *
   *  `unavailable` means there is no live turn to steer, and the caller must
   *  keep its message for a later turn rather than drop it. */
  deliverSteering(sessionId: string, prompt: SDKUserMessage['message']['content']): ClaudeSteeringOutcome;
  runTurn(request: ClaudeTurnRequest): Promise<AsyncIterable<ClaudeTurnStreamEvent>>;
  limitsChanged(): void;
  disposeSession(sessionId: string, reason?: string): Promise<void>;
  dispose(): Promise<void>;
  /** Move one running root tool call to the background: the terminal's Ctrl+B
   *  for a single call. Claude receives a "running in the background" result
   *  at once and the command joins the Host job list with a stop control. */
  backgroundToolCall(sessionId: string, toolUseId: string): Promise<'moved' | 'not-running' | 'unavailable'>;
}
//#endregion
//#region src/index.d.ts
declare const name = "llm-claude";
declare const inject: string[];
interface Config {
  executablePath?: string;
  model?: string;
  idleTimeoutMs?: number;
  maxProcesses?: number;
}
declare const Config: z<Config>;
declare function mountClaudeMetadata(ctx: Context, supervisor: ClaudeSupervisor, agent: Agent, model: string, publishCommands?: (commands: readonly ClaudeCommandView[]) => void, resolveCommands?: () => ClaudeAgentCommandService | undefined): (() => Promise<void>) | undefined;
declare function apply(ctx: Context, config: Config): Promise<void>;
//#endregion
export { CLAUDE_STEERING_SERVICE, type ClaudeSteeringOutcome, type ClaudeSteeringService, Config, apply, inject, mountClaudeMetadata, name };
//# sourceMappingURL=index.d.mts.map