import { A as CLAUDE_REPOSITORY_FEEDBACK_PATH, B as DEFAULT_CLAUDE_PROSE_MODE, C as CLAUDE_PROJECTION_PATH, D as CLAUDE_PROSE_MODES, E as CLAUDE_PROMPT_REFINE_PATH, F as CLAUDE_STEERING_SERVICE, G as claudeStatusTitle, H as PLAN_FEEDBACK_TITLE, I as CLAUDE_UNKNOWN_MESSAGE_PREFIX, K as isClaudeProseMode, L as CLAUDE_UPDATE_CHECK_PATH, M as CLAUDE_REPOSITORY_SETUP_PATH, N as CLAUDE_REVIEW_COMMENT_PATH, O as CLAUDE_RENDER_MODES, P as CLAUDE_REWIND_PATH, R as CLAUDE_UPDATE_PATH, S as CLAUDE_PROGRESS_SUBTYPES, T as CLAUDE_PROMPT_NAME_PATH, V as DEFAULT_CLAUDE_RENDER_MODE, W as TASK_TOOL_NAMES, _ as CLAUDE_DOCTOR_PATH, a as normalizeActivity, b as CLAUDE_PERMISSION_MODE_PATH, c as safeDetail, d as CLAUDE_ASK_PATH, f as CLAUDE_BACKGROUND_TASK_PATH, g as CLAUDE_CODE_PROVIDER_IDS, h as CLAUDE_CODE_PROVIDER, i as latestClaudeTasks, j as CLAUDE_REPOSITORY_FILE_PATH, k as CLAUDE_REPOSITORY_ACTION_PATH, l as API_RETRY_TITLE, m as CLAUDE_CODE_PRESET_ID, n as currentClaudeActivityCursor, o as normalizeTasksEvent, p as CLAUDE_CLIENT_DIAGNOSTICS_PATH, q as isClaudeRenderMode, r as latestClaudeSessionBinding, s as redactText, t as boundText, u as CLAUDE_ACTIVITY_EVENT, v as CLAUDE_GLOBAL_SETTINGS_PATH, w as CLAUDE_PROMPTS_PATH, x as CLAUDE_PLAN_FEEDBACK_PATH, y as CLAUDE_JIRA_PATH, z as CLAUDE_USAGE_PATH } from "./events-BRPDopbd.mjs";
import { a as ensureClaudeModels, c as recordClaudeModels, i as claudeModelValue, l as CLAUDE_COMMANDS_SERVICE, n as claudeLineupKnown, o as latestClaudeModels, r as claudeModelRow, s as probeClaudeModels, t as canonicalClaudeModelId, u as projectClaudeCommands } from "./model-catalog-YIEi-xa6.mjs";
import { a as toolPathEnv, i as createManagedClaudeSpawner, n as resolveClaudeExecutable, r as runClaudeDoctor } from "./executable-BzlqkThH.mjs";
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import z from "@deepseek-ai/schemastery";
import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, opendir, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dshHomePath, resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { closeSync, openSync, readSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { StringDecoder } from "node:string_decoder";
import { LlmAdapter, ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import { deadline } from "@deepseek-ai/dsh-timeout";
import { fileURLToPath } from "node:url";
//#region src/permission-mode.ts
/** Every mode the selector offers, in the order it lists them: tightest
*  first. `auto` hands each ask to Claude Code's own classifier and is a
*  per-model capability, so the selector greys it out where the catalog says
*  the session's model lacks it. */
const CLAUDE_PERMISSION_MODES = [
	"plan",
	"default",
	"acceptEdits",
	"dontAsk",
	"auto",
	"bypassPermissions"
];
function isClaudePermissionMode(value) {
	return typeof value === "string" && CLAUDE_PERMISSION_MODES.includes(value);
}
/** The DSH sandbox mode a Claude mode is carried on. The Host's preset table
*  names its presets after these modes, so the same string selects the preset. */
const SANDBOX_BY_CLAUDE_MODE = {
	plan: "read-only",
	default: "workspace-write",
	acceptEdits: "workspace-write",
	dontAsk: "workspace-write",
	auto: "workspace-write",
	bypassPermissions: "danger-full-access"
};
/** The closest Claude mode for a sandbox mode chosen without this plugin's
*  selector: what the session runs under until the selector is used. */
const CLAUDE_MODE_BY_SANDBOX = {
	"read-only": "plan",
	"workspace-write": "acceptEdits",
	"danger-full-access": "bypassPermissions"
};
function isSandboxMode(value) {
	return value === "read-only" || value === "workspace-write" || value === "danger-full-access";
}
/** The session's effective sandbox mode: the newest `sandbox/mode` event,
*  undefined when there is none, and `null` for a newest event this plugin
*  cannot read (which fails safe rather than falling back to an older one). */
function sandboxModeOf(events) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event?.type !== "sandbox/mode") continue;
		const mode = event.data.mode;
		return isSandboxMode(mode) ? mode : null;
	}
}
/** The Claude mode a session runs its next turn under.
*
*  `chosen` is what the plugin's selector recorded; it stands for as long as
*  the session's sandbox mode is the one it needs. A session that never chose
*  runs the sandbox's closest mode, and one with no sandbox at all, or an
*  unreadable one, runs `plan`: the mode that can do the least. */
function claudePermissionMode(events, chosen) {
	const sandbox = sandboxModeOf(events);
	if (chosen !== void 0 && (sandbox === void 0 || sandbox === SANDBOX_BY_CLAUDE_MODE[chosen])) return chosen;
	return sandbox === void 0 || sandbox === null ? "plan" : CLAUDE_MODE_BY_SANDBOX[sandbox];
}
/** Which access control a Claude session shows and obeys: the Host's own
*  three-preset selector with the sandbox mapping alone (`native`), or this
*  plugin's selector over Claude Code's modes with the default mode and the
*  creation-time alignment (`plugin`). */
const CLAUDE_PERMISSION_SELECTORS = ["plugin", "native"];
const DEFAULT_CLAUDE_PERMISSION_SELECTOR = "plugin";
function isClaudePermissionSelector(value) {
	return value === "plugin" || value === "native";
}
//#endregion
//#region src/rewind.ts
const EMPTY_REWIND_STATE = {
	ranges: [],
	anchors: [],
	snapshots: []
};
/** Absorb one span into an ascending, non-overlapping range list. Adjacent
*  spans merge so a rewind of a rewind reads as one hidden block. */
function mergeRewindRanges(ranges, addition) {
	const merged = [];
	let { start, end } = addition;
	for (const range of [...ranges].sort((left, right) => left.start - right.start)) if (range.end + 1 < start) merged.push(range);
	else if (range.start > end + 1) {
		merged.push({
			start,
			end
		});
		start = range.start;
		end = range.end;
	} else {
		start = Math.min(start, range.start);
		end = Math.max(end, range.end);
	}
	merged.push({
		start,
		end
	});
	return merged.slice(-200);
}
/** Record one completed turn's last chain entry, replacing a re-run turn. */
function recordRewindAnchor(state, anchor) {
	const anchors = [...state.anchors.filter((item) => item.turn !== anchor.turn), anchor].sort((left, right) => left.turn - right.turn).slice(-2e3);
	return {
		...state,
		anchors
	};
}
/** Record the working tree one turn was admitted against, replacing a re-run
*  turn's. */
function recordRewindSnapshot(state, snapshot) {
	const snapshots = [...state.snapshots.filter((item) => item.turn !== snapshot.turn), snapshot].sort((left, right) => left.turn - right.turn).slice(-100);
	return {
		...state,
		snapshots
	};
}
/** The turn a surface seq belongs to, and the seq its rows start at.
*
*  The Host opens a turn before it writes the message that drives it
*  (`turn/start`, `step/start`, then `user/message`), so a message normally
*  sits inside an already-open turn: that turn is the one it belongs to, and
*  its head rows must go with it. A message between turns belongs to the
*  first turn opened after it; one accepted but never run belongs to no
*  logged turn, so nothing Claude holds is discarded. */
function owningTurn(events, seq) {
	let open;
	for (const event of events) if (event.seq > seq) {
		if (open !== void 0) return open;
		if (event.type === "turn/start") return {
			turn: event.data.turn,
			start: event.seq
		};
	} else if (event.type === "turn/start") open = {
		turn: event.data.turn,
		start: event.seq
	};
	else if (event.type === "turn/end") open = void 0;
	return open;
}
function turnAtOrAfter(events, seq) {
	return owningTurn(events, seq)?.turn;
}
/** The working tree a rewind at `seq` restores: the snapshot of the first turn
*  it discards. Undefined when nothing is discarded, or when that turn ran
*  before this session captured trees. */
function rewindRestoreTree(state, events, seq) {
	const turn = turnAtOrAfter(events, seq);
	return turn === void 0 ? void 0 : state.snapshots.find((item) => item.turn === turn)?.tree;
}
/** Plan one rewind at `seq`, or undefined when the seq is not in the log.
*  Anchors and snapshots of the discarded turns go with them: after this
*  rewind Claude no longer holds those entries, so a later rewind must never
*  fork at one — nor restore a tree for a turn that no longer exists. */
function planRewind(state, events, seq) {
	const last = events.at(-1)?.seq;
	if (last === void 0 || seq > last) return void 0;
	const owner = owningTurn(events, seq);
	const turn = owner?.turn ?? Number.MAX_SAFE_INTEGER;
	const anchors = state.anchors.filter((anchor) => anchor.turn < turn);
	const kept = anchors.at(-1);
	return {
		ranges: mergeRewindRanges(state.ranges, {
			start: Math.min(seq, owner?.start ?? seq),
			end: last
		}),
		anchors,
		snapshots: state.snapshots.filter((item) => item.turn < turn),
		pending: kept === void 0 ? { fresh: true } : { resumeAt: kept.uuid }
	};
}
//#endregion
//#region src/sidecar.ts
const SIDECAR_SCHEMA_VERSION = 1;
const MAX_ACTIVITIES = 1e4;
/** Trailing window that coalesces per-token transcript persistence into one
*  atomic disk write; live subscribers are notified synchronously regardless. */
const TEXT_FLUSH_MS = 150;
/** A suggestion is one short prompt; anything longer is not worth ghosting. */
const MAX_PROMPT_SUGGESTION_CHARS = 1e3;
function emptyProjection() {
	return {
		schemaVersion: SIDECAR_SCHEMA_VERSION,
		revision: 0,
		activities: []
	};
}
function record$17(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function finiteInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function string$4(value, max) {
	return typeof value === "string" && value.length > 0 && value.length <= max;
}
function binding(value) {
	const input = record$17(value);
	if (input === void 0 || !string$4(input.claudeSessionId, 512) || !string$4(input.sdkVersion, 128) || !string$4(input.cwd, 4096) || input.cliVersion !== void 0 && !string$4(input.cliVersion, 128)) return void 0;
	return {
		claudeSessionId: input.claudeSessionId,
		sdkVersion: input.sdkVersion,
		cwd: input.cwd,
		...input.cliVersion === void 0 ? {} : { cliVersion: input.cliVersion }
	};
}
const ACTIVITY_KINDS = new Set(Object.keys({
	"text": true,
	"steering": true,
	"status": true,
	"compaction": true,
	"thinking": true,
	"tool-call": true,
	"tool-result": true,
	"permission": true,
	"question": true,
	"subagent": true,
	"usage": true,
	"warning": true,
	"error": true
}));
const ACTIVITY_PHASES = /* @__PURE__ */ new Set([
	"started",
	"updated",
	"completed",
	"denied",
	"failed"
]);
function activity(value) {
	const input = record$17(value);
	if (input === void 0 || !finiteInteger(input.turn) || !finiteInteger(input.step) || !finiteInteger(input.ordinal) || typeof input.kind !== "string" || !ACTIVITY_KINDS.has(input.kind) || input.phase !== void 0 && (typeof input.phase !== "string" || !ACTIVITY_PHASES.has(input.phase))) return void 0;
	return normalizeActivity(input);
}
function rewind(value) {
	const input = record$17(value);
	if (input === void 0 || !Array.isArray(input.ranges) || input.ranges.length > 200 || !Array.isArray(input.anchors) || input.anchors.length > 2e3) return void 0;
	const ranges = [];
	for (const item of input.ranges) {
		const range = record$17(item);
		if (range === void 0 || !finiteInteger(range.start) || !finiteInteger(range.end) || range.end < range.start) return void 0;
		ranges.push({
			start: range.start,
			end: range.end
		});
	}
	const anchors = [];
	for (const item of input.anchors) {
		const anchor = record$17(item);
		if (anchor === void 0 || !finiteInteger(anchor.turn) || !string$4(anchor.uuid, 128)) return void 0;
		anchors.push({
			turn: anchor.turn,
			uuid: anchor.uuid
		});
	}
	const snapshots = [];
	if (input.snapshots !== void 0) {
		if (!Array.isArray(input.snapshots) || input.snapshots.length > 100) return void 0;
		for (const item of input.snapshots) {
			const snapshot = record$17(item);
			if (snapshot === void 0 || !finiteInteger(snapshot.turn) || !string$4(snapshot.tree, 64)) return void 0;
			snapshots.push({
				turn: snapshot.turn,
				tree: snapshot.tree
			});
		}
	}
	const pending = record$17(input.pending);
	if (input.pending !== void 0 && pending === void 0) return void 0;
	if (pending === void 0) return {
		ranges,
		anchors,
		snapshots
	};
	if (pending.fresh === true) return {
		ranges,
		anchors,
		snapshots,
		pending: { fresh: true }
	};
	if (!string$4(pending.resumeAt, 128)) return void 0;
	return {
		ranges,
		anchors,
		snapshots,
		pending: { resumeAt: pending.resumeAt }
	};
}
function tasks(value) {
	const input = record$17(value);
	if (input === void 0 || !Array.isArray(input.tasks)) return void 0;
	return normalizeTasksEvent(input.tasks);
}
function parseClaudeSidecar(value) {
	const input = record$17(value);
	if (input === void 0 || input.schemaVersion !== SIDECAR_SCHEMA_VERSION || !finiteInteger(input.revision) || !Array.isArray(input.activities) || input.activities.length > MAX_ACTIVITIES) throw new Error("dsh-claude: invalid sidecar document");
	const activities = input.activities.map(activity);
	if (activities.some((item) => item === void 0)) throw new Error("dsh-claude: invalid sidecar activity");
	const retained = [];
	const reportedUnknownTitles = /* @__PURE__ */ new Set();
	for (const item of activities) {
		if (isProgressActivity(item)) continue;
		if (item.kind === "warning" && item.title?.startsWith("Unknown Claude SDK message: ") === true) {
			if (reportedUnknownTitles.has(item.title)) continue;
			reportedUnknownTitles.add(item.title);
		}
		retained.push(item);
	}
	retained.sort(compareActivity);
	const parsedBinding = input.binding === void 0 ? void 0 : binding(input.binding);
	const parsedTasks = input.tasks === void 0 ? void 0 : tasks(input.tasks);
	const parsedRewind = input.rewind === void 0 ? void 0 : rewind(input.rewind);
	if (input.permissionMode !== void 0 && !isClaudePermissionMode(input.permissionMode)) throw new Error("dsh-claude: invalid sidecar permission mode");
	if (input.promptSuggestion !== void 0 && typeof input.promptSuggestion !== "string") throw new Error("dsh-claude: invalid sidecar prompt suggestion");
	if (input.binding !== void 0 && parsedBinding === void 0 || input.tasks !== void 0 && parsedTasks === void 0 || input.rewind !== void 0 && parsedRewind === void 0) throw new Error("dsh-claude: invalid sidecar projection");
	return {
		schemaVersion: SIDECAR_SCHEMA_VERSION,
		revision: input.revision,
		activities: retained,
		...parsedBinding === void 0 ? {} : { binding: parsedBinding },
		...parsedTasks === void 0 ? {} : { tasks: parsedTasks },
		...parsedRewind === void 0 ? {} : { rewind: parsedRewind },
		...input.permissionMode === void 0 ? {} : { permissionMode: input.permissionMode },
		...input.promptSuggestion === void 0 ? {} : { promptSuggestion: input.promptSuggestion }
	};
}
function compareActivity(left, right) {
	return left.turn - right.turn || left.step - right.step || left.ordinal - right.ordinal;
}
function activityKey(value) {
	return `${value.turn}:${value.step}:${value.ordinal}`;
}
/** Durable titles of the progress frames {@link CLAUDE_PROGRESS_SUBTYPES} names.
*
*  A projection written before the plugin stopped recording that telemetry still
*  carries up to a full window of those rows. Dropping them on the way in is what
*  makes them stop costing anything: every later write rebuilds only the real
*  activity, so the first write after the upgrade sheds the backlog instead of
*  rebuilding ten thousand rows forever. */
const PROGRESS_STATUS_TITLES = new Set([...CLAUDE_PROGRESS_SUBTYPES].map((subtype) => claudeStatusTitle(subtype)));
/** The same telemetry under the title it carried before it was classified as
*  progress: the unknown-type fallback named those rows after the message type
*  and filed them as warnings. */
const LEGACY_PROGRESS_TITLES = /* @__PURE__ */ new Set([`${CLAUDE_UNKNOWN_MESSAGE_PREFIX}tool_progress`]);
function isProgressActivity(activity) {
	if (activity.title === void 0) return false;
	if (LEGACY_PROGRESS_TITLES.has(activity.title)) return true;
	return activity.kind === "status" && PROGRESS_STATUS_TITLES.has(activity.title);
}
function mergeActivities(existing, additions) {
	const appended = additions.length === 1 ? additions[0] : void 0;
	if (appended !== void 0 && isProgressActivity(appended)) return existing;
	const last = existing[existing.length - 1];
	if (appended !== void 0 && (last === void 0 || compareActivity(last, appended) < 0)) return existing.length < MAX_ACTIVITIES ? [...existing, appended] : [...existing.slice(1), appended];
	const merged = new Map(existing.map((item) => [activityKey(item), item]));
	for (const item of additions) if (!isProgressActivity(item)) merged.set(activityKey(item), item);
	return [...merged.values()].sort(compareActivity).slice(-1e4);
}
function normalizeBinding(input) {
	return {
		claudeSessionId: redactText(input.claudeSessionId, 512),
		sdkVersion: redactText(input.sdkVersion ?? "0.3.247", 128),
		cwd: redactText(input.cwd, 4096),
		...input.cliVersion === void 0 ? {} : { cliVersion: redactText(input.cliVersion, 128) }
	};
}
var ClaudeSidecarRepository = class {
	root;
	legacyRoot;
	#pending = /* @__PURE__ */ new Map();
	/** Latest durable projection per session; disk is read once and written through. */
	#latest = /* @__PURE__ */ new Map();
	#listeners = /* @__PURE__ */ new Map();
	/** Notifications published per session, so a reader can spot a hole. */
	#seq = /* @__PURE__ */ new Map();
	/** Streaming transcript segments not yet persisted, keyed by activity key. */
	#live = /* @__PURE__ */ new Map();
	/** Monotonic revision boost so merged reads advance while text stays in memory. */
	#boost = /* @__PURE__ */ new Map();
	#flushTimers = /* @__PURE__ */ new Map();
	constructor(options = {}) {
		this.root = options.root ?? dshHomePath("plugins", "dsh-claude", "sessions");
		this.legacyRoot = options.legacyRoot ?? (options.root === void 0 ? dshHomePath("plugins", "dsh-claude-code", "sessions") : void 0);
	}
	async read(sessionId) {
		await this.#pending.get(sessionId)?.catch(() => void 0);
		return this.#merged(sessionId, await this.#base(sessionId));
	}
	/** Observe accepted changes for one session; returns the unsubscriber. */
	subscribe(sessionId, listener) {
		let set = this.#listeners.get(sessionId);
		if (set === void 0) {
			set = /* @__PURE__ */ new Set();
			this.#listeners.set(sessionId, set);
		}
		set.add(listener);
		return () => {
			set.delete(listener);
			if (set.size === 0) this.#listeners.delete(sessionId);
		};
	}
	/** Record streaming assistant prose without touching the disk on the hot
	*  path: subscribers are notified synchronously (as an append when the
	*  redacted text grows in place) and persistence is coalesced. */
	appendTranscriptText(sessionId, value) {
		const normalized = normalizeActivity({
			kind: "text",
			phase: "updated",
			...value
		});
		const key = activityKey(normalized);
		let overlay = this.#live.get(sessionId);
		if (overlay === void 0) {
			overlay = /* @__PURE__ */ new Map();
			this.#live.set(sessionId, overlay);
		}
		const previous = overlay.get(key);
		overlay.set(key, normalized);
		this.#boost.set(sessionId, (this.#boost.get(sessionId) ?? 0) + 1);
		const text = normalized.text ?? "";
		const base = {
			turn: normalized.turn,
			step: normalized.step,
			ordinal: normalized.ordinal,
			...normalized.renderer === void 0 ? {} : { renderer: normalized.renderer },
			...normalized.answer === true ? { answer: true } : {}
		};
		this.#notify(sessionId, previous?.text !== void 0 && text.startsWith(previous.text) && normalized.answer === true === (previous.answer === true) ? {
			kind: "text",
			...base,
			append: text.slice(previous.text.length)
		} : {
			kind: "text",
			...base,
			text
		});
		this.#scheduleTextFlush(sessionId);
	}
	/** Persist any pending streaming transcript now (segment close, turn end). */
	flushTranscriptText(sessionId) {
		const timer = this.#flushTimers.get(sessionId);
		if (timer !== void 0) {
			clearTimeout(timer);
			this.#flushTimers.delete(sessionId);
		}
		return this.#flushLive(sessionId);
	}
	/** How many notifications this session has published. */
	sequence(sessionId) {
		return this.#seq.get(sessionId) ?? 0;
	}
	/** Restate where the stream stands without changing anything.
	*
	*  A reader detects a lost delta from the hole the NEXT one leaves, which
	*  never comes when the lost delta was the last of a turn -- exactly the
	*  case that leaves a finished tool group pulsing forever. Called at turn
	*  settlement, this gives that reader the one line it needs to disagree. */
	checkpoint(sessionId) {
		this.#deliver(sessionId, {
			kind: "checkpoint",
			seq: this.sequence(sessionId)
		});
	}
	#notify(sessionId, delta) {
		const seq = this.sequence(sessionId) + 1;
		this.#seq.set(sessionId, seq);
		this.#deliver(sessionId, {
			...delta,
			seq
		});
	}
	#deliver(sessionId, notification) {
		const set = this.#listeners.get(sessionId);
		if (set === void 0) return;
		for (const listener of [...set]) try {
			listener(notification);
		} catch {}
	}
	#merged(sessionId, base) {
		const overlay = this.#live.get(sessionId);
		const boost = this.#boost.get(sessionId) ?? 0;
		if ((overlay === void 0 || overlay.size === 0) && boost === 0) return base;
		return {
			...base,
			revision: base.revision + boost,
			...overlay === void 0 || overlay.size === 0 ? {} : { activities: mergeActivities(base.activities, [...overlay.values()]) }
		};
	}
	async #base(sessionId) {
		const cached = this.#latest.get(sessionId);
		if (cached !== void 0) return cached;
		const loaded = await this.#readNow(sessionId);
		this.#latest.set(sessionId, loaded);
		return loaded;
	}
	#scheduleTextFlush(sessionId) {
		if (this.#flushTimers.has(sessionId)) return;
		const timer = setTimeout(() => {
			this.#flushTimers.delete(sessionId);
			this.#flushLive(sessionId);
		}, TEXT_FLUSH_MS);
		timer.unref?.();
		this.#flushTimers.set(sessionId, timer);
	}
	async #flushLive(sessionId) {
		const overlay = this.#live.get(sessionId);
		if (overlay === void 0 || overlay.size === 0) return;
		const entries = [...overlay.entries()];
		try {
			await this.#update(sessionId, (current) => ({
				...current,
				activities: mergeActivities(current.activities, entries.map(([, value]) => value))
			}));
		} catch {
			return;
		}
		for (const [key, value] of entries) if (overlay.get(key) === value) overlay.delete(key);
		if (overlay.size === 0) this.#live.delete(sessionId);
	}
	writeBinding(sessionId, value) {
		const normalized = normalizeBinding(value);
		return this.#update(sessionId, (current) => ({
			...current,
			binding: normalized
		}));
	}
	appendActivity(sessionId, value) {
		const normalized = normalizeActivity(value);
		return this.#update(sessionId, (current) => ({
			...current,
			activities: mergeActivities(current.activities, [normalized])
		}), false, {
			kind: "activity",
			activity: normalized
		});
	}
	/** Record the mode the selector picked. No delta: the projection carries
	*  it as metadata, which the carrier refreshes on its own cadence. */
	writePermissionMode(sessionId, mode) {
		return this.#update(sessionId, (current) => ({
			...current,
			permissionMode: mode
		}), true);
	}
	/** Offer (or, with undefined, withdraw) the next-prompt suggestion. A write
	*  that changes nothing is skipped, so clearing at every turn start is free. */
	writePromptSuggestion(sessionId, value) {
		const text = value === void 0 ? void 0 : redactText(value, MAX_PROMPT_SUGGESTION_CHARS);
		return this.#update(sessionId, ({ promptSuggestion: _previous, ...current }) => ({
			...current,
			...text === void 0 ? {} : { promptSuggestion: text }
		}), true, text === void 0 ? { kind: "promptSuggestion" } : {
			kind: "promptSuggestion",
			value: text
		});
	}
	writeTasks(sessionId, value) {
		const normalized = normalizeTasksEvent(value);
		return this.#update(sessionId, (current) => ({
			...current,
			tasks: normalized
		}), false, {
			kind: "tasks",
			value: normalized
		});
	}
	/** Land one planned rewind: hidden ranges, surviving anchors, and the fork
	*  target the next Claude spawn consumes.
	*
	*  `droppedFromTurn` also drops the discarded turns' activity. The hidden
	*  ranges are surface seqs and activity records carry none, so a reader that
	*  works in turns — the plan panel, the task board — has nothing to filter
	*  on and would go on showing a plan the session no longer contains. This
	*  projection is rebuildable from the session log, so trimming it is not
	*  losing anything the log still holds. */
	writeRewind(sessionId, value, droppedFromTurn) {
		return this.#update(sessionId, (current) => ({
			...current,
			rewind: value,
			...droppedFromTurn === void 0 ? {} : { activities: current.activities.filter((activity) => activity.turn < droppedFromTurn) }
		}), false, { kind: "sync" });
	}
	/** Remember where Claude's chain ended for one completed DSH turn. */
	recordRewindAnchor(sessionId, turn, uuid) {
		return this.#update(sessionId, (current) => ({
			...current,
			rewind: recordRewindAnchor(current.rewind ?? EMPTY_REWIND_STATE, {
				turn,
				uuid
			})
		}));
	}
	/** Remember the working tree one DSH turn was admitted against. */
	recordRewindSnapshot(sessionId, turn, tree) {
		return this.#update(sessionId, (current) => ({
			...current,
			rewind: recordRewindSnapshot(current.rewind ?? EMPTY_REWIND_STATE, {
				turn,
				tree
			})
		}));
	}
	/** Disarm the fork target once a Claude process has resumed at it, so a
	*  later respawn continues the rewound session instead of re-truncating it. */
	clearRewindPending(sessionId) {
		return this.#update(sessionId, (current) => current.rewind?.pending === void 0 ? current : {
			...current,
			rewind: {
				ranges: current.rewind.ranges,
				anchors: current.rewind.anchors,
				snapshots: current.rewind.snapshots
			}
		});
	}
	importLegacy(sessionId, events) {
		const importedActivities = events.filter((event) => event.type === CLAUDE_ACTIVITY_EVENT).map((event) => activity(event.data)).filter((item) => item !== void 0);
		const importedBinding = latestClaudeSessionBinding(events);
		const importedTasks = latestClaudeTasks(events);
		return this.#update(sessionId, (current) => ({
			...current,
			activities: mergeActivities(importedActivities, current.activities),
			...current.binding !== void 0 || importedBinding === void 0 ? {} : { binding: normalizeBinding(importedBinding) },
			...current.tasks !== void 0 || importedTasks === void 0 ? {} : { tasks: normalizeTasksEvent(importedTasks.tasks) }
		}), true, { kind: "sync" });
	}
	#path(sessionId, root = this.root) {
		if (sessionId.length === 0 || sessionId.length > 1024) throw new Error("dsh-claude: invalid session id");
		return join(root, `${Buffer.from(sessionId).toString("base64url")}.json`);
	}
	/** Apply one change to the in-memory projection and persist it.
	*
	*  Every change below is built from values the matching normalizer already
	*  produced — the very ones `parseClaudeSidecar` would run again — so
	*  re-parsing the document here re-redacted and re-bounded every retained
	*  activity on every write. On a session holding a full activity window that
	*  was tens of milliseconds per SDK message, inside the streaming pump.
	*  Untrusted data still enters through exactly one door: `#readNow` parses the
	*  document that comes off disk. What is left to check here are the invariants
	*  a change itself could break. */
	#update(sessionId, change, skipUnchanged = false, delta) {
		const operation = (this.#pending.get(sessionId) ?? Promise.resolve()).catch(() => void 0).then(async () => {
			const current = await this.#base(sessionId);
			const changed = change(current);
			if (changed.activities.length > MAX_ACTIVITIES) throw new Error("dsh-claude: activity window overflow");
			if (skipUnchanged && JSON.stringify(changed) === JSON.stringify(current)) return current;
			const next = {
				...changed,
				schemaVersion: SIDECAR_SCHEMA_VERSION,
				revision: current.revision + 1
			};
			await this.#writeNow(sessionId, next);
			this.#latest.set(sessionId, next);
			if (delta !== void 0) this.#notify(sessionId, delta);
			return next;
		});
		this.#pending.set(sessionId, operation);
		operation.finally(() => {
			if (this.#pending.get(sessionId) === operation) this.#pending.delete(sessionId);
		}).catch(() => void 0);
		return operation;
	}
	async #readNow(sessionId) {
		try {
			return parseClaudeSidecar(JSON.parse(await readFile(this.#path(sessionId), "utf8")));
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		if (this.legacyRoot === void 0) return emptyProjection();
		try {
			return parseClaudeSidecar(JSON.parse(await readFile(this.#path(sessionId, this.legacyRoot), "utf8")));
		} catch (error) {
			if (error.code === "ENOENT") return emptyProjection();
			throw error;
		}
	}
	async #writeNow(sessionId, projection) {
		await mkdir(this.root, {
			recursive: true,
			mode: 448
		});
		await chmod(this.root, 448);
		const target = this.#path(sessionId);
		const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
		try {
			await writeFile(temporary, `${JSON.stringify(projection)}\n`, {
				mode: 384,
				flag: "wx"
			});
			await chmod(temporary, 384);
			await rename(temporary, target);
			await chmod(target, 384);
		} finally {
			await rm(temporary, { force: true }).catch(() => void 0);
		}
	}
};
//#endregion
//#region src/async-queue.ts
var AsyncQueueClosedError = class extends Error {
	constructor() {
		super("Async queue is closed");
		this.name = "AsyncQueueClosedError";
	}
};
var AsyncQueue = class {
	#values = [];
	#pending = [];
	#closed = false;
	#failure;
	get closed() {
		return this.#closed;
	}
	push(value) {
		if (this.#closed) throw new AsyncQueueClosedError();
		const waiter = this.#pending.shift();
		if (waiter !== void 0) waiter.resolve({
			value,
			done: false
		});
		else this.#values.push(value);
	}
	close() {
		if (this.#closed) return;
		this.#closed = true;
		for (const waiter of this.#pending.splice(0)) waiter.resolve({
			value: void 0,
			done: true
		});
	}
	fail(error) {
		if (this.#closed) return;
		this.#closed = true;
		this.#failure = error;
		for (const waiter of this.#pending.splice(0)) waiter.reject(error);
	}
	discard(error) {
		this.#values.splice(0);
		if (this.#closed) return;
		this.#closed = true;
		if (error === void 0) {
			for (const waiter of this.#pending.splice(0)) waiter.resolve({
				value: void 0,
				done: true
			});
			return;
		}
		this.#failure = error;
		for (const waiter of this.#pending.splice(0)) waiter.resolve({
			value: void 0,
			done: true
		});
	}
	next() {
		const value = this.#values.shift();
		if (value !== void 0) return Promise.resolve({
			value,
			done: false
		});
		if (this.#closed) return this.#failure === void 0 ? Promise.resolve({
			value: void 0,
			done: true
		}) : Promise.reject(this.#failure);
		return new Promise((resolve, reject) => {
			this.#pending.push({
				resolve,
				reject
			});
		});
	}
	return() {
		this.close();
		return Promise.resolve({
			value: void 0,
			done: true
		});
	}
	[Symbol.asyncIterator]() {
		return this;
	}
};
//#endregion
//#region src/plan-feedback.ts
const MAX_NOTES = 30;
const MAX_NOTE_CHARS = 2e3;
const MAX_QUOTE_CHARS = 1e3;
var PlanFeedbackError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "PlanFeedbackError";
		this.code = code;
	}
};
/** Validate and bound one submission's notes. */
function planNotesOf(value) {
	if (!Array.isArray(value) || value.length === 0 || value.length > MAX_NOTES) throw new PlanFeedbackError("invalid-request", "The review notes are invalid.");
	return value.map((item) => {
		const note = item !== null && typeof item === "object" ? item : void 0;
		const text = typeof note?.text === "string" ? note.text.trim() : "";
		if (text.length === 0 || text.length > MAX_NOTE_CHARS) throw new PlanFeedbackError("invalid-request", "A review note is empty or too long.");
		const quote = typeof note?.quote === "string" ? note.quote.trim().slice(0, MAX_QUOTE_CHARS) : "";
		return quote.length === 0 ? { text } : {
			quote,
			text
		};
	});
}
/** The notes as the reviewer wrote them, for the transcript: the quoted
*  passage then what they said about it, one note after another. */
function planNotesText(notes) {
	return notes.map((note) => note.quote === void 0 ? note.text : `${note.quote.split("\n").map((line) => `> ${line}`).join("\n")}\n${note.text}`).join("\n\n");
}
/** What Claude is told when the reviewer asks for changes.
*
*  Addressed to Claude rather than logged at it: a rejection it cannot act on
*  is the thing this whole path exists to replace. The quotes are fenced as
*  block quotes so a passage containing its own Markdown cannot be mistaken
*  for the reviewer's instruction. */
function planFeedbackMessage(notes) {
	return [
		"The user reviewed the plan in DeepSeek Harness and asked for changes rather than approving or rejecting it.",
		"",
		notes.map((note) => note.quote === void 0 ? note.text : `On this part of the plan:\n${note.quote.split("\n").map((line) => `> ${line}`).join("\n")}\n\n${note.text}`).join("\n\n---\n\n"),
		"",
		"Revise the plan accordingly and propose it again."
	].join("\n");
}
/** The seam between the panel's "send for changes" and the permission bridge
*  waiting on that plan's approval.
*
*  The approval promise lives inside the bridge and cannot be resolved from
*  outside, so the bridge races it against this gate instead: whichever
*  answers first decides, and the loser is aborted. One waiter per tool use —
*  a plan is approved once. */
var PlanFeedbackGate = class {
	#waiting = /* @__PURE__ */ new Map();
	/** Notes for the plan under `toolUseId`, or undefined when the wait is
	*  abandoned because the approval surface answered first. */
	wait(toolUseId, signal) {
		return new Promise((resolve) => {
			const settle = (notes) => {
				if (this.#waiting.get(toolUseId) === deliver) this.#waiting.delete(toolUseId);
				signal.removeEventListener("abort", onAbort);
				resolve(notes);
			};
			const deliver = (notes) => {
				settle(notes);
			};
			const onAbort = () => {
				settle(void 0);
			};
			if (signal.aborted) {
				resolve(void 0);
				return;
			}
			signal.addEventListener("abort", onAbort, { once: true });
			this.#waiting.set(toolUseId, deliver);
		});
	}
	/** Hand notes to a waiting plan approval. False when nothing is waiting —
	*  the plan was already decided, or never existed. */
	submit(toolUseId, notes) {
		const deliver = this.#waiting.get(toolUseId);
		if (deliver === void 0) return false;
		deliver(notes);
		return true;
	}
	/** Whether a plan is currently open for review. */
	pending(toolUseId) {
		return this.#waiting.has(toolUseId);
	}
};
//#endregion
//#region src/permission.ts
function denialMessage(outcome) {
	switch (outcome) {
		case "rejected": return "The user rejected this action in DeepSeek Harness.";
		case "cancelled": return "The permission request was cancelled in DeepSeek Harness.";
		case "unavailable": return "No DeepSeek Harness approval surface was available; the action was denied.";
		case "allowed-once": return "";
	}
}
/** Claude leaving plan mode is not an ordinary tool call: its argument is the
*  plan, written for the user, and the approval that follows is the user
*  agreeing to it. Everything else reads better as a prompt plus its input. */
const PLAN_TOOL = "ExitPlanMode";
const MAX_REASON_CHARS = 1200;
/** What the approval dialog says instead of the plan.
*
*  A plan is written to be read at length, and the approval dialog is a
*  cramped modal that renders its reason as plain text: pasting the plan there
*  turned a document into an unreadable wall. The decision stays with the Host
*  — this is still an ordinary tool approval — and the plan itself is drawn by
*  the plugin's own panel, where Markdown and the reader's chosen prose
*  palette both apply. The dialog only has to say what is being decided and
*  where to read it. */
const PLAN_APPROVAL_PROMPT = "Claude proposed a plan. Read it in the Plan panel, then approve or reject here.";
/** The plan an `ExitPlanMode` call carries, if it carries one.
*
*  Travels to the client on the permission activity's `text` field: `summary`
*  is capped at 1k and `detail` at 4k, both of which truncate a real plan,
*  while `text` holds 64k. Only `kind: 'text'` activities are drawn as prose
*  by the transcript, so a plan riding a `kind: 'permission'` record reaches
*  the panel without being painted twice. */
function planText(toolName, input) {
	if (toolName !== PLAN_TOOL) return void 0;
	return typeof input.plan === "string" && input.plan.length > 0 ? input.plan : void 0;
}
/** The session's approval-policy override, or undefined when it never switched.
*
*  The same fold the approval service does — the last `approval/policy` event
*  wins, because replaying the log IS the state. Read here rather than
*  imported so this package keeps its runtime surface to the Host services it
*  is actually handed. */
function approvalPolicyOf(events) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event?.type !== "approval/policy") continue;
		const policy = event.data.policy;
		return typeof policy === "string" ? policy : void 0;
	}
}
/** The policy that answers every request with `rejected` before reaching an
*  answerer, so no approval surface is ever shown. DSH writes it alongside
*  `sandbox/mode: danger-full-access` — Full access means "stop asking". */
const SILENT_POLICY = "never";
const ASKING_POLICY = "ask";
function permissionReason(toolName, input, options) {
	if (planText(toolName, input) !== void 0) return PLAN_APPROVAL_PROMPT;
	const title = options.title ?? options.description;
	const reason = options.decisionReason?.trim();
	const prompt = title === void 0 ? reason ?? `Claude Code wants to use ${toolName}.` : reason === void 0 || reason === title ? title : `${title}\n${reason}`;
	const detail = safeDetail(input);
	return boundText(detail === void 0 ? prompt : `${prompt}\nInput: ${detail}`, MAX_REASON_CHARS);
}
function mapApprovalOutcome(outcome, input, toolUseID) {
	if (outcome === "allowed-once") return {
		behavior: "allow",
		updatedInput: input,
		toolUseID,
		decisionClassification: "user_temporary"
	};
	return {
		behavior: "deny",
		message: denialMessage(outcome),
		toolUseID,
		decisionClassification: "user_reject"
	};
}
/** Hooks that turn an auto-mode block into a question for the user.
*
*  A classifier block is a denial Claude Code resolves on its own:
*  `canUseTool` never runs, so no DSH dialog appears. The CLI lets the user
*  approve it afterwards from `/permissions` (Recently denied → retry); DSH
*  has no such surface. So every block tells Claude it may retry, and the
*  retry of that exact call is forced to `ask`, which reaches `canUseTool`
*  and the ordinary DSH approval. The user still decides; a rejection there
*  reaches Claude as one. */
function createAutoModeEscalation() {
	const blocked = /* @__PURE__ */ new Map();
	const key = (toolName, input) => `${toolName}\n${JSON.stringify(input)}`;
	return {
		PermissionDenied: [{ hooks: [async (input) => {
			if (input.hook_event_name !== "PermissionDenied") return {};
			blocked.set(key(input.tool_name, input.tool_input), input.reason);
			return { hookSpecificOutput: {
				hookEventName: "PermissionDenied",
				retry: true
			} };
		}] }],
		PreToolUse: [{ hooks: [async (input) => {
			if (input.hook_event_name !== "PreToolUse") return {};
			const callKey = key(input.tool_name, input.tool_input);
			const reason = blocked.get(callKey);
			if (reason === void 0) return {};
			blocked.delete(callKey);
			return { hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "ask",
				permissionDecisionReason: `Auto mode blocked this action${reason.trim() === "" ? "" : ` (${reason.trim()})`}. Approve to run it anyway.`
			} };
		}] }]
	};
}
function createPermissionBridge(approval, activeContext, userQuestion, planFeedback) {
	return async (toolName, input, options) => {
		if (toolName === "AskUserQuestion") return userQuestion === void 0 ? {
			behavior: "deny",
			message: "DeepSeek Harness user questions are unavailable; the question was cancelled.",
			toolUseID: options.toolUseID,
			decisionClassification: "user_reject"
		} : userQuestion(input, options);
		const active = activeContext();
		if (active === void 0) return {
			behavior: "deny",
			message: "No active DeepSeek Harness turn owns this Claude Code action.",
			toolUseID: options.toolUseID,
			decisionClassification: "user_reject"
		};
		active.markActivity?.();
		const reason = permissionReason(toolName, input, options);
		const plan = planText(toolName, input);
		const session = active.agent.session;
		let silenced = false;
		try {
			await active.appendActivity({
				kind: "permission",
				phase: "started",
				toolUseId: options.toolUseID,
				toolName,
				title: options.displayName ?? toolName,
				summary: options.title ?? options.description ?? reason,
				detail: input,
				...plan === void 0 ? {} : { text: plan }
			});
			const userDecides = plan !== void 0;
			silenced = userDecides && approvalPolicyOf(session.snapshotEvents()) === SILENT_POLICY;
			if (silenced) session.append("approval/policy", { policy: ASKING_POLICY });
			const alreadyFullAccess = !userDecides && await active.hasFullAccess?.() === true;
			const revision = new AbortController();
			const notes = plan === void 0 || planFeedback === void 0 ? void 0 : planFeedback.wait(options.toolUseID, AbortSignal.any([options.signal, revision.signal]));
			const decided = new AbortController();
			const asked = alreadyFullAccess ? Promise.resolve("allowed-once") : approval.request({
				agent: active.agent,
				toolName,
				reason,
				signal: notes === void 0 ? options.signal : AbortSignal.any([options.signal, decided.signal])
			});
			const answer = notes === void 0 ? { outcome: await asked } : await Promise.race([asked.then((outcome) => {
				revision.abort();
				return { outcome };
			}), notes.then((value) => value === void 0 ? void 0 : { revisions: value })]).then(async (first) => {
				if (first !== void 0 && "revisions" in first) decided.abort();
				return first ?? { outcome: await asked };
			});
			if ("revisions" in answer) {
				const message = planFeedbackMessage(answer.revisions);
				active.recordDenial?.(options.toolUseID);
				await active.appendActivity({
					kind: "permission",
					phase: "denied",
					toolUseId: options.toolUseID,
					toolName,
					title: options.displayName ?? toolName,
					summary: "Sent back for changes in DeepSeek Harness",
					text: message
				});
				await active.appendActivity({
					kind: "steering",
					phase: "completed",
					title: PLAN_FEEDBACK_TITLE,
					summary: planNotesText(answer.revisions)
				});
				return {
					behavior: "deny",
					message,
					toolUseID: options.toolUseID,
					decisionClassification: "user_reject"
				};
			}
			const outcome = answer.outcome;
			const fullAccess = alreadyFullAccess || !userDecides && await active.hasFullAccess?.() === true;
			const effectiveOutcome = fullAccess ? "allowed-once" : outcome;
			const result = mapApprovalOutcome(effectiveOutcome, input, options.toolUseID);
			if (result.behavior === "deny") active.recordDenial?.(options.toolUseID);
			await active.appendActivity({
				kind: "permission",
				phase: effectiveOutcome === "allowed-once" ? "completed" : "denied",
				toolUseId: options.toolUseID,
				toolName,
				title: options.displayName ?? toolName,
				summary: fullAccess ? "Allowed by Full access in DeepSeek Harness" : effectiveOutcome === "allowed-once" ? "Allowed once in DeepSeek Harness" : denialMessage(effectiveOutcome)
			});
			return result;
		} catch (error) {
			const message = options.signal.aborted ? "The permission request was cancelled in DeepSeek Harness." : "DeepSeek Harness could not record or answer the permission request; the action was denied.";
			try {
				await active.appendActivity({
					kind: "permission",
					phase: "failed",
					toolUseId: options.toolUseID,
					toolName,
					title: options.displayName ?? toolName,
					summary: message,
					isError: true,
					detail: error
				});
			} catch {}
			return {
				behavior: "deny",
				message,
				toolUseID: options.toolUseID,
				decisionClassification: "user_reject"
			};
		} finally {
			try {
				if (silenced) session.append("approval/policy", { policy: SILENT_POLICY });
			} catch {}
		}
	};
}
//#endregion
//#region src/user-question.ts
const FAILURE_MESSAGE = "DeepSeek Harness could not collect an answer; the question was cancelled.";
const INVALID_MESSAGE = "Claude Code sent an invalid user-question request; the question was cancelled.";
function failureMessage(error) {
	const code = error !== null && typeof error === "object" && "code" in error ? error.code : void 0;
	return typeof code === "string" && /^[A-Z][A-Z0-9_]*$/.test(code) ? `${FAILURE_MESSAGE} (${code})` : FAILURE_MESSAGE;
}
function deny(message, toolUseID) {
	return {
		behavior: "deny",
		message,
		toolUseID,
		decisionClassification: "user_reject"
	};
}
function optionalText(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function parseQuestions(input, toolUseID) {
	if (!Array.isArray(input.questions) || input.questions.length === 0 || input.questions.length > 20) return void 0;
	const seen = /* @__PURE__ */ new Set();
	const questions = [];
	for (const [index, value] of input.questions.entries()) {
		if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
		const item = value;
		if (typeof item.question !== "string" || item.question.length === 0 || seen.has(item.question)) return void 0;
		seen.add(item.question);
		if (item.options !== void 0 && !Array.isArray(item.options)) return void 0;
		const options = (item.options ?? []).map((option) => {
			if (option === null || typeof option !== "object" || Array.isArray(option)) return void 0;
			const record = option;
			if (typeof record.label !== "string" || record.label.length === 0) return void 0;
			const description = optionalText(record.description);
			return {
				label: record.label,
				...description === void 0 ? {} : { description }
			};
		});
		if (options.some((option) => option === void 0)) return void 0;
		const header = optionalText(item.header);
		questions.push({
			id: `${toolUseID}:${index}`,
			question: item.question,
			...header === void 0 ? {} : { header },
			options,
			multiSelect: item.multiSelect === true
		});
	}
	return questions;
}
function answerText(answer, multiSelect) {
	if (answer === void 0) return "";
	const custom = optionalText(answer.custom);
	if (!multiSelect && custom !== void 0) return custom;
	return [...answer.selected, ...custom === void 0 ? [] : [custom]].join(", ");
}
function createUserQuestionBridge(userQuestions, activeContext) {
	return async (input, options) => {
		const active = activeContext();
		if (active === void 0) return deny("No active DeepSeek Harness turn owns this Claude Code question.", options.toolUseID);
		const questions = parseQuestions(input, options.toolUseID);
		if (questions === void 0) return deny(INVALID_MESSAGE, options.toolUseID);
		active.markActivity?.();
		try {
			await active.appendActivity({
				kind: "question",
				phase: "started",
				toolUseId: options.toolUseID,
				toolName: "AskUserQuestion",
				title: "Claude asked a question",
				summary: questions.length === 1 ? questions[0].question : `Claude asked ${questions.length} questions`
			});
			const response = await userQuestions.ask({
				questions,
				agent: active.agent,
				signal: options.signal
			});
			const answersById = new Map(response.answers.map((answer) => [answer.id, answer]));
			const answers = Object.fromEntries(questions.map((question) => [question.question, answerText(answersById.get(question.id), question.multiSelect === true)]));
			const chosen = questions.map((question) => answerText(answersById.get(question.id), question.multiSelect === true)).filter((text) => text.length > 0);
			await active.appendActivity({
				kind: "question",
				phase: "completed",
				toolUseId: options.toolUseID,
				toolName: "AskUserQuestion",
				title: "Claude asked a question",
				summary: chosen.length === 0 ? "Answered in DeepSeek Harness" : `Answered in DeepSeek Harness · ${chosen.join(" / ")}`,
				detail: { answers }
			});
			return {
				behavior: "allow",
				updatedInput: {
					...input,
					answers
				},
				toolUseID: options.toolUseID,
				decisionClassification: "user_temporary"
			};
		} catch (error) {
			const message = failureMessage(error);
			try {
				await active.appendActivity({
					kind: "question",
					phase: "failed",
					toolUseId: options.toolUseID,
					toolName: "AskUserQuestion",
					title: "Claude asked a question",
					summary: message,
					isError: true
				});
			} catch {}
			return deny(message, options.toolUseID);
		}
	};
}
//#endregion
//#region src/sdk-messages.ts
function record$16(value) {
	return value !== null && typeof value === "object" ? value : void 0;
}
function string$3(value) {
	return typeof value === "string" ? value : void 0;
}
function finiteNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function taskUsageOf(usage) {
	if (usage === void 0) return void 0;
	const normalized = {};
	if (typeof usage.total_tokens === "number") normalized.totalTokens = usage.total_tokens;
	if (typeof usage.tool_uses === "number") normalized.toolUses = usage.tool_uses;
	if (typeof usage.duration_ms === "number") normalized.durationMs = usage.duration_ms;
	return Object.keys(normalized).length === 0 ? void 0 : normalized;
}
/** Read one Anthropic `usage` envelope. Shared by the per-call sample on an
*  assistant message and the turn total on a result message. */
function usageOf(usage) {
	const normalized = {};
	if (usage === void 0) return normalized;
	if (typeof usage.input_tokens === "number") normalized.inputTokens = usage.input_tokens;
	if (typeof usage.output_tokens === "number") normalized.outputTokens = usage.output_tokens;
	if (typeof usage.cache_read_input_tokens === "number") normalized.cacheReadTokens = usage.cache_read_input_tokens;
	if (typeof usage.cache_creation_input_tokens === "number") normalized.cacheCreationTokens = usage.cache_creation_input_tokens;
	return normalized;
}
function hasUsageCounts(usage) {
	return usage.inputTokens !== void 0 || usage.outputTokens !== void 0 || usage.cacheReadTokens !== void 0 || usage.cacheCreationTokens !== void 0;
}
function resultUsage(message) {
	const normalized = usageOf(record$16(message.usage));
	if (typeof message.total_cost_usd === "number") normalized.cumulativeCostUsd = message.total_cost_usd;
	return normalized;
}
function normalizeAssistant(message) {
	const envelope = record$16(message.message);
	const content = envelope?.content;
	if (!Array.isArray(content)) return [{
		kind: "protocol-error",
		title: "Malformed Claude assistant message",
		detail: message
	}];
	const parentToolUseId = string$3(message.parent_tool_use_id);
	const normalized = [];
	for (const item of content) {
		const block = record$16(item);
		if (block === void 0) continue;
		if (block.type === "text") {
			const text = string$3(block.text);
			if (text !== void 0 && text.length > 0) normalized.push({
				kind: "assistant-text",
				text,
				...parentToolUseId === void 0 ? {} : { parentToolUseId }
			});
		} else if (block.type === "thinking") {
			const text = string$3(block.thinking);
			if (text !== void 0 && text.length > 0) normalized.push({
				kind: "thinking",
				text,
				phase: "completed",
				...parentToolUseId === void 0 ? {} : { parentToolUseId }
			});
		} else if (block.type === "tool_use") {
			const toolUseId = string$3(block.id);
			const toolName = string$3(block.name);
			if (toolUseId !== void 0 && toolName !== void 0) normalized.push({
				kind: "tool-call",
				toolUseId,
				toolName,
				input: block.input,
				...parentToolUseId === void 0 ? {} : { parentToolUseId }
			});
		}
	}
	const usage = usageOf(record$16(envelope?.usage));
	if (hasUsageCounts(usage)) normalized.push({
		kind: "request-usage",
		usage,
		...parentToolUseId === void 0 ? {} : { parentToolUseId }
	});
	return normalized;
}
function normalizeUser(message) {
	if (message.isReplay === true) return [];
	const content = record$16(message.message)?.content;
	if (typeof content === "string") return [];
	if (!Array.isArray(content)) return [{
		kind: "protocol-error",
		title: "Malformed Claude user message",
		detail: message
	}];
	const parentToolUseId = string$3(message.parent_tool_use_id);
	const normalized = [];
	for (const item of content) {
		const block = record$16(item);
		if (block?.type !== "tool_result") continue;
		const toolUseId = string$3(block.tool_use_id);
		if (toolUseId === void 0) continue;
		normalized.push({
			kind: "tool-result",
			toolUseId,
			output: message.tool_use_result ?? block.content,
			...message.tool_use_result === void 0 ? {} : { content: block.content },
			isError: block.is_error === true,
			...parentToolUseId === void 0 ? {} : { parentToolUseId }
		});
	}
	return normalized;
}
function normalizeSystem(message) {
	const subtype = string$3(message.subtype);
	if (subtype === "init") {
		const sessionId = string$3(message.session_id);
		const cliVersion = string$3(message.claude_code_version);
		const cwd = string$3(message.cwd);
		return sessionId !== void 0 && cliVersion !== void 0 && cwd !== void 0 ? [{
			kind: "init",
			sessionId,
			cliVersion,
			cwd
		}] : [{
			kind: "protocol-error",
			title: "Malformed Claude initialization message",
			detail: message
		}];
	}
	if (subtype === "status") {
		const status = message.status;
		if (status === null) return [{
			kind: "status",
			title: "Claude Code is ready"
		}];
		return [{
			kind: "status",
			title: `Claude Code ${String(status)}`,
			detail: message
		}];
	}
	if (subtype === "session_state_changed") return [{
		kind: "status",
		title: `Claude session ${String(message.state)}`
	}];
	if (subtype === "permission_denied") {
		const toolUseId = string$3(message.tool_use_id);
		const toolName = string$3(message.tool_name);
		if (toolUseId !== void 0 && toolName !== void 0) return [{
			kind: "permission-denied",
			toolUseId,
			toolName,
			summary: string$3(message.message) ?? "Claude Code denied the action"
		}];
	}
	if (subtype === "task_started") {
		const taskId = string$3(message.task_id);
		const description = string$3(message.description);
		const subagentType = string$3(message.subagent_type);
		const taskType = string$3(message.task_type);
		const taskToolUseId = string$3(message.tool_use_id);
		return [{
			kind: "subagent",
			title: description ?? taskId ?? "Claude subagent started",
			phase: "started",
			detail: message,
			...taskId === void 0 ? {} : { taskId },
			...taskToolUseId === void 0 ? {} : { toolUseId: taskToolUseId },
			taskStatus: "running",
			...description === void 0 ? {} : { description },
			...subagentType === void 0 ? {} : { subagentType },
			...taskType === void 0 ? {} : { taskType },
			...message.skip_transcript === true ? { skipTranscript: true } : {},
			...typeof message.is_backgrounded === "boolean" ? { backgrounded: message.is_backgrounded } : {}
		}];
	}
	if (subtype === "task_progress") {
		const taskId = string$3(message.task_id);
		const description = string$3(message.description);
		const summary = string$3(message.summary);
		const taskToolUseId = string$3(message.tool_use_id);
		const subagentType = string$3(message.subagent_type);
		const lastToolName = string$3(message.last_tool_name);
		const usage = taskUsageOf(record$16(message.usage));
		return [{
			kind: "subagent",
			title: summary ?? description ?? "Claude subagent update",
			phase: "updated",
			detail: message,
			...taskId === void 0 ? {} : { taskId },
			...taskToolUseId === void 0 ? {} : { toolUseId: taskToolUseId },
			taskStatus: "running",
			...subagentType === void 0 ? {} : { subagentType },
			...lastToolName === void 0 ? {} : { lastToolName },
			...summary === void 0 ? {} : { summary },
			...usage === void 0 ? {} : { usage }
		}];
	}
	if (subtype === "task_updated") {
		const patch = record$16(message.patch);
		const status = string$3(patch?.status);
		const taskId = string$3(message.task_id);
		const taskToolUseId = string$3(message.tool_use_id);
		const description = string$3(patch?.description);
		const error = string$3(patch?.error);
		const taskStatus = status === void 0 ? void 0 : status === "killed" ? "killed" : status === "completed" ? "completed" : status === "failed" ? "failed" : "running";
		return [{
			kind: "subagent",
			title: description ?? "Claude subagent update",
			phase: status === "failed" || status === "killed" ? "failed" : status === "completed" ? "completed" : "updated",
			detail: message,
			...taskId === void 0 ? {} : { taskId },
			...taskToolUseId === void 0 ? {} : { toolUseId: taskToolUseId },
			...taskStatus === void 0 ? {} : { taskStatus },
			...description === void 0 ? {} : { description },
			...error === void 0 ? {} : { summary: error }
		}];
	}
	if (subtype === "task_notification") {
		const failed = message.status === "failed";
		const stopped = message.status === "stopped" || message.status === "cancelled";
		const taskId = string$3(message.task_id);
		const summary = string$3(message.summary);
		const taskToolUseId = string$3(message.tool_use_id);
		const taskStatus = failed ? "failed" : stopped ? "stopped" : "completed";
		const usage = taskUsageOf(record$16(message.usage));
		const outputFile = string$3(message.output_file);
		return [{
			kind: "subagent",
			title: summary ?? taskId ?? "Claude subagent finished",
			phase: failed || stopped ? "failed" : "completed",
			detail: message,
			...taskId === void 0 ? {} : { taskId },
			...taskToolUseId === void 0 ? {} : { toolUseId: taskToolUseId },
			taskStatus,
			...summary === void 0 ? {} : { summary },
			...usage === void 0 ? {} : { usage },
			...outputFile === void 0 ? {} : { outputFile }
		}];
	}
	if (subtype === "background_tasks_changed") return [{
		kind: "background-tasks",
		tasks: (Array.isArray(message.tasks) ? message.tasks : []).flatMap((item) => {
			const entry = record$16(item);
			const taskId = string$3(entry?.task_id);
			const description = string$3(entry?.description);
			const taskType = string$3(entry?.task_type);
			if (taskId === void 0 || description === void 0) return [];
			return [{
				taskId,
				description,
				...taskType === void 0 ? {} : { taskType },
				...entry?.ambient === true ? { ambient: true } : {}
			}];
		})
	}];
	if (subtype === "api_retry") {
		const attempt = finiteNumber(message.attempt);
		const maxRetries = finiteNumber(message.max_retries);
		const status = finiteNumber(message.error_status);
		const summary = [attempt === void 0 ? void 0 : maxRetries === void 0 ? `attempt ${attempt}` : `attempt ${attempt} of ${maxRetries}`, status === void 0 ? string$3(message.error) : `HTTP ${status}`].filter((part) => part !== void 0).join(" · ");
		return [{
			kind: "warning",
			title: API_RETRY_TITLE,
			...summary === "" ? {} : { summary },
			detail: message
		}];
	}
	if (subtype === "compact_boundary") {
		const metadata = record$16(message.compact_metadata);
		const trigger = metadata?.trigger === "auto" || metadata?.trigger === "manual" ? metadata.trigger : void 0;
		const preTokens = finiteNumber(metadata?.pre_tokens);
		const postTokens = finiteNumber(metadata?.post_tokens);
		const durationMs = finiteNumber(metadata?.duration_ms);
		return [{
			kind: "compaction",
			...trigger === void 0 ? {} : { trigger },
			...preTokens === void 0 ? {} : { preTokens },
			...postTokens === void 0 ? {} : { postTokens },
			...durationMs === void 0 ? {} : { durationMs }
		}];
	}
	if (subtype === "informational" || subtype === "notification" || subtype === "local_command_output") return [{
		kind: message.level === "warning" ? "warning" : "status",
		title: string$3(message.content) ?? string$3(message.text) ?? "Claude Code notice",
		detail: message
	}];
	if (subtype !== void 0 && CLAUDE_PROGRESS_SUBTYPES.has(subtype)) return [{
		kind: "progress",
		subtype
	}];
	if (subtype?.startsWith("hook_") === true || subtype === "plugin_install") return [{
		kind: "status",
		title: claudeStatusTitle(subtype),
		detail: message
	}];
	if (subtype !== void 0) return [{
		kind: "status",
		title: claudeStatusTitle(subtype),
		detail: message
	}];
	return [];
}
const RESULT_ERROR_SUBTYPES = /* @__PURE__ */ new Set([
	"error_during_execution",
	"error_max_turns",
	"error_max_budget_usd",
	"error_max_structured_output_retries"
]);
function normalizeSdkMessage(message) {
	const value = message;
	if (value.type === "stream_event") {
		const event = record$16(value.event);
		const parentToolUseId = string$3(value.parent_tool_use_id);
		if (event?.type === "content_block_delta") {
			const delta = record$16(event.delta);
			if (delta?.type === "text_delta") {
				const text = string$3(delta.text);
				return text === void 0 ? [] : [{
					kind: "text-delta",
					text,
					...parentToolUseId === void 0 ? {} : { parentToolUseId }
				}];
			}
			if (delta?.type === "thinking_delta") {
				const text = string$3(delta.thinking);
				return text === void 0 ? [] : [{
					kind: "thinking",
					text,
					phase: "updated",
					...parentToolUseId === void 0 ? {} : { parentToolUseId }
				}];
			}
		}
		if (event?.type === "message_delta") {
			const usage = usageOf(record$16(event.usage));
			return hasUsageCounts(usage) ? [{
				kind: "request-usage",
				usage,
				...parentToolUseId === void 0 ? {} : { parentToolUseId }
			}] : [];
		}
		return [];
	}
	if (value.type === "assistant") return normalizeAssistant(value);
	if (value.type === "user") return normalizeUser(value);
	if (value.type === "system") return normalizeSystem(value);
	if (value.type === "result") {
		const sessionId = string$3(value.session_id);
		if (sessionId === void 0 || value.subtype !== "success" && !RESULT_ERROR_SUBTYPES.has(String(value.subtype))) return [{
			kind: "protocol-error",
			title: "Malformed Claude result message",
			detail: value
		}];
		const success = value.subtype === "success" && value.is_error !== true;
		const errors = Array.isArray(value.errors) ? value.errors.filter((item) => typeof item === "string") : void 0;
		const terminalReason = string$3(value.terminal_reason);
		const failureDetail = !success && typeof value.result === "string" && value.result.trim().length > 0 ? value.result : void 0;
		const userMessageUuid = string$3(value.user_message_uuid);
		const queuedTurnCount = finiteNumber(value.queued_turn_count);
		const permissionDenials = Array.isArray(value.permission_denials) ? value.permission_denials.map((item) => record$16(item)).filter((item) => item !== void 0).map((item) => {
			const toolName = string$3(item.tool_name);
			const toolUseId = string$3(item.tool_use_id);
			return toolName === void 0 || toolUseId === void 0 ? void 0 : {
				toolName,
				toolUseId
			};
		}).filter((item) => item !== void 0).slice(0, 40) : void 0;
		return [{
			kind: "result",
			success,
			...success && typeof value.result === "string" ? { text: value.result } : {},
			...errors === void 0 ? {} : { errors },
			...failureDetail === void 0 ? {} : { failureDetail },
			...terminalReason === void 0 ? {} : { terminalReason },
			...permissionDenials === void 0 || permissionDenials.length === 0 ? {} : { permissionDenials },
			usage: resultUsage(value),
			sessionId,
			...userMessageUuid === void 0 ? {} : { userMessageUuid },
			...queuedTurnCount === void 0 ? {} : { queuedTurnCount }
		}];
	}
	if (value.type === "prompt_suggestion") {
		const text = string$3(value.suggestion)?.trim();
		return text === void 0 || text.length === 0 ? [] : [{
			kind: "prompt-suggestion",
			text
		}];
	}
	if (value.type === "auth_status") return [{
		kind: value.error === void 0 ? "status" : "warning",
		title: value.error === void 0 ? "Claude authentication status changed" : "Claude authentication failed",
		detail: value.error ?? value.output
	}];
	if (value.type === "rate_limit_event") {
		const status = string$3(record$16(value.rate_limit_info)?.status);
		return [{
			kind: "status",
			title: status !== void 0 && status !== "allowed" ? "Claude rate limit is blocking requests" : "Claude rate limit status changed",
			detail: value.rate_limit_info
		}];
	}
	if (value.type === "tool_progress") return [{
		kind: "progress",
		subtype: "tool_progress"
	}];
	if (value.type === "command_lifecycle") return [{
		kind: "progress",
		subtype: "command_lifecycle"
	}];
	const unknownType = String(value.type);
	return [{
		kind: "unknown",
		type: unknownType,
		title: `${CLAUDE_UNKNOWN_MESSAGE_PREFIX}${unknownType}`,
		detail: value
	}];
}
//#endregion
//#region src/plan-usage.ts
/** Claude.ai plan rate-limit windows behind the CLI's `/usage` panel.
*
*  The Agent SDK exposes them through an experimental query method whose name
*  advertises its own instability, so every read is guarded: a missing method,
*  a shape change, or an API-key session all degrade to `available: false`
*  instead of breaking the settings page. */
/** The SDK's own name for the unstable `/usage` control request; it is
*  documented to change when the API stabilizes, so it lives in one place. */
const PLAN_USAGE_METHOD = "usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET";
/** A throwaway probe should not outlive a wedged control request. */
const PLAN_USAGE_TIMEOUT_MS = 2e4;
/** Invoke the experimental usage control request, or say why we cannot. */
function readPlanUsageFrom(query) {
	const read = query[PLAN_USAGE_METHOD];
	if (typeof read !== "function") throw new Error("dsh-claude: this Claude Agent SDK build exposes no plan usage API");
	return read.call(query);
}
/** Fixed windows in display order; the SDK omits the ones a plan does not have. */
const FIXED_WINDOWS = [
	"five_hour",
	"seven_day",
	"seven_day_opus",
	"seven_day_sonnet"
];
function record$15(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
/** Utilization is documented as 0-100; clamp so a server glitch cannot render
*  a bar wider than its track or a negative width. */
function utilization(value) {
	return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : void 0;
}
function resetsAt(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function window(id, source, label) {
	const entry = record$15(source);
	if (entry === void 0) return void 0;
	const used = utilization(entry.utilization);
	const reset = resetsAt(entry.resets_at);
	if (used === void 0 && reset === void 0) return void 0;
	return {
		id,
		...label === void 0 ? {} : { label },
		...used === void 0 ? {} : { utilization: used },
		...reset === void 0 ? {} : { resetsAt: reset }
	};
}
/** Project the SDK's `/usage` response onto the windows the settings card shows. */
function normalizePlanUsage(value, fetchedAt) {
	const response = record$15(value);
	const subscription = typeof response?.subscription_type === "string" ? response.subscription_type : void 0;
	const limits = record$15(response?.rate_limits);
	if (response?.rate_limits_available !== true || limits === void 0) return {
		available: false,
		...subscription === void 0 ? {} : { subscription },
		windows: [],
		fetchedAt
	};
	const windows = [...FIXED_WINDOWS.map((id) => window(id, limits[id])), ...(Array.isArray(limits.model_scoped) ? limits.model_scoped : []).map((entry, index) => {
		const name = record$15(entry)?.display_name;
		return window(`model:${typeof name === "string" ? name : index}`, entry, typeof name === "string" ? name : void 0);
	})].filter((entry) => entry !== void 0);
	return {
		available: windows.length > 0,
		...subscription === void 0 ? {} : { subscription },
		windows,
		fetchedAt
	};
}
/** Read plan limits from a throwaway Claude process.
*
*  Deliberately NOT routed through the supervisor. Borrowing a session's
*  process fails outright while that session is mid-turn, and for a session
*  with no process yet it would resume the whole conversation — and possibly
*  evict another idle session to make room — just to read three numbers. This
*  query carries no tools, no permission bridge, and no session binding: it
*  starts, answers one control request, and is killed. */
async function probePlanUsage(executablePath, fetchedAt, factory = query) {
	const lifetime = new AbortController();
	const timer = setTimeout(() => lifetime.abort(), PLAN_USAGE_TIMEOUT_MS);
	timer.unref?.();
	const query$1 = factory({
		prompt: (async function* () {
			await new Promise(() => {});
		})(),
		options: {
			cwd: process.cwd(),
			abortController: lifetime,
			...executablePath.length === 0 ? {} : { pathToClaudeCodeExecutable: executablePath }
		}
	});
	try {
		(async () => {
			for await (const _ of query$1);
		})().catch(() => void 0);
		return normalizePlanUsage(await Promise.race([readPlanUsageFrom(query$1), new Promise((_resolve, reject) => {
			setTimeout(() => reject(/* @__PURE__ */ new Error("dsh-claude: the plan usage request did not answer in time")), PLAN_USAGE_TIMEOUT_MS).unref?.();
		})]), fetchedAt);
	} finally {
		clearTimeout(timer);
		lifetime.abort();
	}
}
let latest;
function recordPlanUsage(report) {
	latest = report;
}
function latestPlanUsage() {
	return latest;
}
//#endregion
//#region src/worktree-snapshot.ts
/** Working-tree snapshots taken and restored with git's own plumbing.
*
*  A rewind that only truncates Claude's transcript leaves the files Claude
*  wrote on disk, so the next turn resumes against a checkout the model no
*  longer remembers writing. Git already stores trees: a throwaway index turns
*  the working tree into one tree object without touching HEAD, the real
*  index, or the checkout, and a restore reads that tree back.
*
*  Ignored files stay outside the snapshot in both directions. `git add -A`
*  honours `.gitignore`, so build output and `node_modules` are neither
*  captured nor removed.
*/
const MAX_OUTPUT_BYTES$4 = 65536;
/** `add -A` walks the whole checkout; a large repository needs more than the
*  status probes' five seconds, and this sits in front of every turn. */
const GIT_TIMEOUT_MS$4 = 3e4;
const OBJECT_NAME = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/u;
/** A snapshot holds the bytes on disk, not git's line-ending translation of
*  them. Under `core.autocrlf=true` a plain `add` would store LF and the
*  restore would write CRLF, so a rewind on Windows would flip every LF file. */
const GIT_OPTIONS = ["-c", "core.autocrlf=false"];
async function collect$4(handle) {
	return {
		exitCode: (await handle.done).exitCode,
		stdout: handle.collected.stdout?.readFrom(0).text ?? ""
	};
}
async function run$1(runtime, git, args, cwd, env = {}) {
	return collect$4(runtime.spawn({
		argv: [
			git,
			...GIT_OPTIONS,
			...args
		],
		cwd,
		stdio: {
			stdin: "ignore",
			stdout: { maxBytes: MAX_OUTPUT_BYTES$4 },
			stderr: { maxBytes: MAX_OUTPUT_BYTES$4 }
		},
		graceMs: 1e3,
		signal: AbortSignal.timeout(GIT_TIMEOUT_MS$4),
		env
	}));
}
/** Capture the working tree as a git tree object.
*
*  Undefined whenever git cannot answer -- no git, not a repository, a locked
*  or broken checkout. Snapshots are advisory: a turn without one simply
*  cannot offer a file rewind, and must never fail for it.
*
*  ponytail: the tree is unreachable from any ref, so `git gc --prune` will
*  eventually collect it. Two weeks is git's default grace period and a rewind
*  happens minutes after the turn it undoes; anchor it to a real ref only if
*  snapshots ever need to outlive a gc.
*/
async function captureWorktreeTree(runtime, cwd) {
	let git;
	try {
		git = await runtime.resolveExecutable("git", toolPathEnv());
	} catch {
		return;
	}
	const indexFile = join(tmpdir(), `dsh-claude-index-${process.pid}-${randomUUID()}`);
	const env = { GIT_INDEX_FILE: indexFile };
	try {
		await run$1(runtime, git, ["read-tree", "HEAD"], cwd, env);
		if ((await run$1(runtime, git, ["add", "-A"], cwd, env)).exitCode !== 0) return void 0;
		const written = await run$1(runtime, git, ["write-tree"], cwd, env);
		const tree = written.stdout.trim();
		return written.exitCode === 0 && OBJECT_NAME.test(tree) ? tree : void 0;
	} catch {
		return;
	} finally {
		await rm(indexFile, { force: true }).catch(() => void 0);
	}
}
/** Put a captured tree back over the working tree, reporting whether it landed.
*
*  Files the tree holds are rewritten, and files created after the snapshot are
*  removed. Nothing outside the snapshot's own scope is touched: ignored files
*  survive, because `clean` runs without `-x`.
*/
async function restoreWorktreeTree(runtime, cwd, tree) {
	if (!OBJECT_NAME.test(tree)) return false;
	let git;
	try {
		git = await runtime.resolveExecutable("git", toolPathEnv());
	} catch {
		return false;
	}
	try {
		const kind = await run$1(runtime, git, [
			"cat-file",
			"-t",
			tree
		], cwd);
		if (kind.exitCode !== 0 || kind.stdout.trim() !== "tree") return false;
		if ((await run$1(runtime, git, [
			"read-tree",
			"--reset",
			"-u",
			tree
		], cwd)).exitCode !== 0) return false;
		await run$1(runtime, git, ["clean", "-fd"], cwd);
		await run$1(runtime, git, [
			"reset",
			"--mixed",
			"HEAD"
		], cwd);
		return true;
	} catch {
		return false;
	}
}
//#endregion
//#region src/host-jobs.ts
/**
* Mirror Claude Code's background tasks into the Host job registry
* (`ctx.jobs`), so they show up in the session header's background-job list
* with live output and a working stop button. Claude Code still owns the
* work; this is presentation plus a kill relay.
*
* Output: the CLI writes each task's stream to `<taskId>.output` and names
* that path in the tool result that backgrounded the command, so the path is
* lifted from tool results while the task runs. When no path was seen, the
* `task_notification.output_file` at settlement is used instead: the
* registry drains pull sources once more before it closes the ring, so the
* whole file lands then.
*/
function hostJobKind(taskType) {
	if (taskType === "local_bash") return "bash";
	return taskType === "local_agent" || taskType === "in_process_teammate" ? "subagent" : "claude";
}
/** The live progress line: the CLI's own summary, else what the task is up to. */
function hostJobProgress(update) {
	if (update.summary !== void 0) return update.summary;
	const parts = [];
	if (update.lastToolName !== void 0) parts.push(update.lastToolName);
	if (update.usage?.toolUses !== void 0) parts.push(`${update.usage.toolUses} tools`);
	if (update.usage?.totalTokens !== void 0) parts.push(`${formatTokens(update.usage.totalTokens)} tok`);
	return parts.length === 0 ? void 0 : parts.join(" · ");
}
function formatTokens(tokens) {
	return tokens >= 1e3 ? `${(tokens / 1e3).toFixed(1)}k` : String(tokens);
}
/** How long a task that left the live set may wait for its notification
*  (which carries the real status) before it is settled as completed. */
const HOST_JOB_SETTLE_GRACE_MS = 2e3;
const OUTPUT_PATH = /([^\s"'`]+[\\/]([A-Za-z0-9_-]+)\.output)(?!\w)/g;
function keyOf(sessionId, taskId) {
	return `${sessionId}\n${taskId}`;
}
function readOutput(job, from) {
	const none = {
		text: "",
		nextOffset: from,
		lossy: false
	};
	if (job.path === void 0) return none;
	let fd;
	try {
		fd = openSync(job.path, "r");
	} catch {
		return none;
	}
	try {
		const buffer = Buffer.allocUnsafe(65536);
		const chunks = [];
		let position = from;
		for (;;) {
			const read = readSync(fd, buffer, 0, buffer.length, position);
			if (read === 0) break;
			chunks.push(job.decoder.write(buffer.subarray(0, read)));
			position += read;
		}
		return {
			text: chunks.join(""),
			nextOffset: position,
			lossy: false,
			spillPath: job.path
		};
	} finally {
		closeSync(fd);
	}
}
/** The terminal reason the row shows: the exit code when the summary names
*  one, otherwise the failure summary itself. */
function hostJobDetail(status, summary) {
	const exitCode = summary === void 0 ? null : /exit code:? (\d+)/i.exec(summary);
	if (exitCode !== null) return `exit code: ${exitCode[1]}`;
	if (status === "failed" && summary !== void 0) return summary.length > 200 ? `${summary.slice(0, 199)}…` : summary;
}
var ClaudeHostJobs = class {
	#registry;
	#warn;
	#jobs = /* @__PURE__ */ new Map();
	/** Output paths seen in tool results before the task itself registered. */
	#paths = /* @__PURE__ */ new Map();
	#warned = false;
	constructor(registry, warn) {
		this.#registry = registry;
		this.#warn = warn;
	}
	/** Register one detached task; `stop` relays the Host's kill to the CLI. */
	started(sessionId, taskId, kind, label, stop) {
		const key = keyOf(sessionId, taskId);
		if (this.#jobs.has(key)) return;
		const registry = this.#registry();
		if (registry === void 0) return;
		const job = {
			decoder: new StringDecoder("utf8"),
			stop
		};
		const path = this.#paths.get(key);
		if (path !== void 0) {
			this.#paths.delete(key);
			job.path = path;
		}
		try {
			registry.start({
				kind,
				label,
				owner: sessionId,
				output: [{
					channel: "stdout",
					read: (from) => readOutput(job, from)
				}],
				run: (handle) => {
					job.handle = handle;
					return {
						cancel: () => {
							job.stop().catch((error) => {
								this.#warn(`dsh-claude: stopping Claude task ${taskId} failed: ${error instanceof Error ? error.message : String(error)}`);
							});
						},
						done: new Promise((resolve) => {
							job.settle = resolve;
						})
					};
				}
			});
			this.#jobs.set(key, job);
		} catch (error) {
			if (this.#warned) return;
			this.#warned = true;
			this.#warn(`dsh-claude: Host background-job list unavailable: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	progress(sessionId, taskId, line) {
		this.#jobs.get(keyOf(sessionId, taskId))?.handle.updateProgress(line);
	}
	/** Lift `<taskId>.output` paths out of a tool result. */
	noteOutput(sessionId, output) {
		for (const text of strings(output)) {
			if (!text.includes(".output")) continue;
			for (const match of text.matchAll(OUTPUT_PATH)) {
				const key = keyOf(sessionId, match[2]);
				const job = this.#jobs.get(key);
				if (job === void 0) this.#paths.set(key, match[1]);
				else job.path ??= match[1];
			}
		}
	}
	/** The level signal dropped the task; settle it as completed unless the
	*  notification with the real status arrives within the grace period. */
	removed(sessionId, taskId) {
		const job = this.#jobs.get(keyOf(sessionId, taskId));
		if (job === void 0 || job.removal !== void 0) return;
		job.removal = setTimeout(() => {
			this.settled(sessionId, taskId, "completed");
		}, HOST_JOB_SETTLE_GRACE_MS);
		job.removal.unref?.();
	}
	settled(sessionId, taskId, status, summary, outputFile) {
		const key = keyOf(sessionId, taskId);
		const job = this.#jobs.get(key);
		this.#paths.delete(key);
		if (job === void 0) return;
		this.#jobs.delete(key);
		if (job.removal !== void 0) clearTimeout(job.removal);
		if (outputFile !== void 0) job.path ??= outputFile;
		const detail = hostJobDetail(status, summary);
		job.settle({
			status: status === "completed" ? "completed" : status === "failed" ? "failed" : "killed",
			...detail === void 0 ? {} : { detail }
		});
	}
	/** The CLI process behind these tasks is gone; nothing will report them. */
	abandon(sessionId) {
		const prefix = `${sessionId}\n`;
		for (const key of [...this.#jobs.keys()]) if (key.startsWith(prefix)) this.settled(sessionId, key.slice(prefix.length), "failed", "Claude Code exited");
		for (const key of [...this.#paths.keys()]) if (key.startsWith(prefix)) this.#paths.delete(key);
	}
};
/** Every string inside a tool result. Scanned one by one rather than as JSON
*  text, where a Windows path's backslashes come out doubled. */
function strings(value, depth = 0) {
	if (typeof value === "string") return [value];
	if (depth > 8 || typeof value !== "object" || value === null) return [];
	return Object.values(value).flatMap((item) => strings(item, depth + 1));
}
//#endregion
//#region src/todo-bridge.ts
function record$14(value) {
	if (typeof value === "string") try {
		return record$14(JSON.parse(value));
	} catch {
		return;
	}
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function text(value) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function todoStatus(value) {
	return value === "pending" || value === "in_progress" || value === "completed" ? value : void 0;
}
/** The id a TaskCreate result names: a structured `id`, else `#N` in its prose. */
function createdTaskId(output) {
	const structured = record$14(output);
	const id = structured?.id ?? record$14(structured?.task)?.id;
	if (typeof id === "string" || typeof id === "number") return String(id);
	const prose = typeof output === "string" ? output : JSON.stringify(output ?? "");
	return (/#(\d+)/u.exec(prose) ?? /\btask\s+(?:id\s*)?[:#]?\s*(\d+)\b/iu.exec(prose))?.[1];
}
/** One distinct row per content, as the Host's dock keys its rows by content. */
function distinct(items) {
	const seen = /* @__PURE__ */ new Set();
	return items.filter((item) => !seen.has(item.content) && seen.add(item.content));
}
/** A `TodoWrite` call's whole list, or undefined for input that is not one. */
function todosFromTodoWrite(input) {
	const todos = record$14(input)?.todos;
	if (!Array.isArray(todos)) return void 0;
	return distinct(todos.flatMap((item) => {
		const entry = record$14(item);
		const content = text(entry?.content);
		const status = todoStatus(entry?.status);
		return content === void 0 || status === void 0 ? [] : [{
			content,
			status
		}];
	}));
}
/** The latest list a session log holds, while any of it is still open: what a
*  new turn carries over, since the Host's projection empties at `turn/start`. */
function carriedTodos(events) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event.type !== "todo/write") continue;
		const todos = todosFromTodoWrite(event.data);
		return todos !== void 0 && todos.some((item) => item.status !== "completed") ? todos : void 0;
	}
}
/**
* The task tools' board, one per Claude process.
* ponytail: lives with the process, so a restarted CLI starts an empty board;
* a TaskUpdate for an id it never saw created still lands, under `#id`.
*/
var ClaudeTaskBoard = class {
	#tasks = /* @__PURE__ */ new Map();
	#creating = /* @__PURE__ */ new Map();
	/** Fold one tool call; true when the board changed. */
	call(toolName, toolUseId, input) {
		const args = record$14(input);
		if (toolName === "TaskCreate") {
			const subject = text(args?.subject);
			if (subject !== void 0) this.#creating.set(toolUseId, subject);
			return false;
		}
		if (toolName !== "TaskUpdate") return false;
		const raw = args?.taskId;
		const id = typeof raw === "number" ? String(raw) : text(raw);
		if (id === void 0) return false;
		if (args?.status === "deleted") return this.#tasks.delete(id);
		const previous = this.#tasks.get(id);
		const subject = text(args?.subject) ?? previous?.subject ?? `#${id}`;
		const status = todoStatus(args?.status) ?? previous?.status ?? "pending";
		if (previous?.subject === subject && previous.status === status) return false;
		this.#tasks.set(id, {
			subject,
			status
		});
		return true;
	}
	/** Fold one tool result; true when a created task joined the board. */
	result(toolUseId, outputs, isError) {
		const subject = this.#creating.get(toolUseId);
		if (subject === void 0) return false;
		this.#creating.delete(toolUseId);
		if (isError) return false;
		const id = outputs.reduce((found, output) => found ?? createdTaskId(output), void 0);
		this.#tasks.set(id ?? toolUseId, {
			subject,
			status: "pending"
		});
		return true;
	}
	todos() {
		return distinct([...this.#tasks.values()].map((task) => ({
			content: task.subject,
			status: task.status
		})));
	}
};
//#endregion
//#region src/supervisor.ts
const CLAUDE_INITIALIZATION_TIMEOUT_MS = 3e4;
/** Control requests must settle; a wedged one must not clog the metadata chain. */
const CLAUDE_METADATA_TIMEOUT_MS = 15e3;
/** How long a disconnect waits for the dead process to be reaped, so the
*  failure can say how it ended. A process that died for its own reasons
*  resolves immediately; this only bounds the case where it has not died. */
const DISCONNECT_EXIT_WAIT_MS = 1e3;
const SYSTEM_PROMPT_APPEND = `When you are in plan mode and the plan is written, end the turn by calling ExitPlanMode with the plan. Do not end a plan-mode turn by asking the user for confirmation in prose: the user reads and approves the plan through ExitPlanMode, and a turn that stops short of that call shows them nothing.\n\nOutside commands, configuration expressions, and code blocks, write every mention of an existing file as a Markdown link, including repeats and tables, so the user can open it: [name](<path>), where path is relative to the working directory or absolute, enclosed in angle brackets. Append #L24 or #L24-L30 to the path for known lines. Use the filename as the label, adding only enough parent directories to distinguish files; keep full paths out of labels. Never write a file path as bare inline code.`;
/** The live equivalent of a thinking mode, or undefined when the mode is a
*  start-time shape the CLI will not take later: `off` disables thinking through
*  a query option, `ultracode` is a settings bundle, and "no explicit mode" is
*  the CLI's own default. Those still rebuild the process. */
function liveEffortSettings(mode) {
	switch (mode) {
		case "low":
		case "medium":
		case "high":
		case "xhigh":
		case "max": return { effortLevel: mode };
		default: return;
	}
}
var ClaudeTurnBusyError = class extends Error {
	constructor(sessionId) {
		super(`Claude Code session ${sessionId} already has an active or interrupting turn`);
		this.name = "ClaudeTurnBusyError";
	}
};
var ClaudeOutcomeUnknownError = class extends Error {
	constructor(message = "Claude Code exited after activity; side-effect outcome is unknown and the prompt was not replayed") {
		super(message);
		this.name = "ClaudeOutcomeUnknownError";
	}
};
var ClaudeProtocolError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "ClaudeProtocolError";
	}
};
var ClaudeProcessLimitError = class extends Error {
	constructor(maxProcesses) {
		super(`Claude Code process limit reached (${maxProcesses}) and no idle session can be evicted`);
		this.name = "ClaudeProcessLimitError";
	}
};
function abortFailure() {
	const error = /* @__PURE__ */ new Error("Claude Code turn aborted");
	error.name = "AbortError";
	return error;
}
function signalAborted(signal) {
	return signal?.aborted === true;
}
async function withTimeout(operation, timeoutMs, label) {
	let timer;
	try {
		return await Promise.race([operation, new Promise((_resolve, reject) => {
			timer = setTimeout(() => reject(/* @__PURE__ */ new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
			timer.unref?.();
		})]);
	} finally {
		if (timer !== void 0) clearTimeout(timer);
	}
}
async function withAbort(operation, signal) {
	if (signal === void 0) return operation;
	if (signal.aborted) throw abortFailure();
	let abortListener;
	try {
		return await Promise.race([operation, new Promise((_resolve, reject) => {
			abortListener = () => {
				reject(abortFailure());
			};
			signal.addEventListener("abort", abortListener, { once: true });
		})]);
	} finally {
		if (abortListener !== void 0) signal.removeEventListener("abort", abortListener);
	}
}
/** The uuid of one main-chain transcript entry, or undefined for anything a
*  rewind must not fork at: stream partials, results, and sidechain traffic. */
function chainEntryUuid(message) {
	if (message.type !== "assistant" && message.type !== "user") return void 0;
	const envelope = message;
	if (typeof envelope.parent_tool_use_id === "string") return void 0;
	return typeof envelope.uuid === "string" && envelope.uuid.length > 0 ? envelope.uuid : void 0;
}
/** The reader's own words out of a steered prompt, for the row that shows it. */
function steeredText(prompt) {
	if (typeof prompt === "string") return prompt;
	return prompt.filter((block) => block.type === "text").map((block) => block.text).join("\n");
}
function sdkUserMessage(prompt, uuid) {
	return {
		type: "user",
		message: {
			role: "user",
			content: prompt
		},
		parent_tool_use_id: null,
		uuid
	};
}
const BACKGROUND_TASK_REPORT_PROMPT = [
	"The background tasks launched by your preceding response have now all settled.",
	"Report their final completed or failed outcomes concisely to the user.",
	"Do not start new tools or tasks, and do not repeat the earlier progress update."
].join(" ");
function usageSummary(usage) {
	return `${usage.inputTokens ?? 0} input / ${usage.outputTokens ?? 0} output tokens${usage.cumulativeCostUsd === void 0 ? "" : ` · $${usage.cumulativeCostUsd.toFixed(4)} cumulative`}`;
}
function errorSummary(error) {
	return error instanceof Error ? error.message : String(error);
}
/** How the CLI process ended, in words a reader can act on.
*
*  Without this the transcript can only say that a turn's outcome is unknown,
*  which is true and useless: an exit code is the CLI saying it finished, a
*  signal is something else ending it, and `killedByPlugin` says whether that
*  something was this plugin's own teardown. The status is captured by
*  {@link ManagedClaudeProcess} either way — it was simply never read. */
function exitStatus(process, reason) {
	if (process === void 0) return "no process was running";
	const signal = process.signalCode;
	const code = process.exitCode;
	const parts = [];
	if (signal !== null) parts.push(`killed by ${signal}`);
	if (code !== null) parts.push(`exit code ${code}`);
	const requested = reason === void 0 ? "requested by this plugin" : `requested by this plugin: ${reason}`;
	if (parts.length === 0) parts.push(process.killed ? requested.replace("requested", "terminated") : "no exit status was reported");
	else if (process.killed) parts.push(requested);
	return parts.join(", ");
}
/** Root-call activity summary; subagent dispatches lead with Claude's own task description. */
function rootCallSummary(toolName, input) {
	if (TASK_TOOL_NAMES.has(toolName)) {
		const description = input !== null && typeof input === "object" ? input.description : void 0;
		if (typeof description === "string" && description.length > 0) return description;
		return "Claude dispatched a subagent";
	}
	return `Claude called ${toolName}`;
}
/** Records the plugin draws even under the native renderer: Claude's root tool
*  cards, their results and denials, and the subagent calls nested in them. */
function pluginDrawnUnderNative(activity) {
	return activity.kind === "tool-call" || activity.kind === "tool-result" || activity.kind === "permission" && activity.toolUseId !== void 0 || activity.kind === "subagent" && activity.parentToolUseId !== void 0;
}
function parseCronDelayMs(cron) {
	if (typeof cron !== "string") return 6e5;
	const parts = cron.trim().split(/\s+/);
	if (parts.length >= 5) {
		const min = parts[0] ?? "";
		const hour = parts[1] ?? "";
		const dom = parts[2] ?? "";
		const stepMin = min.match(/^\*\/(\d+)$/);
		if (stepMin && stepMin[1] !== void 0) {
			const n = parseInt(stepMin[1], 10);
			if (Number.isFinite(n) && n > 0) return Math.min(Math.max(n * 6e4, 1e4), 864e5);
		}
		const stepHour = hour.match(/^\*\/(\d+)$/);
		if (stepHour && stepHour[1] !== void 0 && (min === "0" || min === "*")) {
			const n = parseInt(stepHour[1], 10);
			if (Number.isFinite(n) && n > 0) return Math.min(Math.max(n * 36e5, 1e4), 864e5);
		}
		const stepDay = dom.match(/^\*\/(\d+)$/);
		if (stepDay && stepDay[1] !== void 0 && min === "0" && hour === "0") {
			const n = parseInt(stepDay[1], 10);
			if (Number.isFinite(n) && n > 0) return Math.min(Math.max(n * 864e5, 1e4), 864e5);
		}
		const now = /* @__PURE__ */ new Date();
		const targetMinMatch = min.match(/^(\d+)$/);
		const targetHourMatch = hour.match(/^(\d+)$/);
		const targetMin = targetMinMatch && targetMinMatch[1] !== void 0 ? parseInt(targetMinMatch[1], 10) : void 0;
		const targetHour = targetHourMatch && targetHourMatch[1] !== void 0 ? parseInt(targetHourMatch[1], 10) : void 0;
		if (targetMin !== void 0 && targetHour !== void 0) {
			const next = new Date(now);
			next.setSeconds(0, 0);
			next.setHours(targetHour, targetMin);
			if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
			return Math.max(next.getTime() - now.getTime(), 1e4);
		}
	}
	return 6e5;
}
var ClaudeSupervisor = class {
	#entries = /* @__PURE__ */ new Map();
	#interruptions = /* @__PURE__ */ new Map();
	#activeWakeups = /* @__PURE__ */ new Map();
	#activeCrons = /* @__PURE__ */ new Map();
	#runtime;
	#approval;
	#userQuestions;
	/** Lets the plan panel answer a plan's approval with revisions. */
	planFeedback = new PlanFeedbackGate();
	#config;
	#queryFactory;
	#runDetached;
	#sidecar;
	#defaultPermissionMode;
	#permissionSelector;
	/** Where a process death is reported. The transcript keeps the failure; this
	*  is what makes it findable afterwards. */
	#logger;
	#hostJobs;
	#resolveAgent;
	#contextWindows = /* @__PURE__ */ new Map();
	#disposed = false;
	#admissionGate = Promise.resolve();
	/** FIFO user turns live outside the gate while capacity-blocked, so
	*  best-effort metadata can still enter the serialized path and fail. */
	#turnAdmissions = [];
	#metadataAdmissions = /* @__PURE__ */ new Set();
	#admissionDrainScheduled = false;
	/** Prevent a capacity change between a failed attempt and parking the head
	*  from becoming a lost wake-up. */
	#admissionRevision = 0;
	#blockedAdmissionRevision;
	constructor(dependencies) {
		this.#runtime = dependencies.runtime;
		this.#approval = dependencies.approval;
		this.#userQuestions = dependencies.userQuestions;
		this.#config = dependencies.config;
		this.#queryFactory = dependencies.queryFactory ?? ((params) => query(params));
		this.#runDetached = dependencies.runDetached ?? ((operation) => operation());
		this.#sidecar = dependencies.sidecar ?? new ClaudeSidecarRepository();
		this.#defaultPermissionMode = dependencies.defaultPermissionMode ?? (async () => void 0);
		this.#permissionSelector = dependencies.permissionSelector ?? (async () => "plugin");
		this.#logger = dependencies.logger;
		this.#hostJobs = dependencies.hostJobs;
		this.#resolveAgent = dependencies.resolveAgent ?? (() => void 0);
	}
	snapshots() {
		return [...this.#entries.values()].map((entry) => ({
			sessionId: entry.sessionId,
			...entry.claudeSessionId === void 0 ? {} : { claudeSessionId: entry.claudeSessionId },
			state: entry.state,
			cwd: entry.cwd,
			model: entry.model,
			...entry.thinkingMode === void 0 ? {} : { thinkingMode: entry.thinkingMode },
			lastUsedAt: entry.lastUsedAt
		}));
	}
	supportedCommands(agent, model = this.#config.defaultModel) {
		return this.#runMetadata(agent, model, (query) => query.supportedCommands());
	}
	/** Cache a window under both the selector id the caller asked for and the
	*  concrete model the CLI reports, so either name resolves it later. */
	#recordContextWindow(model, usage) {
		const contextWindow = usage.rawMaxTokens > 0 ? usage.rawMaxTokens : usage.maxTokens;
		if (contextWindow <= 0) return;
		this.#contextWindows.set(model, contextWindow);
		this.#contextWindows.set(usage.model, contextWindow);
	}
	/** Learn a model's context window the first time a turn finishes on it.
	*
	*  DSH hides its context meter entirely unless the route publishes a
	*  capacity, and these numbers move with Claude releases — so none are
	*  hardcoded; the CLI is asked over the session's own live process.
	*
	*  Turn completion is the earliest honest moment to ask. `entry.model` is
	*  already the model that just ran, so no model switch is provoked — which
	*  rules out asking from `resolveModel`, since DSH resolves every model in
	*  the catalog to build its picker and `#metadataEntry` would switch the live
	*  session once per entry. And nothing is lost by waiting: the meter needs a
	*  usage sample too, and no turn has reported one before the first turn ends.
	*
	*  Best-effort — a failure leaves the window unknown (the meter stays hidden,
	*  exactly as before) and the next completed turn tries again. */
	async #learnContextWindow(entry) {
		if (this.#contextWindows.has(entry.model)) return;
		try {
			const usage = await withTimeout(entry.query.getContextUsage(), CLAUDE_METADATA_TIMEOUT_MS, "Claude context window probe");
			this.#recordContextWindow(entry.model, usage);
		} catch {}
	}
	contextWindow(model) {
		return this.#contextWindows.get(model);
	}
	/** Raw `/usage` payload, read over a session's existing process. Only the
	*  idle-time metadata bridge uses this; a user-triggered refresh runs
	*  probePlanUsage instead so it never waits on, or perturbs, a session. */
	planUsage(agent, model = this.#config.defaultModel) {
		return this.#runMetadata(agent, model, (query) => readPlanUsageFrom(query));
	}
	/** Whether a steered message can reach this session's turn right now.
	*
	*  Asked before the caller takes the message out of the agent inbox: a
	*  message removed for a turn that cannot take it would have to be put back,
	*  and a restored message has already lost the insertion that would wake an
	*  idle driver. */
	canSteer(sessionId) {
		const entry = this.#entries.get(sessionId);
		const active = entry?.active;
		if (entry === void 0 || active === void 0 || entry.state !== "running" || active.aborted) return false;
		return active.ownedPromptUuids.size < 16;
	}
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
	#handleScheduleWakeup(entry, rawInput) {
		const input = rawInput;
		const sessionId = entry.sessionId;
		const existing = this.#activeWakeups.get(sessionId);
		if (existing !== void 0) {
			clearTimeout(existing.timer);
			this.#activeWakeups.delete(sessionId);
		}
		if (input?.stop === true) {
			this.#logger?.warn(`dsh-claude: cancelled scheduled wakeup for ${sessionId}`);
			return;
		}
		const delaySeconds = typeof input?.delaySeconds === "number" && Number.isFinite(input.delaySeconds) ? Math.min(Math.max(input.delaySeconds, 1), 86400) : void 0;
		if (delaySeconds === void 0) return;
		const prompt = typeof input?.prompt === "string" && input.prompt.trim().length > 0 ? input.prompt.trim() : "/loop";
		const reason = typeof input?.reason === "string" ? input.reason : "Claude Code scheduled wakeup";
		const delayMs = delaySeconds * 1e3;
		const timer = setTimeout(() => {
			this.#activeWakeups.delete(sessionId);
			this.#dispatchWakeup(sessionId, prompt, reason);
		}, delayMs);
		timer.unref?.();
		this.#activeWakeups.set(sessionId, {
			timer,
			targetTime: Date.now() + delayMs,
			prompt,
			reason
		});
		this.#logger?.warn(`dsh-claude: scheduled wakeup in ${delaySeconds}s for ${sessionId}: ${reason}`);
	}
	#handleCronCreate(entry, rawInput) {
		const input = rawInput;
		const sessionId = entry.sessionId;
		const existing = this.#activeCrons.get(sessionId);
		if (existing !== void 0) {
			clearTimeout(existing.timer);
			this.#activeCrons.delete(sessionId);
		}
		const cron = typeof input?.cron === "string" ? input.cron.trim() : void 0;
		if (cron === void 0) return;
		const prompt = typeof input?.prompt === "string" && input.prompt.trim().length > 0 ? input.prompt.trim() : "/loop";
		const recurring = input?.recurring !== false;
		const delayMs = parseCronDelayMs(cron);
		const scheduleNext = () => {
			const timer = setTimeout(() => {
				if (!recurring) this.#activeCrons.delete(sessionId);
				else scheduleNext();
				this.#dispatchWakeup(sessionId, prompt, `Claude Code cron (${cron})`);
			}, delayMs);
			timer.unref?.();
			this.#activeCrons.set(sessionId, {
				timer,
				cron,
				prompt,
				recurring
			});
		};
		scheduleNext();
		this.#logger?.warn(`dsh-claude: scheduled cron in ${Math.round(delayMs / 1e3)}s (${cron}) for ${sessionId}`);
	}
	#handleCronDelete(entry) {
		const sessionId = entry.sessionId;
		const existing = this.#activeCrons.get(sessionId);
		if (existing !== void 0) {
			clearTimeout(existing.timer);
			this.#activeCrons.delete(sessionId);
			this.#logger?.warn(`dsh-claude: deleted cron for ${sessionId}`);
		}
	}
	#dispatchWakeup(sessionId, prompt, reason) {
		try {
			const entry = this.#entries.get(sessionId);
			const agent = this.#resolveAgent(sessionId) ?? entry?.ownerAgent;
			if (agent === void 0) {
				this.#logger?.warn(`dsh-claude: cannot dispatch wakeup for ${sessionId}, owner agent unavailable`);
				return;
			}
			const message = {
				id: randomUUID(),
				role: "user",
				source: { kind: "user" },
				content: [{
					type: "text",
					text: prompt
				}]
			};
			agent.followup(message);
			this.#logger?.warn(`dsh-claude: dispatched scheduled wakeup for ${sessionId} (${reason})`);
		} catch (error) {
			this.#logger?.warn(`dsh-claude: failed to dispatch wakeup for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	deliverSteering(sessionId, prompt) {
		const entry = this.#entries.get(sessionId);
		const active = entry?.active;
		if (entry === void 0 || active === void 0 || !this.canSteer(sessionId)) return "unavailable";
		const uuid = randomUUID();
		active.ownedPromptUuids.add(uuid);
		entry.input.push(sdkUserMessage(prompt, uuid));
		this.#appendSafely(active, {
			kind: "steering",
			phase: "completed",
			title: "Steered into the running turn",
			summary: steeredText(prompt)
		});
		return "delivered";
	}
	runTurn(request) {
		const interruption = this.#interruptions.get(request.agent.id);
		if (interruption !== void 0) return interruption.then(() => this.runTurn(request));
		return new Promise((resolve, reject) => {
			let complete;
			const completion = new Promise((done) => {
				complete = done;
			});
			const admission = {
				request,
				resolve,
				reject,
				delivered: false,
				admitting: false,
				waitedForCapacity: false,
				cancellation: new AbortController(),
				completion,
				complete: () => {
					complete?.();
				}
			};
			if (request.signal !== void 0) {
				const abortListener = () => {
					if (!admission.admitting) this.#finishTurnAdmission(admission, { error: abortFailure() });
					else if (admission.waitedForCapacity && !admission.delivered) {
						admission.delivered = true;
						admission.reject(abortFailure());
					}
					this.#admissionRevision += 1;
					this.#blockedAdmissionRevision = void 0;
					this.#scheduleTurnAdmissions();
				};
				admission.abortListener = abortListener;
				request.signal.addEventListener("abort", abortListener, { once: true });
			}
			this.#turnAdmissions.push(admission);
			this.#scheduleTurnAdmissions();
		});
	}
	async #drainTurnAdmissions() {
		while (this.#turnAdmissions.length > 0) {
			const admission = this.#turnAdmissions[0];
			if (signalAborted(admission.request.signal)) {
				this.#finishTurnAdmission(admission, { error: abortFailure() });
				continue;
			}
			const attemptedRevision = this.#admissionRevision;
			admission.admitting = true;
			try {
				const output = await this.#runTurnAdmitted(admission.request, admission.waitedForCapacity, admission.cancellation.signal);
				this.#finishTurnAdmission(admission, { output });
			} catch (error) {
				if (error instanceof ClaudeProcessLimitError && !signalAborted(admission.request.signal) && !admission.cancellation.signal.aborted && !this.#disposed) {
					admission.admitting = false;
					admission.waitedForCapacity = true;
					if (attemptedRevision === this.#admissionRevision) {
						this.#blockedAdmissionRevision = attemptedRevision;
						return;
					}
					continue;
				}
				this.#finishTurnAdmission(admission, { error });
			}
		}
	}
	#finishTurnAdmission(admission, outcome) {
		if (this.#turnAdmissions[0] === admission) this.#turnAdmissions.shift();
		else {
			const index = this.#turnAdmissions.indexOf(admission);
			if (index >= 0) this.#turnAdmissions.splice(index, 1);
		}
		admission.admitting = false;
		if (admission.request.signal !== void 0 && admission.abortListener !== void 0) admission.request.signal.removeEventListener("abort", admission.abortListener);
		if (!admission.delivered) {
			admission.delivered = true;
			if ("error" in outcome) admission.reject(outcome.error);
			else admission.resolve(outcome.output);
		}
		admission.complete();
	}
	#scheduleTurnAdmissions() {
		if (this.#admissionDrainScheduled || this.#turnAdmissions.length === 0 || this.#blockedAdmissionRevision === this.#admissionRevision) return;
		this.#admissionDrainScheduled = true;
		const operation = this.#admissionGate.then(() => this.#drainTurnAdmissions());
		this.#admissionGate = operation.then(() => void 0, () => void 0);
		const finished = () => {
			this.#admissionDrainScheduled = false;
			this.#scheduleTurnAdmissions();
		};
		operation.then(finished, finished);
	}
	async #runTurnAdmitted(request, abortDuringAdmission, cancellationSignal) {
		if (this.#disposed) throw new Error("dsh-claude: supervisor is disposed");
		if (cancellationSignal.aborted) throw abortFailure();
		if (signalAborted(request.signal)) throw abortFailure();
		const sessionId = request.agent.id;
		let entry = this.#entries.get(sessionId);
		let createdForRequest;
		const throwIfUnavailable = async () => {
			const failure = this.#disposed ? /* @__PURE__ */ new Error("dsh-claude: supervisor is disposed") : cancellationSignal.aborted || abortDuringAdmission && signalAborted(request.signal) ? abortFailure() : void 0;
			if (failure === void 0) return;
			if (createdForRequest !== void 0) {
				if (this.#entries.get(sessionId) === createdForRequest) this.#entries.delete(sessionId);
				await this.#disposeEntry(createdForRequest, "admission cancelled");
				createdForRequest = void 0;
			}
			throw failure;
		};
		if (entry?.state === "disposed" || entry?.state === "disconnected" || entry?.state === "outcome-unknown") {
			this.#entries.delete(sessionId);
			await this.#disposeEntry(entry, "stale process replaced");
			await throwIfUnavailable();
			entry = void 0;
		}
		if (entry === void 0) {
			await this.#makeRoom();
			await throwIfUnavailable();
			try {
				entry = await this.#createEntry(request.agent, request.model ?? this.#config.defaultModel, request.thinkingMode, abortDuringAdmission ? request.signal : void 0, cancellationSignal);
			} catch (error) {
				await throwIfUnavailable();
				throw error;
			}
			createdForRequest = entry;
			await throwIfUnavailable();
			this.#entries.set(sessionId, entry);
		}
		if (entry.ownerAgent !== request.agent) throw new Error(`dsh-claude: live agent identity changed for session ${sessionId}`);
		if (entry.active !== void 0 || entry.state === "interrupting") throw new ClaudeTurnBusyError(sessionId);
		try {
			const initialization = withAbort(entry.sdkInitialization, cancellationSignal);
			await (abortDuringAdmission ? withAbort(initialization, request.signal) : initialization);
		} catch (error) {
			await throwIfUnavailable();
			throw error;
		}
		await throwIfUnavailable();
		if (entry.idleTimer !== void 0) {
			clearTimeout(entry.idleTimer);
			entry.idleTimer = void 0;
		}
		const model = request.model ?? this.#config.defaultModel;
		const mode = request.thinkingMode;
		const effort = liveEffortSettings(mode);
		const switchedLive = mode !== entry.thinkingMode && mode !== void 0 && effort !== void 0 && model === entry.model ? await this.#switchEffort(entry, mode, effort) : false;
		if (model !== entry.model || mode !== entry.thinkingMode && !switchedLive) {
			this.#entries.delete(sessionId);
			await this.#disposeEntry(entry, "model or effort switch");
			if (createdForRequest === entry) createdForRequest = void 0;
			await throwIfUnavailable();
			try {
				entry = await this.#createEntry(request.agent, model, request.thinkingMode, abortDuringAdmission ? request.signal : void 0, cancellationSignal);
			} catch (error) {
				await throwIfUnavailable();
				throw error;
			}
			createdForRequest = entry;
			await throwIfUnavailable();
			this.#entries.set(sessionId, entry);
			try {
				const initialization = withAbort(entry.sdkInitialization, cancellationSignal);
				await (abortDuringAdmission ? withAbort(initialization, request.signal) : initialization);
			} catch (error) {
				await throwIfUnavailable();
				throw error;
			}
		} else await this.#syncPermissionMode(entry);
		await throwIfUnavailable();
		const promptUuid = randomUUID();
		const cursor = currentClaudeActivityCursor(request.agent.session.snapshotEvents());
		const projection = await this.#sidecar.read(sessionId);
		await throwIfUnavailable();
		cursor.nextOrdinal = projection.activities.reduce((next, activity) => activity.turn === cursor.turn && activity.step === cursor.step ? Math.max(next, activity.ordinal + 1) : next, 0);
		const active = {
			agent: request.agent,
			cursor,
			native: (request.renderMode ?? this.#config.renderMode ?? "plugin") === "native",
			output: new AsyncQueue(),
			promptUuid,
			ownedPromptUuids: /* @__PURE__ */ new Set([promptUuid]),
			phase: "primary",
			sawActivity: false,
			sawTextDelta: false,
			subagentText: /* @__PURE__ */ new Map(),
			text: "",
			transcriptText: "",
			transcriptTextOrdinal: void 0,
			thinking: "",
			requestUsage: void 0,
			startedAt: Date.now(),
			firstOutputAt: void 0,
			aborted: false,
			deniedToolUseIds: /* @__PURE__ */ new Set(),
			openCalls: /* @__PURE__ */ new Map(),
			backgroundTimers: /* @__PURE__ */ new Map(),
			...request.signal === void 0 ? {} : { signal: request.signal }
		};
		entry.active = active;
		entry.state = "running";
		entry.lastUsedAt = Date.now();
		await this.#sidecar.writePromptSuggestion(sessionId, void 0).catch(() => void 0);
		await this.#captureWorktree(entry, cursor.turn);
		try {
			await this.#appendActivity(active, {
				kind: "status",
				phase: "started",
				title: "Claude Code turn started"
			});
		} catch (error) {
			active.output.fail(error);
			entry.active = void 0;
			if (this.#entries.get(sessionId) === entry) this.#entries.delete(sessionId);
			await this.#disposeEntry(entry, "turn start failed");
			throw error;
		}
		const carried = carriedTodos(request.agent.session.snapshotEvents());
		if (carried !== void 0) await this.#writeTodos(active, carried);
		if (signalAborted(request.signal)) {
			active.aborted = true;
			active.output.fail(abortFailure());
			await this.#appendActivity(active, {
				kind: "status",
				phase: "failed",
				title: "Claude Code turn cancelled before submission"
			});
			entry.active = void 0;
			if (!abortDuringAdmission || createdForRequest === void 0) {
				entry.state = "idle";
				entry.lastUsedAt = Date.now();
				this.#armIdleTimer(entry);
			}
			await throwIfUnavailable();
			return active.output;
		}
		if (request.signal !== void 0) {
			const abortListener = () => {
				this.#startInterrupt(entry);
			};
			active.abortListener = abortListener;
			request.signal.addEventListener("abort", abortListener, { once: true });
		}
		entry.input.push(sdkUserMessage(request.prompt, promptUuid));
		return active.output;
	}
	#runMetadata(agent, model, operation) {
		if (this.#turnAdmissions.some((admission) => admission.waitedForCapacity)) return Promise.reject(new ClaudeProcessLimitError(this.#config.maxProcesses));
		let complete;
		const admission = {
			sessionId: agent.id,
			cancellation: new AbortController(),
			started: false,
			completion: new Promise((done) => {
				complete = done;
			}),
			complete: () => {
				complete?.();
			}
		};
		this.#metadataAdmissions.add(admission);
		const admitted = this.#admissionGate.then(async () => {
			admission.started = true;
			if (this.#disposed) throw new Error("dsh-claude: supervisor is disposed");
			if (admission.cancellation.signal.aborted) throw abortFailure();
			if (this.#turnAdmissions.some((admission) => admission.waitedForCapacity)) throw new ClaudeProcessLimitError(this.#config.maxProcesses);
			const entry = await this.#metadataEntry(agent, model, admission.cancellation.signal);
			try {
				await withAbort(entry.sdkInitialization, admission.cancellation.signal);
				return await withAbort(this.#control(entry, operation(entry.query, entry), "Claude metadata request"), admission.cancellation.signal);
			} finally {
				entry.lastUsedAt = Date.now();
				if (entry.active === void 0 && entry.state === "idle") this.#armIdleTimer(entry);
			}
		}).finally(() => {
			this.#finishMetadataAdmission(admission);
		});
		this.#admissionGate = admitted.then(() => void 0, () => void 0);
		return withAbort(admitted, admission.cancellation.signal);
	}
	async #metadataEntry(agent, model, cancellationSignal) {
		if (cancellationSignal.aborted) throw abortFailure();
		const sessionId = agent.id;
		let entry = this.#entries.get(sessionId);
		if (entry?.state === "disposed" || entry?.state === "disconnected" || entry?.state === "outcome-unknown") {
			this.#entries.delete(sessionId);
			await this.#disposeEntry(entry, "stale process replaced");
			if (cancellationSignal.aborted) throw abortFailure();
			entry = void 0;
		}
		if (entry === void 0) {
			await this.#makeRoom();
			if (cancellationSignal.aborted) throw abortFailure();
			entry = await this.#createEntry(agent, model, void 0, void 0, cancellationSignal);
			if (cancellationSignal.aborted) {
				await this.#disposeEntry(entry, "metadata request cancelled");
				throw abortFailure();
			}
			this.#entries.set(sessionId, entry);
		}
		if (entry.ownerAgent !== agent) throw new Error(`dsh-claude: live agent identity changed for session ${sessionId}`);
		if (entry.active !== void 0 || entry.state === "interrupting") throw new ClaudeTurnBusyError(sessionId);
		if (entry.idleTimer !== void 0) {
			clearTimeout(entry.idleTimer);
			entry.idleTimer = void 0;
		}
		await withAbort(this.#syncPermissionMode(entry), cancellationSignal);
		if (cancellationSignal.aborted) throw abortFailure();
		return entry;
	}
	/** Run one SDK control request against a live entry, and discard the entry if
	*  it does not answer.
	*
	*  Turn admission attempts and metadata reads share one process-wide gate,
	*  so an unbounded control request stalls every session until the Host restarts.
	*  Bounding it is only half the cure: a timeout also proves this query has
	*  stopped answering, and keeping the entry means the next caller reuses the
	*  same dead process — timing out again, forever. Discarding it lets the next
	*  attempt spawn a fresh one. Every control request goes through here so a
	*  new call site cannot quietly reintroduce either half. */
	async #control(entry, operation, label, timeoutMs = CLAUDE_METADATA_TIMEOUT_MS) {
		try {
			return await withTimeout(operation, timeoutMs, label);
		} catch (error) {
			if (entry.active === void 0) {
				if (this.#entries.get(entry.sessionId) === entry) this.#entries.delete(entry.sessionId);
				await this.#disposeEntry(entry, "control request timed out");
			} else this.#logger?.warn(`dsh-claude: ${label} timed out during a live turn on session ${entry.sessionId}; keeping the process`);
			throw error;
		}
	}
	/** The mode a turn runs under: the session's choice, else the configured
	*  default, folded against the DSH sandbox; and `auto` only on a model the
	*  catalog does not rule out, since the CLI refuses it elsewhere. */
	async #permissionModeFor(events, chosen, model) {
		const mode = claudePermissionMode(events, await this.#permissionSelector() === "native" ? void 0 : chosen ?? await this.#defaultPermissionMode());
		return mode === "auto" && claudeModelRow(model)?.supportsAutoMode === false ? "default" : mode;
	}
	async #syncPermissionMode(entry) {
		const projection = await this.#sidecar.read(entry.sessionId);
		const mode = await this.#permissionModeFor(entry.ownerAgent.session.snapshotEvents(), projection.permissionMode, entry.model);
		if (mode === entry.permissionMode) return;
		await this.#control(entry, entry.query.setPermissionMode(mode), "Claude Code permission mode switch");
		entry.permissionMode = mode;
	}
	/** Move a running process to another effort level.
	*
	*  Returns false when the CLI would not take the change — the caller then
	*  rebuilds the process, which is what every mode change did before this.
	*  A failed control request has already discarded the entry. */
	async #switchEffort(entry, mode, settings) {
		try {
			await this.#control(entry, entry.query.applyFlagSettings(settings), "Claude effort switch");
			entry.thinkingMode = mode;
			return true;
		} catch {
			return false;
		}
	}
	#finishMetadataAdmission(admission) {
		this.#metadataAdmissions.delete(admission);
		admission.complete();
	}
	#cancelMetadataAdmissions(predicate) {
		const cancelled = [...this.#metadataAdmissions].filter(predicate);
		for (const admission of cancelled) {
			admission.cancellation.abort();
			if (!admission.started) this.#finishMetadataAdmission(admission);
		}
		return cancelled.map((admission) => admission.completion);
	}
	#cancelTurnAdmissions(predicate, error) {
		const cancelled = this.#turnAdmissions.filter(predicate);
		for (const admission of cancelled) {
			admission.cancellation.abort();
			if (!admission.delivered) {
				admission.delivered = true;
				admission.reject(error);
			}
			if (!admission.admitting) this.#finishTurnAdmission(admission, { error });
		}
		if (cancelled.length > 0) {
			this.#admissionRevision += 1;
			this.#blockedAdmissionRevision = void 0;
			this.#scheduleTurnAdmissions();
		}
		return cancelled.map((admission) => admission.completion);
	}
	limitsChanged() {
		if (this.#disposed) return;
		this.#notifyCapacityChange();
		this.#scheduleLimitReconciliation();
	}
	async disposeSession(sessionId, reason = "session reset") {
		const pendingAdmissions = this.#cancelTurnAdmissions((admission) => admission.request.agent.id === sessionId, abortFailure());
		const pendingMetadata = this.#cancelMetadataAdmissions((admission) => admission.sessionId === sessionId);
		const entry = this.#entries.get(sessionId);
		if (entry !== void 0) this.#entries.delete(sessionId);
		await Promise.allSettled([
			...pendingAdmissions,
			...pendingMetadata,
			...entry === void 0 ? [] : [this.#disposeEntry(entry, reason)]
		]);
	}
	async dispose() {
		if (this.#disposed) return;
		this.#disposed = true;
		const pendingAdmissions = this.#cancelTurnAdmissions(() => true, /* @__PURE__ */ new Error("dsh-claude: supervisor is disposed"));
		const pendingMetadata = this.#cancelMetadataAdmissions(() => true);
		const entries = [...this.#entries.values()];
		this.#entries.clear();
		for (const wakeup of this.#activeWakeups.values()) clearTimeout(wakeup.timer);
		this.#activeWakeups.clear();
		for (const cron of this.#activeCrons.values()) clearTimeout(cron.timer);
		this.#activeCrons.clear();
		this.#notifyCapacityChange();
		await Promise.allSettled([
			...pendingAdmissions,
			...pendingMetadata,
			...entries.map((entry) => this.#disposeEntry(entry, "plugin unloaded"))
		]);
	}
	async #makeRoom() {
		while (this.#entries.size >= this.#config.maxProcesses) {
			const idle = [...this.#entries.values()].filter((entry) => entry.active === void 0 && entry.state === "idle").sort((left, right) => left.lastUsedAt - right.lastUsedAt)[0];
			if (idle === void 0) throw new ClaudeProcessLimitError(this.#config.maxProcesses);
			this.#entries.delete(idle.sessionId);
			await this.#disposeEntry(idle, "process limit reached");
		}
	}
	async #trimExcessIdle() {
		while (this.#entries.size > this.#config.maxProcesses) {
			const idle = [...this.#entries.values()].filter((entry) => entry.active === void 0 && entry.state === "idle").sort((left, right) => left.lastUsedAt - right.lastUsedAt)[0];
			if (idle === void 0) return;
			this.#entries.delete(idle.sessionId);
			await this.#disposeEntry(idle, "process limit lowered");
		}
	}
	#notifyCapacityChange() {
		this.#admissionRevision += 1;
		this.#blockedAdmissionRevision = void 0;
		this.#scheduleTurnAdmissions();
	}
	#scheduleLimitReconciliation() {
		const operation = this.#admissionGate.then(() => this.#trimExcessIdle());
		this.#admissionGate = operation.then(() => void 0, () => void 0);
	}
	async #createEntry(agent, model, thinkingMode, signal, cancellationSignal) {
		const sessionId = agent.id;
		const cwd = agent.session.header.cwd ?? process.cwd();
		const input = new AsyncQueue();
		const lifetime = new AbortController();
		const projection = await this.#sidecar.importLegacy(sessionId, agent.session.snapshotEvents());
		if (signalAborted(signal) || signalAborted(cancellationSignal)) throw abortFailure();
		const binding = projection.binding;
		const pendingRewind = projection.rewind?.pending;
		const forkAt = pendingRewind !== void 0 && "resumeAt" in pendingRewind ? pendingRewind.resumeAt : void 0;
		const startFresh = pendingRewind !== void 0 && "fresh" in pendingRewind;
		const permissionMode = await this.#permissionModeFor(agent.session.snapshotEvents(), projection.permissionMode, model);
		const entry = {
			sessionId,
			ownerAgent: agent,
			cwd,
			model,
			thinkingMode,
			permissionMode,
			state: "starting",
			lastUsedAt: Date.now(),
			input,
			lifetime,
			claudeSessionId: startFresh ? void 0 : binding?.claudeSessionId,
			expectedResume: startFresh || forkAt !== void 0 ? void 0 : binding?.claudeSessionId,
			lastChainUuid: void 0,
			consumedRewind: pendingRewind !== void 0,
			reportedUnknownTypes: /* @__PURE__ */ new Set(),
			initialized: false,
			idleTimer: void 0,
			tasks: /* @__PURE__ */ new Map(),
			taskBoard: new ClaudeTaskBoard(),
			taskSnapshotAt: 0,
			taskSnapshotTimer: void 0,
			costReading: 0
		};
		const activeInteraction = () => {
			const active = entry.active;
			return active === void 0 ? void 0 : {
				agent: active.agent,
				cursor: active.cursor,
				markActivity: () => {
					active.sawActivity = true;
				},
				recordDenial: (toolUseId) => {
					active.deniedToolUseIds.add(toolUseId);
				},
				hasFullAccess: async () => {
					await this.#syncPermissionMode(entry);
					return entry.permissionMode === "bypassPermissions";
				},
				appendActivity: (activity) => this.#appendActivity(active, activity)
			};
		};
		const userQuestion = createUserQuestionBridge(this.#userQuestions, activeInteraction);
		const canUseTool = createPermissionBridge(this.#approval, activeInteraction, userQuestion, this.planFeedback);
		const options = {
			pathToClaudeCodeExecutable: this.#config.executablePath,
			cwd,
			settingSources: [
				"user",
				"project",
				"local"
			],
			systemPrompt: {
				type: "preset",
				preset: "claude_code",
				append: SYSTEM_PROMPT_APPEND
			},
			tools: {
				type: "preset",
				preset: "claude_code"
			},
			includePartialMessages: true,
			perTaskStopAffordance: true,
			forwardSubagentText: true,
			promptSuggestions: true,
			permissionMode,
			allowDangerouslySkipPermissions: true,
			canUseTool,
			hooks: createAutoModeEscalation(),
			abortController: lifetime,
			spawnClaudeCodeProcess: createManagedClaudeSpawner(this.#runtime, this.#config.executablePath, (process) => {
				entry.process = process;
			}),
			...binding === void 0 || startFresh ? {} : {
				resume: binding.claudeSessionId,
				...forkAt === void 0 ? {} : { resumeSessionAt: forkAt }
			},
			model: claudeModelValue(model),
			...thinkingMode === void 0 ? {} : thinkingMode === "off" ? { thinking: { type: "disabled" } } : thinkingMode === "ultracode" ? {} : { effort: thinkingMode },
			settings: {
				teammateMode: "in-process",
				...thinkingMode === "ultracode" ? { ultracode: true } : {}
			}
		};
		entry.query = this.#queryFactory({
			prompt: input,
			options
		});
		entry.pump = this.#runDetached(() => this.#pump(entry));
		entry.sdkInitialization = withTimeout(entry.query.initializationResult(), CLAUDE_INITIALIZATION_TIMEOUT_MS, "Claude SDK initialization").then((initialization) => {
			recordClaudeModels(initialization.models);
			if (entry.state === "starting") entry.state = "idle";
		});
		entry.sdkInitialization.catch((error) => this.#handleDisconnect(entry, error));
		return entry;
	}
	async #pump(entry) {
		try {
			for await (const sdkMessage of entry.query) {
				const chainUuid = chainEntryUuid(sdkMessage);
				if (chainUuid !== void 0) entry.lastChainUuid = chainUuid;
				for (const message of normalizeSdkMessage(sdkMessage)) await this.#handleMessage(entry, message);
			}
			if (entry.state !== "disposed") await this.#handleDisconnect(entry, /* @__PURE__ */ new Error("Claude Code stream ended"));
		} catch (error) {
			if (entry.state !== "disposed") await this.#handleDisconnect(entry, error);
		}
	}
	async #handleMessage(entry, message) {
		if (message.kind === "init") {
			const firstInitialization = !entry.initialized;
			const expectedSessionId = firstInitialization ? entry.expectedResume : entry.claudeSessionId;
			if (expectedSessionId !== void 0 && message.sessionId !== expectedSessionId) throw new ClaudeProtocolError(`Claude Code initialized unexpected session ${message.sessionId}; expected ${expectedSessionId}`);
			if (firstInitialization && entry.expectedResume === void 0 && message.cwd !== entry.cwd) throw new ClaudeProtocolError(`Claude Code initialized in unexpected cwd ${message.cwd}; expected ${entry.cwd}`);
			entry.initialized = true;
			entry.claudeSessionId = message.sessionId;
			entry.state = entry.active === void 0 ? "idle" : "running";
			if (firstInitialization && entry.tasks.size > 0) {
				entry.tasks.clear();
				await this.#flushTasksSnapshot(entry);
			}
			await this.#sidecar.writeBinding(entry.sessionId, {
				claudeSessionId: message.sessionId,
				cliVersion: message.cliVersion,
				cwd: message.cwd
			});
			if (entry.consumedRewind) {
				entry.consumedRewind = false;
				await this.#sidecar.clearRewindPending(entry.sessionId);
			}
			return;
		}
		const taskId = message.kind === "subagent" ? message.taskId : void 0;
		if (message.kind === "tool-result") this.#hostJobs?.noteOutput(entry.sessionId, [message.output, message.content]);
		if (message.kind === "subagent" && taskId !== void 0) await this.#trackTask(entry, message, taskId, entry.active?.cursor.turn);
		else if (message.kind === "background-tasks") await this.#trackBackgroundLevel(entry, message.tasks, entry.active?.cursor.turn);
		if (message.kind === "prompt-suggestion") {
			if (entry.active === void 0) await this.#sidecar.writePromptSuggestion(entry.sessionId, message.text).catch(() => void 0);
			return;
		}
		const active = entry.active;
		if (active === void 0) return;
		if (message.kind === "result") {
			if (entry.claudeSessionId === void 0) throw new ClaudeProtocolError("Claude Code sent a result before initialization");
			if (message.sessionId !== entry.claudeSessionId) throw new ClaudeProtocolError(`Claude Code result session ${message.sessionId} does not match ${entry.claudeSessionId}`);
			if (active.phase === "waiting-tasks") {
				await this.#completeProgressSegment(active, message);
				return;
			}
			if (message.userMessageUuid !== void 0 && !active.ownedPromptUuids.has(message.userMessageUuid)) {
				if (active.phase === "follow-up") {
					if ((message.queuedTurnCount ?? 0) > 0) {
						await this.#completeProgressSegment(active, message);
						return;
					}
					await this.#completeTurn(entry, active, message);
					return;
				}
				if ((message.queuedTurnCount ?? 0) > 0) {
					this.#logger?.warn?.(`dsh-claude: absorbed foreign result for user message ${message.userMessageUuid} while active prompt ${active.promptUuid} is queued (${message.queuedTurnCount} turns remaining)`);
					await this.#completeProgressSegment(active, message);
					return;
				}
				throw new ClaudeProtocolError(`Claude Code result for user message ${message.userMessageUuid} does not match active request ${active.promptUuid}`);
			}
			if ((message.queuedTurnCount ?? 0) > 0) {
				await this.#completeProgressSegment(active, message);
				return;
			}
			await this.#completeTurn(entry, active, message);
			return;
		}
		if (message.kind === "protocol-error") throw new ClaudeProtocolError(`${message.title}: ${JSON.stringify(message.detail).slice(0, 1e3)}`);
		active.sawActivity = true;
		switch (message.kind) {
			case "text-delta":
				if (message.parentToolUseId !== void 0) return;
				active.sawTextDelta = true;
				active.text += message.text;
				active.transcriptText += message.text;
				await this.#upsertTranscriptText(active);
				active.firstOutputAt ??= Date.now();
				active.output.push({
					type: "text-delta",
					text: message.text
				});
				return;
			case "assistant-text":
				if (message.parentToolUseId !== void 0) {
					if (active.subagentText.get(message.parentToolUseId) === message.text) return;
					active.subagentText.set(message.parentToolUseId, message.text);
					await this.#appendActivity(active, {
						kind: "text",
						phase: "completed",
						parentToolUseId: message.parentToolUseId,
						text: message.text
					});
					return;
				}
				if (!active.sawTextDelta) {
					active.sawTextDelta = true;
					active.text += message.text;
					active.transcriptText += message.text;
					await this.#upsertTranscriptText(active);
					active.firstOutputAt ??= Date.now();
					active.output.push({
						type: "text-delta",
						text: message.text
					});
				}
				return;
			case "thinking":
				if (message.parentToolUseId !== void 0) return;
				if (message.phase === "updated") {
					active.thinking += message.text;
					return;
				}
				active.thinking = message.text;
				await this.#appendActivity(active, {
					kind: "thinking",
					phase: "completed",
					title: "Claude thinking",
					summary: message.text
				});
				if (active.native) active.output.push({
					type: "thinking",
					text: message.text
				});
				return;
			case "tool-call":
				if (message.parentToolUseId === void 0) this.#closeTranscriptTextSegment(active);
				await this.#appendActivity(active, {
					kind: message.parentToolUseId === void 0 ? "tool-call" : "subagent",
					phase: "started",
					toolUseId: message.toolUseId,
					...message.parentToolUseId === void 0 ? {} : { parentToolUseId: message.parentToolUseId },
					toolName: message.toolName,
					title: message.toolName,
					summary: message.parentToolUseId === void 0 ? rootCallSummary(message.toolName, message.input) : `Subagent called ${message.toolName}`,
					detail: message.parentToolUseId === void 0 ? message.input : void 0
				});
				if (message.toolName === "ScheduleWakeup" && message.parentToolUseId === void 0) this.#handleScheduleWakeup(entry, message.input);
				if (message.toolName === "CronCreate" && message.parentToolUseId === void 0) this.#handleCronCreate(entry, message.input);
				if (message.toolName === "CronDelete" && message.parentToolUseId === void 0) this.#handleCronDelete(entry);
				if (message.toolName === "TodoWrite" && message.parentToolUseId === void 0) {
					const todos = todosFromTodoWrite(message.input);
					if (todos !== void 0) await this.#writeTodos(active, todos);
				} else if (entry.taskBoard.call(message.toolName, message.toolUseId, message.input)) await this.#writeTodos(active, entry.taskBoard.todos());
				if (message.parentToolUseId === void 0) {
					active.openCalls.set(message.toolUseId, message.toolName);
					this.#armAutoBackground(entry, active, message.toolUseId, message.toolName, message.input);
				}
				return;
			case "tool-result":
				active.openCalls.delete(message.toolUseId);
				this.#disarmAutoBackground(active, message.toolUseId);
				if (entry.taskBoard.result(message.toolUseId, [message.output, message.content], message.isError)) await this.#writeTodos(active, entry.taskBoard.todos());
				await this.#appendActivity(active, {
					kind: message.parentToolUseId === void 0 ? "tool-result" : "subagent",
					phase: message.isError ? "failed" : "completed",
					toolUseId: message.toolUseId,
					...message.parentToolUseId === void 0 ? {} : { parentToolUseId: message.parentToolUseId },
					title: message.isError ? "Tool failed" : "Tool completed",
					detail: message.parentToolUseId === void 0 ? message.output : void 0,
					isError: message.isError
				});
				return;
			case "subagent":
				await this.#appendActivity(active, {
					kind: "subagent",
					phase: message.phase,
					...message.taskId === void 0 ? {} : { taskId: message.taskId },
					title: message.title,
					summary: message.summary,
					detail: message.detail,
					isError: message.phase === "failed"
				});
				return;
			case "request-usage":
				if (message.parentToolUseId !== void 0) return;
				if ((message.usage.inputTokens ?? 0) + (message.usage.cacheReadTokens ?? 0) + (message.usage.cacheCreationTokens ?? 0) > 0) active.requestUsage = message.usage;
				return;
			case "compaction":
				this.#closeTranscriptTextSegment(active);
				await this.#appendActivity(active, {
					kind: "compaction",
					phase: "completed",
					title: "Claude compacted the conversation",
					detail: {
						...message.trigger === void 0 ? {} : { trigger: message.trigger },
						...message.preTokens === void 0 ? {} : { preTokens: message.preTokens },
						...message.postTokens === void 0 ? {} : { postTokens: message.postTokens },
						...message.durationMs === void 0 ? {} : { durationMs: message.durationMs }
					}
				});
				return;
			case "unknown":
				if (entry.reportedUnknownTypes.has(message.type)) return;
				entry.reportedUnknownTypes.add(message.type);
				await this.#appendActivity(active, {
					kind: "warning",
					phase: "completed",
					title: message.title,
					detail: message.detail
				});
				return;
			case "status":
			case "warning":
				await this.#appendActivity(active, {
					kind: message.kind === "status" ? "status" : "warning",
					phase: "completed",
					title: message.title,
					..."summary" in message ? { summary: message.summary } : {},
					..."detail" in message ? { detail: message.detail } : {}
				});
				return;
			case "permission-denied":
				await this.#appendActivity(active, {
					kind: "permission",
					phase: "denied",
					toolUseId: message.toolUseId,
					toolName: message.toolName,
					title: message.toolName,
					summary: message.summary
				});
				return;
		}
	}
	/** The turn's accounting with its wall clock attached. The transcript draws
	*  this line itself under the plugin renderer: activities carry no
	*  timestamps, so a duration it did not measure is a duration nobody has. */
	#timedUsage(active, usage) {
		const now = Date.now();
		return {
			...usage,
			durationMs: Math.max(0, now - active.startedAt),
			...active.firstOutputAt === void 0 ? {} : { ttftMs: Math.max(0, active.firstOutputAt - active.startedAt) }
		};
	}
	/** Merge one task lifecycle message into the session's task board. */
	async #trackTask(entry, message, taskId, originTurn) {
		const previous = entry.tasks.get(taskId);
		const next = {
			taskId,
			description: message.description ?? previous?.description ?? message.title,
			status: message.taskStatus ?? previous?.status ?? "running"
		};
		const resolvedOriginTurn = previous?.originTurn ?? originTurn;
		if (resolvedOriginTurn !== void 0) next.originTurn = resolvedOriginTurn;
		const toolUseId = message.toolUseId ?? previous?.toolUseId;
		if (toolUseId !== void 0) next.toolUseId = toolUseId;
		const subagentType = message.subagentType ?? previous?.subagentType;
		if (subagentType !== void 0) next.subagentType = subagentType;
		const taskType = message.taskType ?? previous?.taskType;
		if (taskType !== void 0) next.taskType = taskType;
		const lastToolName = message.lastToolName ?? previous?.lastToolName;
		if (lastToolName !== void 0) next.lastToolName = lastToolName;
		const summary = message.summary ?? previous?.summary;
		if (summary !== void 0) next.summary = summary;
		const usage = message.usage ?? previous?.usage;
		if (usage !== void 0) next.usage = usage;
		if (previous?.backgrounded === true) next.backgrounded = true;
		entry.tasks.set(taskId, next);
		const settled = next.status !== "running";
		if (next.status !== "running") this.#hostJobs?.settled(entry.sessionId, taskId, next.status, message.summary, message.outputFile);
		else if (message.phase === "started") {
			if ((message.backgrounded === true || hostJobKind(next.taskType) === "subagent") && message.skipTranscript !== true) this.#hostJobs?.started(entry.sessionId, taskId, hostJobKind(next.taskType), next.description, () => entry.query.stopTask(taskId));
		} else {
			const line = hostJobProgress(message);
			if (line !== void 0) this.#hostJobs?.progress(entry.sessionId, taskId, line);
		}
		await this.#scheduleTasksSnapshot(entry, settled);
		if (settled) await this.#continueAfterTasks(entry);
	}
	/** Fold the background-task level signal into the board (REPLACE semantics
	*  for the backgrounded flag: only the listed tasks are detached). */
	async #trackBackgroundLevel(entry, tasks, originTurn) {
		const live = new Set(tasks.map((task) => task.taskId));
		let changed = false;
		for (const task of tasks) {
			if (task.ambient !== true) this.#hostJobs?.started(entry.sessionId, task.taskId, hostJobKind(task.taskType), task.description, () => entry.query.stopTask(task.taskId));
			const existing = entry.tasks.get(task.taskId);
			if (existing === void 0) {
				entry.tasks.set(task.taskId, {
					taskId: task.taskId,
					description: task.description,
					status: "running",
					...originTurn === void 0 ? {} : { originTurn },
					...task.taskType === void 0 ? {} : { taskType: task.taskType },
					backgrounded: true
				});
				changed = true;
			} else if (existing.backgrounded !== true || existing.status !== "running") {
				entry.tasks.set(task.taskId, {
					...existing,
					status: "running",
					backgrounded: true
				});
				changed = true;
			}
		}
		for (const task of entry.tasks.values()) if (task.backgrounded === true && task.status === "running" && !live.has(task.taskId)) {
			this.#hostJobs?.removed(entry.sessionId, task.taskId);
			entry.tasks.set(task.taskId, {
				...task,
				status: "completed"
			});
			changed = true;
		}
		if (changed) {
			await this.#scheduleTasksSnapshot(entry, true);
			await this.#continueAfterTasks(entry);
		}
	}
	#hasRunningTasks(entry, active) {
		return [...entry.tasks.values()].some((task) => {
			if (task.status !== "running") return false;
			if (task.originTurn !== void 0 && active?.cursor?.turn !== void 0 && task.originTurn !== active.cursor.turn) return false;
			return task.backgrounded === true || hostJobKind(task.taskType) === "subagent" || task.taskType === "local_agent" || task.taskType === "in_process_teammate";
		});
	}
	async #continueAfterTasks(entry) {
		const active = entry.active;
		if (active === void 0 || active.phase !== "waiting-tasks" || this.#hasRunningTasks(entry, active)) return;
		active.phase = "follow-up";
		active.promptUuid = randomUUID();
		active.sawTextDelta = false;
		active.text = "";
		this.#closeTranscriptTextSegment(active);
		active.thinking = "";
		await this.#appendSafely(active, {
			kind: "status",
			phase: "updated",
			title: "Claude Code is reporting background task results"
		});
		entry.input.push(sdkUserMessage(BACKGROUND_TASK_REPORT_PROMPT, active.promptUuid));
	}
	/** Persist the task board. Settled transitions flush immediately; progress
	*  ticks throttle to one snapshot per second to bound log volume. */
	async #scheduleTasksSnapshot(entry, immediate) {
		const THROTTLE_MS = 1e3;
		const elapsed = Date.now() - entry.taskSnapshotAt;
		if (!immediate && elapsed < THROTTLE_MS) {
			if (entry.taskSnapshotTimer === void 0) {
				entry.taskSnapshotTimer = setTimeout(() => {
					entry.taskSnapshotTimer = void 0;
					this.#flushTasksSnapshot(entry);
				}, THROTTLE_MS - elapsed);
				entry.taskSnapshotTimer.unref?.();
			}
			return;
		}
		await this.#flushTasksSnapshot(entry);
	}
	async #flushTasksSnapshot(entry) {
		if (entry.taskSnapshotTimer !== void 0) {
			clearTimeout(entry.taskSnapshotTimer);
			entry.taskSnapshotTimer = void 0;
		}
		entry.taskSnapshotAt = Date.now();
		await this.#sidecar.writeTasks(entry.sessionId, [...entry.tasks.values()]).catch(() => void 0);
	}
	/** What DSH is told about token usage: newest call's prompt, whole turn's output.
	*
	*  `TokenUsage` is documented as "token accounting for ONE model call", and
	*  DSH's token meter divides `uncachedInput + cacheRead + cacheWrite` by the
	*  context window to draw context pressure. One Claude turn makes many calls
	*  and the CLI's result usage sums all of them, so reporting that sum pinned
	*  the meter at 100%: a 35-call turn reads the same prompt from cache 35
	*  times, which sums past the window without the conversation ever growing.
	*  The newest single call answers "how big is this conversation now".
	*
	*  Output is deliberately excluded from that pressure sum, so the same
	*  argument never applied to it — and taking it from the newest call reported
	*  whatever the wrap-up message happened to cost, which is a couple of tokens
	*  after a turn that wrote thousands. The turn total is the honest figure.
	*
	*  The sidecar activity keeps the whole turn total for both — that is the
	*  audit and cost record, and nothing divides it by a window. */
	#reportedUsage(active, result) {
		const prompt = active.requestUsage;
		if (prompt === void 0) return result.usage;
		return {
			...prompt,
			...result.usage.outputTokens === void 0 ? {} : { outputTokens: result.usage.outputTokens }
		};
	}
	async #completeProgressSegment(active, result) {
		if (!active.sawTextDelta && active.text.length === 0 && result.text !== void 0) {
			active.text = result.text;
			active.transcriptText = result.text;
			await this.#upsertTranscriptText(active);
			active.output.push({
				type: "text-delta",
				text: result.text
			});
		}
		await this.#upsertTranscriptText(active);
		active.output.push({
			type: "segment-complete",
			text: active.text
		});
		active.sawTextDelta = false;
		active.text = "";
		this.#closeTranscriptTextSegment(active);
		active.thinking = "";
	}
	/** The turn's accounting, recorded once the turn is actually over.
	*
	*  A turn that hands off to background tasks passes through the same result
	*  handling on its way to `waiting-tasks`, and recording there drew a closing
	*  total under a turn that was still running. */
	async #recordTurnUsage(entry, active, result) {
		if (result.usage.inputTokens === void 0 && result.usage.outputTokens === void 0 && result.usage.cumulativeCostUsd === void 0) return;
		const cumulative = await this.#sessionCost(entry, result.usage.cumulativeCostUsd);
		const usage = cumulative === void 0 ? result.usage : {
			...result.usage,
			cumulativeCostUsd: cumulative
		};
		await this.#appendSafely(active, {
			kind: "usage",
			phase: "completed",
			title: "Claude usage",
			summary: usageSummary(usage),
			usage: this.#timedUsage(active, usage)
		});
		active.output.push({
			type: "usage",
			usage: this.#reportedUsage(active, result)
		});
	}
	/** What each session has spent across every process it has used. */
	#sessionCostTotals = /* @__PURE__ */ new Map();
	/** Add what this process spent since its last reading to the session total.
	*
	*  The reading is tracked per process rather than inferred from a drop in the
	*  counter, so a new process whose first turn costs more than the previous
	*  process's whole run is still counted in full. The first reading after this
	*  supervisor starts continues from the last total the sidecar recorded, so a
	*  Host restart does not reset the session either. */
	async #sessionCost(entry, reported) {
		if (reported === void 0) return void 0;
		const sessionId = entry.sessionId;
		let total = this.#sessionCostTotals.get(sessionId);
		if (total === void 0) total = await this.#persistedSessionCost(sessionId);
		total += Math.max(0, reported - entry.costReading);
		entry.costReading = reported;
		this.#sessionCostTotals.set(sessionId, total);
		return total;
	}
	async #persistedSessionCost(sessionId) {
		try {
			const { activities } = await this.#sidecar.read(sessionId);
			for (let index = activities.length - 1; index >= 0; index -= 1) {
				const cost = activities[index].usage?.cumulativeCostUsd;
				if (activities[index].kind === "usage" && typeof cost === "number" && Number.isFinite(cost)) return cost;
			}
		} catch {}
		return 0;
	}
	async #completeTurn(entry, active, result) {
		if (entry.active !== active) return;
		if (active.aborted) {
			await this.#upsertTranscriptText(active);
			await this.#flushTranscript(active);
			await this.#settleOpenCalls(active, "Cancelled with the turn");
			await this.#appendSafely(active, {
				kind: "status",
				phase: "failed",
				title: "Claude Code turn cancelled"
			});
			entry.active = void 0;
			entry.state = "idle";
			entry.lastUsedAt = Date.now();
			await this.#recordChainAnchor(entry, active);
			this.#checkpointProjection(entry);
			this.#armIdleTimer(entry);
			this.#notifyCapacityChange();
			this.#scheduleLimitReconciliation();
			return;
		}
		const unmatchedDenials = (result.permissionDenials ?? []).filter((denial) => !active.deniedToolUseIds.has(denial.toolUseId));
		if (unmatchedDenials.length > 0) await this.#appendSafely(active, {
			kind: "permission",
			phase: "denied",
			title: "Claude Code auto-denied tool calls",
			summary: unmatchedDenials.map((denial) => denial.toolName).join(", ")
		});
		if (!result.success) {
			await this.#recordTurnUsage(entry, active, result);
			if (!active.sawTextDelta && active.text.length === 0 && result.text !== void 0) {
				active.text = result.text;
				active.transcriptText = result.text;
				await this.#upsertTranscriptText(active);
				active.output.push({
					type: "text-delta",
					text: result.text
				});
			}
			await this.#upsertTranscriptText(active);
			await this.#flushTranscript(active);
			const collected = result.errors?.filter((entry) => entry.trim().length > 0).join("\n");
			const message = (collected !== void 0 && collected.length > 0 ? collected : void 0) ?? result.failureDetail ?? (result.terminalReason !== void 0 ? `Claude Code failed the turn (${result.terminalReason})` : "Claude Code failed the turn");
			await this.#appendSafely(active, {
				kind: "error",
				phase: "failed",
				title: "Claude Code turn failed",
				summary: message,
				isError: true
			});
			active.output.fail(new Error(message));
		} else {
			if (!active.sawTextDelta && active.text.length === 0 && result.text !== void 0) {
				active.text = result.text;
				active.transcriptText = result.text;
				await this.#upsertTranscriptText(active);
				active.output.push({
					type: "text-delta",
					text: result.text
				});
			}
			await this.#upsertTranscriptText(active);
			if ((active.phase === "primary" || active.phase === "follow-up") && this.#hasRunningTasks(entry, active)) {
				active.phase = "waiting-tasks";
				await this.#appendSafely(active, {
					kind: "status",
					phase: "updated",
					title: "Claude Code is waiting for background tasks"
				});
				await this.#completeProgressSegment(active, result);
				return;
			}
			await this.#recordTurnUsage(entry, active, result);
			await this.#appendSafely(active, {
				kind: "status",
				phase: "completed",
				title: "Claude Code turn completed"
			});
			this.#markAnswer(active);
			await this.#flushTranscript(active);
			active.output.push({
				type: "complete",
				text: active.text
			});
			active.output.close();
		}
		if (active.signal !== void 0 && active.abortListener !== void 0) active.signal.removeEventListener("abort", active.abortListener);
		entry.active = void 0;
		entry.state = "idle";
		entry.lastUsedAt = Date.now();
		await this.#recordChainAnchor(entry, active);
		this.#checkpointProjection(entry);
		this.#armIdleTimer(entry);
		this.#notifyCapacityChange();
		this.#scheduleLimitReconciliation();
		await this.#learnContextWindow(entry);
	}
	/** Tell every reader where this session's delta stream ended.
	*
	*  A reader that lost the turn's last delta has nothing later to reveal the
	*  hole, and a settled turn produces nothing further -- so a finished tool
	*  group would keep pulsing until the session was reopened by hand. Last
	*  line of the turn, best effort: presentation must never unsettle it. */
	#checkpointProjection(entry) {
		try {
			this.#sidecar.checkpoint(entry.sessionId);
		} catch {}
	}
	/** Pin the working tree this turn is about to change, so a rewind of it can
	*  put the checkout back where the turn found it.
	*
	*  Awaited, and deliberately: a snapshot taken after Claude's first edit
	*  would restore to a state that never existed. It costs one `git add -A`
	*  against a throwaway index per turn, and best effort throughout -- a
	*  session with no repository simply never offers a file rewind. */
	async #captureWorktree(entry, turn) {
		try {
			const tree = await captureWorktreeTree(this.#runtime, entry.cwd);
			if (tree === void 0) return;
			await this.#sidecar.recordRewindSnapshot(entry.sessionId, turn, tree);
		} catch {}
	}
	/** Pin where Claude's chain ended for the DSH turn that just settled, so a
	*  later rewind of the following turn can fork exactly here. Best effort:
	*  a missing anchor only makes a rewind fall back to an earlier turn. */
	async #recordChainAnchor(entry, active) {
		const uuid = entry.lastChainUuid;
		if (uuid === void 0) return;
		try {
			await this.#sidecar.recordRewindAnchor(entry.sessionId, active.cursor.turn, uuid);
		} catch {}
	}
	async #upsertTranscriptText(active) {
		if (active.transcriptText.length === 0) return;
		const ordinal = active.transcriptTextOrdinal ?? active.cursor.nextOrdinal++;
		active.transcriptTextOrdinal = ordinal;
		try {
			this.#sidecar.appendTranscriptText(active.agent.id, {
				text: active.transcriptText,
				...active.native ? { renderer: "native" } : {},
				turn: active.cursor.turn,
				step: active.cursor.step,
				ordinal
			});
		} catch {}
	}
	async #flushTranscript(active) {
		await this.#sidecar.flushTranscriptText(active.agent.id).catch(() => void 0);
	}
	/** Hand the closing prose segment to the Host as the turn's answer.
	*
	*  Host 0.1.7 folds a finished turn behind a disclosure and keeps only the
	*  final assistant answer outside it. Under the plugin renderer the answer
	*  would otherwise be empty, folding Claude's reply away with the rest of
	*  the turn. The segment is re-stamped so the plugin transcript stops
	*  drawing it; a turn that ended on a tool call has no closing prose and
	*  hands nothing over. */
	#markAnswer(active) {
		if (active.native || active.transcriptText.trim().length === 0 || active.transcriptTextOrdinal === void 0) return;
		try {
			this.#sidecar.appendTranscriptText(active.agent.id, {
				text: active.transcriptText,
				answer: true,
				turn: active.cursor.turn,
				step: active.cursor.step,
				ordinal: active.transcriptTextOrdinal
			});
		} catch {}
		active.output.push({
			type: "answer",
			text: active.transcriptText
		});
	}
	#closeTranscriptTextSegment(active) {
		this.#flushTranscript(active);
		active.transcriptText = "";
		active.transcriptTextOrdinal = void 0;
	}
	async #appendActivity(active, activity) {
		const ordinal = active.cursor.nextOrdinal++;
		await this.#sidecar.appendActivity(active.agent.id, {
			...activity,
			...active.native && !pluginDrawnUnderNative(activity) ? { renderer: "native" } : {},
			turn: active.cursor.turn,
			step: active.cursor.step,
			ordinal
		});
	}
	/** Persist durable activity without letting a storage failure unsettle the
	* in-memory turn or leak process ownership. Audit failure is best-effort. */
	async #appendSafely(active, activity) {
		await this.#appendActivity(active, activity).catch(() => void 0);
	}
	#startInterrupt(entry) {
		const existing = this.#interruptions.get(entry.sessionId);
		if (existing !== void 0) return existing;
		const interruption = this.#interrupt(entry).finally(() => {
			this.#interruptions.delete(entry.sessionId);
		});
		this.#interruptions.set(entry.sessionId, interruption);
		return interruption;
	}
	/** Put Claude's list in the session log as the `todo/write` snapshot the
	*  Host's to-do dock reads. Presentation only: a failed append never
	*  unsettles the turn. */
	async #writeTodos(active, todos) {
		const snapshot = JSON.stringify(todos);
		if (snapshot === active.todoSnapshot) return;
		active.todoSnapshot = snapshot;
		try {
			await active.agent.session.append("todo/write", { todos: todos.map((item) => ({ ...item })) });
		} catch {}
	}
	/** Move one running root tool call to the background: the terminal's Ctrl+B
	*  for a single call. Claude receives a "running in the background" result
	*  at once and the command joins the Host job list with a stop control. */
	async backgroundToolCall(sessionId, toolUseId) {
		const entry = this.#entries.get(sessionId);
		const active = entry?.active;
		if (entry === void 0 || active === void 0 || !active.openCalls.has(toolUseId)) return "not-running";
		return await this.#backgroundCall(entry, active, toolUseId, "requested by the user") ? "moved" : "unavailable";
	}
	/** A blocking Bash call gets one timer; the timer's firing is the auto-move,
	*  which the call's own result disarms. `run_in_background` calls are
	*  already detached and need none. */
	#armAutoBackground(entry, active, toolUseId, toolName, input) {
		const afterMs = this.#config.foregroundBashBackgroundMs ?? 6e4;
		if (toolName !== "Bash" || afterMs <= 0) return;
		if ((input !== null && typeof input === "object" ? input : void 0)?.run_in_background === true) return;
		const timer = setTimeout(() => {
			active.backgroundTimers.delete(toolUseId);
			if (entry.active !== active || !active.openCalls.has(toolUseId)) return;
			this.#backgroundCall(entry, active, toolUseId, `ran longer than ${afterMs >= 1e3 ? `${Math.round(afterMs / 1e3)}s` : `${afterMs}ms`}`);
		}, afterMs);
		timer.unref?.();
		active.backgroundTimers.set(toolUseId, timer);
	}
	#disarmAutoBackground(active, toolUseId) {
		const timer = active.backgroundTimers.get(toolUseId);
		if (timer === void 0) return;
		clearTimeout(timer);
		active.backgroundTimers.delete(toolUseId);
	}
	async #backgroundCall(entry, active, toolUseId, reason) {
		this.#disarmAutoBackground(active, toolUseId);
		let moved = false;
		try {
			moved = await entry.query.backgroundTasks(toolUseId);
		} catch (error) {
			this.#logger?.warn(`dsh-claude: moving tool call ${toolUseId} to the background failed: ${error instanceof Error ? error.message : String(error)}`);
		}
		await this.#appendSafely(active, {
			kind: "status",
			phase: moved ? "completed" : "failed",
			toolUseId,
			title: moved ? "Claude Code moved the command to the background" : "Claude Code could not move the command to the background",
			summary: reason
		});
		return moved;
	}
	/** Close out the root tool calls a turn is ending without answers for.
	*
	*  A tool result is the only thing that ever settles a call, and a turn that
	*  is cancelled or disconnected produces none: the transcript would keep
	*  drawing those calls as running for as long as the session lives, and no
	*  later event would ever correct it. Written as the failures they are. */
	async #settleOpenCalls(active, summary) {
		const open = [...active.openCalls];
		active.openCalls.clear();
		for (const toolUseId of [...active.backgroundTimers.keys()]) this.#disarmAutoBackground(active, toolUseId);
		for (const [toolUseId, toolName] of open) await this.#appendSafely(active, {
			kind: "tool-result",
			phase: "failed",
			toolUseId,
			toolName,
			title: "Tool cancelled",
			summary,
			isError: true
		});
	}
	async #interrupt(entry) {
		const active = entry.active;
		if (active === void 0 || entry.state === "interrupting") return;
		entry.state = "interrupting";
		active.aborted = true;
		active.output.fail(abortFailure());
		await this.#upsertTranscriptText(active);
		let interruptError;
		try {
			if (((await withTimeout(entry.query.interrupt(), 5e3, "Claude Code interrupt"))?.still_queued ?? []).includes(active.promptUuid)) throw new Error(`Claude Code interrupt left submitted prompt ${active.promptUuid} queued`);
		} catch (error) {
			interruptError = error;
		}
		await this.#settleOpenCalls(active, "Cancelled with the turn").catch(() => void 0);
		try {
			await this.#appendActivity(active, {
				kind: "status",
				phase: "failed",
				title: interruptError === void 0 ? "Claude Code turn cancelled" : "Claude Code cancelled; process entry reset",
				...interruptError === void 0 ? {} : { summary: errorSummary(interruptError) }
			});
		} catch {}
		if (this.#entries.get(entry.sessionId) === entry) this.#entries.delete(entry.sessionId);
		await this.#disposeEntry(entry, "turn interrupt cleanup");
	}
	async #handleDisconnect(entry, error) {
		const active = entry.active;
		const process = entry.process;
		if (process !== void 0 && process.exitCode === null && process.signalCode === null) await process.handle.waitForExit(AbortSignal.timeout(DISCONNECT_EXIT_WAIT_MS)).catch(() => void 0);
		const status = exitStatus(process, entry.disposeReason);
		const stderr = process?.stderrTail();
		this.#logger?.warn?.(`dsh-claude: Claude Code for ${entry.sessionId} stopped (${status})${active === void 0 ? " with no turn running" : active.sawActivity ? " mid-turn after activity" : " before the turn produced anything"}${stderr === void 0 || stderr.length === 0 ? "" : `; stderr: ${redactText(stderr.slice(-400))}`}`);
		if (active !== void 0) {
			await this.#upsertTranscriptText(active);
			await this.#flushTranscript(active);
			if (active.signal !== void 0 && active.abortListener !== void 0) active.signal.removeEventListener("abort", active.abortListener);
			const unknown = active.sawActivity;
			entry.state = unknown ? "outcome-unknown" : "disconnected";
			const open = active.openCalls.size === 0 ? "" : `; ${active.openCalls.size} tool call(s) were still unanswered`;
			const failure = unknown ? new ClaudeOutcomeUnknownError(`Claude Code exited after activity; side-effect outcome is unknown and the prompt was not replayed (${status}${open})${stderr === void 0 || stderr.length === 0 ? "" : `. ${stderr}`}`) : /* @__PURE__ */ new Error(`${stderr === void 0 || stderr.length === 0 ? errorSummary(error) : stderr} (${status}${open})`);
			await this.#settleOpenCalls(active, "Claude Code stopped before the tool answered").catch(() => void 0);
			await this.#appendSafely(active, {
				kind: "error",
				phase: "failed",
				title: unknown ? "Claude Code outcome unknown" : "Claude Code disconnected",
				summary: failure.message,
				isError: true,
				detail: error
			});
			active.output.fail(failure);
			entry.active = void 0;
		} else entry.state = "disconnected";
		this.#entries.delete(entry.sessionId);
		await this.#disposeEntry(entry, "process stream ended");
	}
	#armIdleTimer(entry) {
		if (this.#config.idleTimeoutMs <= 0) return;
		const timer = setTimeout(() => {
			if (entry.active !== void 0 || entry.state !== "idle") return;
			this.#entries.delete(entry.sessionId);
			this.#disposeEntry(entry, "idle timeout");
		}, this.#config.idleTimeoutMs);
		timer.unref?.();
		entry.idleTimer = timer;
	}
	/** @param reason - why the plugin is ending this process; it travels into the
	*  turn's failure text, so a kill the plugin asked for names its cause. */
	async #disposeEntry(entry, reason) {
		if (entry.state === "disposed") return;
		entry.disposeReason = reason;
		if (entry.idleTimer !== void 0) clearTimeout(entry.idleTimer);
		entry.state = "disposed";
		this.#hostJobs?.abandon(entry.sessionId);
		entry.input.discard(abortFailure());
		entry.query.close();
		entry.lifetime.abort();
		if (entry.active !== void 0) {
			for (const toolUseId of [...entry.active.backgroundTimers.keys()]) this.#disarmAutoBackground(entry.active, toolUseId);
			entry.active.output.fail(abortFailure());
		}
		entry.process?.kill("SIGTERM");
		if (entry.process !== void 0) try {
			await entry.process.handle.waitForExit(AbortSignal.timeout(5e3));
		} catch {}
		this.#notifyCapacityChange();
	}
};
//#endregion
//#region src/review-comments.ts
const MAX_COMMENTS_PER_SESSION = 50;
const MAX_TEXT_CHARS$1 = 2e3;
const MAX_PATH_CHARS$2 = 1024;
const MAX_LINE = 1e7;
var ReviewCommentError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "ReviewCommentError";
		this.code = code;
	}
};
function validSide(value) {
	return value === "old" || value === "new";
}
/** Pending line comments queued per session until the next user turn drains them. */
var ReviewCommentStore = class {
	#comments = /* @__PURE__ */ new Map();
	add(sessionId, input) {
		const path = typeof input.path === "string" ? input.path.trim() : "";
		const text = typeof input.text === "string" ? input.text.trim() : "";
		if (path.length === 0 || path.length > MAX_PATH_CHARS$2 || /[\0\r\n]/u.test(path)) throw new ReviewCommentError("invalid-request", "The comment path is invalid.");
		if (text.length === 0 || text.length > MAX_TEXT_CHARS$1 || text.includes("\0")) throw new ReviewCommentError("invalid-request", "The comment text is invalid.");
		if (typeof input.line !== "number" || !Number.isSafeInteger(input.line) || input.line < 1 || input.line > MAX_LINE) throw new ReviewCommentError("invalid-request", "The comment line is invalid.");
		if (!validSide(input.side)) throw new ReviewCommentError("invalid-request", "The comment side is invalid.");
		const startLine = input.startLine === void 0 || input.startLine === null ? void 0 : input.startLine;
		if (startLine !== void 0 && (typeof startLine !== "number" || !Number.isSafeInteger(startLine) || startLine < 1 || startLine > input.line)) throw new ReviewCommentError("invalid-request", "The comment start line is invalid.");
		const existing = this.#comments.get(sessionId) ?? [];
		if (existing.length >= MAX_COMMENTS_PER_SESSION) throw new ReviewCommentError("too-many-comments", "Too many pending review comments. Remove one before adding another.");
		const comment = {
			id: randomUUID(),
			path,
			line: input.line,
			...startLine === void 0 || startLine === input.line ? {} : { startLine },
			side: input.side,
			text
		};
		this.#comments.set(sessionId, [...existing, comment]);
		return comment;
	}
	remove(sessionId, id) {
		const existing = this.#comments.get(sessionId);
		if (existing === void 0) return false;
		const next = existing.filter((comment) => comment.id !== id);
		if (next.length === existing.length) return false;
		if (next.length === 0) this.#comments.delete(sessionId);
		else this.#comments.set(sessionId, next);
		return true;
	}
	list(sessionId) {
		return this.#comments.get(sessionId) ?? [];
	}
	/** Remove and return every pending comment; called when a user turn consumes them. */
	drain(sessionId) {
		const existing = this.#comments.get(sessionId) ?? [];
		this.#comments.delete(sessionId);
		return existing;
	}
	disposeSession(sessionId) {
		this.#comments.delete(sessionId);
	}
	dispose() {
		this.#comments.clear();
	}
};
/** Render drained comments as the prompt block preceding the user's message text. */
function formatReviewComments(comments) {
	return [
		"<user-review-comments>",
		"The user attached these code review comments to this message. Each references a file and line (or line range) from the current working tree diff:",
		...comments.map((comment, index) => `${index + 1}. ${comment.path}:${comment.startLine === void 0 ? comment.line : `${comment.startLine}-${comment.line}`}${comment.side === "old" ? " (old side)" : ""} — ${comment.text}`),
		"</user-review-comments>"
	].join("\n");
}
//#endregion
//#region src/session-title.ts
/** Answer DSH's auxiliary session-title request with a throwaway Haiku turn.
*
*  DSH titles a session by asking the model behind the session's own route for
*  a summary of the first human message. That route is this plugin, and the
*  session's Claude process must not answer it: the title call carries a
*  plugin-authored system prompt and would land in the user's transcript. A
*  separate one-shot turn keeps it out, for the same reasons as the branch-name
*  summary and the plan-usage probe. Deployments that never installed a second
*  model provider still get a readable title, since the only model this plugin
*  needs is the one it already runs. */
/** Cheapest model that can summarize a sentence in the language it was written in. */
const SESSION_TITLE_MODEL = "haiku";
/** Backstop only. The title service wraps its own deadline (60s by default)
*  around the call and passes it as `signal`, so a shorter budget here just
*  kills a turn the caller was still happy to wait for — a cold CLI start plus
*  one Haiku reply routinely passes ten seconds. */
const SESSION_TITLE_TIMEOUT_MS = 6e4;
/** DSH frames the messages as JSON under its own byte cap; this only bounds a
*  caller that does not. */
const MAX_INPUT_CHARS = 8e3;
/** Longer than any title DSH accepts (80 bytes), short enough to bound prose. */
const MAX_TITLE_CHARS = 200;
/** Carry DSH's instruction as the prompt's own preamble: a Claude Code turn has
*  no separate system slot this plugin can borrow without replacing the CLI's. */
function sessionTitlePrompt(request) {
	const input = request.input.trim().slice(0, MAX_INPUT_CHARS);
	return request.system === void 0 || request.system.length === 0 ? input : `${request.system}\n\n${input}`;
}
/** The one line of the reply that is the title. DSH strips control characters
*  and truncates to its own byte cap, so nothing else is cleaned here. */
function sessionTitleLine(reply) {
	const line = reply.split("\n").map((candidate) => candidate.trim()).find((candidate) => candidate.length > 0);
	return line === void 0 ? "" : line.slice(0, MAX_TITLE_CHARS);
}
/**
* Summarize the framed messages into one title line.
*
* Rejects rather than returning a placeholder: the title service logs the
* failure and keeps the deterministic first-words fallback, which is a better
* label than anything this function could invent.
*/
async function summarizeSessionTitle(executablePath, request, factory = query) {
	const prompt = sessionTitlePrompt(request);
	if (prompt.length === 0) throw new Error("dsh-claude: the session-title request carried no text");
	const lifetime = new AbortController();
	const abort = () => {
		lifetime.abort();
	};
	request.signal?.addEventListener("abort", abort, { once: true });
	const timer = setTimeout(abort, SESSION_TITLE_TIMEOUT_MS);
	timer.unref?.();
	try {
		const query = factory({
			prompt,
			options: {
				cwd: process.cwd(),
				abortController: lifetime,
				model: SESSION_TITLE_MODEL,
				allowedTools: [],
				settingSources: [
					"user",
					"project",
					"local"
				],
				maxTurns: 1,
				...executablePath.length === 0 ? {} : { pathToClaudeCodeExecutable: executablePath }
			}
		});
		for await (const message of query) {
			if (message.type !== "result" || message.subtype !== "success" || message.is_error === true) continue;
			const title = sessionTitleLine(message.result);
			if (title.length > 0) return title;
			break;
		}
		throw new Error("dsh-claude: the session-title turn produced no title");
	} finally {
		clearTimeout(timer);
		request.signal?.removeEventListener("abort", abort);
		lifetime.abort();
	}
}
//#endregion
//#region src/adapter.ts
const THINKING_MODES = [
	{
		id: "off",
		name: "Off",
		description: "No extended thinking."
	},
	{
		id: "low",
		name: "Low",
		description: "Minimal thinking, fastest responses."
	},
	{
		id: "medium",
		name: "Medium",
		description: "Moderate thinking."
	},
	{
		id: "high",
		name: "High",
		description: "Deep reasoning (Claude Code default)."
	},
	{
		id: "xhigh",
		name: "Extra High",
		description: "Deeper than high; unsupported models silently downgrade to high."
	},
	{
		id: "max",
		name: "Max",
		description: "Maximum effort; unsupported models silently downgrade."
	},
	{
		id: "ultracode",
		name: "Ultracode",
		description: "Extra-high effort plus standing dynamic-workflow orchestration; requires an xhigh-capable model."
	}
];
function thinkingModeFor(effort) {
	if (effort === void 0) return void 0;
	if (THINKING_MODES.some((mode) => mode.id === effort)) return effort;
	throw new Error(`dsh-claude: unsupported reasoning effort ${JSON.stringify(effort)}`);
}
const NO_RETRY_POLICY = Object.freeze({
	mode: "normal",
	maxRetries: 0,
	retryableCodes: Object.freeze([]),
	initialDelayMs: 500,
	maxDelayMs: 1e4,
	jitterRatio: .1
});
/** One line per attached file, ahead of the text it came with.
*
*  Claude Code reads files through its own tools, and the SDK's prompt content
*  has no file block, so an attachment travels as the path it was stored at —
*  the same thing the CLI user would have typed. */
function fileReferenceBlock(files) {
	return {
		type: "text",
		text: ["The user attached these files to this message:", ...files.map((file) => `- ${file.name} — read it from ${file.path}`)].join("\n")
	};
}
function abortIfRequested(signal) {
	if (signal?.aborted !== true) return;
	if (signal.reason instanceof Error) throw signal.reason;
	const error = /* @__PURE__ */ new Error("Claude Code input resolution aborted");
	error.name = "AbortError";
	throw error;
}
function finiteNonNegative(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function validateImageRef(ref, attachments, imageIndex) {
	const limits = attachments.imageLimits;
	if (!limits.mediaTypes.includes(ref.mediaType)) throw new Error(`dsh-claude: image ${imageIndex} has an unsupported media type`);
	if (!finiteNonNegative(ref.bytes) || ref.bytes > limits.maxImageBytes) throw new Error(`dsh-claude: image ${imageIndex} exceeds the configured byte limit`);
	const maxDimension = "maxImageDimension" in limits && finiteNonNegative(limits.maxImageDimension) ? limits.maxImageDimension : void 0;
	if (!finiteNonNegative(ref.width) || !finiteNonNegative(ref.height) || ref.width * ref.height > limits.maxImagePixels || maxDimension !== void 0 && (ref.width > maxDimension || ref.height > maxDimension)) throw new Error(`dsh-claude: image ${imageIndex} exceeds the configured dimension limit`);
}
/**
* Prepend the session's pending diff-review comments to the outgoing user
* prompt. The comments are drained once per turn: they are formatted into one
* `<user-review-comments>` block placed ahead of the user's own text (or as a
* leading text block for multi-part prompts) so Claude reads them in the same
* turn that consumed them.
*/
function injectReviewComments(prompt, comments) {
	if (comments.length === 0) return prompt;
	const block = formatReviewComments(comments);
	if (typeof prompt === "string") return `${block}\n\n${prompt}`;
	return [{
		type: "text",
		text: block
	}, ...prompt];
}
function imageBlock(data, mediaType) {
	return {
		type: "image",
		source: {
			type: "base64",
			media_type: mediaType,
			data: Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("base64")
		}
	};
}
/** Resolve only the newest direct human message; Claude's session owns history. */
async function resolveDirectUserPrompt(messages, attachments, signal) {
	const message = [...messages].reverse().find((candidate) => candidate.role === "user" && candidate.source?.kind === "user");
	if (message === void 0) throw new Error("dsh-claude: no direct human input was present in this model step");
	const imageRefs = message.content.filter((block) => block.type === "image").map((block) => block.attachment);
	const fileCount = message.content.filter((block) => block.type === "file").length;
	const limits = attachments.imageLimits;
	if (imageRefs.length > limits.maxImagesPerMessage) throw new Error("dsh-claude: prompt exceeds the configured image-count limit");
	let declaredBytes = 0;
	imageRefs.forEach((ref, index) => {
		validateImageRef(ref, attachments, index + 1);
		declaredBytes += ref.bytes;
		if (!Number.isSafeInteger(declaredBytes) || declaredBytes > limits.maxMessageImageBytes) throw new Error("dsh-claude: prompt exceeds the configured aggregate image-byte limit");
	});
	if (imageRefs.length === 0 && fileCount === 0) {
		const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
		if (text.length > 0) return text;
		throw new Error("dsh-claude: the newest direct human message has no supported content");
	}
	const content = [];
	const files = [];
	let imageIndex = 0;
	let fileIndex = 0;
	let verifiedBytes = 0;
	for (const block of message.content) {
		abortIfRequested(signal);
		if (block.type === "text") {
			content.push({
				type: "text",
				text: block.text
			});
			continue;
		}
		if (block.type === "file") {
			fileIndex += 1;
			const path = attachments.fileHostPath(block.attachment);
			if (path === void 0 || path.length === 0) throw new Error(`dsh-claude: file ${fileIndex} is not readable from this Host`);
			files.push({
				name: block.attachment.name,
				path
			});
			continue;
		}
		if (block.type !== "image") continue;
		imageIndex += 1;
		let stored;
		try {
			stored = await attachments.readImage(block.attachment, signal);
		} catch {
			abortIfRequested(signal);
			throw new Error(`dsh-claude: image ${imageIndex} could not be read or verified`);
		}
		abortIfRequested(signal);
		validateImageRef(stored.ref, attachments, imageIndex);
		if (stored.data.byteLength !== stored.ref.bytes || stored.ref.mediaType !== block.attachment.mediaType) throw new Error(`dsh-claude: image ${imageIndex} failed attachment verification`);
		verifiedBytes += stored.data.byteLength;
		if (!Number.isSafeInteger(verifiedBytes) || verifiedBytes > limits.maxMessageImageBytes) throw new Error("dsh-claude: prompt exceeds the configured aggregate image-byte limit");
		content.push(imageBlock(stored.data, stored.ref.mediaType));
	}
	if (files.length > 0) content.unshift(fileReferenceBlock(files));
	if (content.length === 0) throw new Error("dsh-claude: the newest direct human message has no supported content");
	return content;
}
function tokenUsage(usage) {
	const normalized = {
		inputTokens: usage.inputTokens ?? 0,
		outputTokens: usage.outputTokens ?? 0
	};
	if (usage.cacheReadTokens !== void 0) normalized.cacheReadTokens = usage.cacheReadTokens;
	if (usage.cacheCreationTokens !== void 0) normalized.cacheWriteTokens = usage.cacheCreationTokens;
	return normalized;
}
/** Flatten a hand-built auxiliary request to text. Unlike a conversation turn
*  it has no images and no human-sourced message to single out: every message
*  in it was assembled by the plugin that asked the question. */
function auxiliaryText(messages) {
	return messages.flatMap((message) => message.content.filter((block) => block.type === "text").map((block) => block.text)).join("\n");
}
function resolveAgent(agents, options) {
	const initiator = agents.currentInitiator();
	if (initiator !== void 0) return initiator;
	if (options.sessionId !== void 0) {
		const agent = agents.get(options.sessionId);
		if (agent !== void 0) return agent;
	}
	throw new Error("dsh-claude: the model request has no live owning DSH agent");
}
var ClaudeCodeAdapter = class extends LlmAdapter {
	#supervisor;
	#agents;
	#attachments;
	#presetIdFor;
	#drainReviewComments;
	/** The renderer setting, read from its file at the start of each turn. A
	*  cached copy would go stale whenever the file is edited outside the
	*  Settings dialog, and the read is dwarfed by the process the turn spawns. */
	#renderMode;
	#summarizeTitle;
	/** Reads the CLI's own `/model` rows, so the selector never has to advertise
	*  the seed vocabulary once the CLI can answer for itself. */
	#probeModels;
	constructor(supervisor, agents, attachments, presetIdFor, drainReviewComments = () => [], renderMode = async () => DEFAULT_CLAUDE_RENDER_MODE, summarizeTitle = (request) => summarizeSessionTitle("", request), probeModels = async () => []) {
		super();
		this.#supervisor = supervisor;
		this.#agents = agents;
		this.#attachments = attachments;
		this.#presetIdFor = presetIdFor;
		this.#drainReviewComments = drainReviewComments;
		this.#renderMode = renderMode;
		this.#summarizeTitle = summarizeTitle;
		this.#probeModels = probeModels;
	}
	providerInfo(provider) {
		return {
			id: provider,
			name: "Claude Code"
		};
	}
	providerRetryPolicy() {
		return NO_RETRY_POLICY;
	}
	async listModels(provider) {
		return (await ensureClaudeModels(this.#probeModels)).map((model) => ({
			provider,
			id: model.id,
			name: model.name,
			description: model.description,
			inputModalities: ["text", "image"]
		}));
	}
	async resolveModel(provider, model, _signal) {
		const known = claudeModelRow(model);
		const contextWindow = this.#supervisor.contextWindow(model) ?? known?.contextWindow;
		return {
			provider,
			id: model,
			name: known?.name ?? `Claude Code ${model}`,
			...known === void 0 ? {} : { description: known.description },
			...contextWindow === void 0 ? {} : { context: { contextWindow } },
			inputModalities: ["text", "image"],
			reasoning: { efforts: THINKING_MODES.map((mode) => ({
				id: ReasoningEffortId(mode.id),
				name: mode.name,
				description: mode.description
			})) }
		};
	}
	async prepareCall(provider, model, signal) {
		return {
			model: await this.resolveModel(provider, model, signal),
			stream: (options) => this.stream(options)
		};
	}
	/** Title the session from its own provider without touching its process.
	*
	*  DSH routes the title request at the session's model, which is this
	*  adapter; a deployment with no second provider configured would otherwise
	*  never get a title at all and keep the first five words of the first
	*  message. A throwaway Haiku turn answers it, so the session's transcript,
	*  context, and permission bridge stay out of it. */
	async *#titleStream(options) {
		const title = await this.#summarizeTitle({
			...options.system === void 0 ? {} : { system: options.system },
			input: auxiliaryText(options.messages),
			...options.signal === void 0 ? {} : { signal: options.signal }
		});
		yield {
			type: "block-start",
			index: 0,
			blockType: "text"
		};
		yield {
			type: "text-delta",
			index: 0,
			text: title
		};
		yield {
			type: "block-end",
			index: 0,
			block: {
				type: "text",
				text: title
			}
		};
		yield {
			type: "finish",
			reason: { kind: "stop" }
		};
	}
	async *stream(options) {
		if (options.purpose === "session-title") {
			yield* this.#titleStream(options);
			return;
		}
		if (options.purpose !== void 0) throw new Error(`dsh-claude: auxiliary ${options.purpose} calls are not routed into the Claude session`);
		const agent = resolveAgent(this.#agents, options);
		if (this.#presetIdFor(agent) !== "claude") throw new Error(`dsh-claude: provider ${CLAUDE_CODE_PROVIDER} is available only to the ${CLAUDE_CODE_PRESET_ID} preset`);
		const thinkingMode = thinkingModeFor(options.reasoningEffort);
		let prompt;
		try {
			prompt = await resolveDirectUserPrompt(options.messages, this.#attachments, options.signal);
		} catch (error) {
			if (error.name !== "AbortError") throw error;
			yield {
				type: "finish",
				reason: {
					kind: "aborted",
					failure: {
						code: "aborted",
						message: error instanceof Error ? error.message : "Claude Code input resolution aborted"
					}
				}
			};
			return;
		}
		const renderMode = await this.#renderMode();
		const native = renderMode === "native";
		const events = await this.#supervisor.runTurn({
			agent,
			prompt: injectReviewComments(prompt, this.#drainReviewComments(agent.id)),
			model: options.model,
			renderMode,
			...thinkingMode === void 0 ? {} : { thinkingMode },
			...options.signal === void 0 ? {} : { signal: options.signal }
		});
		let pendingUsage;
		let completed = false;
		let blockIndex = 0;
		let text = "";
		/** Settle the buffered prose as one text block. Each Claude result is one
		*  block so tool activity stays ahead of the prose it explains and a
		*  background-task report can follow in a block of its own. */
		function* flushText() {
			if (text.length === 0) return;
			const settled = text;
			text = "";
			yield {
				type: "block-start",
				index: blockIndex,
				blockType: "text"
			};
			yield {
				type: "text-delta",
				index: blockIndex,
				text: settled
			};
			yield {
				type: "block-end",
				index: blockIndex,
				block: {
					type: "text",
					text: settled
				}
			};
			blockIndex += 1;
		}
		try {
			for await (const event of events) {
				if (event.type === "usage") {
					pendingUsage = tokenUsage(event.usage);
					continue;
				}
				if (event.type === "text-delta") {
					if (native) text += event.text;
					continue;
				}
				if (event.type === "answer") {
					if (!native) text = event.text;
					continue;
				}
				if (event.type === "thinking") {
					if (!native) continue;
					yield* flushText();
					yield {
						type: "block-start",
						index: blockIndex,
						blockType: "reasoning"
					};
					yield {
						type: "reasoning-delta",
						index: blockIndex,
						text: event.text
					};
					yield {
						type: "block-end",
						index: blockIndex,
						block: {
							type: "reasoning",
							text: event.text
						}
					};
					blockIndex += 1;
					continue;
				}
				yield* flushText();
				if (event.type === "segment-complete") continue;
				completed = true;
				if (pendingUsage !== void 0) yield {
					type: "usage",
					usage: pendingUsage
				};
				yield {
					type: "finish",
					reason: { kind: "stop" }
				};
			}
		} catch (error) {
			if (error.name === "AbortError") {
				completed = true;
				yield* flushText();
				yield {
					type: "finish",
					reason: {
						kind: "aborted",
						failure: {
							code: "aborted",
							message: error instanceof Error ? error.message : "Claude Code turn aborted"
						}
					}
				};
				return;
			}
			throw error;
		}
		if (!completed) throw new Error("dsh-claude: Claude turn stream ended without a result");
	}
};
function createClaudeCodeAdapter(supervisor, agents, attachments, presetIdFor, drainReviewComments = () => [], renderMode = async () => DEFAULT_CLAUDE_RENDER_MODE, summarizeTitle = (request) => summarizeSessionTitle("", request), probeModels = async () => []) {
	return new ClaudeCodeAdapter(supervisor, agents, attachments, presetIdFor, drainReviewComments, renderMode, summarizeTitle, probeModels);
}
//#endregion
//#region src/steering.ts
/** Carry a steered message into the Claude turn that is already running.
*
*  DSH steers by putting the message in the agent's next-step inbox, which its
*  own driver claims at the next step boundary. This preset has no such
*  boundary: one DSH step is one whole Claude Code turn, so an unclaimed
*  steered message waits for the turn to end and arrives as an ordinary
*  follow-up — the opposite of what the reader asked for by typing during the
*  turn.
*
*  Claude Code's own steering is a message pushed into the CLI's input stream,
*  which it reads at its next model step without restarting the turn. So the
*  message is taken out of the inbox here and handed to the process that owns
*  the running turn. Anything this bridge cannot deliver goes back where it
*  came from, unchanged, and the turn boundary delivers it as before.
*/
function mountClaudeSteering(ctx, supervisor, attachments, nativeRenderer, onError) {
	/** Put the steered message on DSH's own surface — for the renderer that has
	*  nowhere else to draw it.
	*
	*  The Host logs a message when its driver claims it out of the inbox, and
	*  this bridge claims it instead, so nothing else will. The plugin transcript
	*  draws its own row where the message arrived, which is where the reader
	*  typed it; DSH's surface can only take it as a node ahead of the turn's
	*  prose, which settles as one node at the end — so the whole answer would
	*  read as the reply to the steered message. That is still better than not
	*  showing it at all, so it is what the native renderer gets. */
	const record = async (agent, message) => {
		try {
			if (!await nativeRenderer()) return;
			agent.session.append("user/message", message, { surfaceOp: "append" });
		} catch (error) {
			onError(`dsh-claude: steered message was delivered but not recorded for ${agent.id}: ${error instanceof Error ? error.message : String(error)}`);
		}
	};
	const deliver = async (agent, message) => {
		const sessionId = agent.id;
		if (!agent.inbox.remove(message.id)) return;
		let restored = false;
		const restore = () => {
			if (restored) return;
			restored = true;
			agent.inbox.append("next-step", message);
		};
		try {
			const prompt = await resolveDirectUserPrompt([message], attachments);
			if (supervisor.deliverSteering(sessionId, prompt) === "delivered") {
				await record(agent, message);
				return;
			}
			restore();
		} catch (error) {
			restore();
			onError(`dsh-claude: steered message kept for the next turn for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
		}
	};
	const steerable = (agent, message) => message.role === "user" && message.source.kind === "user" && supervisor.canSteer(agent.id) && agent.inbox.nextStep.some((pending) => pending.id === message.id);
	return ctx.on("agent/inbox/inserted", ({ agent, message }) => {
		if (!steerable(agent, message)) return;
		deliver(agent, message);
	});
}
//#endregion
//#region src/plugin-budget.ts
/**
* The plugin's connection budget, in one table.
*
* A browser opens a small fixed number of connections to one origin — six for
* HTTP/1.1 in Chromium — and shares them with the Host's own traffic. Every
* response this plugin holds open costs one of them for its lifetime, and a
* request that cannot get one waits in the browser's queue where no server-side
* deadline can reach it. When the pool is exhausted the panels that would
* *diagnose* the problem are the first thing to stop answering, which is how
* this failure has always presented: four settings cards timing out at once
* against a Host that is demonstrably healthy.
*
* So the budget is a fixed constant rather than a function of how much work is
* in flight. Steady state is one connection (the multiplexed projection
* carrier); the peak is `PLUGIN_GLOBAL_PERMITS`, whatever the session count.
*
* Both halves read this file, which is the point: a route declares a budget
* class and the client derives its wait from the same entry, so a server
* deadline can never be quietly longer than the client's patience.
*/
/** Server-side budget classes. A route declares a class, never a number. */
const ROUTE_BUDGET_MS = {
	/** Answers from memory or a single bounded probe. */
	fast: 5e3,
	/** Chains local Git work. */
	git: 45e3,
	/** Reaches the network: remote Git, `gh`, the npm registry. */
	remote: 15e4
};
//#endregion
//#region src/http.ts
/** Accept only loopback, same-origin browser requests to plugin-private routes. */
function trustedRequest(req, ctx) {
	try {
		const conn = ctx?.connection ?? (typeof ctx?.get === "function" ? ctx.get("connection") : void 0);
		if (conn && typeof conn.requestRejection === "function") {
			if (conn.requestRejection(req) === void 0) return true;
		}
	} catch {}
	const remote = req.socket.remoteAddress;
	if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") return false;
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	const host = req.headers.host;
	if (host === void 0) return false;
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	try {
		const originUrl = new URL(origin);
		const hostUrl = new URL(originUrl.protocol + "//" + host);
		return originUrl.host === hostUrl.host;
	} catch {
		return false;
	}
}
/** Send a non-cacheable JSON response with MIME sniffing disabled. */
function json(res, status, value) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(value));
}
const ROUTE_TIMEOUT_CODE = "DSH_CLAUDE_ROUTE";
const DEFAULT_BODY_BYTES = 1048576;
/** Bounds live streaming responses per path, so a teardown bug cannot become a
*  permanent connection leak. Registration is per path, not global, because a
*  wedged projection stream must not evict an in-flight repository setup. */
var StreamRegistry = class {
	#open = /* @__PURE__ */ new Map();
	admit(path, key, max, close) {
		let live = this.#open.get(path);
		if (live === void 0) {
			live = /* @__PURE__ */ new Map();
			this.#open.set(path, live);
		}
		live.get(key)?.();
		live.set(key, close);
		while (live.size > max) {
			const oldest = live.keys().next();
			if (oldest.done === true) break;
			const evict = live.get(oldest.value);
			live.delete(oldest.value);
			evict?.();
		}
		return () => {
			const current = this.#open.get(path);
			if (current?.get(key) === close) current.delete(key);
		};
	}
};
const streams = new StreamRegistry();
function isPluginMethod(value) {
	return value === "GET" || value === "POST" || value === "PATCH" || value === "DELETE";
}
/** Distinguishable so the wrapper can answer 413 rather than folding an
*  oversized body into whatever generic failure the handler reports. */
var PluginBodyTooLargeError = class extends Error {
	constructor() {
		super("Request body is too large");
		this.name = "PluginBodyTooLargeError";
	}
};
async function readBody(req, maxBytes) {
	const declared = Number(req.headers["content-length"] ?? 0);
	if (!Number.isFinite(declared) || declared < 0 || declared > maxBytes) throw new PluginBodyTooLargeError();
	const chunks = [];
	let bytes = 0;
	for await (const chunk of req) {
		const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		bytes += data.byteLength;
		if (bytes > maxBytes) throw new PluginBodyTooLargeError();
		chunks.push(data);
	}
	if (bytes === 0) return {};
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function rejectOn(signal) {
	return new Promise((_resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason);
			return;
		}
		signal.addEventListener("abort", () => reject(signal.reason), { once: true });
	});
}
/**
* Register one plugin route.
*
* This is the only place in the package that calls `ctx.webServer.register`,
* and the ordering inside it is the fix rather than an implementation detail:
* the disconnect listeners are attached before the first `await`, so a client
* that goes away while the handler is still assembling its first response
* still tears the route's work down. The previous per-route code attached
* `res.on('close')` after awaiting an unbounded repository probe, which is how
* the projection stream reached 53 opens against 33 closes.
*/
function registerPluginRoute(ctx, route) {
	const label = `dsh-claude: ${route.path}`;
	ctx.effect(() => ctx.webServer.register({
		kind: route.kind,
		path: route.path,
		handler: async (req, res) => {
			const method = req.method;
			if (!isPluginMethod(method) || !route.methods.includes(method)) return json(res, 405, { error: "method not allowed" });
			if (!trustedRequest(req, ctx)) return json(res, 403, { error: "forbidden" });
			const aborted = new AbortController();
			const abort = () => {
				aborted.abort();
			};
			req.on("close", () => {
				if (!req.complete) abort();
			});
			res.on("close", abort);
			const url = new URL(req.url ?? "/", "http://localhost");
			if (route.mode === "stream") {
				const release = streams.admit(route.path, route.streamKey(url), route.maxConcurrent, abort);
				const io = {
					signal: aborted.signal,
					method,
					url,
					body: async (maxBytes = DEFAULT_BODY_BYTES) => await readBody(req, maxBytes)
				};
				try {
					await route.handler(res, io);
				} catch (error) {
					if (!res.headersSent) json(res, 500, { error: "stream-failed" });
					ctx.logger.warn(`dsh-claude: ${route.path} stream failed: ${error instanceof Error ? error.message : String(error)}`);
				} finally {
					release();
					res.end();
				}
				return;
			}
			const budgetMs = ROUTE_BUDGET_MS[route.budget];
			const bounded = deadline(aborted.signal, budgetMs, ROUTE_TIMEOUT_CODE);
			const io = {
				signal: bounded.signal,
				method,
				url,
				body: async (maxBytes = DEFAULT_BODY_BYTES) => await readBody(req, maxBytes)
			};
			try {
				const result = await Promise.race([route.handler(io), rejectOn(bounded.signal)]);
				if (!res.writableEnded) json(res, result.status, result.value);
			} catch (error) {
				if (res.writableEnded || res.headersSent) return;
				if (bounded.signal.aborted && !aborted.signal.aborted) return json(res, 504, {
					error: "deadline",
					budget: route.budget,
					ms: budgetMs
				});
				if (aborted.signal.aborted) return;
				if (error instanceof PluginBodyTooLargeError) return json(res, 413, {
					error: "body-too-large",
					message: "The request body is too large."
				});
				json(res, 400, { error: error instanceof Error ? error.message : "request failed" });
			} finally {
				bounded[Symbol.dispose]();
			}
		}
	}), label);
}
//#endregion
//#region src/doctor-routes.ts
const CLAUDE_DOCTOR_PROBE_TIMEOUT_MS = 15e3;
const claudeBridgeDiagnostics = /* @__PURE__ */ new WeakMap();
function safeMessage$2(error) {
	return redactText(error instanceof Error ? error.message : String(error), 1e3);
}
/** Model selections the selector cannot name: the profile default and each
*  live Claude session's persisted model (its latest request header), checked
*  against the catalog. A stranded one shows as `claude/<id>` in the composer;
*  `repairsTo` is the row the next request will record instead, when any. */
function modelDiagnostics(ctx) {
	try {
		const listed = new Set(latestClaudeModels().map((row) => row.id));
		const check = (model) => {
			const repairsTo = canonicalClaudeModelId(model);
			return listed.has(model) ? {
				model,
				listed: true
			} : {
				model,
				listed: false,
				...listed.has(repairsTo) ? { repairsTo } : {}
			};
		};
		const defaults = ctx.get("agentDefaultModel")?.currentSelection();
		const stranded = ctx.agents.list().flatMap((agent) => {
			const config = agent.session.requestHeader()?.config;
			if (config === void 0 || !CLAUDE_CODE_PROVIDER_IDS.includes(config.provider) || listed.has(config.model)) return [];
			return [{
				sessionId: String(agent.id),
				...check(config.model)
			}];
		});
		return {
			source: claudeLineupKnown() ? "cli" : "seed",
			rows: listed.size,
			...defaults === void 0 ? {} : { default: CLAUDE_CODE_PROVIDER_IDS.includes(defaults.provider) ? {
				provider: defaults.provider,
				...check(defaults.model)
			} : {
				provider: defaults.provider,
				model: defaults.model
			} },
			stranded
		};
	} catch (error) {
		return { error: safeMessage$2(error) };
	}
}
/** Live command-bridge diagnostics: which agents exist, their presets, and how
*  many slash commands each agent's registry layer resolves. */
function commandDiagnostics(ctx) {
	try {
		const agents = ctx.agents.list();
		return {
			total: agents.length,
			agents: agents.map((agent) => {
				const info = { id: String(agent.id) };
				try {
					const preset = ctx.agentPresets.composedPreset(agent.ctx);
					if (preset !== void 0) info.preset = preset;
				} catch (error) {
					info.error = safeMessage$2(error);
				}
				try {
					const list = ctx.commands.list(agent);
					info.commandCount = list.length;
					info.sample = list.slice(0, 10).map((command) => command.name);
				} catch (error) {
					info.error = info.error === void 0 ? safeMessage$2(error) : `${info.error}; ${safeMessage$2(error)}`;
				}
				const bridge = claudeBridgeDiagnostics.get(agent);
				if (bridge !== void 0) info.bridge = bridge;
				return info;
			})
		};
	} catch (error) {
		return { error: safeMessage$2(error) };
	}
}
let cachedDoctorReport = null;
let cachedDoctorAt = 0;
let doctorInflight = null;
const DOCTOR_CACHE_TTL_MS = 1e4;
function registerClaudeDoctorRoutes(ctx, runtime, supervisor, config, bootFailure) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_DOCTOR_PATH,
		methods: ["GET"],
		budget: "git",
		handler: async (io) => {
			try {
				if (bootFailure?.step === "executable") return {
					status: 200,
					value: {
						executable: {
							status: "missing",
							searched: config.executablePath.length > 0 ? [config.executablePath] : [
								"claude",
								"~/.local/bin/claude",
								"/opt/homebrew/bin/claude",
								"/usr/local/bin/claude"
							]
						},
						version: { status: "not-run" },
						authentication: { status: "not-run" },
						handshake: "not-run",
						message: safeMessage$2(bootFailure.error),
						limits: {
							idleTimeoutMs: config.idleTimeoutMs,
							maxProcesses: config.maxProcesses
						},
						processes: {
							count: 0,
							active: 0
						}
					}
				};
				const now = Date.now();
				let report;
				if (cachedDoctorReport !== null && now - cachedDoctorAt < DOCTOR_CACHE_TTL_MS) report = { ...cachedDoctorReport };
				else {
					if (!doctorInflight) doctorInflight = runClaudeDoctor(runtime, {
						configuredPath: config.executablePath,
						cwd: process.cwd(),
						signal: AbortSignal.any([io.signal, AbortSignal.timeout(CLAUDE_DOCTOR_PROBE_TIMEOUT_MS)])
					}).then((res) => {
						cachedDoctorReport = res;
						cachedDoctorAt = Date.now();
						return res;
					}).finally(() => {
						doctorInflight = null;
					});
					report = { ...await doctorInflight };
				}
				const processes = supervisor.snapshots();
				if (processes.some((process) => process.claudeSessionId !== void 0)) report.handshake = "ok";
				return {
					status: 200,
					value: {
						...report,
						...bootFailure === void 0 ? {} : { initialization: {
							status: "failed",
							message: safeMessage$2(bootFailure.error)
						} },
						limits: {
							idleTimeoutMs: config.idleTimeoutMs,
							maxProcesses: config.maxProcesses
						},
						processes: {
							count: processes.length,
							active: processes.filter((process) => process.state === "running" || process.state === "starting").length
						},
						commandBridge: commandDiagnostics(ctx),
						models: modelDiagnostics(ctx)
					}
				};
			} catch (error) {
				return {
					status: 500,
					value: { error: safeMessage$2(error) }
				};
			}
		}
	});
}
//#endregion
//#region src/projection-routes.ts
const MAX_SESSION_ID_CHARS$7 = 1024;
/** Slow-moving metadata refresh and stream heartbeat cadence; deliberately off
*  the transcript hot path so git/gh latency never delays visible text. */
const META_REFRESH_MS = 5e3;
/** The multiplexed carrier's path segment. Session ids are `session-<uuid>`,
*  so this cannot collide with one. */
const MULTI_SEGMENT = "multi";
function validSessionId(value) {
	return value.length > 0 && value.length <= MAX_SESSION_ID_CHARS$7;
}
function targetFromUrl(url) {
	const prefix = `${CLAUDE_PROJECTION_PATH}/`;
	if (!url.pathname.startsWith(prefix)) return void 0;
	const encoded = url.pathname.slice(prefix.length);
	if (encoded.length === 0 || encoded.includes("/")) return void 0;
	if (encoded === MULTI_SEGMENT) {
		const raw = url.searchParams.get("sessions");
		if (raw === null) return void 0;
		const sessionIds = [...new Set(raw.split(",").filter((id) => id.length > 0))];
		if (sessionIds.length === 0 || sessionIds.length > 16) return void 0;
		if (!sessionIds.every(validSessionId)) return void 0;
		return {
			kind: "multi",
			sessionIds
		};
	}
	try {
		const sessionId = decodeURIComponent(encoded);
		return validSessionId(sessionId) ? {
			kind: "snapshot",
			sessionId
		} : void 0;
	} catch {
		return;
	}
}
function envelope(projection, meta) {
	return {
		schemaVersion: projection.schemaVersion,
		revision: projection.revision,
		owned: meta.owned,
		commands: meta.commands,
		activities: projection.activities,
		...projection.tasks === void 0 ? {} : { tasks: projection.tasks },
		...projection.promptSuggestion === void 0 ? {} : { promptSuggestion: projection.promptSuggestion },
		...meta.repository === void 0 ? {} : { repository: meta.repository },
		...meta.repositories === void 0 ? {} : { repositories: meta.repositories },
		reviewComments: meta.reviewComments,
		...meta.permissionMode === void 0 ? {} : { permissionMode: meta.permissionMode },
		...meta.permissionSelector === void 0 ? {} : { permissionSelector: meta.permissionSelector },
		...projection.rewind === void 0 ? {} : { rewind: { ranges: projection.rewind.ranges } }
	};
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
function registerClaudeProjectionRoute(ctx, sidecar, ownsSession, commandsForSession = () => [], repositoryForSession = async () => void 0, reviewCommentsForSession = () => [], extraRepositoriesForSession = async () => [], permissionModeForSession = async () => void 0, permissionSelector = () => "plugin", presetSettled = () => () => void 0) {
	const info = (message) => {
		ctx.logger?.info?.(message);
	};
	/** Everything the host already knows, without touching the repository. */
	const localMeta = (sessionId) => {
		const owned = ownsSession(sessionId);
		return {
			owned,
			commands: commandsForSession(sessionId),
			reviewComments: owned ? reviewCommentsForSession(sessionId) : [],
			...owned ? { permissionSelector: permissionSelector() } : {}
		};
	};
	const assembleMeta = async (sessionId, activities) => {
		const meta = localMeta(sessionId);
		if (!meta.owned) return meta;
		const [repository, repositories, permissionMode] = await Promise.all([
			repositoryForSession(sessionId),
			extraRepositoriesForSession(sessionId, activities ?? (await sidecar.read(sessionId)).activities),
			permissionModeForSession(sessionId)
		]);
		return {
			...meta,
			...repository === void 0 ? {} : { repository },
			...repositories.length === 0 ? {} : { repositories },
			...permissionMode === void 0 ? {} : { permissionMode }
		};
	};
	const streamMulti = async (res, io, sessionIds) => {
		info(`dsh-claude: projection stream opened for ${sessionIds.length} session(s)`);
		let textDeltas = 0;
		let textBytes = 0;
		let textSince = Date.now();
		res.writeHead(200, {
			"content-type": "application/x-ndjson; charset=utf-8",
			"cache-control": "no-store, no-transform",
			"x-content-type-options": "nosniff"
		});
		res.flushHeaders?.();
		let closed = false;
		const writeLine = (value) => {
			if (closed) return;
			try {
				res.write(`${JSON.stringify(value)}\n`);
			} catch {
				closed = true;
			}
		};
		const metas = /* @__PURE__ */ new Map();
		const writeMeta = (sessionId, meta) => {
			metas.set(sessionId, meta);
			writeLine({
				type: "meta",
				session: sessionId,
				owned: meta.owned,
				commands: meta.commands,
				...meta.repository === void 0 ? {} : { repository: meta.repository },
				...meta.permissionMode === void 0 ? {} : { permissionMode: meta.permissionMode },
				...meta.permissionSelector === void 0 ? {} : { permissionSelector: meta.permissionSelector },
				...meta.repositories === void 0 ? {} : { repositories: meta.repositories },
				reviewComments: meta.reviewComments
			});
		};
		const writeSnapshot = async (sessionId) => {
			const projection = await sidecar.read(sessionId);
			const meta = metas.get(sessionId) ?? localMeta(sessionId);
			metas.set(sessionId, meta);
			writeLine({
				type: "snapshot",
				session: sessionId,
				seq: sidecar.sequence(sessionId),
				...envelope(projection, meta)
			});
			const probed = await assembleMeta(sessionId, projection.activities);
			if (closed || JSON.stringify(probed) === JSON.stringify(metas.get(sessionId))) return;
			writeMeta(sessionId, probed);
		};
		const unsubscribes = sessionIds.map((sessionId) => sidecar.subscribe(sessionId, (delta) => {
			switch (delta.kind) {
				case "text":
					textDeltas += 1;
					textBytes += (delta.append ?? delta.text ?? "").length;
					if (textDeltas % 25 === 0) {
						const elapsed = Date.now() - textSince;
						info(`dsh-claude: stream 25 text deltas ${textBytes}B in ${elapsed}ms`);
						textBytes = 0;
						textSince = Date.now();
					}
					writeLine({
						type: "text",
						session: sessionId,
						turn: delta.turn,
						step: delta.step,
						ordinal: delta.ordinal,
						...delta.append === void 0 ? {} : { append: delta.append },
						...delta.text === void 0 ? {} : { text: delta.text },
						...delta.renderer === void 0 ? {} : { renderer: delta.renderer },
						...delta.answer === true ? { answer: true } : {},
						seq: delta.seq
					});
					return;
				case "activity":
					writeLine({
						type: "activity",
						session: sessionId,
						activity: delta.activity,
						seq: delta.seq
					});
					return;
				case "tasks":
					writeLine({
						type: "tasks",
						session: sessionId,
						value: delta.value,
						seq: delta.seq
					});
					return;
				case "promptSuggestion":
					writeLine({
						type: "promptSuggestion",
						session: sessionId,
						...delta.value === void 0 ? {} : { value: delta.value },
						seq: delta.seq
					});
					return;
				case "checkpoint":
					writeLine({
						type: "checkpoint",
						session: sessionId,
						seq: delta.seq
					});
					return;
				case "sync": writeSnapshot(sessionId).catch(() => void 0);
			}
		}));
		const refreshMeta = async (sessionId) => {
			const next = await assembleMeta(sessionId);
			if (closed || JSON.stringify(next) === JSON.stringify(metas.get(sessionId))) return;
			writeMeta(sessionId, next);
		};
		unsubscribes.push(presetSettled((sessionId) => {
			if (sessionIds.includes(sessionId)) refreshMeta(sessionId).catch(() => void 0);
		}));
		for (const sessionId of sessionIds) writeSnapshot(sessionId).catch(() => void 0);
		let sweeping = false;
		const timer = setInterval(() => {
			writeLine({ type: "ping" });
			if (sweeping) return;
			sweeping = true;
			(async () => {
				for (const sessionId of sessionIds) {
					if (closed) return;
					await refreshMeta(sessionId);
				}
			})().catch(() => void 0).finally(() => {
				sweeping = false;
			});
		}, META_REFRESH_MS);
		timer.unref?.();
		await new Promise((resolve) => {
			const finish = () => {
				if (closed) return;
				closed = true;
				clearInterval(timer);
				for (const unsubscribe of unsubscribes) unsubscribe();
				info(`dsh-claude: projection stream closed after ${textDeltas} text deltas`);
				resolve();
			};
			if (io.signal.aborted) finish();
			else io.signal.addEventListener("abort", finish, { once: true });
		});
	};
	registerPluginRoute(ctx, {
		mode: "stream",
		kind: "prefix",
		path: CLAUDE_PROJECTION_PATH,
		methods: ["GET"],
		maxConcurrent: 1,
		streamKey: () => MULTI_SEGMENT,
		handler: async (res, io) => {
			const target = targetFromUrl(io.url);
			if (target === void 0) {
				res.writeHead(400, {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store"
				});
				res.write(JSON.stringify({ error: "invalid session id" }));
				return;
			}
			if (target.kind === "multi") return await streamMulti(res, io, target.sessionIds);
			info(`dsh-claude: projection poll for ${target.sessionId.slice(0, 64)}`);
			try {
				const projection = await sidecar.read(target.sessionId);
				const body = envelope(projection, await assembleMeta(target.sessionId, projection.activities));
				res.writeHead(200, {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store",
					"x-content-type-options": "nosniff"
				});
				res.write(JSON.stringify(body));
			} catch {
				if (res.headersSent) return;
				res.writeHead(500, {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store"
				});
				res.write(JSON.stringify({ error: "projection unavailable" }));
			}
		}
	});
}
//#endregion
//#region src/diff-funcname.ts
/** Extensions mapped onto a funcname driver, so `@@` hunk headers name the
*  method a change sits in. Without one git falls back to "the last line that
*  starts in column 0", which in Java or Kotlin is always the class. */
const DIFF_ATTRIBUTES = [
	"*.java diff=java",
	"*.kt diff=kotlin",
	"*.kts diff=kotlin",
	"*.py diff=python",
	"*.pyi diff=python",
	"*.js diff=dshweb",
	"*.jsx diff=dshweb",
	"*.mjs diff=dshweb",
	"*.cjs diff=dshweb",
	"*.ts diff=dshweb",
	"*.tsx diff=dshweb",
	"*.mts diff=dshweb",
	"*.cts diff=dshweb",
	"*.vue diff=dshweb",
	"*.svelte diff=dshweb",
	"*.css diff=css",
	"*.scss diff=css",
	"*.less diff=css",
	""
].join("\n");
/** git ships no JavaScript driver, so this is the one pattern we write ourselves.
*
*  POSIX extended regexes, one per line, matched top-down: a leading `!` marks a
*  line that can never be a header, and the reported text is capture group 1 --
*  hence the outer parentheses around everything worth showing.
*
*  Line 2 keeps git's own fallback (anything unindented), because a driver
*  replaces that fallback rather than extending it, and most of a frontend file's
*  declarations already live in column 0. Lines 3 and 4 add what the fallback
*  cannot see: nested declarations, and indented class or object methods.
*
*  ponytail: a method line must end in `{`. Allowing `)` too would pick up every
*  bare `foo(bar)` statement, which reads as a header and hides the real one.
*/
const DSHWEB_FUNCNAME = [
	"!^[ 	]*(if|else|for|while|do|switch|case|catch|try|finally|return|await|new|throw|typeof)[^A-Za-z0-9_$]",
	"^([A-Za-z_$].*)$",
	"^[ 	]*((export[ 	]+)?(default[ 	]+)?(declare[ 	]+)?(abstract[ 	]+)?(async[ 	]+)?(function|class|interface|enum|namespace|module)[ 	].*)$",
	"^[ 	]*(((public|private|protected|static|readonly|abstract|async|get|set)[ 	]+)*[A-Za-z_$#][A-Za-z0-9_$]*[ 	]*[:=]?[ 	]*(async[ 	]+)?[(<][^;]*\\{)[ 	]*$"
].join("\n");
let attributesFile;
async function writeAttributes() {
	const path = dshHomePath("plugins", "dsh-claude", "diff-attributes");
	try {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, DIFF_ATTRIBUTES, "utf8");
		return path;
	} catch {
		return;
	}
}
/** `-c` overrides to place in front of a `git diff`, teaching it which funcname
*  driver each extension uses.
*
*  `core.attributesFile` is the lowest-precedence attribute source, so a
*  repository that already declares its own `.gitattributes` still wins. Better
*  hunk headers are cosmetic: a failed write drops the overrides and the diff
*  runs exactly as before.
*/
async function diffFuncnameArgs() {
	attributesFile ??= writeAttributes();
	const path = await attributesFile;
	if (path === void 0) return [];
	return [
		"-c",
		`core.attributesFile=${path}`,
		"-c",
		`diff.dshweb.xfuncname=${DSHWEB_FUNCNAME}`
	];
}
//#endregion
//#region src/repository-status.ts
const MAX_OUTPUT_BYTES$3 = 65536;
/** What the diff panel receives: whole files packed under this budget. */
const MAX_DIFF_BYTES = 262144;
/** What git may hand back before packing; beyond this the diff is truncated. */
const MAX_RAW_DIFF_BYTES = 8388608;
/** One file's share of the panel; a lockfile or bundle past this is elided by name. */
const MAX_FILE_PATCH_BYTES = 65536;
const MAX_FILE_BYTES = 8388608;
const MAX_UNTRACKED_DIFFS = 50;
const GIT_TIMEOUT_MS$3 = 5e3;
const GH_TIMEOUT_MS$1 = 8e3;
const CACHE_TTL_MS = 5e3;
const PULL_REQUEST_TTL_FACTOR = 12;
const MAX_TEXT_CHARS = 1024;
const MAX_CONFLICT_PATHS = 100;
const PULL_REQUEST_FIELDS = "number,title,url,state,isDraft,reviewDecision,mergeStateStatus,mergedAt,statusCheckRollup,author,createdAt,baseRefName,headRefName,additions,deletions,changedFiles";
function bounded(value) {
	return value.trim().slice(0, MAX_TEXT_CHARS);
}
async function collect$3(handle) {
	const outcome = await handle.done;
	const stdout = handle.collected.stdout?.readFrom(0);
	return {
		exitCode: outcome.exitCode,
		stdout: stdout?.text ?? "",
		lossy: stdout?.lossy === true
	};
}
async function run(runtime, executable, args, cwd, timeoutMs, maxBytes = MAX_OUTPUT_BYTES$3) {
	const signal = AbortSignal.timeout(timeoutMs);
	return collect$3(runtime.spawn({
		argv: [executable, ...args],
		cwd,
		stdio: {
			stdin: "ignore",
			stdout: { maxBytes },
			stderr: { maxBytes: MAX_OUTPUT_BYTES$3 }
		},
		graceMs: 1e3,
		signal,
		env: {}
	}));
}
function normalizedPath(value) {
	return value.replaceAll("\\", "/").replace(/\/+$/u, "").toLocaleLowerCase("en-US");
}
function parseGitStatus(output) {
	let branch;
	let detached = false;
	let dirty = false;
	let upstream = false;
	let ahead;
	let behind;
	const conflicts = [];
	for (const line of output.split(/\r?\n/u)) {
		if (line.startsWith("# branch.head ")) {
			const head = bounded(line.slice(14));
			if (head === "(detached)") detached = true;
			else if (head.length > 0 && head !== "(unknown)") branch = head;
			continue;
		}
		if (line.startsWith("# branch.upstream ")) {
			upstream = true;
			continue;
		}
		if (line.startsWith("# branch.ab ")) {
			const counts = /^# branch\.ab \+(\d+) -(\d+)$/u.exec(line);
			if (counts !== null) {
				ahead = Number(counts[1]);
				behind = Number(counts[2]);
			}
			continue;
		}
		if (line.startsWith("u ")) {
			const path = line.split(" ").slice(10).join(" ");
			if (path.length > 0 && conflicts.length < MAX_CONFLICT_PATHS) conflicts.push(bounded(path));
		}
		if (line.length > 0 && !line.startsWith("# ")) dirty = true;
	}
	return {
		...branch === void 0 ? {} : { branch },
		detached,
		dirty,
		upstream,
		...ahead === void 0 ? {} : { ahead },
		...behind === void 0 ? {} : { behind },
		...conflicts.length === 0 ? {} : { conflicts }
	};
}
/** Ordered so the rebase directories win: a conflicted rebase also writes
*  MERGE_HEAD-like state, and the two are resumed by different commands. */
const OPERATION_MARKERS = [
	["rebase-merge", "rebase"],
	["rebase-apply", "rebase"],
	["MERGE_HEAD", "merge"],
	["CHERRY_PICK_HEAD", "cherry-pick"],
	["REVERT_HEAD", "revert"]
];
/** Reads the in-progress operation out of the worktree's own git dir -- linked
*  worktrees keep their own, so this must not be handed the common dir. */
async function detectRepositoryOperation(gitDir) {
	for (const [marker, operation] of OPERATION_MARKERS) {
		const path = join(gitDir, marker);
		try {
			await stat(path);
		} catch {
			continue;
		}
		const branch = bounded(operation === "rebase" ? await readFile(join(path, "head-name"), "utf8").catch(() => "") : "").replace(/^refs\/heads\//u, "");
		return {
			operation,
			...branch.length === 0 || branch.includes(" ") ? {} : { branch }
		};
	}
}
/**
* Pack a unified diff into a byte budget one whole file at a time.
*
* A single oversized file (a lockfile, a bundle) used to void the entire
* patch, which read as "no changes" in the panel. Files are kept in git's
* order while they fit; a file past its own cap or past what is left of the
* budget is skipped and named, so the panel still shows every other change.
*/
function packPatchByFile(patch, budget = MAX_DIFF_BYTES, perFile = MAX_FILE_PATCH_BYTES) {
	let packed = "";
	const elided = [];
	for (const section of patch.split(/(?=^diff --git )/mu)) {
		if (section.length === 0) continue;
		if (section.length <= perFile && packed.length + section.length <= budget) {
			packed += section;
			continue;
		}
		const header = /^diff --git a\/(?<a>.*?) b\/(?<b>.*)$/mu.exec(section);
		elided.push(header?.groups?.["b"] ?? header?.groups?.["a"] ?? "?");
	}
	return {
		patch: packed,
		elided
	};
}
function parseDiffNumstat(value) {
	let additions = 0;
	let deletions = 0;
	let files = 0;
	for (const line of value.split(/\r?\n/u)) {
		if (line.length === 0) continue;
		const [added, deleted] = line.split("	");
		files += 1;
		if (added !== void 0 && /^\d+$/u.test(added)) additions += Number(added);
		if (deleted !== void 0 && /^\d+$/u.test(deleted)) deletions += Number(deleted);
	}
	return {
		additions,
		deletions,
		files
	};
}
function parseGitHubRemote(value) {
	const remote = bounded(value);
	const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/\s]+)\/([^/\s]+?)(?:\.git)?$/iu.exec(remote);
	if (match?.[1] === void 0 || match[2] === void 0) return void 0;
	return `${match[1]}/${match[2]}`;
}
function record$13(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function aggregateChecks(value) {
	if (!Array.isArray(value) || value.length === 0) return "none";
	let pending = false;
	for (const item of value) {
		const check = record$13(item);
		if (check === void 0) continue;
		const conclusion = typeof check.conclusion === "string" ? check.conclusion.toUpperCase() : void 0;
		const status = typeof check.status === "string" ? check.status.toUpperCase() : void 0;
		const state = typeof check.state === "string" ? check.state.toUpperCase() : void 0;
		if ([
			"FAILURE",
			"ERROR",
			"CANCELLED",
			"TIMED_OUT",
			"ACTION_REQUIRED"
		].includes(conclusion ?? state ?? "")) return "failing";
		if (status !== void 0 && status !== "COMPLETED") pending = true;
		if (["PENDING", "EXPECTED"].includes(state ?? "")) pending = true;
	}
	return pending ? "pending" : "passing";
}
function reviewState(value) {
	if (value === "APPROVED") return "approved";
	if (value === "CHANGES_REQUESTED") return "changes-requested";
	if (value === "REVIEW_REQUIRED") return "review-required";
	return "none";
}
function parsePullRequest(value) {
	const input = record$13(value);
	if (input === void 0 || !Number.isSafeInteger(input.number) || Number(input.number) <= 0 || typeof input.title !== "string" || typeof input.url !== "string") return void 0;
	let url;
	try {
		url = new URL(input.url);
	} catch {
		return;
	}
	if (url.protocol !== "https:" || url.hostname !== "github.com") return void 0;
	const rawState = typeof input.state === "string" ? input.state.toUpperCase() : "";
	const state = input.mergedAt !== void 0 && input.mergedAt !== null ? "merged" : rawState === "OPEN" ? "open" : rawState === "CLOSED" ? "closed" : void 0;
	if (state === void 0) return void 0;
	return {
		number: Number(input.number),
		title: bounded(input.title),
		url: url.href,
		state,
		draft: input.isDraft === true,
		review: reviewState(input.reviewDecision),
		checks: aggregateChecks(input.statusCheckRollup),
		...typeof input.mergeStateStatus === "string" ? { mergeState: bounded(input.mergeStateStatus) } : {},
		...typeof input.headRefName === "string" && input.headRefName.length > 0 ? { headBranch: bounded(input.headRefName) } : {},
		...typeof record$13(input.author)?.login === "string" ? { author: bounded(String(record$13(input.author)?.login)) } : {},
		...typeof input.createdAt === "string" && Number.isFinite(Date.parse(input.createdAt)) ? { createdAt: new Date(input.createdAt).toISOString() } : {},
		...typeof input.mergedAt === "string" && Number.isFinite(Date.parse(input.mergedAt)) ? { mergedAt: new Date(input.mergedAt).toISOString() } : {},
		...typeof input.baseRefName === "string" && bounded(input.baseRefName).length > 0 ? { baseBranch: bounded(input.baseRefName) } : {}
	};
}
var RepositoryFileError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "RepositoryFileError";
		this.code = code;
	}
};
var RepositoryStatusService = class {
	#runtime;
	#cacheTtlMs;
	#cache = /* @__PURE__ */ new Map();
	#lastReady = /* @__PURE__ */ new Map();
	#gitExecutable;
	#ghExecutable;
	#roots = /* @__PURE__ */ new Map();
	constructor(runtime, cacheTtlMs = CACHE_TTL_MS) {
		this.#runtime = runtime;
		this.#cacheTtlMs = cacheTtlMs;
	}
	/** `signal` bounds the scan itself, not just the caller's patience: the
	*  untracked-file diff below is a serial spawn loop that can outlive any
	*  route budget, and work nobody is waiting for still occupies the process. */
	inspect(cwd, signal) {
		const current = this.#cache.get(cwd);
		if (current !== void 0 && current.expiresAt > Date.now()) return current.value;
		const value = this.#inspect(cwd, signal).then((next) => this.#stabilize(cwd, next));
		this.#cache.set(cwd, {
			expiresAt: Date.now() + this.#cacheTtlMs,
			value
		});
		value.catch(() => this.#cache.delete(cwd));
		return value;
	}
	/** One pull request by number, as the checkout-shaped status the panels
	*  read: a session that opened a pull request in another repository and
	*  then moved that checkout back to its base branch still has the pull
	*  request. No root, no diff; `cwd` is only where gh runs. Same cache and
	*  stabilisation as `inspect`, keyed off the pull request. */
	inspectPullRequest(cwd, repository, number) {
		const key = `gh:${repository}#${number}`;
		const current = this.#cache.get(key);
		if (current !== void 0 && current.expiresAt > Date.now()) return current.value;
		const value = (async () => {
			const gh = await this.#gh();
			if (gh === void 0) return {
				status: "unavailable",
				cwd
			};
			const result = await run(this.#runtime, gh, [
				"pr",
				"view",
				String(number),
				"--repo",
				repository,
				"--json",
				PULL_REQUEST_FIELDS
			], cwd, GH_TIMEOUT_MS$1);
			const raw = result.exitCode === 0 ? JSON.parse(result.stdout) : void 0;
			const pullRequest = parsePullRequest(raw);
			if (pullRequest === void 0) return {
				status: "unavailable",
				cwd
			};
			const counts = record$13(raw);
			const count = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
			const patch = await run(this.#runtime, gh, [
				"pr",
				"diff",
				String(number),
				"--repo",
				repository
			], cwd, GH_TIMEOUT_MS$1, MAX_RAW_DIFF_BYTES);
			const packed = patch.exitCode === 0 && !patch.lossy ? packPatchByFile(patch.stdout) : void 0;
			return {
				status: "ready",
				cwd,
				remote: repository,
				...pullRequest.headBranch === void 0 ? {} : { branch: pullRequest.headBranch },
				detached: false,
				worktree: false,
				dirty: false,
				pullRequest,
				pullRequestOnly: true,
				diff: {
					additions: count(counts?.additions),
					deletions: count(counts?.deletions),
					files: count(counts?.changedFiles),
					...packed === void 0 ? {} : { patch: packed.patch },
					...packed === void 0 || packed.elided.length === 0 ? {} : { elided: packed.elided },
					truncated: packed === void 0
				}
			};
		})().then((next) => this.#stabilize(key, next), () => ({
			status: "unavailable",
			cwd
		}));
		this.#cache.set(key, {
			expiresAt: Date.now() + this.#cacheTtlMs * PULL_REQUEST_TTL_FACTOR,
			value
		});
		return value;
	}
	invalidate(cwd) {
		this.#cache.delete(cwd);
		this.#lastReady.delete(cwd);
		for (const key of this.#cache.keys()) if (key.startsWith("gh:")) this.#cache.delete(key);
	}
	/** The repository holding `directory`, or undefined outside any. A root
	*  does not move, so a settled answer is kept for the service's lifetime;
	*  a probe that could not run is not an answer and is asked again. */
	rootOf(directory) {
		const known = this.#roots.get(directory);
		if (known !== void 0) return known;
		const value = (async () => {
			const top = await run(this.#runtime, await this.#git(), [
				"rev-parse",
				"--path-format=absolute",
				"--show-toplevel"
			], directory, GIT_TIMEOUT_MS$3);
			return top.exitCode === 0 ? resolve(top.stdout.trim()) : void 0;
		})().catch(() => {
			this.#roots.delete(directory);
		});
		this.#roots.set(directory, value);
		return value;
	}
	dispose() {
		this.#roots.clear();
		this.#cache.clear();
		this.#lastReady.clear();
	}
	#stabilize(cwd, next) {
		const previous = this.#lastReady.get(cwd);
		if (next.status !== "ready") return previous ?? next;
		const stable = previous?.status === "ready" && previous.root === next.root && previous.branch === next.branch ? {
			...next,
			...next.pullRequest === void 0 && previous.pullRequest !== void 0 ? { pullRequest: previous.pullRequest } : {},
			...next.pullRequest === void 0 && previous.pullRequest !== void 0 && previous.diff !== void 0 ? { diff: previous.diff } : next.diff === void 0 && previous.diff !== void 0 ? { diff: previous.diff } : {}
		} : next;
		this.#lastReady.set(cwd, stable);
		return stable;
	}
	/** Lines [from, to] of a working-tree file, used to expand unmodified context around diff hunks. */
	async fileLines(cwd, relativePath, from, to) {
		if (relativePath.length === 0 || isAbsolute(relativePath) || relativePath.includes("\0") || relativePath.split(/[\\/]/u).includes("..")) throw new RepositoryFileError("invalid-request", "The file path must be relative to the repository.");
		if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to < from || to - from >= 500) throw new RepositoryFileError("invalid-request", "The requested line range is invalid.");
		const git = await this.#git();
		const top = await run(this.#runtime, git, [
			"rev-parse",
			"--path-format=absolute",
			"--show-toplevel"
		], cwd, GIT_TIMEOUT_MS$3);
		if (top.exitCode !== 0) throw new RepositoryFileError("not-repository", "The directory is not inside a git repository.");
		const root = resolve(top.stdout.trim());
		const target = resolve(root, relativePath);
		if (target !== root && !target.startsWith(root + sep)) throw new RepositoryFileError("invalid-request", "The file path escapes the repository.");
		const content = await readFile(target, "utf8");
		if (content.length > MAX_FILE_BYTES) throw new RepositoryFileError("too-large", "The file is too large to expand.");
		const all = content.split(/\r?\n/u);
		if (all.at(-1) === "") all.pop();
		return {
			lines: all.slice(from - 1, to),
			total: all.length
		};
	}
	async #git() {
		this.#gitExecutable ??= this.#runtime.resolveExecutable("git", toolPathEnv());
		return this.#gitExecutable;
	}
	async #gh() {
		this.#ghExecutable ??= this.#runtime.resolveExecutable("gh", toolPathEnv()).catch(() => void 0);
		return this.#ghExecutable;
	}
	async #inspect(cwd, signal) {
		const safeCwd = bounded(cwd);
		let git;
		try {
			git = await this.#git();
		} catch {
			return {
				status: "unavailable",
				cwd: safeCwd
			};
		}
		try {
			const paths = await run(this.#runtime, git, [
				"rev-parse",
				"--path-format=absolute",
				"--show-toplevel",
				"--absolute-git-dir",
				"--git-common-dir"
			], cwd, GIT_TIMEOUT_MS$3);
			if (paths.exitCode !== 0) return {
				status: "not-repository",
				cwd: safeCwd
			};
			const [rootValue, gitDirValue, commonDirValue] = paths.stdout.split(/\r?\n/u);
			const root = bounded(rootValue ?? "");
			const gitDir = bounded(gitDirValue ?? "");
			const commonDir = bounded(commonDirValue ?? "");
			if (root.length === 0 || gitDir.length === 0 || commonDir.length === 0) return {
				status: "unavailable",
				cwd: safeCwd
			};
			const statusResult = await run(this.#runtime, git, [
				"status",
				"--porcelain=v2",
				"--branch",
				"--untracked-files=normal"
			], cwd, GIT_TIMEOUT_MS$3);
			if (statusResult.exitCode !== 0) return {
				status: "unavailable",
				cwd: safeCwd
			};
			const status = parseGitStatus(statusResult.stdout);
			const operation = await detectRepositoryOperation(gitDir);
			const branch = operation?.branch ?? status.branch;
			const remoteResult = await run(this.#runtime, git, [
				"remote",
				"get-url",
				"origin"
			], cwd, GIT_TIMEOUT_MS$3);
			const remote = remoteResult.exitCode === 0 ? parseGitHubRemote(remoteResult.stdout) : void 0;
			const pullRequest = branch === void 0 || remote === void 0 ? void 0 : await this.#pullRequest(cwd, remote, branch);
			const diffBase = await this.#mergeBase(cwd, git, pullRequest?.baseBranch ?? "HEAD") ?? "HEAD";
			const diff = status.dirty || diffBase !== "HEAD" ? await this.#diff(cwd, git, diffBase, signal) : {
				additions: 0,
				deletions: 0,
				files: 0,
				truncated: false
			};
			const baseBehind = pullRequest?.state === "open" && pullRequest.baseBranch !== void 0 ? await this.#baseBehind(cwd, git, pullRequest.baseBranch) : void 0;
			return {
				status: "ready",
				cwd: safeCwd,
				root,
				...status,
				...branch === void 0 ? {} : { branch },
				...operation === void 0 ? {} : { operation: operation.operation },
				worktree: normalizedPath(gitDir) !== normalizedPath(commonDir),
				...remote === void 0 ? {} : { remote },
				...pullRequest === void 0 ? {} : { pullRequest },
				...diff === void 0 ? {} : { diff },
				...baseBehind === void 0 ? {} : { baseBehind }
			};
		} catch {
			return {
				status: "unavailable",
				cwd: safeCwd
			};
		}
	}
	async #baseBehind(cwd, git, baseBranch) {
		try {
			const result = await run(this.#runtime, git, [
				"rev-list",
				"--count",
				`HEAD..refs/remotes/origin/${baseBranch}`,
				"--"
			], cwd, GIT_TIMEOUT_MS$3);
			if (result.exitCode !== 0 || result.lossy) return void 0;
			const count = Number(bounded(result.stdout));
			return Number.isSafeInteger(count) && count >= 0 ? count : void 0;
		} catch {
			return;
		}
	}
	async #mergeBase(cwd, git, baseBranch) {
		try {
			const result = await run(this.#runtime, git, [
				"merge-base",
				"HEAD",
				`refs/remotes/origin/${baseBranch}`
			], cwd, GIT_TIMEOUT_MS$3);
			if (result.exitCode !== 0 || result.lossy) return void 0;
			const oid = bounded(result.stdout);
			return /^[0-9a-f]{40}$/iu.test(oid) ? oid : void 0;
		} catch {
			return;
		}
	}
	async #diff(cwd, git, base, signal) {
		try {
			const numstat = await run(this.#runtime, git, [
				"diff",
				"--no-ext-diff",
				"--numstat",
				base,
				"--"
			], cwd, GIT_TIMEOUT_MS$3);
			if (numstat.exitCode !== 0 || numstat.lossy) return void 0;
			const summary = parseDiffNumstat(numstat.stdout);
			const patch = await run(this.#runtime, git, [
				...await diffFuncnameArgs(),
				"diff",
				"--no-ext-diff",
				"--no-color",
				"--unified=3",
				base,
				"--"
			], cwd, GIT_TIMEOUT_MS$3, MAX_RAW_DIFF_BYTES);
			if (patch.exitCode !== 0) return {
				...summary,
				truncated: true
			};
			const untracked = await this.#untrackedDiff(cwd, git, signal);
			const packed = packPatchByFile(`${patch.stdout}${untracked.patch}`);
			return {
				additions: summary.additions + untracked.additions,
				deletions: summary.deletions,
				files: summary.files + untracked.files,
				...patch.lossy ? {} : { patch: packed.patch },
				...packed.elided.length === 0 ? {} : { elided: packed.elided },
				truncated: patch.lossy || untracked.truncated
			};
		} catch {
			return;
		}
	}
	async #untrackedDiff(cwd, git, signal) {
		const listed = await run(this.#runtime, git, [
			"ls-files",
			"--others",
			"--exclude-standard",
			"-z"
		], cwd, GIT_TIMEOUT_MS$3);
		if (listed.exitCode !== 0 || listed.lossy) return {
			additions: 0,
			files: 0,
			patch: "",
			truncated: listed.lossy
		};
		const paths = listed.stdout.split("\0").filter((path) => path.length > 0);
		let additions = 0;
		let patch = "";
		let truncated = paths.length > MAX_UNTRACKED_DIFFS;
		for (const path of paths.slice(0, MAX_UNTRACKED_DIFFS)) {
			if (signal?.aborted === true) return {
				additions,
				files: paths.length,
				patch,
				truncated: true
			};
			const result = await run(this.#runtime, git, [
				"diff",
				"--no-ext-diff",
				"--no-color",
				"--unified=3",
				"--numstat",
				"--patch",
				"--no-index",
				"--",
				"/dev/null",
				path
			], cwd, GIT_TIMEOUT_MS$3, MAX_DIFF_BYTES);
			if (result.exitCode !== 0 && result.exitCode !== 1) {
				truncated = true;
				continue;
			}
			const start = result.stdout.indexOf("diff --git ");
			additions += parseDiffNumstat(start >= 0 ? result.stdout.slice(0, start) : result.stdout).additions;
			if (result.lossy) truncated = true;
			else if (start >= 0) patch += result.stdout.slice(start);
		}
		return {
			additions,
			files: paths.length,
			patch,
			truncated
		};
	}
	async #pullRequest(cwd, repository, branch) {
		const gh = await this.#gh();
		if (gh === void 0) return void 0;
		try {
			const result = await run(this.#runtime, gh, [
				"pr",
				"view",
				branch,
				"--repo",
				repository,
				"--json",
				PULL_REQUEST_FIELDS
			], cwd, GH_TIMEOUT_MS$1);
			if (result.exitCode !== 0) return void 0;
			return parsePullRequest(JSON.parse(result.stdout));
		} catch {
			return;
		}
	}
};
//#endregion
//#region src/branch-name.ts
/** Name a generated worktree branch after what the user is about to ask for.
*
*  The composer draft is the only description of the work that exists before
*  the session starts, and it is usually not English and never branch-safe, so
*  a throwaway Haiku turn compresses it into a slug. Naming is a nicety: every
*  failure here returns `undefined` and the caller keeps its timestamped name. */
/** Cheapest model that can translate and compress a sentence. */
const BRANCH_SUMMARY_MODEL = "haiku";
/** A branch name is not worth blocking worktree creation on for long. */
const BRANCH_SUMMARY_TIMEOUT_MS = 15e3;
const MAX_INTENT_CHARS = 2e3;
/** A compliant reply is one short fragment; anything longer is prose. */
const MAX_REPLY_CHARS$2 = 80;
/** More words than this is a sentence, not the fragment we asked for. */
const MAX_SLUG_WORDS = 6;
const MAX_SLUG_CHARS = 48;
function branchSummaryPrompt(intent) {
	return [
		"Summarize this software task as a Git branch name fragment.",
		"Reply with 2-5 lowercase English words joined by hyphens and nothing else:",
		"no quotes, no slashes, no prefix, no punctuation, no explanation.",
		"Translate the task to English if it is written in another language.",
		"",
		"Task:",
		`"""\n${intent.replaceAll("\"\"\"", "\" \" \"")}\n"""`
	].join("\n");
}
/** Branch-safe slug for a model reply, or `undefined` when the reply is not
*  the fragment we asked for. Mangling a refusal or a paragraph into a slug
*  would produce a worse name than the timestamped fallback. */
function branchSlug(reply) {
	const line = reply.trim();
	if (line.length === 0 || line.length > MAX_REPLY_CHARS$2 || /[\r\n]/u.test(line)) return void 0;
	const words = line.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, "-").split("-").filter((word) => word.length > 0);
	if (words.length === 0 || words.length > MAX_SLUG_WORDS) return void 0;
	const slug = words.join("-").slice(0, MAX_SLUG_CHARS).replace(/-+$/u, "");
	return slug.length === 0 ? void 0 : slug;
}
/** First free name in `<candidate>`, `<candidate>-2`, `<candidate>-3`, … */
function uniqueBranchName(candidate, taken) {
	const existing = new Set(taken);
	if (!existing.has(candidate)) return candidate;
	for (let index = 2; index < 100; index += 1) {
		const name = `${candidate}-${index}`;
		if (!existing.has(name)) return name;
	}
	return candidate;
}
/** Compress a composer draft into a branch slug with a throwaway Claude turn.
*
*  Deliberately NOT routed through the supervisor, for the same reasons as the
*  plan-usage probe: there is no session to borrow yet. Settings sources match
*  conversation turns so the CLI can resolve settings-based authentication. */
async function summarizeBranchSlug(executablePath, intent, factory = query) {
	const task = intent.trim().slice(0, MAX_INTENT_CHARS);
	if (task.length === 0) return void 0;
	const lifetime = new AbortController();
	const timer = setTimeout(() => lifetime.abort(), BRANCH_SUMMARY_TIMEOUT_MS);
	timer.unref?.();
	try {
		const query = factory({
			prompt: branchSummaryPrompt(task),
			options: {
				cwd: process.cwd(),
				abortController: lifetime,
				model: BRANCH_SUMMARY_MODEL,
				allowedTools: [],
				settingSources: [
					"user",
					"project",
					"local"
				],
				maxTurns: 1,
				...executablePath.length === 0 ? {} : { pathToClaudeCodeExecutable: executablePath }
			}
		});
		for await (const message of query) if (message.type === "result" && message.subtype === "success" && message.is_error !== true) return branchSlug(message.result);
		return;
	} catch {
		return;
	} finally {
		clearTimeout(timer);
		lifetime.abort();
	}
}
//#endregion
//#region src/repository-setup.ts
const MAX_OUTPUT_BYTES$2 = 131072;
const GIT_TIMEOUT_MS$2 = 1e4;
const GIT_FETCH_TIMEOUT_MS = 6e4;
const MAX_PATH_CHARS$1 = 4096;
const MAX_BRANCH_CHARS = 512;
const LEASE_SCHEMA_VERSION = 1;
const CLEANUP_GRACE_MS = 12e4;
var RepositorySetupError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "RepositorySetupError";
		this.code = code;
	}
};
async function collect$2(handle) {
	const outcome = await handle.done;
	const stdout = handle.collected.stdout?.readFrom(0);
	const stderr = handle.collected.stderr?.readFrom(0);
	return {
		exitCode: outcome.exitCode,
		stdout: stdout?.text ?? "",
		stderr: stderr?.text ?? "",
		lossy: stdout?.lossy === true || stderr?.lossy === true
	};
}
function safePath(value) {
	if (value.length === 0 || value.length > MAX_PATH_CHARS$1 || !isAbsolute(value) || value.includes("\0")) throw new RepositorySetupError("invalid-path", "The workspace path is invalid.");
	return resolve(value);
}
function safeBranch(value) {
	if (value.length === 0 || value.length > MAX_BRANCH_CHARS || value.trim() !== value || /[\0\r\n]/u.test(value)) throw new RepositorySetupError("invalid-branch", "The branch name is invalid.");
	return value;
}
function parseCurrentBranch(value) {
	const branch = value.trim();
	return branch.length === 0 || branch === "HEAD" ? void 0 : branch;
}
function parseWorktreeBranches(value) {
	const occupied = /* @__PURE__ */ new Map();
	let path;
	for (const line of `${value}\n`.split(/\r?\n/u)) if (line.startsWith("worktree ")) path = line.slice(9);
	else if (line.startsWith("branch refs/heads/") && path !== void 0) occupied.set(line.slice(18), path);
	else if (line.length === 0) path = void 0;
	return occupied;
}
function slug(value, fallback) {
	return value.toLocaleLowerCase("en-US").replace(/[^a-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 48) || fallback;
}
/** A branch name as one path segment: `/` and anything else unsafe folds to
*  `-`, case is kept so a ticket key stays scannable (`PSOS-5683`, not
*  `psos-5683`). Flattened rather than nested on purpose -- see
*  {@link worktreeDirectoryName}. */
function branchSegment(branch) {
	return branch.replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/^[-.]+/u, "").replace(/-+$/u, "").slice(0, 48).replace(/-+$/u, "") || "branch";
}
/** Name a worktree directory after the repository and the branch it holds, so
*  the workspace list reads without opening a session.
*
*  One flat segment, never a `feature/x` subdirectory: the orphan sweep lists
*  this root one level deep, and a prefix directory holds no lease of its own,
*  so it would be removed along with every live worktree inside it. */
function worktreeDirectoryName(root, branch) {
	return `${slug(basename(root), "repository")}-${branchSegment(branch)}`;
}
/** Where new worktrees go, relative to the repository's main checkout.
*
*  Inside the repository, not under `$DSH_HOME`: the Host only groups a
*  Session under a Workspace whose path equals its cwd, so a worktree is always
*  a Workspace of its own, and only its path decides whether the sidebar's
*  Workspace tree can nest it under the repository it came from. It is the
*  directory Claude Code's own `--worktree` uses, so one exclude line keeps
*  both out of `git status`. */
const IN_REPOSITORY_WORKTREE_DIR = join(".claude", "worktrees");
/** The line that keeps {@link IN_REPOSITORY_WORKTREE_DIR} out of the main
*  checkout's status; written to the local `info/exclude`, never to a tracked
*  `.gitignore`. */
const WORKTREE_EXCLUDE_LINE = "/.claude/worktrees/";
/** Comparable form for path identity: resolved, forward slashes, case-folded
*  so Windows drive-letter or case spelling differences cannot hide a match. */
function comparablePath(value) {
	return resolve(value).replaceAll("\\", "/").toLocaleLowerCase("en-US");
}
function pathExists(value) {
	return stat(value).then(() => true, () => false);
}
function lease(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
	const input = value;
	if (typeof input.id !== "string" || typeof input.root !== "string" || typeof input.path !== "string" || typeof input.branch !== "string" || typeof input.createdAt !== "string" || input.pluginGeneratedBranch !== void 0 && typeof input.pluginGeneratedBranch !== "boolean" || input.sessionId !== void 0 && typeof input.sessionId !== "string") return void 0;
	return {
		id: input.id,
		root: input.root,
		path: input.path,
		branch: input.branch,
		createdAt: input.createdAt,
		pluginGeneratedBranch: input.pluginGeneratedBranch === true,
		...input.sessionId === void 0 ? {} : { sessionId: input.sessionId }
	};
}
var RepositorySetupService = class {
	#runtime;
	#leasePath;
	#worktreeRoot;
	#legacyWorktreeRoot;
	#branchPrefix;
	#summarizeBranch;
	#cleanupGraceMs;
	#gitPath;
	#pending = Promise.resolve();
	constructor(runtime, options = {}) {
		this.#runtime = runtime;
		this.#leasePath = options.leasePath ?? dshHomePath("plugins", "dsh-claude", "worktrees.json");
		this.#worktreeRoot = options.worktreeRoot;
		this.#legacyWorktreeRoot = options.legacyWorktreeRoot ?? options.worktreeRoot ?? dshHomePath("plugins", "dsh-claude", "worktrees");
		this.#branchPrefix = options.branchPrefix ?? (async () => "claude");
		this.#summarizeBranch = options.summarizeBranch ?? (async () => void 0);
		this.#cleanupGraceMs = options.cleanupGraceMs ?? CLEANUP_GRACE_MS;
	}
	async listBranches(cwd) {
		const git = await this.#git();
		return this.#listBranches(git, await this.#repositoryRoot(git, safePath(cwd)));
	}
	/** Refresh remote-tracking refs before listing: a branch pushed after this
	*  checkout last fetched has no local ref, so the picker cannot offer it. */
	async refreshBranches(cwd) {
		const git = await this.#git();
		const root = await this.#repositoryRoot(git, safePath(cwd));
		await this.#fetchRemotes(git, root);
		return this.#listBranches(git, root);
	}
	async #listBranches(git, root) {
		const [status, refs, remoteRefs] = await Promise.all([
			this.#run(git, [
				"status",
				"--porcelain=v2",
				"--branch",
				"--untracked-files=normal"
			], root),
			this.#run(git, [
				"for-each-ref",
				"--format=%(refname:short)",
				"refs/heads"
			], root),
			this.#run(git, [
				"for-each-ref",
				"--format=%(refname:short) %(symref)",
				"refs/remotes"
			], root)
		]);
		if (status.exitCode !== 0 || status.lossy || refs.exitCode !== 0 || refs.lossy || remoteRefs.exitCode !== 0 || remoteRefs.lossy) throw new RepositorySetupError("repository-unavailable", "The repository state is unavailable.");
		const current = status.stdout.split(/\r?\n/u).find((line) => line.startsWith("# branch.head "))?.slice(14);
		const branches = refs.stdout.split(/\r?\n/u).filter(Boolean).sort((left, right) => left.localeCompare(right));
		const remoteBranches = remoteRefs.stdout.split(/\r?\n/u).map((line) => line.trim().split(/\s+/u)).filter((parts) => parts[0] !== void 0 && parts[0].length > 0 && parts.length === 1).map((parts) => parts[0]).sort((left, right) => left.localeCompare(right));
		const currentBranch = current === void 0 ? void 0 : parseCurrentBranch(current);
		return {
			root,
			...currentBranch === void 0 ? {} : { current: currentBranch },
			dirty: status.stdout.split(/\r?\n/u).some((line) => line.length > 0 && !line.startsWith("# ")),
			branches,
			remoteBranches
		};
	}
	async setup(cwd, branchValue, useWorktree, explicitBranchName, progress = () => {}, intent) {
		progress("inspecting");
		const branch = safeBranch(branchValue);
		const info = await this.listBranches(cwd);
		const local = info.branches.includes(branch);
		const remote = info.remoteBranches.includes(branch);
		if (!local && !remote) throw new RepositorySetupError("branch-not-found", "The selected local or remote-tracking branch does not exist.");
		const requestedBranch = explicitBranchName === void 0 ? void 0 : safeBranch(explicitBranchName);
		if (useWorktree) return this.#createWorktree(info, branch, local ? `refs/heads/${branch}` : `refs/remotes/${branch}`, requestedBranch, requestedBranch !== void 0 && info.branches.includes(requestedBranch), progress, intent);
		progress("switching-branch");
		return !local && remote ? this.#checkoutRemote(info, branch) : this.#checkout(info, branch);
	}
	/** Tear down a merged branch: remove a worktree (a plugin one with its
	*  lease, or one another tool added) and its branch, or switch a plain
	*  checkout back to the base branch and delete the merged branch. Refuses
	*  dirty trees. */
	/** `branch` names the merged branch when the checkout is no longer on it:
	*  a session that opened a pull request in another clone switched that
	*  clone back to base itself, and only the local branch is left to delete.
	*  `requirePushed` is for a branch no pull request vouches for: it is only
	*  removed once every commit on it is reachable from some remote, so a
	*  worktree that never got as far as a pull request cannot take work with it. */
	async cleanupMerged(pathValue, baseBranch, branch, requirePushed = false) {
		const path = safePath(pathValue);
		const base = baseBranch === void 0 ? void 0 : safeBranch(baseBranch);
		const named = branch === void 0 ? void 0 : safeBranch(branch);
		const git = await this.#git();
		const status = await this.#run(git, [
			"status",
			"--porcelain=v1",
			"--untracked-files=normal"
		], path);
		if (status.exitCode !== 0 || status.lossy) throw new RepositorySetupError("repository-unavailable", "The repository state is unavailable.");
		if (status.stdout.trim().length > 0) throw new RepositorySetupError("dirty-workspace", "Commit or stash workspace changes before cleaning up.");
		const lease = (await this.#readLeases()).find((item) => comparablePath(item.path) === comparablePath(path));
		if (lease !== void 0) {
			if (requirePushed) await this.#requirePushed(git, lease.root, lease.branch);
			return this.#serialize(async () => {
				if ((await this.#run(git, [
					"worktree",
					"remove",
					"--",
					lease.path
				], lease.root)).exitCode !== 0) throw new RepositorySetupError("worktree-remove-failed", "Git could not remove the worktree.");
				await this.#run(git, [
					"branch",
					"-D",
					"--",
					lease.branch
				], lease.root).catch(() => void 0);
				const current = await this.#readLeases();
				await this.#writeLeases(current.filter((item) => item.id !== lease.id));
				return {
					mode: "worktree",
					root: lease.root,
					branch: lease.branch
				};
			});
		}
		const dirs = await this.#run(git, [
			"rev-parse",
			"--path-format=absolute",
			"--git-dir",
			"--git-common-dir"
		], path);
		const [gitDir = "", commonDir = ""] = dirs.exitCode === 0 ? dirs.stdout.trim().split(/\r?\n/u) : [];
		if (gitDir.length > 0 && comparablePath(gitDir) !== comparablePath(commonDir)) {
			const mainRoot = resolve(commonDir, "..");
			const head = named === void 0 ? await this.#run(git, [
				"symbolic-ref",
				"--quiet",
				"--short",
				"HEAD"
			], path) : void 0;
			const branch = named ?? (head?.exitCode === 0 ? head.stdout.trim() : "");
			if (branch.length === 0) throw new RepositorySetupError("nothing-to-clean", "The worktree is not on a branch.");
			if (requirePushed) await this.#requirePushed(git, mainRoot, branch);
			if ((await this.#run(git, [
				"worktree",
				"remove",
				"--",
				path
			], mainRoot)).exitCode !== 0) throw new RepositorySetupError("worktree-remove-failed", "Git could not remove the worktree.");
			await this.#run(git, [
				"branch",
				"-D",
				"--",
				branch
			], mainRoot).catch(() => void 0);
			return {
				mode: "worktree",
				root: mainRoot,
				branch
			};
		}
		const root = await this.#repositoryRoot(git, path);
		if (base === void 0) throw new RepositorySetupError("nothing-to-clean", "A plain checkout needs the base branch to return to.");
		const head = await this.#run(git, [
			"symbolic-ref",
			"--quiet",
			"--short",
			"HEAD"
		], root);
		const current = head.exitCode === 0 ? head.stdout.trim() : "";
		if (current.length === 0 || current === base) {
			if (named === void 0 || named === base) throw new RepositorySetupError("nothing-to-clean", "The checkout is already on the base branch.");
			if (requirePushed) await this.#requirePushed(git, root, named);
			await this.#run(git, [
				"branch",
				"-D",
				"--",
				named
			], root).catch(() => void 0);
			await this.#run(git, ["pull", "--ff-only"], root, GIT_FETCH_TIMEOUT_MS).catch(() => void 0);
			return {
				mode: "checkout",
				root,
				branch: named
			};
		}
		if (requirePushed) await this.#requirePushed(git, root, current);
		if ((await this.#run(git, [
			"switch",
			"--",
			base
		], root)).exitCode !== 0) throw new RepositorySetupError("checkout-failed", "Git could not switch to the base branch.");
		await this.#run(git, [
			"branch",
			"-D",
			"--",
			current
		], root).catch(() => void 0);
		await this.#run(git, ["pull", "--ff-only"], root, GIT_FETCH_TIMEOUT_MS).catch(() => void 0);
		return {
			mode: "checkout",
			root,
			branch: current
		};
	}
	bindLease(leaseId, sessionId) {
		if (leaseId.length === 0 || leaseId.length > 128 || sessionId.length === 0 || sessionId.length > 1024) return Promise.reject(new RepositorySetupError("invalid-lease", "The worktree lease is invalid."));
		return this.#serialize(async () => {
			const leases = await this.#readLeases();
			const index = leases.findIndex((item) => item.id === leaseId);
			if (index < 0) throw new RepositorySetupError("lease-not-found", "The worktree lease no longer exists.");
			const existing = leases[index];
			if (existing === void 0) throw new RepositorySetupError("lease-not-found", "The worktree lease no longer exists.");
			leases[index] = {
				...existing,
				sessionId
			};
			await this.#writeLeases(leases);
		});
	}
	/** Reconcile leases against the set of directories still referenced by a
	*  workspace. Deleting a workspace is the user saying they are done with it,
	*  so an unreferenced worktree goes even with uncommitted changes; its
	*  sessions are archived first, through `archiveSessions`, or the Host
	*  rebuilds the deleted workspace from their headers on the next boot.
	*  Fresh leases are retained for a grace period so a worktree created
	*  moments ago cannot be swept before its workspace registration lands.
	*
	*  Every command runs from the repository root, never from the worktree
	*  being removed: spawning in a directory that is already gone throws
	*  ENOENT, which used to strand the lease forever. */
	cleanupOrphans(activePaths, archiveSessions) {
		const active = new Set(activePaths.map(comparablePath));
		return this.#serialize(async () => {
			const leases = await this.#readLeases();
			const retained = [];
			let changed = false;
			const git = await this.#git();
			const now = Date.now();
			for (const item of leases) {
				const age = now - Date.parse(item.createdAt);
				if (active.has(comparablePath(item.path)) || !(age >= this.#cleanupGraceMs)) {
					retained.push(item);
					continue;
				}
				try {
					await archiveSessions?.(item.path).catch(() => void 0);
					if (await pathExists(item.path)) {
						if ((await this.#run(git, [
							"worktree",
							"remove",
							"--force",
							"--",
							item.path
						], item.root)).exitCode !== 0) {
							retained.push(item);
							continue;
						}
					} else await this.#run(git, ["worktree", "prune"], item.root).catch(() => void 0);
					if (item.pluginGeneratedBranch) await this.#run(git, [
						"branch",
						"-D",
						"--",
						item.branch
					], item.root).catch(() => void 0);
					changed = true;
				} catch {
					if (await pathExists(item.root)) retained.push(item);
					else changed = true;
				}
			}
			if (changed) await this.#writeLeases(retained);
			await this.#removeUnleasedDirectories(retained, active, now, archiveSessions);
		});
	}
	/** Remove leftover directories under the plugin's own worktree root that no
	*  lease and no workspace claims and that are no longer checkouts (an IDE
	*  folder outliving its worktree); otherwise nothing would ever sweep them.
	*  The grace period covers the gap between `worktree add` and the lease
	*  write, so a worktree being created right now is never taken. */
	async #removeUnleasedDirectories(retained, active, now, archiveSessions) {
		const leased = new Set(retained.map((item) => comparablePath(item.path)));
		let entries;
		try {
			entries = await readdir(this.#legacyWorktreeRoot);
		} catch {
			return;
		}
		for (const entry of entries) {
			const path = join(this.#legacyWorktreeRoot, entry);
			const key = comparablePath(path);
			if (leased.has(key) || active.has(key)) continue;
			try {
				const info = await stat(path);
				if (!info.isDirectory()) continue;
				const created = info.birthtimeMs > 0 ? info.birthtimeMs : info.mtimeMs;
				if (Math.max(0, now - created) < this.#cleanupGraceMs) continue;
				if (await pathExists(join(path, ".git"))) continue;
				await archiveSessions?.(path).catch(() => void 0);
				await rm(path, {
					recursive: true,
					force: true
				});
			} catch {}
		}
	}
	async #checkoutRemote(info, remoteBranch) {
		const separator = remoteBranch.indexOf("/");
		if (separator <= 0 || separator === remoteBranch.length - 1) throw new RepositorySetupError("invalid-branch", "The remote-tracking branch name is invalid.");
		const localBranch = safeBranch(remoteBranch.slice(separator + 1));
		if (info.branches.includes(localBranch)) {
			const git = await this.#git();
			const upstream = await this.#run(git, [
				"for-each-ref",
				"--format=%(upstream:short)",
				`refs/heads/${localBranch}`
			], info.root);
			if (upstream.exitCode !== 0 || upstream.lossy) throw new RepositorySetupError("repository-unavailable", "The local branch tracking state is unavailable.");
			if (upstream.stdout.trim() !== remoteBranch) throw new RepositorySetupError("branch-tracking-conflict", `The local branch ${localBranch} does not track ${remoteBranch}.`);
			return this.#checkout(info, localBranch);
		}
		if (info.dirty) throw new RepositorySetupError("dirty-workspace", "Commit or stash workspace changes before switching branches.");
		const git = await this.#git();
		if ((await this.#run(git, [
			"switch",
			"--track",
			"-c",
			localBranch,
			`refs/remotes/${remoteBranch}`
		], info.root)).exitCode !== 0) throw new RepositorySetupError("checkout-failed", "Git could not create the local tracking branch.");
		return {
			mode: "checkout",
			root: info.root,
			path: info.root,
			branch: localBranch
		};
	}
	async #fetchRemotes(git, root) {
		const fetched = await this.#run(git, [
			"-c",
			"credential.interactive=never",
			"fetch",
			"--all",
			"--prune"
		], root, GIT_FETCH_TIMEOUT_MS);
		const refClashOnly = !fetched.lossy && /unable to update local ref/u.test(fetched.stderr) && !/^fatal:/mu.test(fetched.stderr);
		if (fetched.exitCode !== 0 && !refClashOnly || fetched.lossy) throw new RepositorySetupError("fetch-failed", "Git could not refresh remote references.");
	}
	/** The remote-tracking ref a local base branch follows, when that ref still
	*  exists. Falls back to the local branch for a branch with no upstream. */
	async #upstreamRef(git, info, branch) {
		const upstream = await this.#run(git, [
			"for-each-ref",
			"--format=%(upstream:short)",
			`refs/heads/${branch}`
		], info.root);
		if (upstream.exitCode !== 0 || upstream.lossy) return void 0;
		const name = upstream.stdout.trim();
		return name.length > 0 && info.remoteBranches.includes(name) ? `refs/remotes/${name}` : void 0;
	}
	async #checkout(info, branch) {
		if (info.current !== branch) {
			if (info.dirty) throw new RepositorySetupError("dirty-workspace", "Commit or stash workspace changes before switching branches.");
			const git = await this.#git();
			const worktrees = await this.#run(git, [
				"worktree",
				"list",
				"--porcelain"
			], info.root);
			if (worktrees.exitCode !== 0 || worktrees.lossy) throw new RepositorySetupError("repository-unavailable", "Worktree state is unavailable.");
			const occupiedPath = parseWorktreeBranches(worktrees.stdout).get(branch);
			if (occupiedPath !== void 0 && resolve(occupiedPath) !== info.root) throw new RepositorySetupError("branch-occupied", "The selected branch is already checked out in another worktree.");
			if ((await this.#run(git, [
				"switch",
				"--",
				branch
			], info.root)).exitCode !== 0) throw new RepositorySetupError("checkout-failed", "Git could not switch to the selected branch.");
		}
		return {
			mode: "checkout",
			root: info.root,
			path: info.root,
			branch
		};
	}
	async #createWorktree(info, baseBranch, baseRef, explicitBranchName, reuseExistingBranch, progress, intent) {
		const { root } = info;
		const git = await this.#git();
		progress("fetching");
		await this.#fetchRemotes(git, root);
		const startRef = reuseExistingBranch ? baseRef : await this.#upstreamRef(git, info, baseBranch) ?? baseRef;
		const suffix = randomUUID().slice(0, 8);
		const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
		const branch = explicitBranchName ?? await this.#generatedBranch(info, baseBranch, intent, stamp, suffix, progress);
		const directory = this.#worktreeRoot ?? await this.#inRepositoryWorktreeRoot(git, root);
		const path = join(directory, await this.#freeDirectoryName(directory, root, branch));
		progress("creating-worktree");
		await mkdir(directory, { recursive: true });
		if (reuseExistingBranch) await this.#run(git, ["worktree", "prune"], root).catch(() => void 0);
		const created = await this.#run(git, reuseExistingBranch ? [
			"worktree",
			"add",
			"--",
			path,
			branch
		] : [
			"worktree",
			"add",
			"--no-track",
			"-b",
			branch,
			path,
			startRef
		], root);
		if (created.exitCode !== 0) {
			const detail = created.stderr.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line.length > 0).at(-1);
			throw new RepositorySetupError("worktree-failed", detail === void 0 ? "Git could not create the worktree." : `Git could not create the worktree: ${detail}`);
		}
		const item = {
			id: randomUUID(),
			root,
			path,
			branch,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			pluginGeneratedBranch: explicitBranchName === void 0
		};
		progress("saving-worktree");
		try {
			await this.#serialize(async () => {
				const leases = await this.#readLeases();
				await this.#writeLeases([...leases, item]);
			});
		} catch (error) {
			await this.#run(git, [
				"worktree",
				"remove",
				"--force",
				"--",
				path
			], root).catch(() => void 0);
			if (!reuseExistingBranch) await this.#run(git, [
				"branch",
				"-D",
				"--",
				branch
			], root).catch(() => void 0);
			throw error;
		}
		return {
			mode: "worktree",
			root,
			path,
			branch,
			leaseId: item.id
		};
	}
	/** `<prefix>/<what the draft is about>`, falling back to
	*  `<prefix>/<base branch>-<stamp>-<random>` whenever the summary is missing
	*  or unusable. The prefix and the fallback shape are unchanged. */
	/** The branch-named directory, or the first `-2`, `-3`, ... spelling free of
	*  anything already on disk. Names no longer carry a timestamp, so a stale
	*  directory a crash left behind -- or two branches that fold to the same
	*  segment -- would otherwise fail `worktree add` outright. Compared
	*  case-folded, since a case-insensitive filesystem would collide anyway. */
	/** `<main checkout>/.claude/worktrees`, excluded from that checkout's status.
	*  Anchored at the main checkout rather than `root`, so a worktree prepared
	*  from inside another worktree does not nest in it. The exclude is
	*  best-effort: failing to write it only leaves the directory visible as
	*  untracked. */
	async #inRepositoryWorktreeRoot(git, root) {
		const dirs = await this.#run(git, [
			"rev-parse",
			"--path-format=absolute",
			"--git-common-dir",
			"--git-path",
			"info/exclude"
		], root);
		const [commonDir = "", excludePath = ""] = dirs.exitCode === 0 ? dirs.stdout.trim().split(/\r?\n/u) : [];
		const mainRoot = commonDir.length > 0 && basename(commonDir) === ".git" ? resolve(commonDir, "..") : root;
		if (excludePath.length > 0) try {
			const current = await readFile(excludePath, "utf8").catch(() => "");
			if (!current.split(/\r?\n/u).some((line) => line.trim() === WORKTREE_EXCLUDE_LINE)) {
				await mkdir(resolve(excludePath, ".."), { recursive: true });
				const separator = current.length === 0 || current.endsWith("\n") ? "" : "\n";
				await writeFile(excludePath, `${current}${separator}${WORKTREE_EXCLUDE_LINE}\n`, "utf8");
			}
		} catch {}
		return join(mainRoot, IN_REPOSITORY_WORKTREE_DIR);
	}
	async #freeDirectoryName(directory, root, branch) {
		const base = worktreeDirectoryName(root, branch);
		const taken = await readdir(directory).then((entries) => new Set(entries.map((entry) => entry.toLocaleLowerCase("en-US"))), () => /* @__PURE__ */ new Set());
		if (!taken.has(base.toLocaleLowerCase("en-US"))) return base;
		for (let index = 2; index < 100; index += 1) {
			const candidate = `${base}-${index}`;
			if (!taken.has(candidate.toLocaleLowerCase("en-US"))) return candidate;
		}
		return base;
	}
	async #generatedBranch(info, baseBranch, intent, stamp, suffix, progress) {
		const prefix = safeBranch(await this.#branchPrefix());
		if (intent !== void 0 && intent.trim().length > 0) {
			progress("summarizing");
			const summary = await this.#summarizeBranch(intent).catch(() => void 0);
			if (summary !== void 0) return uniqueBranchName(`${prefix}/${summary}`, info.branches);
		}
		return `${prefix}/${slug(baseBranch, "branch")}-${stamp}-${suffix}`;
	}
	/** Refuse to delete a branch holding commits no remote has. */
	async #requirePushed(git, root, branch) {
		const count = await this.#run(git, [
			"rev-list",
			"--count",
			branch,
			"--not",
			"--remotes"
		], root);
		if (count.exitCode !== 0 || Number(count.stdout.trim()) > 0) throw new RepositorySetupError("unpushed-commits", "The branch has commits that are not on any remote; push or discard them first.");
	}
	async #repositoryRoot(git, cwd) {
		const result = await this.#run(git, [
			"rev-parse",
			"--path-format=absolute",
			"--show-toplevel"
		], cwd);
		const root = result.stdout.trim();
		if (result.exitCode !== 0 || result.lossy || root.length === 0 || !isAbsolute(root)) throw new RepositorySetupError("not-repository", "The workspace is not a Git repository.");
		return resolve(root);
	}
	#git() {
		this.#gitPath ??= this.#runtime.resolveExecutable("git", toolPathEnv(), AbortSignal.timeout(GIT_TIMEOUT_MS$2)).catch((error) => {
			this.#gitPath = void 0;
			throw error;
		});
		return this.#gitPath;
	}
	async #run(executable, args, cwd, timeoutMs = GIT_TIMEOUT_MS$2) {
		return collect$2(this.#runtime.spawn({
			argv: [executable, ...args],
			cwd,
			stdio: {
				stdin: "ignore",
				stdout: { maxBytes: MAX_OUTPUT_BYTES$2 },
				stderr: { maxBytes: MAX_OUTPUT_BYTES$2 }
			},
			graceMs: 1e3,
			signal: AbortSignal.timeout(timeoutMs),
			env: {}
		}));
	}
	async #readLeases() {
		try {
			const parsed = JSON.parse(await readFile(this.#leasePath, "utf8"));
			if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return [];
			const input = parsed;
			if (input.schemaVersion !== LEASE_SCHEMA_VERSION || !Array.isArray(input.leases)) return [];
			return input.leases.map(lease).filter((item) => item !== void 0);
		} catch (error) {
			if (error.code === "ENOENT") return [];
			throw error;
		}
	}
	async #writeLeases(leases) {
		await mkdir(resolve(this.#leasePath, ".."), { recursive: true });
		const temporary = `${this.#leasePath}.${process.pid}.${randomUUID()}.tmp`;
		const document = {
			schemaVersion: LEASE_SCHEMA_VERSION,
			leases
		};
		try {
			await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, { mode: 384 });
			await rename(temporary, this.#leasePath);
		} finally {
			await rm(temporary, { force: true }).catch(() => void 0);
		}
	}
	#serialize(operation) {
		const result = this.#pending.then(operation, operation);
		this.#pending = result.then(() => void 0, () => void 0);
		return result;
	}
};
//#endregion
//#region src/repository-actions.ts
const MAX_OUTPUT_BYTES$1 = 262144;
const MAX_PATCH_CHARS = 65536;
const MAX_MESSAGE_CHARS = 2048;
const MAX_PR_TEXT_CHARS = 8192;
const MAX_UNPUSHED_COMMITS = 20;
/** What one generation shows the model: the whole patch when it fits, the
*  head of it otherwise, and the prompt says which. */
const MAX_GENERATE_PATCH_CHARS = 49152;
const MAX_SUBJECT_CHARS = 72;
/** A body is for the reader skimming `git log`, not a change list: past this
*  many bullets it stops being read, so the rest are dropped. */
const MAX_BODY_BULLETS = 4;
/** Past this the first line is not a subject at all; under it, a subject a
*  few characters over what the prompt asked for is the user's to trim. */
const MAX_SUBJECT_KEPT_CHARS = 120;
const MAX_PR_TITLE_CHARS = 100;
const MAX_RECENT_SUBJECTS = 10;
const MAX_PR_COMMITS = 50;
const GIT_TIMEOUT_MS$1 = 15e3;
const REMOTE_TIMEOUT_MS = 6e4;
const GENERATE_TIMEOUT_MS = 6e4;
/** One cold `claude -p` per generation, so everything the subject line cannot
*  use is cost: MCP servers (which `ask` already skips for the same reason,
*  and which stall for as long as an unreachable one takes to give up) and the
*  user's own hooks and settings. Project settings stay: a repository's commit
*  conventions belong in the message. The prompt itself goes in on stdin:
*  a 48 KB diff on argv is past what Windows lets a process be started with
*  (ENAMETOOLONG, and the fallback subject where a message should be).
*
*  Sonnet rather than the session's default: describing a diff needs no
*  frontier model, but telling three unrelated changes apart in one diff is
*  where haiku starts to blur them, and sonnet costs only a second or two
*  more. Extended thinking is off (see {@link GENERATE_ENV}): the naming call
*  in prompts.ts measured it as most of a ten-second run. */
const GENERATE_ARGUMENTS = [
	"-p",
	"--model",
	"sonnet",
	"--strict-mcp-config",
	"--mcp-config",
	"{\"mcpServers\":{}}",
	"--setting-sources",
	"project,local",
	"--tools",
	"",
	"--output-format",
	"text"
];
/** A CLI that stops honouring the variable is slow again, never wrong. */
const GENERATE_ENV = { MAX_THINKING_TOKENS: "0" };
var RepositoryActionError = class extends Error {
	code;
	commit;
	constructor(code, message, commit) {
		super(message);
		this.name = "RepositoryActionError";
		this.code = code;
		if (commit !== void 0) this.commit = commit;
	}
};
async function collect$1(handle) {
	const outcome = await handle.done;
	const stdout = handle.collected.stdout?.readFrom(0);
	const stderr = handle.collected.stderr?.readFrom(0);
	return {
		exitCode: outcome.exitCode,
		stdout: stdout?.text ?? "",
		stderr: stderr?.text ?? "",
		lossy: stdout?.lossy === true || stderr?.lossy === true
	};
}
function safeText(value, maximum, label) {
	const text = value.trim();
	if (text.length === 0 || text.length > maximum || /[\0\r]/u.test(text)) throw new RepositoryActionError("invalid-request", `${label} is invalid.`);
	return text;
}
function isProtectedWarpPath(path) {
	return basename(path.replaceAll("\\", "/")).toLocaleLowerCase("en-US") === "warp.md";
}
function parseRepositoryActionStatus(output) {
	const files = /* @__PURE__ */ new Map();
	const records = output.includes("\0") ? output.split("\0") : output.split(/\r?\n/u);
	for (let position = 0; position < records.length; position += 1) {
		const line = records[position] ?? "";
		if (line.length < 4) continue;
		const index = line[0] ?? " ";
		const worktree = line[1] ?? " ";
		let path = line.slice(3);
		let origPath;
		const rename = path.lastIndexOf(" -> ");
		if (rename >= 0) {
			origPath = path.slice(0, rename);
			path = path.slice(rename + 4);
		}
		if (output.includes("\0") && (index === "R" || index === "C" || worktree === "R" || worktree === "C")) {
			position += 1;
			origPath = records[position];
		}
		if (path.length === 0 || path.includes("\0") || isProtectedWarpPath(path)) continue;
		files.set(path, {
			path,
			...origPath === void 0 || origPath.length === 0 || index === "C" ? {} : { origPath },
			staged: index !== " " && index !== "?",
			unstaged: worktree !== " " && worktree !== "?",
			untracked: index === "?" && worktree === "?"
		});
	}
	return [...files.values()].sort((left, right) => left.path.localeCompare(right.path));
}
function conflictPaths(result) {
	if (result.exitCode !== 0 || result.lossy) return [];
	return result.stdout.split(/\r?\n/u).filter((line) => line.length > 0).slice(0, 100);
}
function fallbackCommitMessage(files) {
	if (files.length === 1) return `Update ${files[0]?.path ?? "repository files"}`;
	return `Update ${files.length} repository files`;
}
/** The model's answer as lines: fences and a trailing prose apology dropped,
*  carriage returns and NULs (which git and the request validator refuse)
*  gone, leading blank lines gone. */
function answerLines(value) {
	const kept = value.replace(/\0/gu, "").split(/\r?\n/u).map((line) => line.trimEnd()).filter((line) => !line.trim().startsWith("```"));
	while (kept.length > 0 && kept[0]?.trim() === "") kept.shift();
	while (kept.length > 0 && kept.at(-1)?.trim() === "") kept.pop();
	return kept;
}
function unquoted(line) {
	return line.trim().replace(/^['"`]+|['"`]+$/gu, "").trim();
}
/** Subject line, then a body when the model wrote one: the subject must at
*  least look like one, the body is kept as the bullets the model listed, and the
*  whole thing is cut at a line boundary under the commit-message cap. */
function normalizeCommitMessage(value, fallback) {
	const lines = answerLines(value);
	const subject = unquoted(lines[0] ?? "");
	if (subject.length === 0 || subject.length > MAX_SUBJECT_KEPT_CHARS) return fallback;
	const body = lines.slice(1);
	while (body.length > 0 && body[0]?.trim() === "") body.shift();
	const kept = [subject];
	if (body.length > 0) kept.push("");
	let previousBlank = false;
	let bullets = 0;
	for (const line of body) {
		const blank = line.trim() === "";
		if (blank && previousBlank) continue;
		previousBlank = blank;
		if (/^\s*[-*]\s/u.test(line) && ++bullets > MAX_BODY_BULLETS) continue;
		if ([...kept, line].join("\n").length > MAX_MESSAGE_CHARS) break;
		kept.push(line);
	}
	while (kept.length > 1 && kept.at(-1)?.trim() === "") kept.pop();
	return kept.join("\n");
}
/** `Title:` on its own line, then the `Summary:` / `Changes:` body the
*  create-pr arm insists on. Anything else is the caller's fallback. */
function parsePullRequestText(value) {
	const lines = answerLines(value);
	const titleAt = lines.findIndex((line) => /^title:/iu.test(line.trim()));
	if (titleAt < 0) return void 0;
	const title = unquoted(lines[titleAt].trim().replace(/^title:/iu, ""));
	if (title.length === 0 || title.length > MAX_PR_TITLE_CHARS) return void 0;
	const summaryAt = lines.findIndex((line, index) => index > titleAt && /^summary:/iu.test(line.trim()));
	if (summaryAt < 0) return void 0;
	const body = lines.slice(summaryAt).map((line) => line.trim() === "" ? "" : line).join("\n").trim();
	return validPullRequestBody(body) && body.length <= MAX_PR_TEXT_CHARS ? {
		title,
		body
	} : void 0;
}
function fallbackPullRequestText(commits, files) {
	const title = commits[0]?.subject ?? fallbackCommitMessage(files);
	const changes = commits.length > 0 ? commits.map((commit) => commit.subject) : files.map((file) => `Update ${file.path}`);
	return {
		title,
		body: `Summary: ${title}\n\nChanges:\n${(changes.length > 0 ? changes : [title]).map((item) => `- ${item}`).join("\n")}`
	};
}
function parseBranchCommits(output) {
	return output.split("\0").flatMap((record) => {
		const [subject = "", ...rest] = record.replace(/^\r?\n/u, "").split(/\r?\n/u);
		if (subject.trim().length === 0) return [];
		return [{
			subject: subject.trim().slice(0, 140),
			body: rest.join("\n").trim()
		}];
	}).slice(0, MAX_PR_COMMITS);
}
function boundedPatch(patch) {
	return patch.length > MAX_GENERATE_PATCH_CHARS ? {
		text: patch.slice(0, MAX_GENERATE_PATCH_CHARS),
		truncated: true
	} : {
		text: patch,
		truncated: false
	};
}
function validPrUrl(value) {
	try {
		const url = new URL(value.trim());
		return url.protocol === "https:" && url.hostname === "github.com" ? url.href : void 0;
	} catch {
		return;
	}
}
function validPullRequestBody(value) {
	const body = value.trim();
	const match = /^Summary:\s+([^\r\n]+)\r?\n\r?\nChanges:\s*\r?\n([\s\S]+)$/u.exec(body);
	const summary = match?.[1]?.trim();
	const changes = match?.[2]?.trim();
	if (summary === void 0 || summary.length === 0 || changes === void 0 || changes.length === 0) return false;
	return !/^#{1,6}\s|^[A-Za-z][A-Za-z ]+:\s*$/mu.test(changes);
}
var RepositoryActionService = class {
	#runtime;
	#claudeExecutable;
	#invalidate;
	#gitExecutable;
	#ghExecutable;
	#pending = Promise.resolve();
	constructor(runtime, claudeExecutable, invalidate = () => {}) {
		this.#runtime = runtime;
		this.#claudeExecutable = claudeExecutable;
		this.#invalidate = invalidate;
	}
	preview(cwd) {
		return this.#preview(cwd);
	}
	async generateMessage(cwd, fingerprint) {
		const preview = await this.#preview(cwd);
		if (preview.fingerprint !== fingerprint) throw new RepositoryActionError("repository-changed", "Repository changes have changed. Refresh the commit panel.");
		const fallback = fallbackCommitMessage(preview.files);
		const git = await this.#git();
		const recent = await this.#run(git, [
			"log",
			"--no-merges",
			"--format=%s",
			"-n",
			String(MAX_RECENT_SUBJECTS),
			"HEAD",
			"--"
		], preview.root, GIT_TIMEOUT_MS$1);
		const subjects = recent.exitCode === 0 && !recent.lossy ? recent.stdout.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line.length > 0) : [];
		const patch = boundedPatch(preview.patch);
		const prompt = [
			"Write a git commit message for the changes below, in English, for someone skimming git log.",
			`Line 1 is the subject: imperative mood, at most ${MAX_SUBJECT_CHARS} characters, saying what the change does for the user or the code's behaviour, not which files it touches.`,
			"Most changes get the subject line only. Add a body only when the diff carries more than one change a reader would want to know about separately: leave line 2 blank, then one line per such change starting with \"- \", a short sentence about what now behaves differently.",
			`Never more than ${MAX_BODY_BULLETS} bullets. Do not list tests, documentation, README, translations, type or wiring plumbing, or the propagation of one change through several layers: those are part of the change they serve, not changes of their own. Do not name files or identifiers unless nothing else identifies the change.`,
			"Describe only what the diff shows. Do not invent motivation, do not summarise the file list, and do not mention that the diff is truncated.",
			"Return only the message: no quotes, no markdown fences, no explanation before or after it.",
			...subjects.length > 0 ? [`Recent commit subjects of this repository, as a style reference only:\n${subjects.map((subject) => `- ${subject}`).join("\n")}`] : [],
			`Files: ${preview.files.map((file) => file.path).join(", ")}`,
			...patch.truncated || preview.truncated ? ["The diff below is cut short; the file list above is complete."] : [],
			`Diff:\n${patch.text}`
		].join("\n");
		try {
			const result = await this.#run(this.#claudeExecutable, GENERATE_ARGUMENTS, preview.root, GENERATE_TIMEOUT_MS, MAX_OUTPUT_BYTES$1, GENERATE_ENV, prompt);
			return result.exitCode === 0 && !result.lossy ? normalizeCommitMessage(result.stdout, fallback) : fallback;
		} catch {
			return fallback;
		}
	}
	/** Title and description for the pull request the branch would open: the
	*  commits and diff since the base, plus whatever is still uncommitted,
	*  since create-pr commits that first. Base is the named branch on origin,
	*  else origin's default; with neither, the tree alone. */
	async generatePullRequest(cwd, fingerprint, baseBranch) {
		const preview = await this.#preview(cwd);
		if (preview.fingerprint !== fingerprint) throw new RepositoryActionError("repository-changed", "Repository changes have changed. Refresh the commit panel.");
		const git = await this.#git();
		const base = await this.#baseRef(git, preview.root, baseBranch);
		let commits = [];
		let branchPatch = "";
		let branchTruncated = false;
		if (base !== void 0) {
			const log = await this.#run(git, [
				"log",
				"--no-merges",
				"--format=%s%n%b%x00",
				"-n",
				String(51),
				`${base}..HEAD`,
				"--"
			], preview.root, GIT_TIMEOUT_MS$1);
			if (log.exitCode === 0 && !log.lossy) commits = parseBranchCommits(log.stdout);
			const funcname = await diffFuncnameArgs();
			const diff = await this.#run(git, [
				...funcname,
				"diff",
				"--no-ext-diff",
				"--no-color",
				"--unified=3",
				`${base}...HEAD`,
				"--",
				":(exclude)WARP.md",
				":(exclude)**/WARP.md"
			], preview.root, GIT_TIMEOUT_MS$1, MAX_OUTPUT_BYTES$1);
			if (diff.exitCode === 0) {
				branchPatch = diff.stdout;
				branchTruncated = diff.lossy;
			}
		}
		const fallback = fallbackPullRequestText(commits, preview.files);
		const patch = boundedPatch([branchPatch, preview.patch].filter((part) => part.length > 0).join("\n"));
		const prompt = [
			"Write the title and description of a GitHub pull request for the changes below, in English.",
			"Answer in exactly this shape and nothing else:",
			`Title: <imperative title, at most ${MAX_SUBJECT_CHARS} characters, saying what the pull request does>`,
			"Summary: <one sentence saying what the pull request achieves as a whole>",
			"",
			"Changes:",
			"- <one line per independent change, describing what changed in the code>",
			"",
			`One bullet per change a reviewer would want to know about separately, at most 6; a change with a single purpose gets one bullet. Tests, documentation, translations, and the plumbing that carries a change through several layers belong to the change they serve, not to bullets of their own. Do not describe anything the diff does not show.`,
			"No markdown headings, no quotes, no fences, no text before \"Title:\" or after the last bullet.",
			...commits.length > 0 ? [`Commits on this branch, newest first:\n${commits.map((commit) => commit.body.length > 0 ? `- ${commit.subject}\n${commit.body}` : `- ${commit.subject}`).join("\n")}`] : [],
			...preview.files.length > 0 ? [`Uncommitted files that will go into the same pull request: ${preview.files.map((file) => file.path).join(", ")}`] : [],
			...patch.truncated || branchTruncated || preview.truncated ? ["The diff below is cut short; the commit list is complete."] : [],
			`Diff:\n${patch.text}`
		].join("\n");
		try {
			const result = await this.#run(this.#claudeExecutable, GENERATE_ARGUMENTS, preview.root, GENERATE_TIMEOUT_MS, MAX_OUTPUT_BYTES$1, GENERATE_ENV, prompt);
			return (result.exitCode === 0 && !result.lossy ? parsePullRequestText(result.stdout) : void 0) ?? fallback;
		} catch {
			return fallback;
		}
	}
	/** `origin/<branch>` when the named branch exists on origin, else the branch
	*  origin's HEAD points at. Neither on a checkout that never fetched. */
	async #baseRef(git, root, baseBranch) {
		const named = baseBranch?.trim() ?? "";
		if (named.length > 0) {
			if (/[\0\r\n\s]|\.\.|^-/u.test(named)) return void 0;
			const verified = await this.#run(git, [
				"rev-parse",
				"--verify",
				"--quiet",
				"--symbolic-full-name",
				`refs/remotes/origin/${named}`
			], root, GIT_TIMEOUT_MS$1);
			return verified.exitCode === 0 && !verified.lossy && verified.stdout.trim() === `refs/remotes/origin/${named}` ? `origin/${named}` : void 0;
		}
		const head = await this.#run(git, [
			"symbolic-ref",
			"--quiet",
			"--short",
			"refs/remotes/origin/HEAD"
		], root, GIT_TIMEOUT_MS$1);
		const ref = head.stdout.trim();
		return head.exitCode === 0 && !head.lossy && /^origin\/[^\s]+$/u.test(ref) ? ref : void 0;
	}
	execute(cwd, request) {
		const operation = this.#pending.then(() => this.#execute(cwd, request));
		this.#pending = operation.then(() => void 0, () => void 0);
		return operation;
	}
	async #execute(cwd, request) {
		if (request.action === "resolve-continue" || request.action === "resolve-abort") return this.#resolve(cwd, request.action, request.push === true);
		const before = await this.#preview(cwd);
		if (before.fingerprint !== request.fingerprint) throw new RepositoryActionError("repository-changed", "Repository changes have changed. Refresh the commit panel.");
		if (request.action === "revert") return this.#revert(before, request.paths);
		if (request.action === "push") {
			const git = await this.#git();
			try {
				await this.#push(git, before.root, before.branch);
			} catch (error) {
				throw new RepositoryActionError("push-failed", error instanceof Error ? error.message : "Git push failed.");
			}
			this.#invalidate(before.root);
			return {
				commit: before.head,
				pushed: true
			};
		}
		if (request.action === "merge-pr") {
			const method = request.mergeMethod;
			if (method !== "merge" && method !== "squash" && method !== "rebase") throw new RepositoryActionError("invalid-request", "The merge method is invalid.");
			let gh;
			try {
				gh = await this.#gh();
			} catch (error) {
				throw new RepositoryActionError("gh-unavailable", error instanceof Error ? error.message : "GitHub CLI is unavailable.");
			}
			const merged = await this.#run(gh, [
				"pr",
				"merge",
				...request.pullNumber === void 0 ? [] : [String(request.pullNumber)],
				`--${method}`,
				...request.admin === true ? ["--admin"] : []
			], before.root, REMOTE_TIMEOUT_MS);
			if (merged.exitCode !== 0 || merged.lossy) {
				const reason = merged.stderr.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line.length > 0).at(-1);
				throw new RepositoryActionError("merge-failed", reason === void 0 || reason.length === 0 ? "The pull request could not be merged." : reason);
			}
			this.#invalidate(before.root);
			return {
				commit: before.head,
				pushed: true
			};
		}
		if (request.action === "update-branch") {
			const base = safeText(request.baseBranch ?? "", 512, "Base branch");
			if (before.files.length > 0) throw new RepositoryActionError("dirty-workspace", "Commit or stash workspace changes before updating the branch.");
			const method = request.mergeMethod ?? "rebase";
			if (method !== "merge" && method !== "rebase") throw new RepositoryActionError("invalid-request", "Update branch supports merge or rebase.");
			const git = await this.#git();
			await this.#mustRun(git, [
				"fetch",
				"origin",
				"--",
				base
			], before.root, REMOTE_TIMEOUT_MS, "fetch-failed", "Git could not fetch the base branch.");
			const merged = await this.#run(git, method === "rebase" ? [
				"rebase",
				"--",
				`origin/${base}`
			] : [
				"merge",
				"--no-edit",
				"--",
				`origin/${base}`
			], before.root, REMOTE_TIMEOUT_MS);
			if (merged.exitCode !== 0 || merged.lossy) {
				const conflicts = conflictPaths(await this.#run(git, [
					"diff",
					"--name-only",
					"--diff-filter=U",
					"--"
				], before.root, GIT_TIMEOUT_MS$1));
				if (conflicts.length === 0) {
					await this.#run(git, [method, "--abort"], before.root, GIT_TIMEOUT_MS$1).catch(() => void 0);
					throw new RepositoryActionError("merge-failed", `Git could not ${method} the base branch.`);
				}
				this.#invalidate(before.root);
				return {
					commit: before.head,
					pushed: false,
					conflicts
				};
			}
			const mergedHead = (await this.#mustRun(git, ["rev-parse", "HEAD"], before.root, GIT_TIMEOUT_MS$1, "merge-failed", "The updated commit could not be verified.")).stdout.trim();
			try {
				await this.#push(git, before.root, before.branch, method === "rebase");
			} catch (error) {
				throw new RepositoryActionError("push-failed", error instanceof Error ? error.message : "Git push failed.", mergedHead);
			}
			this.#invalidate(before.root);
			return {
				commit: mergedHead,
				pushed: true
			};
		}
		const message = safeText(request.message, MAX_MESSAGE_CHARS, "Commit message");
		if (before.files.length === 0 && request.action !== "create-pr") throw new RepositoryActionError("nothing-to-commit", "There are no changes to commit.");
		const git = await this.#git();
		let oid = before.head;
		if (before.files.length > 0) {
			await this.#rejectStagedWarp(git, before.root);
			if (request.includeUnstaged) {
				const paths = before.files.filter((file) => file.unstaged || file.untracked).map((file) => file.path);
				if (paths.length > 0) await this.#mustRun(git, [
					"add",
					"--",
					...paths
				], before.root, GIT_TIMEOUT_MS$1, "stage-failed", "Changes could not be staged.");
			}
			await this.#rejectStagedWarp(git, before.root);
			const staged = await this.#run(git, [
				"diff",
				"--cached",
				"--quiet",
				"--exit-code",
				"--"
			], before.root, GIT_TIMEOUT_MS$1);
			if (staged.exitCode === 0) throw new RepositoryActionError("nothing-to-commit", "There are no staged changes to commit.");
			if (staged.exitCode !== 1) throw new RepositoryActionError("repository-unavailable", "The staged changes could not be verified.");
			await this.#mustRun(git, [
				"commit",
				"-m",
				message,
				"--"
			], before.root, GIT_TIMEOUT_MS$1, "commit-failed", "Git commit failed.");
			oid = (await this.#mustRun(git, ["rev-parse", "HEAD"], before.root, GIT_TIMEOUT_MS$1, "commit-failed", "The new commit could not be verified.")).stdout.trim();
			this.#invalidate(before.root);
			if (request.action === "commit") return {
				commit: oid,
				pushed: false
			};
		}
		try {
			await this.#push(git, before.root, before.branch);
		} catch (error) {
			throw new RepositoryActionError("push-failed", error instanceof Error ? error.message : "Git push failed.", oid);
		}
		this.#invalidate(before.root);
		if (request.action === "commit-push") return {
			commit: oid,
			pushed: true
		};
		const title = safeText(request.prTitle ?? message, 256, "Pull request title");
		const body = safeText(request.prBody ?? "", MAX_PR_TEXT_CHARS, "Pull request description");
		if (!validPullRequestBody(body)) throw new RepositoryActionError("invalid-pr-description", "Pull request description must contain only Summary and Changes sections.", oid);
		let gh;
		try {
			gh = await this.#gh();
		} catch (error) {
			throw new RepositoryActionError("gh-unavailable", error instanceof Error ? error.message : "GitHub CLI is unavailable.", oid);
		}
		const args = [
			"pr",
			"create",
			"--title",
			title,
			"--body",
			body
		];
		if (request.draft !== false) args.push("--draft");
		if (request.baseBranch !== void 0) args.push("--base", safeText(request.baseBranch, 512, "Base branch"));
		const created = await this.#run(gh, args, before.root, REMOTE_TIMEOUT_MS);
		const url = created.exitCode === 0 && !created.lossy ? validPrUrl(created.stdout) : void 0;
		if (url === void 0) throw new RepositoryActionError("pr-failed", "The pull request could not be created.", oid);
		return {
			commit: oid,
			pushed: true,
			pullRequestUrl: url
		};
	}
	/** Finishes or discards the merge, rebase, cherry-pick or revert git is
	*  waiting on. The operation is read from the git dir rather than taken from
	*  the caller: `--continue` and `--abort` are only safe against the one that
	*  is actually in progress. */
	async #resolve(cwd, action, push) {
		const git = await this.#git();
		const [rootValue, gitDirValue] = (await this.#mustRun(git, [
			"rev-parse",
			"--path-format=absolute",
			"--show-toplevel",
			"--absolute-git-dir"
		], cwd, GIT_TIMEOUT_MS$1, "not-repository", "The session directory is not a Git repository.")).stdout.split(/\r?\n/u);
		const root = (rootValue ?? "").trim();
		const gitDir = (gitDirValue ?? "").trim();
		if (root.length === 0 || gitDir.length === 0) throw new RepositoryActionError("repository-unavailable", "Repository state is unavailable.");
		const state = await detectRepositoryOperation(gitDir);
		if (state === void 0) throw new RepositoryActionError("no-operation", "No merge, rebase, cherry-pick or revert is in progress.");
		const operation = state.operation;
		if (action === "resolve-abort") {
			await this.#mustRun(git, [operation, "--abort"], root, GIT_TIMEOUT_MS$1, "abort-failed", `Git could not abort the ${operation}.`);
			this.#invalidate(root);
			return {
				commit: await this.#head(git, root),
				pushed: false
			};
		}
		if (conflictPaths(await this.#run(git, [
			"diff",
			"--name-only",
			"--diff-filter=U",
			"--"
		], root, GIT_TIMEOUT_MS$1)).length > 0) throw new RepositoryActionError("unresolved-conflicts", "Resolve and stage every conflicted file before continuing.");
		const continued = await this.#run(git, [
			"-c",
			"core.editor=true",
			operation,
			"--continue"
		], root, REMOTE_TIMEOUT_MS);
		this.#invalidate(root);
		if (continued.exitCode !== 0 || continued.lossy) {
			const next = conflictPaths(await this.#run(git, [
				"diff",
				"--name-only",
				"--diff-filter=U",
				"--"
			], root, GIT_TIMEOUT_MS$1));
			if (next.length > 0) return {
				commit: await this.#head(git, root),
				pushed: false,
				conflicts: next
			};
			const reason = continued.stderr.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line.length > 0).at(-1);
			throw new RepositoryActionError("continue-failed", reason === void 0 || reason.length === 0 ? `Git could not continue the ${operation}.` : reason);
		}
		const head = await this.#head(git, root);
		if (!push) return {
			commit: head,
			pushed: false
		};
		const branch = await this.#run(git, [
			"symbolic-ref",
			"--quiet",
			"--short",
			"HEAD"
		], root, GIT_TIMEOUT_MS$1);
		if (branch.exitCode !== 0 || branch.lossy) throw new RepositoryActionError("detached-head", "The finished operation left a detached HEAD, so nothing was pushed.", head);
		try {
			await this.#push(git, root, branch.stdout.trim(), operation === "rebase");
		} catch (error) {
			throw new RepositoryActionError("push-failed", error instanceof Error ? error.message : "Git push failed.", head);
		}
		this.#invalidate(root);
		return {
			commit: head,
			pushed: true
		};
	}
	/** Put uncommitted changes back to HEAD: tracked files (staged and working
	*  tree, a rename's source included) through `git restore`, untracked ones
	*  deleted. Only paths the preview lists are touched, and pathspecs are
	*  literal, so a name with glob characters reverts that one file. */
	async #revert(before, paths) {
		const wanted = paths === void 0 ? before.files : before.files.filter((file) => paths.includes(file.path));
		if (wanted.length === 0) throw new RepositoryActionError("nothing-to-revert", "Only uncommitted changes can be reverted; these are already committed.");
		const git = await this.#git();
		const tracked = wanted.filter((file) => !file.untracked).flatMap((file) => [file.path, ...file.origPath === void 0 ? [] : [file.origPath]]);
		const untracked = wanted.filter((file) => file.untracked).map((file) => file.path);
		if (tracked.length > 0) await this.#mustRun(git, [
			"--literal-pathspecs",
			"restore",
			"--source=HEAD",
			"--staged",
			"--worktree",
			"--",
			...tracked
		], before.root, GIT_TIMEOUT_MS$1, "revert-failed", "Git could not restore the files.");
		if (untracked.length > 0) await this.#mustRun(git, [
			"--literal-pathspecs",
			"clean",
			"-f",
			"--",
			...untracked
		], before.root, GIT_TIMEOUT_MS$1, "revert-failed", "Git could not remove the untracked files.");
		this.#invalidate(before.root);
		return {
			commit: before.head,
			pushed: false,
			reverted: wanted.length
		};
	}
	async #head(git, root) {
		const head = await this.#run(git, ["rev-parse", "HEAD"], root, GIT_TIMEOUT_MS$1);
		return head.exitCode === 0 && !head.lossy ? head.stdout.trim() : "";
	}
	async #preview(cwd) {
		const git = await this.#git();
		const root = (await this.#mustRun(git, [
			"rev-parse",
			"--path-format=absolute",
			"--show-toplevel"
		], cwd, GIT_TIMEOUT_MS$1, "not-repository", "The session directory is not a Git repository.")).stdout.trim();
		const funcname = await diffFuncnameArgs();
		const [branchResult, headResult, statusResult, stagedPatch, unstagedPatch] = await Promise.all([
			this.#run(git, [
				"symbolic-ref",
				"--quiet",
				"--short",
				"HEAD"
			], root, GIT_TIMEOUT_MS$1),
			this.#run(git, ["rev-parse", "HEAD"], root, GIT_TIMEOUT_MS$1),
			this.#run(git, [
				"status",
				"--porcelain=v1",
				"-z",
				"--untracked-files=all"
			], root, GIT_TIMEOUT_MS$1),
			this.#run(git, [
				...funcname,
				"diff",
				"--cached",
				"--no-ext-diff",
				"--no-color",
				"--unified=3",
				"--",
				":(exclude)WARP.md",
				":(exclude)**/WARP.md"
			], root, GIT_TIMEOUT_MS$1, MAX_OUTPUT_BYTES$1),
			this.#run(git, [
				...funcname,
				"diff",
				"--no-ext-diff",
				"--no-color",
				"--unified=3",
				"--",
				":(exclude)WARP.md",
				":(exclude)**/WARP.md"
			], root, GIT_TIMEOUT_MS$1, MAX_OUTPUT_BYTES$1)
		]);
		if (branchResult.exitCode !== 0) throw new RepositoryActionError("detached-head", "A detached HEAD cannot be committed from this panel.");
		if (headResult.exitCode !== 0 || statusResult.exitCode !== 0 || statusResult.lossy) throw new RepositoryActionError("repository-unavailable", "Repository state is unavailable.");
		const files = parseRepositoryActionStatus(statusResult.stdout);
		const patch = `${stagedPatch.stdout}${stagedPatch.stdout.length > 0 && unstagedPatch.stdout.length > 0 ? "\n" : ""}${unstagedPatch.stdout}`.slice(0, MAX_PATCH_CHARS);
		const branch = branchResult.stdout.trim();
		const head = headResult.stdout.trim();
		const fingerprint = createHash("sha256").update([
			head,
			branch,
			statusResult.stdout,
			stagedPatch.stdout,
			unstagedPatch.stdout
		].join("\0")).digest("hex");
		const upstreamResult = await this.#run(git, [
			"rev-parse",
			"--abbrev-ref",
			"--symbolic-full-name",
			"@{upstream}"
		], root, GIT_TIMEOUT_MS$1);
		const upstream = upstreamResult.exitCode === 0 && !upstreamResult.lossy ? upstreamResult.stdout.trim() : void 0;
		const logResult = await this.#run(git, [
			"log",
			"--format=%H%x09%s",
			`-n`,
			String(21),
			upstream === void 0 ? "HEAD" : "@{upstream}..HEAD",
			"--"
		], root, GIT_TIMEOUT_MS$1);
		const commitLines = logResult.exitCode === 0 && !logResult.lossy ? logResult.stdout.split(/\r?\n/u).filter((line) => line.includes("	")) : [];
		const unpushedCommits = commitLines.slice(0, MAX_UNPUSHED_COMMITS).flatMap((line) => {
			const tab = line.indexOf("	");
			const hash = line.slice(0, tab);
			return /^[0-9a-f]{40}$/iu.test(hash) ? [{
				hash,
				subject: line.slice(tab + 1).slice(0, 140)
			}] : [];
		});
		return {
			root,
			branch,
			head,
			fingerprint,
			files,
			patch,
			truncated: stagedPatch.lossy || unstagedPatch.lossy || stagedPatch.stdout.length + unstagedPatch.stdout.length > MAX_PATCH_CHARS,
			hasStaged: files.some((file) => file.staged),
			hasUnstaged: files.some((file) => file.unstaged),
			hasUntracked: files.some((file) => file.untracked),
			...upstream === void 0 ? {} : { upstream },
			unpushedCommits,
			unpushedTruncated: commitLines.length > MAX_UNPUSHED_COMMITS
		};
	}
	async #rejectStagedWarp(git, cwd) {
		const staged = await this.#run(git, [
			"diff",
			"--cached",
			"--name-only",
			"--"
		], cwd, GIT_TIMEOUT_MS$1);
		if (staged.exitCode !== 0 || staged.lossy) throw new RepositoryActionError("repository-unavailable", "Staged files could not be verified.");
		if (staged.stdout.split(/\r?\n/u).some((path) => path.length > 0 && isProtectedWarpPath(path))) throw new RepositoryActionError("protected-warp-file", "WARP.md files cannot be committed. Unstage them before continuing.");
	}
	async #push(git, cwd, branch, forceWithLease = false) {
		const args = (await this.#run(git, [
			"rev-parse",
			"--abbrev-ref",
			"--symbolic-full-name",
			"@{upstream}"
		], cwd, GIT_TIMEOUT_MS$1)).exitCode === 0 ? ["push", ...forceWithLease ? ["--force-with-lease"] : []] : [
			"push",
			"--set-upstream",
			"origin",
			branch
		];
		await this.#mustRun(git, args, cwd, REMOTE_TIMEOUT_MS, "push-failed", "Git push failed.");
	}
	#git() {
		this.#gitExecutable ??= this.#runtime.resolveExecutable("git", toolPathEnv());
		return this.#gitExecutable;
	}
	#gh() {
		this.#ghExecutable ??= this.#runtime.resolveExecutable("gh", toolPathEnv()).catch(() => {
			throw new RepositoryActionError("gh-unavailable", "GitHub CLI is unavailable.");
		});
		return this.#ghExecutable;
	}
	async #mustRun(executable, args, cwd, timeoutMs, code, message) {
		const result = await this.#run(executable, args, cwd, timeoutMs);
		if (result.exitCode !== 0 || result.lossy) throw new RepositoryActionError(code, message);
		return result;
	}
	#run(executable, args, cwd, timeoutMs, maxBytes = MAX_OUTPUT_BYTES$1, env = {}, stdin) {
		return collect$1(this.#runtime.spawn({
			argv: [executable, ...args],
			cwd,
			stdio: {
				stdin: stdin === void 0 ? "ignore" : { data: stdin },
				stdout: { maxBytes },
				stderr: { maxBytes: MAX_OUTPUT_BYTES$1 }
			},
			graceMs: 1e3,
			signal: AbortSignal.timeout(timeoutMs),
			env
		}));
	}
};
//#endregion
//#region src/repository-setup-routes.ts
const MAX_BODY_BYTES$9 = 16384;
function record$12(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
async function readJson$8(io) {
	let parsed;
	try {
		parsed = await io.body(MAX_BODY_BYTES$9);
	} catch (error) {
		if (error instanceof SyntaxError) throw error;
		throw new RepositorySetupError("body-too-large", "The request body is too large.");
	}
	const value = record$12(parsed);
	if (value === void 0) throw new RepositorySetupError("invalid-request", "The request body is invalid.");
	return value;
}
function string$2(input, key) {
	const value = input[key];
	if (typeof value !== "string") throw new RepositorySetupError("invalid-request", `The ${key} field is required.`);
	return value;
}
function optionalString$1(input, key) {
	const value = input[key];
	if (value === void 0) return void 0;
	if (typeof value !== "string") throw new RepositorySetupError("invalid-request", `The ${key} field must be a string.`);
	return value;
}
function ndjsonHeaders(res) {
	res.writeHead(200, {
		"content-type": "application/x-ndjson; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.flushHeaders?.();
}
function ndjson$1(res, value) {
	res.write(`${JSON.stringify(value)}\n`);
}
async function streamSetup(res, service, input) {
	ndjsonHeaders(res);
	let ended = false;
	try {
		ndjson$1(res, {
			type: "complete",
			result: await service.setup(string$2(input, "cwd"), string$2(input, "branch"), input.worktree, optionalString$1(input, "branchName"), (stage) => {
				if (!ended) ndjson$1(res, {
					type: "progress",
					stage
				});
			}, optionalString$1(input, "intent"))
		});
	} catch (error) {
		const setupError = error instanceof RepositorySetupError ? error : void 0;
		ndjson$1(res, {
			type: "error",
			code: setupError?.code ?? "repository-setup-unavailable",
			message: setupError?.message ?? "Repository setup is unavailable."
		});
	} finally {
		ended = true;
		res.end();
	}
}
/** Register trusted browser routes for safe pre-session Git setup.
*
*  The prefix is registered as a stream because the setup POST holds its
*  connection open for the whole worktree build; the short sibling paths ride
*  the same registration and answer with `json` before releasing it. */
function registerRepositorySetupRoute(ctx, service, sweep, cleaned) {
	registerPluginRoute(ctx, {
		mode: "stream",
		kind: "prefix",
		path: CLAUDE_REPOSITORY_SETUP_PATH,
		methods: ["GET", "POST"],
		maxConcurrent: 2,
		streamKey: (url) => `${url.pathname}?${url.searchParams.get("cwd") ?? url.searchParams.get("branch") ?? ""}`,
		handler: async (res, io) => {
			const pathname = io.url.pathname;
			try {
				if (pathname === `/plugins/dsh-claude/repository/setup/branches/refresh`) {
					if (io.method !== "POST") return json(res, 405, { error: "method not allowed" });
					const input = await readJson$8(io);
					return json(res, 200, await service.refreshBranches(string$2(input, "cwd")));
				}
				if (pathname === `/plugins/dsh-claude/repository/setup/branches`) {
					if (io.method !== "GET") return json(res, 405, { error: "method not allowed" });
					const cwd = io.url.searchParams.get("cwd");
					if (cwd === null) throw new RepositorySetupError("invalid-request", "The cwd query parameter is required.");
					return json(res, 200, await service.listBranches(cwd));
				}
				if (pathname === "/plugins/dsh-claude/repository/setup") {
					if (io.method !== "POST") return json(res, 405, { error: "method not allowed" });
					const input = await readJson$8(io);
					if (typeof input.worktree !== "boolean") throw new RepositorySetupError("invalid-request", "The worktree field is required.");
					await streamSetup(res, service, input);
					return;
				}
				if (pathname === `/plugins/dsh-claude/repository/setup/cleanup`) {
					if (io.method !== "POST") return json(res, 405, { error: "method not allowed" });
					const input = await readJson$8(io);
					const path = string$2(input, "path");
					const branch = typeof input.branch === "string" && input.branch.length > 0 ? input.branch : void 0;
					const baseBranch = typeof input.baseBranch === "string" && input.baseBranch.length > 0 ? input.baseBranch : void 0;
					const result = await service.cleanupMerged(path, baseBranch, branch, input.requirePushed === true);
					cleaned?.(path, branch);
					return json(res, 200, result);
				}
				if (pathname === `/plugins/dsh-claude/repository/setup/sweep`) {
					if (io.method !== "POST") return json(res, 405, { error: "method not allowed" });
					sweep?.();
					return json(res, 200, { ok: true });
				}
				if (pathname === `/plugins/dsh-claude/repository/setup/bind`) {
					if (io.method !== "POST") return json(res, 405, { error: "method not allowed" });
					const input = await readJson$8(io);
					await service.bindLease(string$2(input, "leaseId"), string$2(input, "sessionId"));
					return json(res, 200, { ok: true });
				}
				return json(res, 404, { error: "not found" });
			} catch (error) {
				if (error instanceof RepositorySetupError) return json(res, 409, {
					error: error.code,
					message: error.message
				});
				if (error instanceof SyntaxError) return json(res, 400, { error: "invalid json" });
				return json(res, 500, { error: "repository setup unavailable" });
			}
		}
	});
}
//#endregion
//#region src/repository-action-routes.ts
const MAX_BODY_BYTES$8 = 16384;
const MAX_SESSION_ID_CHARS$6 = 1024;
const MAX_ROOT_CHARS = 4096;
const ACTIONS = /* @__PURE__ */ new Set([
	"commit",
	"commit-push",
	"push",
	"create-pr",
	"merge-pr",
	"update-branch",
	"resolve-continue",
	"resolve-abort",
	"revert"
]);
/** Actions that commit nothing of their own, so the panel sends no message. */
const MESSAGELESS = /* @__PURE__ */ new Set([
	"push",
	"merge-pr",
	"update-branch",
	"resolve-continue",
	"resolve-abort",
	"revert"
]);
const MAX_REVERT_PATHS = 2e3;
function record$11(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
async function readJson$7(io) {
	let parsed;
	try {
		parsed = await io.body(MAX_BODY_BYTES$8);
	} catch (error) {
		if (error instanceof SyntaxError) throw error;
		throw new RepositoryActionError("body-too-large", "The request body is too large.");
	}
	const value = record$11(parsed);
	if (value === void 0) throw new RepositoryActionError("invalid-request", "The request body is invalid.");
	return value;
}
function sessionId$1(url) {
	const value = url.searchParams.get("sessionId");
	if (value === null || value.length === 0 || value.length > MAX_SESSION_ID_CHARS$6) throw new RepositoryActionError("invalid-session", "The session is invalid.");
	return value;
}
function requestedRoot(url) {
	const value = url.searchParams.get("root");
	return value === null || value.length === 0 || value.length > MAX_ROOT_CHARS ? void 0 : value;
}
function string$1(input, key) {
	const value = input[key];
	if (typeof value !== "string") throw new RepositoryActionError("invalid-request", `The ${key} field is required.`);
	return value;
}
function optionalString(input, key) {
	const value = input[key];
	if (value === void 0) return void 0;
	if (typeof value !== "string") throw new RepositoryActionError("invalid-request", `The ${key} field must be a string.`);
	return value;
}
function actionRequest(input) {
	const action = input.action;
	if (typeof action !== "string" || !ACTIONS.has(action) || typeof input.includeUnstaged !== "boolean") throw new RepositoryActionError("invalid-request", "The repository action is invalid.");
	return {
		action,
		fingerprint: string$1(input, "fingerprint"),
		message: MESSAGELESS.has(action) ? optionalString(input, "message") ?? "" : string$1(input, "message"),
		includeUnstaged: input.includeUnstaged,
		...optionalString(input, "prTitle") === void 0 ? {} : { prTitle: optionalString(input, "prTitle") },
		...optionalString(input, "prBody") === void 0 ? {} : { prBody: optionalString(input, "prBody") },
		...optionalString(input, "baseBranch") === void 0 ? {} : { baseBranch: optionalString(input, "baseBranch") },
		...input.draft === void 0 ? {} : typeof input.draft === "boolean" ? { draft: input.draft } : (() => {
			throw new RepositoryActionError("invalid-request", "The draft field must be a boolean.");
		})(),
		...input.paths === void 0 ? {} : Array.isArray(input.paths) && input.paths.length > 0 && input.paths.length <= MAX_REVERT_PATHS && input.paths.every((path) => typeof path === "string" && path.length > 0 && path.length <= 4096 && !path.includes("\0")) ? { paths: input.paths } : (() => {
			throw new RepositoryActionError("invalid-request", "The paths field must list repository paths.");
		})(),
		...input.push === void 0 ? {} : typeof input.push === "boolean" ? { push: input.push } : (() => {
			throw new RepositoryActionError("invalid-request", "The push field must be a boolean.");
		})(),
		...input.admin === void 0 ? {} : typeof input.admin === "boolean" ? { admin: input.admin } : (() => {
			throw new RepositoryActionError("invalid-request", "The admin field must be a boolean.");
		})(),
		...input.pullNumber === void 0 ? {} : Number.isSafeInteger(input.pullNumber) && input.pullNumber > 0 ? { pullNumber: input.pullNumber } : (() => {
			throw new RepositoryActionError("invalid-request", "The pullNumber field must be a positive integer.");
		})(),
		...input.mergeMethod === void 0 ? {} : input.mergeMethod === "merge" || input.mergeMethod === "squash" || input.mergeMethod === "rebase" ? { mergeMethod: input.mergeMethod } : (() => {
			throw new RepositoryActionError("invalid-request", "The mergeMethod field is invalid.");
		})()
	};
}
/** One prefix serves the local-Git preview and the POST arms that push, open
*  and merge pull requests, so the registration takes the wider of the two
*  budgets: a `remote` arm cut short at the `git` deadline would abandon work
*  that had already reached GitHub. */
function registerRepositoryActionRoute(ctx, service, cwdForSession) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "prefix",
		path: CLAUDE_REPOSITORY_ACTION_PATH,
		methods: ["GET", "POST"],
		budget: "remote",
		handler: async (io) => {
			const url = io.url;
			try {
				const cwd = cwdForSession(sessionId$1(url), requestedRoot(url));
				if (cwd === void 0) throw new RepositoryActionError("session-unavailable", "The Claude session is unavailable.");
				if (url.pathname === `/plugins/dsh-claude/repository/action/preview`) {
					if (io.method !== "GET") return {
						status: 405,
						value: { error: "method not allowed" }
					};
					return {
						status: 200,
						value: await service.preview(cwd)
					};
				}
				if (url.pathname === `/plugins/dsh-claude/repository/action/message`) {
					if (io.method !== "POST") return {
						status: 405,
						value: { error: "method not allowed" }
					};
					const input = await readJson$7(io);
					return {
						status: 200,
						value: { message: await service.generateMessage(cwd, string$1(input, "fingerprint")) }
					};
				}
				if (url.pathname === `/plugins/dsh-claude/repository/action/pull-request`) {
					if (io.method !== "POST") return {
						status: 405,
						value: { error: "method not allowed" }
					};
					const input = await readJson$7(io);
					return {
						status: 200,
						value: await service.generatePullRequest(cwd, string$1(input, "fingerprint"), optionalString(input, "baseBranch"))
					};
				}
				if (url.pathname === "/plugins/dsh-claude/repository/action") {
					if (io.method !== "POST") return {
						status: 405,
						value: { error: "method not allowed" }
					};
					return {
						status: 200,
						value: await service.execute(cwd, actionRequest(await readJson$7(io)))
					};
				}
				return {
					status: 404,
					value: { error: "not found" }
				};
			} catch (error) {
				if (error instanceof RepositoryActionError) return {
					status: 409,
					value: {
						error: error.code,
						message: error.message,
						...error.commit === void 0 ? {} : { commit: error.commit }
					}
				};
				if (error instanceof SyntaxError) return {
					status: 400,
					value: { error: "invalid-json" }
				};
				return {
					status: 500,
					value: {
						error: "repository-action-unavailable",
						message: "Repository action is unavailable."
					}
				};
			}
		}
	});
}
//#endregion
//#region src/prompts.ts
const MAX_PROMPT_FILES = 256;
const MAX_PROMPT_BYTES = 16384;
const MAX_DESCRIPTION_CHARS = 120;
const MAX_REQUEST_BYTES$1 = 32768;
/**
* The same shape as the output-style name in `global-settings.ts`, plus
* `\p{M}` so a macOS-decomposed name survives. Two properties matter and both
* are load-bearing: no member of the class is a path separator, and the first
* character can be neither a dot nor a separator — so `join(dir, name + '.md')`
* cannot address anything outside `dir`. Nothing else validates the path.
*/
const PROMPT_NAME = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._()\[\]-]{0,127}$/u;
/** Prompt snippets live beside the rest of the user's Claude Code state. */
function claudePromptsDir() {
	return join(homedir(), ".claude", "prompts");
}
/** `~/.claude/prompts/x.md` rather than the absolute path it expands to.
*  Windows joins with backslashes; the display form is the same on every OS. */
function displayPath(file) {
	const home = homedir();
	const separator = file.charAt(home.length);
	if (!file.startsWith(home) || separator !== "/" && separator !== "\\") return file;
	return `~${file.slice(home.length).replaceAll("\\", "/")}`;
}
/** The menu's second row: the first non-empty line, collapsed and bounded. */
function summarize(body) {
	const line = body.split("\n").map((text) => text.trim()).find((text) => text.length > 0) ?? "";
	return redactText(line.replace(/\s+/gu, " "), MAX_DESCRIPTION_CHARS);
}
/**
* Every `.md` file in the prompts directory, sorted by name.
*
* A missing directory is the ordinary state before the user saves anything,
* and one unreadable file must not empty the whole menu — both answer with
* what is there rather than throwing.
*/
async function readClaudePrompts(directory) {
	const prompts = [];
	let entries;
	try {
		entries = await opendir(directory);
	} catch (error) {
		if (error.code === "ENOENT") return prompts;
		throw error;
	}
	for await (const entry of entries) {
		if (prompts.length >= MAX_PROMPT_FILES) break;
		if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".md") continue;
		const name = entry.name.slice(0, -3);
		if (!PROMPT_NAME.test(name)) continue;
		try {
			const file = join(directory, entry.name);
			const body = await readFile(file, "utf8");
			if (body.trim().length === 0 || Buffer.byteLength(body) > MAX_PROMPT_BYTES) continue;
			prompts.push({
				name,
				description: summarize(body),
				body,
				location: displayPath(file)
			});
		} catch {}
	}
	return prompts.sort((left, right) => left.name.localeCompare(right.name));
}
var ClaudePromptWriteError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "ClaudePromptWriteError";
		this.code = code;
	}
};
/**
* Save one prompt, refusing to clobber an existing file.
*
* `wx` is the whole collision policy: a name the user already uses is theirs
* to resolve, and overwriting a prompt they keep is not something they can
* undo from inside DSH.
*/
async function writeClaudePrompt(directory, name, body) {
	if (typeof name !== "string" || !PROMPT_NAME.test(name)) throw new ClaudePromptWriteError("invalid-name", "The prompt name is invalid.");
	if (typeof body !== "string" || body.trim().length === 0 || Buffer.byteLength(body) > MAX_PROMPT_BYTES) throw new ClaudePromptWriteError("invalid-body", "The prompt text is empty or too large.");
	const text = body.endsWith("\n") ? body : `${body}\n`;
	const file = join(directory, `${name}.md`);
	await mkdir(directory, {
		recursive: true,
		mode: 448
	});
	try {
		await writeFile(file, text, {
			encoding: "utf8",
			mode: 384,
			flag: "wx"
		});
	} catch (error) {
		if (error.code === "EEXIST") throw new ClaudePromptWriteError("name-taken", "A prompt with that name already exists.");
		throw error;
	}
	return {
		name,
		description: summarize(text),
		body: text,
		location: displayPath(file)
	};
}
/** Delete one prompt by the name the menu shows. The same `PROMPT_NAME` guard
*  as saving is what keeps the unlink inside `directory`. */
async function deleteClaudePrompt(directory, name) {
	if (typeof name !== "string" || !PROMPT_NAME.test(name)) throw new ClaudePromptWriteError("invalid-name", "The prompt name is invalid.");
	try {
		await unlink(join(directory, `${name}.md`));
	} catch (error) {
		if (error.code === "ENOENT") throw new ClaudePromptWriteError("not-found", "No prompt with that name exists.");
		throw error;
	}
}
const MAX_NAME_DRAFT_CHARS = 4e3;
const MAX_NAME_OUTPUT_BYTES = 4096;
const MAX_SUGGESTED_NAME_CHARS = 48;
const MAX_REFINE_DRAFT_CHARS = 16e3;
const MAX_REFINED_BYTES = 32768;
const ASSIST_TIMEOUT_MS = 4e4;
/**
* Ask for a file name and nothing else, with the draft fenced as data.
*
* Two things here were measured rather than guessed. The instruction travels
* in the user turn, not in `--system-prompt`: a saved prompt is itself an
* instruction and a system prompt does not outrank it, so the model reads the
* draft as its task and answers it instead of naming it. And the default
* system prompt is left in place even though it is large, because the CLI
* sends it as a cache read (~6.5k cached tokens); replacing it with a short
* one costs a fresh 3.5k-token prefill and measured slower end to end.
*
* The naming spec is this specific because a vaguer one ("describe what the
* template does, at most 40 characters") produced names that were both
* inconsistent in style and stripped of the detail that tells two similar
* templates apart.
*/
function promptNamePrompt(draft) {
	return [
		"Below is a reusable prompt template a user is saving to a file. Name it.",
		"",
		`"""\n${draft.trim().slice(0, MAX_NAME_DRAFT_CHARS).replaceAll("\"\"\"", "\" \" \"")}\n"""`,
		"",
		"Answer with the file name alone: no quotes, no explanation, no extension, no leading dot, no slashes.",
		"Write it in English however the template is written, as lower-case words joined by hyphens.",
		"Name the task the template performs, keeping whatever detail distinguishes it from a",
		"similar template. At most 6 words."
	].join("\n");
}
/**
* Rewrite the draft into something an agent can act on, with the draft fenced
* as data for the same reason the naming prompt fences it.
*
* The rule about people and places is not politeness. Asked to rewrite
* "后端 assign 给我", the model reached into Claude Code's ambient system
* prompt and substituted the operator's actual email address — inventing a
* detail the original never carried, and putting a personal address into a
* message the user had not written it into. Naming the failure explicitly is
* what stopped it; stripping the ambient context with `--system-prompt` also
* stopped it but cost a fresh prefill and produced looser rewrites.
*/
function promptRefinePrompt(draft) {
	return [
		"Below is a prompt a user is about to send to a coding agent. Rewrite it so the agent can act on it without coming back with questions.",
		"",
		`"""\n${draft.trim().slice(0, MAX_REFINE_DRAFT_CHARS).replaceAll("\"\"\"", "\" \" \"")}\n"""`,
		"",
		"Keep the intent and every concrete detail exactly as given — names, paths, branches, identifiers, numbers.",
		"Leave every reference to a person or place as the original wrote it (\"me\", \"我\", \"the usual branch\");",
		"you do not know who or what they resolve to, and guessing puts a wrong name in the user's message.",
		"Do not invent requirements the original does not imply, do not answer the prompt, do not add a preamble or sign-off.",
		"Write the rewrite in the same language the original is written in.",
		"Reply with the rewritten prompt alone."
	].join("\n");
}
/** One turn, no tools, no MCP: neither of these tasks needs them, and both
*  cost seconds of cold start. Variadic `--tools` stays last. */
function promptAssistArguments() {
	return [
		"-p",
		"--output-format",
		"text",
		"--model",
		"haiku",
		"--strict-mcp-config",
		"--mcp-config",
		"{\"mcpServers\":{}}",
		"--tools",
		""
	];
}
/** The rewrite in a model reply, or undefined when the reply is unusable.
*
*  A model told to answer with the text alone still sometimes wraps it in a
*  markdown fence, so one is peeled off; anything else is the user's to read
*  and edit, and is passed through untouched. */
function refinedPrompt(output) {
	const trimmed = output.trim();
	const text = (/^```[^\n]*\n([\s\S]*?)\n?```$/u.exec(trimmed)?.[1] ?? trimmed).trim();
	return text.length === 0 || Buffer.byteLength(text) > MAX_REFINED_BYTES ? void 0 : text;
}
/**
* The usable name in a model reply, or undefined when there is none.
*
* A one-line answer is what the prompt asks for and usually what comes back,
* but "usually" is not a contract: the reply is scrubbed to what a file name
* may hold and then held to the same {@link PROMPT_NAME} guard the write path
* uses, so a chatty or malformed answer is dropped rather than offered.
*/
function suggestedName(output) {
	const scrubbed = wordBounded((output.split("\n").map((text) => text.trim()).find((text) => text.length > 0) ?? "").replace(/^["'`]+|["'`]+$/gu, "").replace(/\.md$/iu, "").replace(/[^\p{L}\p{M}\p{N} ._()\[\]-]/gu, " ").replace(/\s+/gu, " ").trim());
	return PROMPT_NAME.test(scrubbed) ? scrubbed : void 0;
}
/** Cut a long name at its last word boundary. A name the user has to repair
*  ("analyze-frontend-backend-create-jira-tic") is worse than a shorter one. */
function wordBounded(name) {
	if (name.length <= MAX_SUGGESTED_NAME_CHARS) return name;
	const cut = name.slice(0, MAX_SUGGESTED_NAME_CHARS);
	const boundary = cut.search(/[\s\-_][^\s\-_]*$/u);
	return (boundary > 0 ? cut.slice(0, boundary) : cut).trim();
}
/** Runs Claude Code's cheapest model over the draft: names it, or rewrites it. */
var PromptAssistService = class {
	#runtime;
	#executablePath;
	constructor(runtime, executablePath) {
		this.#runtime = runtime;
		this.#executablePath = executablePath;
	}
	/** One bounded, tool-less turn; undefined whenever it cannot be had. */
	async #ask(prompt, maxOutputBytes, signal) {
		const executablePath = this.#executablePath();
		if (executablePath.length === 0) return void 0;
		const timeout = AbortSignal.timeout(ASSIST_TIMEOUT_MS);
		try {
			const handle = this.#runtime.spawn({
				argv: [executablePath, ...promptAssistArguments()],
				cwd: homedir(),
				stdio: {
					stdin: { data: prompt },
					stdout: { maxBytes: maxOutputBytes },
					stderr: { maxBytes: MAX_NAME_OUTPUT_BYTES }
				},
				graceMs: 1e3,
				signal: signal === void 0 ? timeout : AbortSignal.any([signal, timeout]),
				env: { MAX_THINKING_TOKENS: "0" }
			});
			if ((await handle.done).exitCode !== 0) return void 0;
			return handle.collected.stdout?.readFrom(0).text ?? "";
		} catch {
			return;
		}
	}
	/** The suggested file name, or undefined whenever one cannot be had. The
	*  caller already has a name derived locally, so every failure here is a
	*  non-event: nothing is reported, and nothing is retried. */
	async suggest(draft, signal) {
		if (draft.trim().length === 0) return void 0;
		const output = await this.#ask(promptNamePrompt(draft), MAX_NAME_OUTPUT_BYTES, signal);
		return output === void 0 ? void 0 : suggestedName(output);
	}
	/** The rewritten draft, or undefined when the rewrite could not be had.
	*  Unlike naming, this failure is worth reporting: the user asked for it and
	*  is waiting on it. */
	async refine(draft, signal) {
		if (draft.trim().length === 0) return void 0;
		const output = await this.#ask(promptRefinePrompt(draft), MAX_REFINED_BYTES, signal);
		return output === void 0 ? void 0 : refinedPrompt(output);
	}
};
/** List the user's prompt snippets, save the composer draft as a new one, or
*  delete one by `?name=`. */
function registerClaudePromptsRoute(ctx, directory = claudePromptsDir()) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_PROMPTS_PATH,
		methods: [
			"GET",
			"POST",
			"DELETE"
		],
		budget: "fast",
		handler: async (io) => {
			if (io.method === "GET") return {
				status: 200,
				value: { prompts: await readClaudePrompts(directory) }
			};
			if (io.method === "DELETE") try {
				await deleteClaudePrompt(directory, io.url.searchParams.get("name") ?? void 0);
				return {
					status: 200,
					value: { deleted: true }
				};
			} catch (error) {
				if (error instanceof ClaudePromptWriteError) return {
					status: error.code === "not-found" ? 404 : 400,
					value: {
						error: error.code,
						message: error.message
					}
				};
				return {
					status: 500,
					value: {
						error: "prompt-delete-failed",
						message: "The prompt could not be deleted."
					}
				};
			}
			const payload = await io.body(MAX_REQUEST_BYTES$1);
			try {
				return {
					status: 200,
					value: {
						saved: true,
						prompt: await writeClaudePrompt(directory, payload.name, payload.body)
					}
				};
			} catch (error) {
				if (error instanceof ClaudePromptWriteError) return {
					status: error.code === "name-taken" ? 409 : 400,
					value: {
						error: error.code,
						message: error.message
					}
				};
				return {
					status: 500,
					value: {
						error: "prompt-write-failed",
						message: "The prompt could not be saved."
					}
				};
			}
		}
	});
}
/** Suggest a file name for a draft. Answers `{}` when no name could be had:
*  the caller keeps the name it derived locally, so this is never an error. */
function registerClaudePromptNameRoute(ctx, service) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_PROMPT_NAME_PATH,
		methods: ["POST"],
		budget: "git",
		handler: async (io) => {
			const payload = await io.body(MAX_REQUEST_BYTES$1);
			const draft = typeof payload.draft === "string" ? payload.draft : "";
			const name = await service.suggest(draft, io.signal);
			return {
				status: 200,
				value: name === void 0 ? {} : { name }
			};
		}
	});
}
/** Rewrite a draft into something an agent can act on. */
function registerClaudePromptRefineRoute(ctx, service) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_PROMPT_REFINE_PATH,
		methods: ["POST"],
		budget: "git",
		handler: async (io) => {
			const payload = await io.body(MAX_REQUEST_BYTES$1);
			const draft = typeof payload.draft === "string" ? payload.draft : "";
			if (draft.trim().length === 0) return {
				status: 400,
				value: {
					error: "empty-draft",
					message: "There is nothing to rewrite."
				}
			};
			const text = await service.refine(draft, io.signal);
			return text === void 0 ? {
				status: 503,
				value: {
					error: "refine-unavailable",
					message: "Claude could not rewrite the prompt."
				}
			} : {
				status: 200,
				value: { text }
			};
		}
	});
}
//#endregion
//#region src/github-url.ts
/** Only GitHub's own image hosts; the browser loads these directly, so a URL
*  the API did not vouch for must never become an outbound request. */
function githubAvatarUrl(value) {
	if (typeof value !== "string" || value.length === 0 || value.length > 1024) return void 0;
	try {
		const url = new URL(value);
		const allowed = url.hostname === "github.com" || url.hostname === "githubusercontent.com" || url.hostname.endsWith(".githubusercontent.com");
		return url.protocol === "https:" && allowed ? url.href : void 0;
	} catch {
		return;
	}
}
//#endregion
//#region src/pr-feedback.ts
const MAX_OUTPUT_BYTES = 524288;
const GIT_TIMEOUT_MS = 1e4;
const GH_TIMEOUT_MS = 6e4;
const MAX_COMMENTS = 100;
const MAX_THREADS = 100;
const MAX_MENTIONABLE_USERS = 20;
const MAX_REPLY_CHARS$1 = 2e3;
const MAX_COMMENT_CHARS = 4096;
const MAX_FAILING_CHECKS = 3;
const MAX_LOG_CHARS = 8192;
var PullRequestFeedbackError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "PullRequestFeedbackError";
		this.code = code;
	}
};
/** Threads carry the anchor; comments carry the prose. `isOutdated` marks a
*  thread whose lines the branch has since moved past. */
const REVIEW_THREADS_QUERY = `query($owner:String!,$name:String!,$number:Int!){
  repository(owner:$owner,name:$name){
    pullRequest(number:$number){
      reviewThreads(first:100){
        nodes{
          id isResolved isOutdated path line originalLine diffSide
          comments(first:50){ nodes{ databaseId body url createdAt author{ __typename login avatarUrl } } }
        }
      }
    }
  }
}`;
const RESOLVE_MUTATION = `mutation($threadId:ID!){
  resolveReviewThread(input:{threadId:$threadId}){ thread{ isResolved } }
}`;
const UNRESOLVE_MUTATION = `mutation($threadId:ID!){
  unresolveReviewThread(input:{threadId:$threadId}){ thread{ isResolved } }
}`;
const MENTIONABLE_USERS_QUERY = `query($owner:String!,$name:String!,$q:String!){
  repository(owner:$owner,name:$name){
    mentionableUsers(first:20,query:$q){ nodes{ login avatarUrl } }
  }
}`;
async function collect(handle) {
	const outcome = await handle.done;
	const stdout = handle.collected.stdout?.readFrom(0);
	return {
		exitCode: outcome.exitCode,
		stdout: stdout?.text ?? "",
		lossy: stdout?.lossy === true
	};
}
function record$10(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
/** Read `repository.pullRequest.reviewThreads.nodes` out of a GraphQL response.
*  A payload carrying `errors` instead of data yields nothing rather than
*  throwing: the caller distinguishes "no threads" from "call failed" by the
*  process exit code. */
function parseReviewThreads(value) {
	const nodes = record$10(record$10(record$10(record$10(record$10(value)?.data)?.repository)?.pullRequest)?.reviewThreads)?.nodes;
	if (!Array.isArray(nodes)) return [];
	const threads = [];
	let total = 0;
	for (const item of nodes) {
		const input = record$10(item);
		if (input === void 0 || typeof input.id !== "string" || input.id.length === 0) continue;
		const path = typeof input.path === "string" ? input.path : "";
		if (path.length === 0) continue;
		const line = Number.isSafeInteger(input.line) ? Number(input.line) : Number.isSafeInteger(input.originalLine) ? Number(input.originalLine) : void 0;
		const side = input.diffSide === "LEFT" ? "old" : "new";
		const anchor = {
			path,
			...line === void 0 ? {} : { line },
			side
		};
		const comments = [];
		const commentNodes = record$10(input.comments)?.nodes;
		for (const node of Array.isArray(commentNodes) ? commentNodes : []) {
			if (total >= MAX_COMMENTS) break;
			const comment = record$10(node);
			if (comment === void 0 || !Number.isSafeInteger(comment.databaseId)) continue;
			const body = typeof comment.body === "string" ? comment.body.trim() : "";
			if (body.length === 0) continue;
			const author = record$10(comment.author);
			const avatarUrl = githubAvatarUrl(author?.avatarUrl);
			const login = typeof author?.login === "string" ? author.login : "unknown";
			comments.push({
				id: Number(comment.databaseId),
				...anchor,
				author: login,
				...author?.__typename === "Bot" || login.endsWith("[bot]") ? { bot: true } : {},
				...avatarUrl === void 0 ? {} : { avatarUrl },
				body: body.slice(0, MAX_COMMENT_CHARS),
				url: typeof comment.url === "string" ? comment.url : "",
				...typeof comment.createdAt === "string" ? { createdAt: comment.createdAt } : {}
			});
			total += 1;
		}
		if (comments.length === 0) continue;
		threads.push({
			id: input.id,
			...anchor,
			resolved: input.isResolved === true,
			outdated: input.isOutdated === true,
			comments
		});
		if (threads.length >= MAX_THREADS || total >= MAX_COMMENTS) break;
	}
	return threads;
}
/** One posted reply, shaped like the thread comments it joins. */
function parseReplyComment(value, anchor) {
	const input = record$10(value);
	if (input === void 0 || !Number.isSafeInteger(input.id)) return void 0;
	const body = typeof input.body === "string" ? input.body.trim() : "";
	if (body.length === 0) return void 0;
	const user = record$10(input.user);
	const avatarUrl = githubAvatarUrl(user?.avatar_url);
	const login = typeof user?.login === "string" ? user.login : "unknown";
	return {
		id: Number(input.id),
		...anchor,
		author: login,
		...user?.type === "Bot" || login.endsWith("[bot]") ? { bot: true } : {},
		...avatarUrl === void 0 ? {} : { avatarUrl },
		body: body.slice(0, MAX_COMMENT_CHARS),
		url: typeof input.html_url === "string" ? input.html_url : "",
		...typeof input.created_at === "string" ? { createdAt: input.created_at } : {}
	};
}
function parseMentionableUsers(value) {
	const nodes = record$10(record$10(record$10(record$10(value)?.data)?.repository)?.mentionableUsers)?.nodes;
	if (!Array.isArray(nodes)) return [];
	const users = [];
	for (const item of nodes) {
		const input = record$10(item);
		if (input === void 0 || typeof input.login !== "string" || input.login.length === 0) continue;
		const avatarUrl = githubAvatarUrl(input.avatarUrl);
		users.push({
			login: input.login,
			...avatarUrl === void 0 ? {} : { avatarUrl }
		});
		if (users.length >= MAX_MENTIONABLE_USERS) break;
	}
	return users;
}
/** Extract the Actions job id from a check run link, when it is one. */
function actionsJobId(link) {
	if (link === void 0) return void 0;
	return /\/actions\/runs\/\d+\/jobs?\/(\d+)/u.exec(link)?.[1];
}
function parseFailingChecks(value) {
	if (!Array.isArray(value)) return [];
	const failing = [];
	for (const item of value) {
		const input = record$10(item);
		if (input === void 0 || input.bucket !== "fail" || typeof input.name !== "string") continue;
		failing.push({
			name: input.name,
			...typeof input.link === "string" && input.link.length > 0 ? { link: input.link } : {},
			...typeof input.description === "string" && input.description.length > 0 ? { description: input.description } : {}
		});
	}
	return failing;
}
/** Keep the informative end of a failed-job log within the size budget. */
function boundedLogTail(value) {
	const text = value.replaceAll("\0", "").trimEnd();
	return text.length <= MAX_LOG_CHARS ? text : text.slice(text.length - MAX_LOG_CHARS);
}
var PullRequestFeedbackService = class {
	#runtime;
	#gitExecutable;
	#ghExecutable;
	constructor(runtime) {
		this.#runtime = runtime;
	}
	async threads(cwd, pullNumber) {
		const { owner, name } = await this.#repositoryParts(cwd);
		const gh = await this.#gh();
		const result = await this.#run(gh, [
			"api",
			"graphql",
			"-f",
			`owner=${owner}`,
			"-f",
			`name=${name}`,
			"-F",
			`number=${pullNumber}`,
			"-f",
			`query=${REVIEW_THREADS_QUERY}`
		], cwd, GH_TIMEOUT_MS);
		if (result.exitCode !== 0) throw new PullRequestFeedbackError("comments-unavailable", "Pull request comments could not be loaded.");
		try {
			return parseReviewThreads(JSON.parse(result.stdout));
		} catch {
			throw new PullRequestFeedbackError("comments-unavailable", "Pull request comments could not be parsed.");
		}
	}
	/** Post a reply into the thread the given comment belongs to. GitHub parses
	*  `@login` in the body server-side, so mentions need nothing from us. */
	async reply(cwd, pullNumber, commentId, body) {
		const text = body.trim();
		if (text.length === 0 || text.length > MAX_REPLY_CHARS$1) throw new PullRequestFeedbackError("invalid-request", "The reply body is invalid.");
		const repository = await this.#repository(cwd);
		const gh = await this.#gh();
		const result = await this.#run(gh, [
			"api",
			"-X",
			"POST",
			`repos/${repository}/pulls/${pullNumber}/comments/${commentId}/replies`,
			"--input",
			"-"
		], cwd, GH_TIMEOUT_MS, JSON.stringify({ body: text }));
		if (result.exitCode !== 0) throw new PullRequestFeedbackError("reply-failed", "The reply could not be posted.");
		let posted;
		try {
			const parsed = JSON.parse(result.stdout);
			const path = typeof record$10(parsed)?.path === "string" ? String(record$10(parsed)?.path) : "";
			const line = Number.isSafeInteger(record$10(parsed)?.line) ? Number(record$10(parsed)?.line) : void 0;
			posted = parseReplyComment(parsed, {
				path,
				...line === void 0 ? {} : { line },
				side: record$10(parsed)?.side === "LEFT" ? "old" : "new"
			});
		} catch {
			posted = void 0;
		}
		if (posted === void 0) throw new PullRequestFeedbackError("reply-failed", "The posted reply could not be read back.");
		return posted;
	}
	/** Resolve or reopen a thread. Returns the state GitHub reports afterwards. */
	async setResolved(cwd, threadId, resolved) {
		const gh = await this.#gh();
		const result = await this.#run(gh, [
			"api",
			"graphql",
			"-f",
			`threadId=${threadId}`,
			"-f",
			`query=${resolved ? RESOLVE_MUTATION : UNRESOLVE_MUTATION}`
		], cwd, GH_TIMEOUT_MS);
		if (result.exitCode !== 0) throw new PullRequestFeedbackError("resolve-failed", "The thread could not be updated.");
		try {
			const thread = record$10(record$10(record$10(record$10(JSON.parse(result.stdout))?.data)?.[resolved ? "resolveReviewThread" : "unresolveReviewThread"])?.thread);
			if (typeof thread?.isResolved !== "boolean") throw new Error("missing state");
			return thread.isResolved;
		} catch {
			throw new PullRequestFeedbackError("resolve-failed", "The thread state could not be read back.");
		}
	}
	/** Logins GitHub would notify from this repository, for the reply composer. */
	async mentionables(cwd, query) {
		const { owner, name } = await this.#repositoryParts(cwd);
		const gh = await this.#gh();
		const result = await this.#run(gh, [
			"api",
			"graphql",
			"-f",
			`owner=${owner}`,
			"-f",
			`name=${name}`,
			"-f",
			`q=${query}`,
			"-f",
			`query=${MENTIONABLE_USERS_QUERY}`
		], cwd, GH_TIMEOUT_MS);
		if (result.exitCode !== 0) return [];
		try {
			return parseMentionableUsers(JSON.parse(result.stdout));
		} catch {
			return [];
		}
	}
	/** `signal` bounds the log fetches below: each is capped on its own, but they
	*  run one after another, so the honest worst case is their sum rather than
	*  any single ceiling — more than a route is allowed to hold a connection. */
	async failingChecks(cwd, pullNumber, signal) {
		const gh = await this.#gh();
		const result = await this.#run(gh, [
			"pr",
			"checks",
			String(pullNumber),
			"--json",
			"name,state,link,description,bucket"
		], cwd, GH_TIMEOUT_MS);
		let checks;
		try {
			checks = parseFailingChecks(JSON.parse(result.stdout));
		} catch {
			throw new PullRequestFeedbackError("checks-unavailable", "Pull request checks could not be loaded.");
		}
		const detailed = [];
		for (const check of checks) {
			const jobId = detailed.length < MAX_FAILING_CHECKS ? actionsJobId(check.link) : void 0;
			if (jobId === void 0) {
				detailed.push(check);
				continue;
			}
			if (signal?.aborted === true) {
				detailed.push(check);
				continue;
			}
			const log = await this.#run(gh, [
				"run",
				"view",
				"--job",
				jobId,
				"--log-failed"
			], cwd, GH_TIMEOUT_MS);
			detailed.push(log.exitCode === 0 && log.stdout.trim().length > 0 ? {
				...check,
				log: boundedLogTail(log.stdout)
			} : check);
		}
		return detailed;
	}
	async #repository(cwd) {
		const git = await this.#git();
		const remote = await this.#run(git, [
			"remote",
			"get-url",
			"origin"
		], cwd, GIT_TIMEOUT_MS);
		const repository = remote.exitCode === 0 ? parseGitHubRemote(remote.stdout) : void 0;
		if (repository === void 0) throw new PullRequestFeedbackError("no-github-remote", "The repository has no GitHub origin remote.");
		return repository;
	}
	/** GraphQL takes the owner and the name as separate variables, so they never
	*  reach the query text itself. */
	async #repositoryParts(cwd) {
		const [owner, name] = (await this.#repository(cwd)).split("/");
		if (owner === void 0 || name === void 0 || owner.length === 0 || name.length === 0) throw new PullRequestFeedbackError("no-github-remote", "The repository has no GitHub origin remote.");
		return {
			owner,
			name
		};
	}
	#git() {
		this.#gitExecutable ??= this.#runtime.resolveExecutable("git", toolPathEnv());
		return this.#gitExecutable;
	}
	#gh() {
		this.#ghExecutable ??= this.#runtime.resolveExecutable("gh", toolPathEnv()).catch(() => {
			throw new PullRequestFeedbackError("gh-unavailable", "GitHub CLI is unavailable.");
		});
		return this.#ghExecutable;
	}
	#run(executable, args, cwd, timeoutMs, input) {
		const handle = this.#runtime.spawn({
			argv: [executable, ...args],
			cwd,
			stdio: {
				stdin: input === void 0 ? "ignore" : "pipe",
				stdout: { maxBytes: MAX_OUTPUT_BYTES },
				stderr: { maxBytes: 65536 }
			},
			graceMs: 1e3,
			signal: AbortSignal.timeout(timeoutMs),
			env: {}
		});
		if (input !== void 0) handle.stdin?.end(input);
		return collect(handle);
	}
};
//#endregion
//#region src/pr-feedback-routes.ts
const MAX_SESSION_ID_CHARS$5 = 1024;
const MAX_BODY_BYTES$7 = 16384;
const MAX_REPLY_CHARS = 2e3;
const MAX_THREAD_ID_CHARS = 512;
const MAX_MENTION_QUERY_CHARS = 64;
function record$9(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
async function readJson$6(io) {
	let parsed;
	try {
		parsed = await io.body(MAX_BODY_BYTES$7);
	} catch (error) {
		if (error instanceof SyntaxError) throw error;
		throw new PullRequestFeedbackError("body-too-large", "The request body is too large.");
	}
	const value = record$9(parsed);
	if (value === void 0) throw new PullRequestFeedbackError("invalid-request", "The request body is invalid.");
	return value;
}
function replyBody(input) {
	const body = typeof input.body === "string" ? input.body.trim() : "";
	if (body.length === 0 || body.length > MAX_REPLY_CHARS || body.includes("\0")) throw new PullRequestFeedbackError("invalid-request", "The reply body is invalid.");
	return body;
}
function commentId(input) {
	const value = input.commentId;
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new PullRequestFeedbackError("invalid-request", "The comment id is invalid.");
	return value;
}
function threadId(input) {
	const value = input.threadId;
	if (typeof value !== "string" || value.length === 0 || value.length > MAX_THREAD_ID_CHARS) throw new PullRequestFeedbackError("invalid-request", "The thread id is invalid.");
	return value;
}
function sessionId(url) {
	const value = url.searchParams.get("sessionId");
	if (value === null || value.length === 0 || value.length > MAX_SESSION_ID_CHARS$5) throw new PullRequestFeedbackError("invalid-session", "The session is invalid.");
	return value;
}
function pullNumber(url) {
	const value = Number(url.searchParams.get("number"));
	if (!Number.isSafeInteger(value) || value <= 0 || value > 1e9) throw new PullRequestFeedbackError("invalid-request", "The pull request number is invalid.");
	return value;
}
/** Every arm shells out to `gh`, so the whole prefix carries the network budget. */
function registerPullRequestFeedbackRoute(ctx, service, cwdForSession) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "prefix",
		path: CLAUDE_REPOSITORY_FEEDBACK_PATH,
		methods: ["GET", "POST"],
		budget: "remote",
		handler: async (io) => {
			const url = io.url;
			const reads = io.method === "GET";
			const writes = io.method === "POST";
			try {
				const cwd = cwdForSession(sessionId(url), url.searchParams.get("root") ?? void 0);
				if (cwd === void 0) throw new PullRequestFeedbackError("session-unavailable", "The Claude session is unavailable.");
				if (url.pathname === `/plugins/dsh-claude/repository/feedback/comments`) {
					if (!reads) return {
						status: 405,
						value: { error: "method not allowed" }
					};
					return {
						status: 200,
						value: { threads: await service.threads(cwd, pullNumber(url)) }
					};
				}
				if (url.pathname === `/plugins/dsh-claude/repository/feedback/checks`) {
					if (!reads) return {
						status: 405,
						value: { error: "method not allowed" }
					};
					return {
						status: 200,
						value: { checks: await service.failingChecks(cwd, pullNumber(url), io.signal) }
					};
				}
				if (url.pathname === `/plugins/dsh-claude/repository/feedback/mentionables`) {
					if (!reads) return {
						status: 405,
						value: { error: "method not allowed" }
					};
					const query = (url.searchParams.get("q") ?? "").slice(0, MAX_MENTION_QUERY_CHARS);
					return {
						status: 200,
						value: { users: await service.mentionables(cwd, query) }
					};
				}
				if (url.pathname === `/plugins/dsh-claude/repository/feedback/reply`) {
					if (!writes) return {
						status: 405,
						value: { error: "method not allowed" }
					};
					const input = await readJson$6(io);
					return {
						status: 200,
						value: { comment: await service.reply(cwd, pullNumber(url), commentId(input), replyBody(input)) }
					};
				}
				if (url.pathname === `/plugins/dsh-claude/repository/feedback/resolve`) {
					if (!writes) return {
						status: 405,
						value: { error: "method not allowed" }
					};
					const input = await readJson$6(io);
					if (typeof input.resolved !== "boolean") throw new PullRequestFeedbackError("invalid-request", "The resolved field is required.");
					return {
						status: 200,
						value: { resolved: await service.setResolved(cwd, threadId(input), input.resolved) }
					};
				}
				return {
					status: 404,
					value: { error: "not found" }
				};
			} catch (error) {
				if (error instanceof PullRequestFeedbackError) return {
					status: 409,
					value: {
						error: error.code,
						message: error.message
					}
				};
				if (error instanceof SyntaxError) return {
					status: 400,
					value: { error: "invalid-json" }
				};
				return {
					status: 500,
					value: {
						error: "pr-feedback-unavailable",
						message: "Pull request feedback is unavailable."
					}
				};
			}
		}
	});
}
//#endregion
//#region src/repository-file-routes.ts
const MAX_PATH_CHARS = 4096;
/** Read-only slice of a working-tree file so the diff panel can expand unmodified lines around hunks. */
function registerRepositoryFileRoute(ctx, service) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_REPOSITORY_FILE_PATH,
		methods: ["GET"],
		budget: "git",
		handler: async (io) => {
			const params = io.url.searchParams;
			const cwd = params.get("cwd");
			const path = params.get("path");
			const from = Number(params.get("from"));
			const to = Number(params.get("to"));
			if (cwd === null || cwd.length === 0 || cwd.length > MAX_PATH_CHARS || !isAbsolute(cwd) || cwd.includes("\0")) return {
				status: 400,
				value: {
					error: "invalid-request",
					message: "The cwd query parameter is invalid."
				}
			};
			if (path === null || path.length === 0 || path.length > MAX_PATH_CHARS) return {
				status: 400,
				value: {
					error: "invalid-request",
					message: "The path query parameter is invalid."
				}
			};
			try {
				return {
					status: 200,
					value: await service.fileLines(cwd, path, from, to)
				};
			} catch (error) {
				if (error instanceof RepositoryFileError) return {
					status: error.code === "invalid-request" ? 400 : 409,
					value: {
						error: error.code,
						message: error.message
					}
				};
				return {
					status: 500,
					value: {
						error: "repository-file-unavailable",
						message: "The file could not be read."
					}
				};
			}
		}
	});
}
//#endregion
//#region src/jira.ts
const REQUEST_TIMEOUT_MS = 15e3;
const MAX_RESULTS = 20;
const MAX_QUERY_CHARS = 200;
const MAX_STORE_BYTES = 65536;
var JiraError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "JiraError";
		this.code = code;
	}
};
function record$8(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
/** Jira Cloud sites are origins; Data Center may carry a context path. */
function normalizeSiteUrl(value) {
	let url;
	try {
		url = new URL(value.trim());
	} catch {
		throw new JiraError("invalid-site", "The Jira site URL is invalid.");
	}
	if (url.protocol !== "https:") throw new JiraError("invalid-site", "The Jira site URL must use https.");
	return `${url.origin}${url.pathname.replace(/\/+$/u, "")}`;
}
function ticketKeyOf(query) {
	const match = /^([A-Za-z][A-Za-z0-9_]*)-(\d+)$/u.exec(query.trim());
	return match === null ? void 0 : `${match[1].toUpperCase()}-${match[2]}`;
}
/** Jira's text index carries summary, description and comments -- never the
*  issue key -- so a bare ticket number ("5697") can never reach PSOS-5697
*  through `text ~`. The issue picker is the endpoint behind Jira's own quick
*  search and does match keys; its hits become the key filter the normal
*  search then reads the display fields from. */
function pickerKeys(value, number) {
	const sections = record$8(value)?.sections;
	if (!Array.isArray(sections)) return [];
	const keys = [];
	for (const section of sections) {
		const issues = record$8(section)?.issues;
		if (!Array.isArray(issues)) continue;
		for (const issue of issues) {
			const raw = record$8(issue)?.key;
			const key = ticketKeyOf(typeof raw === "string" ? raw : "");
			if (key !== void 0 && key.endsWith(`-${number}`) && !keys.includes(key)) keys.push(key);
		}
	}
	return keys;
}
/** Keys arrive validated by `ticketKeyOf`, so they cannot break out of the quotes. */
function keyJql(keys) {
	return `key in (${keys.map((key) => `"${key}"`).join(", ")}) ORDER BY updated DESC`;
}
function buildJql(query) {
	const trimmed = query.trim().slice(0, MAX_QUERY_CHARS);
	if (trimmed.length === 0) return "statusCategory != Done ORDER BY updated DESC";
	const key = ticketKeyOf(trimmed);
	if (key !== void 0) return `key = "${key}"`;
	return `text ~ "${trimmed.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}*" ORDER BY updated DESC`;
}
function parseTickets(value, siteUrl) {
	const issues = record$8(value)?.issues;
	if (!Array.isArray(issues)) return [];
	const tickets = [];
	for (const item of issues) {
		const issue = record$8(item);
		const fields = record$8(issue?.fields);
		if (issue === void 0 || typeof issue.key !== "string" || fields === void 0) continue;
		const status = record$8(fields.status)?.name;
		const type = record$8(fields.issuetype)?.name;
		tickets.push({
			key: issue.key,
			summary: typeof fields.summary === "string" ? fields.summary.slice(0, 256) : "",
			url: `${siteUrl}/browse/${issue.key}`,
			...typeof status === "string" ? { status } : {},
			...typeof type === "string" ? { type } : {}
		});
		if (tickets.length >= MAX_RESULTS) break;
	}
	return tickets;
}
function statusOf(store) {
	if (store === void 0) return { connected: false };
	return {
		connected: true,
		siteUrl: store.siteUrl,
		email: store.email,
		...store.displayName === void 0 ? {} : { displayName: store.displayName }
	};
}
/** Jira Cloud access through the user's API token (Basic auth). */
var JiraService = class {
	#storePath;
	#fetch;
	constructor(options = {}) {
		this.#storePath = options.storePath ?? dshHomePath("plugins", "dsh-claude", "jira.json");
		this.#fetch = options.fetch ?? globalThis.fetch;
	}
	async status() {
		return statusOf(await this.#read());
	}
	async connect(input) {
		const siteUrl = normalizeSiteUrl(input.siteUrl);
		const email = input.email.trim();
		const apiToken = input.apiToken.trim();
		if (email.length === 0 || email.length > 320 || apiToken.length === 0 || apiToken.length > 4096) throw new JiraError("invalid-credentials", "An account email and API token are required.");
		const connection = {
			siteUrl,
			email,
			apiToken
		};
		const myself = record$8(await this.#json(connection, "/rest/api/3/myself"));
		const displayName = typeof myself?.displayName === "string" ? myself.displayName : void 0;
		const accountId = typeof myself?.accountId === "string" ? myself.accountId : void 0;
		const store = {
			...connection,
			...displayName === void 0 ? {} : { displayName },
			...accountId === void 0 ? {} : { accountId }
		};
		await this.#write(store);
		return statusOf(store);
	}
	/** Assign a ticket to the connected account (used once a ticket's worktree exists). */
	async assignToMe(key) {
		const store = await this.#read();
		if (store === void 0) throw new JiraError("not-connected", "Connect Jira in Settings first.");
		const ticket = ticketKeyOf(key);
		if (ticket === void 0) throw new JiraError("invalid-request", "The ticket key is invalid.");
		let accountId = store.accountId;
		if (accountId === void 0) {
			const myself = record$8(await this.#json(store, "/rest/api/3/myself"));
			if (typeof myself?.accountId !== "string") throw new JiraError("jira-failed", "The Jira account id is unavailable.");
			accountId = myself.accountId;
			await this.#write({
				...store,
				accountId
			});
		}
		await this.#json(store, `/rest/api/3/issue/${ticket}/assignee`, {
			method: "PUT",
			body: { accountId }
		});
	}
	async disconnect() {
		await rm(this.#storePath, { force: true });
	}
	async search(query) {
		const store = await this.#read();
		if (store === void 0) throw new JiraError("not-connected", "Connect Jira in Settings first.");
		const params = new URLSearchParams({
			jql: await this.#searchJql(store, query.trim().slice(0, MAX_QUERY_CHARS)),
			maxResults: String(MAX_RESULTS),
			fields: "summary,status,issuetype"
		});
		let body;
		try {
			body = await this.#json(store, `/rest/api/3/search/jql?${params.toString()}`);
		} catch (error) {
			if (!(error instanceof JiraError && error.code === "not-found")) throw error;
			body = await this.#json(store, `/rest/api/3/search?${params.toString()}`);
		}
		return parseTickets(body, store.siteUrl);
	}
	/** A bare ticket number resolves through the picker; everything else is JQL.
	*  A site that cannot serve the picker falls back to the text search rather
	*  than failing the whole lookup. */
	async #searchJql(store, query) {
		if (!/^\d+$/u.test(query)) return buildJql(query);
		const keys = await this.#json(store, `/rest/api/3/issue/picker?query=${encodeURIComponent(query)}`).then((body) => pickerKeys(body, query), () => []);
		return keys.length === 0 ? buildJql(query) : keyJql(keys);
	}
	async #json(connection, path, init = {}) {
		let response;
		try {
			response = await this.#fetch(`${connection.siteUrl}${path}`, {
				method: init.method ?? "GET",
				headers: {
					accept: "application/json",
					authorization: `Basic ${Buffer.from(`${connection.email}:${connection.apiToken}`).toString("base64")}`,
					...init.body === void 0 ? {} : { "content-type": "application/json" }
				},
				...init.body === void 0 ? {} : { body: JSON.stringify(init.body) },
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
		} catch {
			throw new JiraError("unreachable", "The Jira site could not be reached.");
		}
		if (response.status === 401 || response.status === 403) throw new JiraError("unauthorized", "Jira rejected the credentials.");
		if (response.status === 404) throw new JiraError("not-found", "The Jira endpoint was not found.");
		if (!response.ok) throw new JiraError("jira-failed", `Jira responded with HTTP ${response.status}.`);
		if (response.status === 204) return void 0;
		try {
			return await response.json();
		} catch {
			throw new JiraError("jira-failed", "Jira returned an invalid response.");
		}
	}
	async #read() {
		let text;
		try {
			text = await readFile(this.#storePath, "utf8");
		} catch (error) {
			if (error.code === "ENOENT") return void 0;
			throw error;
		}
		if (Buffer.byteLength(text) > MAX_STORE_BYTES) return void 0;
		const input = record$8(JSON.parse(text));
		if (input === void 0 || typeof input.siteUrl !== "string" || typeof input.email !== "string" || typeof input.apiToken !== "string") return void 0;
		return {
			siteUrl: input.siteUrl,
			email: input.email,
			apiToken: input.apiToken,
			...typeof input.displayName === "string" ? { displayName: input.displayName } : {},
			...typeof input.accountId === "string" ? { accountId: input.accountId } : {}
		};
	}
	async #write(store) {
		await mkdir(dirname(this.#storePath), {
			recursive: true,
			mode: 448
		});
		const temporary = `${this.#storePath}.${process.pid}.${randomUUID()}.tmp`;
		try {
			await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, {
				encoding: "utf8",
				mode: 384,
				flag: "wx"
			});
			await chmod(temporary, 384);
			await rename(temporary, this.#storePath);
		} finally {
			await rm(temporary, { force: true }).catch(() => void 0);
		}
	}
};
//#endregion
//#region src/jira-routes.ts
const MAX_BODY_BYTES$6 = 8192;
function record$7(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
/** The wrapper enforces the byte cap; its plain rejection is translated back
*  into the JiraError shape the panel already knows how to render. */
async function readJson$5(io) {
	let body;
	try {
		body = await io.body(MAX_BODY_BYTES$6);
	} catch (error) {
		if (error instanceof SyntaxError) throw error;
		throw new JiraError("body-too-large", "The request body is too large.");
	}
	const value = record$7(body);
	if (value === void 0) throw new JiraError("invalid-request", "The request body is invalid.");
	return value;
}
function string(input, key) {
	const value = input[key];
	if (typeof value !== "string") throw new JiraError("invalid-request", `The ${key} field is required.`);
	return value;
}
function registerJiraRoute(ctx, service) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "prefix",
		path: CLAUDE_JIRA_PATH,
		methods: ["GET", "POST"],
		budget: "git",
		handler: async (io) => {
			const url = io.url;
			try {
				if (url.pathname === `/plugins/dsh-claude/jira/status`) {
					if (io.method !== "GET") return {
						status: 405,
						value: { error: "method not allowed" }
					};
					return {
						status: 200,
						value: await service.status()
					};
				}
				if (url.pathname === `/plugins/dsh-claude/jira/connect`) {
					if (io.method !== "POST") return {
						status: 405,
						value: { error: "method not allowed" }
					};
					const input = await readJson$5(io);
					return {
						status: 200,
						value: await service.connect({
							siteUrl: string(input, "siteUrl"),
							email: string(input, "email"),
							apiToken: string(input, "apiToken")
						})
					};
				}
				if (url.pathname === `/plugins/dsh-claude/jira/disconnect`) {
					if (io.method !== "POST") return {
						status: 405,
						value: { error: "method not allowed" }
					};
					await service.disconnect();
					return {
						status: 200,
						value: { connected: false }
					};
				}
				if (url.pathname === `/plugins/dsh-claude/jira/assign`) {
					if (io.method !== "POST") return {
						status: 405,
						value: { error: "method not allowed" }
					};
					const input = await readJson$5(io);
					await service.assignToMe(string(input, "key"));
					return {
						status: 200,
						value: { assigned: true }
					};
				}
				if (url.pathname === `/plugins/dsh-claude/jira/search`) {
					if (io.method !== "GET") return {
						status: 405,
						value: { error: "method not allowed" }
					};
					return {
						status: 200,
						value: { tickets: await service.search(url.searchParams.get("query") ?? "") }
					};
				}
				return {
					status: 404,
					value: { error: "not found" }
				};
			} catch (error) {
				if (error instanceof JiraError) return {
					status: 409,
					value: {
						error: error.code,
						message: error.message
					}
				};
				if (error instanceof SyntaxError) return {
					status: 400,
					value: { error: "invalid-json" }
				};
				return {
					status: 500,
					value: {
						error: "jira-unavailable",
						message: "Jira is unavailable."
					}
				};
			}
		}
	});
}
//#endregion
//#region src/ask.ts
const MAX_SELECTION_CHARS = 8e3;
const MAX_CONTEXT_CHARS = 16e3;
const MAX_QUESTION_CHARS = 2e3;
const ASK_TIMEOUT_MS = 18e4;
const MAX_STDERR_BYTES = 65536;
const MAX_TOOL_SUMMARY_CHARS = 160;
const READ_ONLY_TOOLS = [
	"Read",
	"Grep",
	"Glob"
];
var AskError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "AskError";
		this.code = code;
	}
};
function fence(value) {
	return `"""\n${value.replaceAll("\"\"\"", "\" \" \"")}\n"""`;
}
function askPrompt(request) {
	const selection = request.selection.trim().slice(0, MAX_SELECTION_CHARS);
	const context = (request.context ?? "").trim().slice(0, MAX_CONTEXT_CHARS);
	const question = request.question.trim().slice(0, MAX_QUESTION_CHARS);
	return [
		"You are answering a follow-up question about part of an earlier assistant reply in this project.",
		"",
		"Selected passage:",
		fence(selection),
		...context.length === 0 || context === selection ? [] : [
			"",
			"Surrounding reply, for context only:",
			fence(context)
		],
		"",
		`Question: ${question}`,
		"",
		"Answer the question directly and concisely, in the same language as the question. Use Markdown.",
		"Only the read-only tools Read, Grep, and Glob are available; use them when the answer depends on project code, otherwise answer from the passage."
	].join("\n");
}
/** CLI effort for a session thinking mode; `off` and unknown modes send nothing. */
function effortFor(thinkingMode) {
	if (thinkingMode === void 0 || thinkingMode === "off") return void 0;
	if (thinkingMode === "ultracode") return "max";
	return [
		"low",
		"medium",
		"high",
		"max"
	].includes(thinkingMode) ? thinkingMode : void 0;
}
function askArguments(preferences) {
	const effort = effortFor(preferences.thinkingMode);
	return [
		"-p",
		"--output-format",
		"stream-json",
		"--verbose",
		"--include-partial-messages",
		"--strict-mcp-config",
		"--mcp-config",
		"{\"mcpServers\":{}}",
		...preferences.model === void 0 || preferences.model === "default" ? [] : ["--model", preferences.model],
		...effort === void 0 ? [] : ["--effort", effort],
		"--tools",
		...READ_ONLY_TOOLS,
		"--allowedTools",
		...READ_ONLY_TOOLS
	];
}
function record$6(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
/** One-line description of a tool call, mirroring the main window's step titles. */
function toolSummary(input) {
	const fields = record$6(input);
	if (fields === void 0) return void 0;
	const candidate = [
		fields.command,
		fields.pattern,
		fields.file_path,
		fields.path,
		fields.query
	].find((value) => typeof value === "string" && value.length > 0);
	return (typeof candidate === "string" ? candidate : JSON.stringify(fields)).replaceAll(/\s+/gu, " ").trim().slice(0, MAX_TOOL_SUMMARY_CHARS);
}
function eventsOfStreamLine(line) {
	let parsed;
	try {
		parsed = record$6(JSON.parse(line));
	} catch {
		return [];
	}
	if (parsed === void 0) return [];
	if (parsed.type === "system" && parsed.subtype === "init") return [{
		type: "status",
		text: "ready"
	}];
	if (parsed.type === "stream_event") {
		const event = record$6(parsed.event);
		if (event?.type === "content_block_start") {
			const block = record$6(event.content_block);
			if (block?.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") return [{
				type: "tool",
				id: block.id,
				phase: "start",
				name: block.name
			}];
			return [];
		}
		const delta = record$6(event?.delta);
		if (event?.type !== "content_block_delta" || delta === void 0) return [];
		if (delta.type === "text_delta" && typeof delta.text === "string") return [{
			type: "text",
			text: delta.text
		}];
		if (delta.type === "thinking_delta" && typeof delta.thinking === "string") return [{
			type: "thinking",
			text: delta.thinking
		}];
		return [];
	}
	if (parsed.type === "assistant" || parsed.type === "user") {
		const content = record$6(parsed.message)?.content;
		if (!Array.isArray(content)) return [];
		const events = [];
		for (const item of content) {
			const block = record$6(item);
			if (block?.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
				const summary = toolSummary(block.input);
				events.push({
					type: "tool",
					id: block.id,
					phase: "input",
					name: block.name,
					...summary === void 0 ? {} : { summary }
				});
			} else if (block?.type === "tool_result" && typeof block.tool_use_id === "string") events.push({
				type: "tool",
				id: block.tool_use_id,
				phase: "done",
				...block.is_error === true ? { error: true } : {}
			});
		}
		return events;
	}
	if (parsed.type === "result" && typeof parsed.result === "string") return [{
		type: "result",
		text: parsed.result
	}];
	return [];
}
/** One-shot Claude Code query answering a question about selected reply text. */
var AskService = class {
	#runtime;
	#executablePath;
	constructor(runtime, executablePath) {
		this.#runtime = runtime;
		this.#executablePath = executablePath;
	}
	async ask(cwd, request, preferences, onEvent, signal) {
		if (request.question.trim().length === 0 || request.selection.trim().length === 0) throw new AskError("invalid-request", "A selection and a question are required.");
		if (this.#executablePath.length === 0) throw new AskError("claude-unavailable", "Claude Code is unavailable.");
		const timeout = AbortSignal.timeout(ASK_TIMEOUT_MS);
		const handle = this.#runtime.spawn({
			argv: [this.#executablePath, ...askArguments(preferences)],
			cwd,
			stdio: {
				stdin: { data: askPrompt(request) },
				stdout: "pipe",
				stderr: { maxBytes: MAX_STDERR_BYTES }
			},
			graceMs: 1e3,
			signal: signal === void 0 ? timeout : AbortSignal.any([signal, timeout]),
			env: {}
		});
		const stdout = handle.stdout;
		if (stdout === void 0) throw new AskError("ask-failed", "Claude output is unavailable.");
		const decoder = new StringDecoder("utf8");
		let buffer = "";
		let emitted = false;
		let result;
		const consume = (line) => {
			for (const event of eventsOfStreamLine(line)) {
				if (event.type === "result") {
					result = event.text;
					continue;
				}
				if (event.type !== "tool" && event.text.length === 0) continue;
				if (event.type === "text") emitted = true;
				onEvent(event);
			}
		};
		for await (const chunk of stdout) {
			buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) if (line.trim().length > 0) consume(line);
		}
		buffer += decoder.end();
		if (buffer.trim().length > 0) consume(buffer);
		const outcome = await handle.done;
		if (!emitted && result !== void 0 && result.length > 0) {
			emitted = true;
			onEvent({
				type: "text",
				text: result
			});
		}
		if (!emitted) {
			if (signal?.aborted === true) throw new AskError("aborted", "The question was cancelled.");
			if (timeout.aborted) throw new AskError("timeout", "Claude took too long to answer.");
			const stderr = handle.collected.stderr?.readFrom(0).text.trim().split(/\r?\n/u).filter((line) => line.length > 0).at(-1);
			throw new AskError("ask-failed", stderr !== void 0 && stderr.length > 0 ? stderr : `Claude exited with code ${String(outcome.exitCode)}.`);
		}
	}
};
//#endregion
//#region src/ask-routes.ts
const MAX_BODY_BYTES$5 = 131072;
const MAX_SESSION_ID_CHARS$4 = 1024;
/** Two sessions may await an answer at once; a third evicts the oldest. */
const MAX_CONCURRENT_ASKS = 2;
function record$5(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function askRequest(input) {
	if (typeof input.selection !== "string" || typeof input.question !== "string" || input.context !== void 0 && typeof input.context !== "string") throw new AskError("invalid-request", "The selection and question fields are required.");
	return {
		selection: input.selection,
		question: input.question,
		...typeof input.context === "string" ? { context: input.context } : {}
	};
}
function ndjson(res, value) {
	res.write(`${JSON.stringify(value)}\n`);
}
/** A stream route rather than a unary one: the answer is written as it arrives,
*  so the deadline stays where the work is — `ASK_TIMEOUT_MS` inside the
*  service, fused there with the disconnect signal — instead of a route budget
*  that would cut a legitimate long answer off mid-sentence. */
function registerAskRoute(ctx, service, cwdForSession, preferencesFor) {
	registerPluginRoute(ctx, {
		mode: "stream",
		kind: "exact",
		path: CLAUDE_ASK_PATH,
		methods: ["POST"],
		maxConcurrent: MAX_CONCURRENT_ASKS,
		streamKey: (url) => url.searchParams.get("sessionId") ?? "",
		handler: async (res, io) => {
			let cwd;
			let request;
			let sessionId;
			try {
				const value = io.url.searchParams.get("sessionId");
				if (value === null || value.length === 0 || value.length > MAX_SESSION_ID_CHARS$4) throw new AskError("invalid-session", "The session is invalid.");
				sessionId = value;
				const resolved = cwdForSession(sessionId);
				if (resolved === void 0) throw new AskError("session-unavailable", "The Claude session is unavailable.");
				cwd = resolved;
				const body = record$5(await io.body(MAX_BODY_BYTES$5));
				if (body === void 0) throw new AskError("invalid-request", "The request body is invalid.");
				request = askRequest(body);
			} catch (error) {
				if (error instanceof AskError) return json(res, 409, {
					error: error.code,
					message: error.message
				});
				if (error instanceof SyntaxError) return json(res, 400, { error: "invalid-json" });
				return json(res, 500, {
					error: "ask-unavailable",
					message: "The question could not be sent."
				});
			}
			res.writeHead(200, {
				"content-type": "application/x-ndjson; charset=utf-8",
				"cache-control": "no-store",
				"x-content-type-options": "nosniff"
			});
			res.flushHeaders?.();
			try {
				await service.ask(cwd, request, preferencesFor(sessionId) ?? {}, (event) => {
					ndjson(res, event.type === "text" ? {
						type: "delta",
						text: event.text
					} : event);
				}, io.signal);
				ndjson(res, { type: "done" });
			} catch (error) {
				ndjson(res, {
					type: "error",
					code: error instanceof AskError ? error.code : "ask-unavailable",
					message: error instanceof AskError ? error.message : "The question could not be answered."
				});
			}
		}
	});
}
//#endregion
//#region src/review-comment-routes.ts
const MAX_BODY_BYTES$4 = 16384;
const MAX_SESSION_ID_CHARS$3 = 1024;
function record$4(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
async function readJson$4(io) {
	let parsed;
	try {
		parsed = await io.body(MAX_BODY_BYTES$4);
	} catch (error) {
		if (error instanceof SyntaxError) throw error;
		throw new ReviewCommentError("body-too-large", "The request body is too large.");
	}
	const value = record$4(parsed);
	if (value === void 0) throw new ReviewCommentError("invalid-request", "The request body is invalid.");
	return value;
}
function sessionIdFromUrl(url) {
	const value = url.searchParams.get("sessionId");
	if (value === null || value.length === 0 || value.length > MAX_SESSION_ID_CHARS$3) throw new ReviewCommentError("invalid-session", "The session is invalid.");
	return value;
}
function registerReviewCommentRoute(ctx, store, ownsSession) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "prefix",
		path: CLAUDE_REVIEW_COMMENT_PATH,
		methods: ["POST"],
		budget: "fast",
		handler: async (io) => {
			try {
				const sessionId = sessionIdFromUrl(io.url);
				if (!ownsSession(sessionId)) throw new ReviewCommentError("session-unavailable", "The Claude session is unavailable.");
				const pathname = io.url.pathname;
				if (pathname === "/plugins/dsh-claude/review-comments") {
					const input = await readJson$4(io);
					return {
						status: 200,
						value: { comment: store.add(sessionId, {
							path: input.path,
							line: input.line,
							startLine: input.startLine,
							side: input.side,
							text: input.text
						}) }
					};
				}
				if (pathname === `/plugins/dsh-claude/review-comments/clear`) return {
					status: 200,
					value: { removed: store.drain(sessionId).length }
				};
				if (pathname === `/plugins/dsh-claude/review-comments/remove`) {
					const input = await readJson$4(io);
					if (typeof input.id !== "string" || input.id.length === 0 || input.id.length > 128) throw new ReviewCommentError("invalid-request", "The comment id is invalid.");
					return {
						status: 200,
						value: { removed: store.remove(sessionId, input.id) }
					};
				}
				return {
					status: 404,
					value: { error: "not found" }
				};
			} catch (error) {
				if (error instanceof ReviewCommentError) return {
					status: 409,
					value: {
						error: error.code,
						message: error.message
					}
				};
				if (error instanceof SyntaxError) return {
					status: 400,
					value: { error: "invalid-json" }
				};
				return {
					status: 500,
					value: {
						error: "review-comment-unavailable",
						message: "Review comments are unavailable."
					}
				};
			}
		}
	});
}
//#endregion
//#region src/plan-feedback-routes.ts
const MAX_BODY_BYTES$3 = 65536;
const MAX_SESSION_ID_CHARS$2 = 1024;
const MAX_TOOL_USE_ID_CHARS = 256;
function record$3(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
async function readJson$3(io) {
	let parsed;
	try {
		parsed = await io.body(MAX_BODY_BYTES$3);
	} catch (error) {
		if (error instanceof SyntaxError) throw error;
		throw new PlanFeedbackError("body-too-large", "The request body is too large.");
	}
	const value = record$3(parsed);
	if (value === void 0) throw new PlanFeedbackError("invalid-request", "The request body is invalid.");
	return value;
}
/** Send one plan back for changes.
*
*  Unary rather than a stream: the panel hands over what the reviewer wrote
*  and the turn carries on in the transcript it was already watching. Answers
*  409 when nothing is waiting, which is what the panel shows if the approval
*  dialog was answered while the reviewer was still typing. */
function registerPlanFeedbackRoute(ctx, gate, ownsSession) {
	registerPluginRoute(ctx, {
		mode: "unary",
		budget: "fast",
		kind: "exact",
		path: CLAUDE_PLAN_FEEDBACK_PATH,
		methods: ["POST"],
		handler: async (io) => {
			try {
				const sessionId = io.url.searchParams.get("sessionId");
				if (sessionId === null || sessionId.length === 0 || sessionId.length > MAX_SESSION_ID_CHARS$2) return {
					status: 400,
					value: { error: "invalid-session" }
				};
				if (!ownsSession(sessionId)) return {
					status: 409,
					value: { error: "session-unavailable" }
				};
				const body = await readJson$3(io);
				const toolUseId = body.toolUseId;
				if (typeof toolUseId !== "string" || toolUseId.length === 0 || toolUseId.length > MAX_TOOL_USE_ID_CHARS) return {
					status: 400,
					value: { error: "invalid-request" }
				};
				const notes = planNotesOf(body.notes);
				if (!gate.submit(toolUseId, notes)) return {
					status: 409,
					value: { error: "plan-settled" }
				};
				return {
					status: 200,
					value: { ok: true }
				};
			} catch (error) {
				if (error instanceof PlanFeedbackError) return {
					status: 400,
					value: {
						error: error.code,
						message: error.message
					}
				};
				if (error instanceof SyntaxError) return {
					status: 400,
					value: { error: "invalid-json" }
				};
				return {
					status: 500,
					value: { error: "plan-feedback-unavailable" }
				};
			}
		}
	});
}
//#endregion
//#region src/client-diagnostics-routes.ts
/** Enough for a message plus a trimmed stack; the client caps its own volume. */
const MAX_DIAGNOSTIC_BYTES = 8192;
const MAX_DETAIL_CHARS = 2e3;
const MAX_KIND_CHARS = 60;
/** `POST <path>` with `{ kind, detail }`: write one renderer finding to the Host log.
*
*  The renderer has no other way to speak. A Slot entry that throws is caught
*  by the Host's Slot system and dropped, the shipped Desktop opens no
*  DevTools, and startup still reports `rendererStatus: "healthy"` — so a
*  plugin whose UI died silently is indistinguishable from a working one.
*  Every finding here is data written by this package's own client half, but
*  it is still bounded and redacted like any other untrusted input. */
function registerClaudeClientDiagnosticsRoute(ctx) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_CLIENT_DIAGNOSTICS_PATH,
		methods: ["POST"],
		budget: "fast",
		handler: async (io) => {
			try {
				const body = await io.body(MAX_DIAGNOSTIC_BYTES);
				const kind = typeof body?.kind === "string" ? body.kind.slice(0, MAX_KIND_CHARS) : "unknown";
				const detail = typeof body?.detail === "string" ? body.detail : "";
				if (detail === "") return {
					status: 400,
					value: { error: "invalid-request" }
				};
				ctx.logger.warn(`dsh-claude client [${kind}]: ${redactText(detail, MAX_DETAIL_CHARS)}`);
				return {
					status: 200,
					value: { ok: true }
				};
			} catch (error) {
				if (error instanceof SyntaxError) return {
					status: 400,
					value: { error: "invalid-json" }
				};
				return {
					status: 400,
					value: { error: "invalid-request" }
				};
			}
		}
	});
}
//#endregion
//#region src/rewind-routes.ts
const MAX_BODY_BYTES$2 = 4096;
const MAX_SESSION_ID_CHARS$1 = 1024;
function record$2(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
/** An oversized body fails the same field checks as a missing one; only
*  malformed JSON is worth reporting separately. */
async function readJson$2(io) {
	try {
		return record$2(await io.body(MAX_BODY_BYTES$2));
	} catch (error) {
		if (error instanceof SyntaxError) throw error;
		return;
	}
}
/** `POST <path>` with `{ sessionId, seq, restoreFiles? }`: hide that surface
*  event and every later one, and arm Claude to resume before the turn it
*  opened. With `restoreFiles`, the checkout is also put back to the tree that
*  turn was admitted against.
*
*  The conversation rewind is what the user confirmed, so it lands first and
*  stands on its own; a checkout that cannot be restored — no snapshot, a
*  collected tree, no git — reports `filesRestored: false` rather than
*  failing the rewind. */
function registerClaudeRewindRoute(ctx, sidecar, access) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_REWIND_PATH,
		methods: ["POST"],
		budget: "git",
		handler: async (io) => {
			try {
				const input = await readJson$2(io);
				const sessionId = input?.sessionId;
				const seq = input?.seq;
				if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > MAX_SESSION_ID_CHARS$1 || typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return {
					status: 400,
					value: { error: "invalid-request" }
				};
				const events = access.eventsFor(sessionId);
				if (events === void 0) return {
					status: 409,
					value: { error: "session-unavailable" }
				};
				if (access.busy(sessionId)) return {
					status: 409,
					value: { error: "session-busy" }
				};
				const current = (await sidecar.read(sessionId)).rewind ?? EMPTY_REWIND_STATE;
				const planned = planRewind(current, events, seq);
				if (planned === void 0) return {
					status: 409,
					value: { error: "seq-unavailable" }
				};
				const tree = input?.restoreFiles === true ? rewindRestoreTree(current, events, seq) : void 0;
				await sidecar.writeRewind(sessionId, planned, turnAtOrAfter(events, seq));
				await access.reset(sessionId);
				const filesRestored = tree === void 0 || access.restoreFiles === void 0 ? false : await access.restoreFiles(sessionId, tree).catch(() => false);
				return {
					status: 200,
					value: {
						ranges: planned.ranges,
						filesRestored
					}
				};
			} catch (error) {
				if (error instanceof SyntaxError) return {
					status: 400,
					value: { error: "invalid-json" }
				};
				return {
					status: 500,
					value: { error: "rewind-unavailable" }
				};
			}
		}
	});
}
//#endregion
//#region src/background-task-routes.ts
const MAX_BODY_BYTES$1 = 4096;
const MAX_ID_CHARS = 1024;
function record$1(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function id(value) {
	return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_CHARS ? value : void 0;
}
async function readJson$1(io) {
	try {
		return record$1(await io.body(MAX_BODY_BYTES$1));
	} catch (error) {
		if (error instanceof SyntaxError) throw error;
		return;
	}
}
/** `POST <path>` with `{ sessionId, toolUseId }`: the Ctrl+B of the terminal
*  for one blocking Bash call. Claude gets a "running in the background" result
*  at once and the command joins the Host job list. */
function registerClaudeBackgroundTaskRoute(ctx, access) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_BACKGROUND_TASK_PATH,
		methods: ["POST"],
		budget: "fast",
		handler: async (io) => {
			try {
				const input = await readJson$1(io);
				const sessionId = id(input?.sessionId);
				const toolUseId = id(input?.toolUseId);
				if (sessionId === void 0 || toolUseId === void 0) return {
					status: 400,
					value: { error: "invalid-request" }
				};
				const outcome = await access.background(sessionId, toolUseId);
				return outcome === "moved" ? {
					status: 200,
					value: { outcome }
				} : {
					status: 409,
					value: { error: outcome }
				};
			} catch (error) {
				if (error instanceof SyntaxError) return {
					status: 400,
					value: { error: "invalid-json" }
				};
				return {
					status: 500,
					value: { error: "background-unavailable" }
				};
			}
		}
	});
}
//#endregion
//#region src/permission-mode-routes.ts
const MAX_BODY_BYTES = 4096;
const MAX_SESSION_ID_CHARS = 1024;
function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
async function readJson(io) {
	try {
		return record(await io.body(MAX_BODY_BYTES));
	} catch (error) {
		if (error instanceof SyntaxError) throw error;
		return;
	}
}
/** `POST <path>` with `{ sessionId, mode }`: make `mode` the session's Claude
*  permission mode from its next turn, and move the Host's access preset
*  with it. The plugin's record lands first: it is what the next turn reads,
*  and a Host that declines the preset changes nothing about that. */
function registerClaudePermissionModeRoute(ctx, sidecar, access) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_PERMISSION_MODE_PATH,
		methods: ["POST"],
		budget: "fast",
		handler: async (io) => {
			try {
				const input = await readJson(io);
				const sessionId = input?.sessionId;
				const mode = input?.mode;
				if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > MAX_SESSION_ID_CHARS || !isClaudePermissionMode(mode)) return {
					status: 400,
					value: { error: "invalid-request" }
				};
				if (!access.ownsSession(sessionId)) return {
					status: 409,
					value: { error: "session-unavailable" }
				};
				if (access.busy(sessionId)) return {
					status: 409,
					value: { error: "session-busy" }
				};
				await sidecar.writePermissionMode(sessionId, mode);
				const sandbox = SANDBOX_BY_CLAUDE_MODE[mode];
				return {
					status: 200,
					value: {
						mode,
						sandbox,
						hostSynced: await access.applyHostPreset(sessionId, sandbox).catch((error) => {
							ctx.logger?.warn?.(`dsh-claude: Host preset ${sandbox} not applied for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
							return false;
						})
					}
				};
			} catch (error) {
				if (error instanceof SyntaxError) return {
					status: 400,
					value: { error: "invalid-json" }
				};
				throw error;
			}
		}
	});
}
//#endregion
//#region src/permission-mode-host.ts
/** Put the Host on the preset named after `sandbox`. Answers whether it took:
*  a Host with no preset service, or whose table lacks that entry, leaves
*  Claude to enforce the mode on its own. */
function applyHostPreset(access, agent, sandbox) {
	const presets = access.presets();
	if (presets === void 0 || !presets.names.includes(sandbox)) return false;
	presets.apply(agent.session, sandbox, (policy) => {
		access.setPolicy(agent, policy);
	});
	return true;
}
/** Put a session that has not chosen a mode on the sandbox its default needs.
*
*  The fold in permission-mode.ts lets the sandbox win over a mode it cannot
*  carry, which is right for a sandbox the user switched deliberately -- and
*  wrong for the one a fresh session merely inherited from the Host's default
*  preset, where it would quietly turn a configured `auto` into whatever that
*  preset means. So a new Claude session is moved onto its default's sandbox
*  once, at creation; a session that already chose its own mode is left alone.
*  @returns the sandbox the Host was put on, or undefined when nothing moved. */
function alignSessionWithDefault(access, agent, chosen, defaultMode) {
	if (chosen !== void 0) return void 0;
	const wanted = SANDBOX_BY_CLAUDE_MODE[defaultMode];
	if (sandboxModeOf(agent.session.snapshotEvents()) === wanted) return void 0;
	return applyHostPreset(access, agent, wanted) ? wanted : void 0;
}
//#endregion
//#region src/touched-repositories.ts
/** Which other repositories a session has written into.
*
*  A session is pinned to one checkout, but Claude writes wherever it is
*  pointed: a monorepo sibling, a dependency checked out next door. Those
*  edits never showed up anywhere -- no diff, no pull request -- because every
*  repository read keyed off the session's own cwd. The file tools' arguments
*  are already on the activity log, so the extra roots are derived from there
*  rather than tracked as new state. */
const FILE_TOOLS = /* @__PURE__ */ new Set([
	"Edit",
	"MultiEdit",
	"Write",
	"NotebookEdit"
]);
/** The activity detail is a redacted JSON string that may be cut short, so
*  these match one key each rather than parsing the document. */
const PATH_KEY = /"(?:file_path|notebook_path)"\s*:\s*"((?:[^"\\]|\\.)*)"/u;
const COMMAND_KEY = /"command"\s*:\s*"((?:[^"\\]|\\.)*)"/u;
/** An absolute path token in shell text: not the tail of a URL, a relative
*  path, a `$VAR` or a `NAME=` assignment, and not reaching into quotes or
*  shell punctuation. */
const PATH_TOKEN = String.raw`\/[\w.@+~-]+(?:\/[\w.@+~-]+)*`;
/** Going there: every relative path that follows is inside. Counted only when
*  something is changed while there (MUTATES, up to the next one of these) --
*  `cd repo && git grep` is reading, and `cd repo && git worktree add /tmp/w;
*  cd /tmp/w && git commit` changed the worktree, not the checkout. */
const GO_CONTEXTS = [new RegExp(String.raw`(?:^|[;&|(]\s*)(?:cd|pushd)\s+(${PATH_TOKEN})`, "gmu"), new RegExp(String.raw`\bgit\s+-C\s+(${PATH_TOKEN})`, "gu")];
/** Anything in a command that writes where it stands: a redirect to a
*  relative file, an in-place edit, a file operation,
*  a git command that moves the checkout or its history. */
const MUTATES = /(?<![\d&=-])>{1,2}[ \t]*(?=[\w.])|\btee\s|\bsed\s+-i|\bperl\s+-\S*i|\b(?:mkdir|touch|rm|cp|mv|install|patch)\s|\bopen\([^)]*['"][wa]['"]|\bgit\s+(?:-C\s+\S+\s+)?(?:add|am|apply|checkout|cherry-pick|commit|merge|mv|pull|push|rebase|reset|restore|revert|rm|stash|switch|tag)\b|\bgh\s+pr\s+create\b/u;
/** Where a stretch of the command ends: any change of directory, relative too. */
const LEAVES = /(?:^|[;&|(]\s*)(?:cd|pushd|popd)\b/gmu;
/** Double-quoted text and heredoc bodies are arguments (a PR body, a note,
*  a grep pattern), not shell. */
const QUOTED = /"(?:[^"\\]|\\.)*"|<<-?\s*['"]?(\w+)['"]?[^\n]*\n[\s\S]*?\n\1(?=\n|$)/gu;
/** Where a command goes to work or writes: the shell forms Claude actually
*  uses under full access. Reading a path (grep, cat, ls) is not touching it. */
const WRITE_CONTEXTS = [
	new RegExp(String.raw`\bgit\s+worktree\s+add\s+(?:-\S+\s+)*(${PATH_TOKEN})`, "gu"),
	new RegExp(String.raw`>{1,2}\s*(${PATH_TOKEN})`, "gu"),
	new RegExp(String.raw`\btee\s+(?:-\S+\s+)*(${PATH_TOKEN})`, "gu"),
	new RegExp(String.raw`\bmkdir\s+(?:-\S+\s+)*(${PATH_TOKEN})`, "gu"),
	new RegExp(String.raw`\bsed[ \t]+-i[^\s;&|]*[ \t]+(?:(?:'[^'\n]*'|"[^"\n]*"|[^\s;&|]+)[ \t]+)+?(${PATH_TOKEN})`, "gu"),
	new RegExp(String.raw`\b(?:cp|mv|install)[ \t]+(?:[^\s;&|]+[ \t]+)+?(${PATH_TOKEN})`, "gu"),
	new RegExp(String.raw`\bopen\(\s*['"](${PATH_TOKEN})['"]\s*,\s*['"][wa]`, "gu")
];
/** A pathological command (a generated file list) must not turn into a
*  hundred git probes. */
const MAX_PATHS_PER_COMMAND = 50;
const PULL_REQUEST_URL = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d{1,9})(?![\d])/gu;
const MAX_PULL_REQUESTS = 12;
function unescaped(escaped) {
	try {
		return JSON.parse(`"${escaped}"`);
	} catch {
		return;
	}
}
/** Absolute paths Claude worked in or wrote to, first-seen order: the file
*  tools' own argument, plus the paths a Bash command changes into, sets a
*  worktree up at, or writes -- under full access Claude edits through
*  heredocs and sed. Paths outside any repository are dropped downstream. */
function touchedFilePaths(activities) {
	const paths = /* @__PURE__ */ new Set();
	for (const activity of activities) {
		if (activity.kind !== "tool-call" && activity.kind !== "subagent" || activity.toolName === void 0 || activity.detail === void 0) continue;
		if (FILE_TOOLS.has(activity.toolName)) {
			const escaped = PATH_KEY.exec(activity.detail)?.[1];
			const path = escaped === void 0 ? void 0 : unescaped(escaped);
			if (path !== void 0 && isAbsolute(path)) paths.add(path);
		} else if (activity.toolName === "Bash") {
			const escaped = COMMAND_KEY.exec(activity.detail)?.[1];
			const command = escaped === void 0 ? void 0 : unescaped(escaped);
			if (command === void 0) continue;
			const shell = command.replace(QUOTED, (text) => " ".repeat(text.length));
			const found = [];
			const pathOf = (match) => ({
				index: (match.index ?? 0) + match[0].length - (match[1]?.length ?? 0),
				path: match[1] ?? ""
			});
			const gone = GO_CONTEXTS.flatMap((context) => [...command.matchAll(context)].map(pathOf)).sort((left, right) => left.index - right.index);
			const leaves = [...shell.matchAll(LEAVES)].map((match) => match.index + match[0].length);
			for (const go of gone) {
				const from = go.index + go.path.length;
				const stretch = shell.slice(from, leaves.find((index) => index > from));
				if (MUTATES.test(stretch)) found.push(go);
			}
			for (const context of WRITE_CONTEXTS) for (const match of command.matchAll(context)) {
				const written = pathOf(match);
				if (written.path !== "" && !written.path.startsWith("/dev/")) found.push(written);
			}
			found.sort((left, right) => left.index - right.index);
			for (const { path } of found.slice(0, MAX_PATHS_PER_COMMAND)) paths.add(path);
		}
	}
	return [...paths];
}
/** Every absolute path a Bash command changed into, written there or not.
*  Not a linked checkout on its own, but where the user's clones live: a
*  pull request whose worktree is gone is still mergeable through one. */
function visitedPaths(activities) {
	const paths = /* @__PURE__ */ new Set();
	for (const activity of activities) {
		if (activity.kind !== "tool-call" && activity.kind !== "subagent" || activity.toolName !== "Bash" || activity.detail === void 0) continue;
		const escaped = COMMAND_KEY.exec(activity.detail)?.[1];
		const command = escaped === void 0 ? void 0 : unescaped(escaped);
		if (command === void 0) continue;
		for (const context of GO_CONTEXTS) for (const match of command.matchAll(context)) if (match[1] !== void 0) paths.add(match[1]);
	}
	return [...paths];
}
const PR_CREATE = /\bgh\s+pr\s+create\b/u;
/** A file a command writes (redirect, tee): where a script lands. */
const WRITTEN_FILE = new RegExp(String.raw`(?:>{1,2}\s*|\btee\s+(?:-\S+\s+)*)(${PATH_TOKEN}|[\w.@+~-]+(?:\/[\w.@+~-]+)*)`, "gu");
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
/** The pull requests the session opened: the URL `gh pr create` printed,
*  read off that call's own result. Other than the session repository's,
*  once each in first-seen order. A URL merely read, quoted or mentioned
*  (a fixture, a summary, a `gh pr view`) is not one the session made.
*  A script the session wrote with `gh pr create` inside and then ran by
*  name -- once per repository, the way a fan-out gets done -- counts the
*  same: the URLs come out of the runs, not of the write.
*  A checkout that has since moved back to its base branch no longer knows
*  about its pull request; the log still does. */
function touchedPullRequests(activities, ownRepository) {
	const found = /* @__PURE__ */ new Map();
	const own = ownRepository?.toLowerCase();
	const creating = /* @__PURE__ */ new Set();
	/** Basenames of scripts written with `gh pr create` inside, as patterns. */
	const scripts = [];
	for (const activity of activities) {
		if (activity.toolUseId === void 0) continue;
		if (activity.kind === "tool-call" || activity.kind === "subagent" && activity.toolName !== void 0) {
			if (activity.toolName !== "Bash" || activity.detail === void 0) continue;
			const escaped = COMMAND_KEY.exec(activity.detail)?.[1];
			const command = escaped === void 0 ? void 0 : unescaped(escaped);
			if (command === void 0) continue;
			if (PR_CREATE.test(command)) {
				creating.add(activity.toolUseId);
				for (const match of command.matchAll(WRITTEN_FILE)) {
					const name = match[1]?.split("/").at(-1);
					if (name !== void 0 && name.length > 0) scripts.push(new RegExp(String.raw`(?:^|[\s/])${escapeRegExp(name)}(?=$|\s)`, "mu"));
				}
			} else if (scripts.some((script) => script.test(command))) creating.add(activity.toolUseId);
			continue;
		}
		if (activity.detail === void 0 || !creating.has(activity.toolUseId)) continue;
		for (const match of activity.detail.matchAll(PULL_REQUEST_URL)) {
			const repository = match[1]?.toLowerCase();
			const number = Number(match[2]);
			if (repository === void 0 || repository === own || !Number.isSafeInteger(number) || number <= 0) continue;
			const key = `${repository}#${number}`;
			if (found.has(key)) continue;
			found.set(key, {
				repository,
				number
			});
			if (found.size >= MAX_PULL_REQUESTS) return [...found.values()];
		}
	}
	return [...found.values()];
}
async function isDirectory(path) {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}
/** Repository roots behind the touched paths, minus the session's own, in
*  first-seen order. `rootOf` answers undefined outside any repository. */
/** Whether `child` lies strictly under `parent`. Compared with one separator:
*  on Windows git prints forward slashes where Node resolves to backslashes,
*  and a root can arrive in either form. */
function isInside(child, parent) {
	const slashed = (value) => value.replaceAll("\\", "/").replace(/\/+$/u, "");
	return slashed(child).startsWith(`${slashed(parent)}/`);
}
async function touchedRepositoryRoots(paths, sessionRoot, rootOf, max, directory = isDirectory) {
	const roots = [];
	const directories = /* @__PURE__ */ new Set();
	for (const path of paths) directories.add(await directory(path) ? path : dirname(path));
	for (const directory of directories) {
		const root = await rootOf(directory);
		if (root === void 0 || root === sessionRoot || roots.includes(root)) continue;
		if (isInside(sessionRoot, root)) continue;
		roots.push(root);
		if (roots.length >= max) break;
	}
	return roots;
}
/** Whether a linked checkout still has anything to show. A cleaned-up
*  worktree is gone, and a checkout cleaned up in place is back on base with
*  nothing pending -- either way its bar comes down. A checkout with an open
*  or merged pull request, or unpushed commits, stays. A clean branch with no
*  upstream is what a tool checkout looks like and is no evidence on its own. */
function linkedRepositoryShown(status) {
	if (status.status !== "ready") return false;
	return status.dirty === true || (status.ahead ?? 0) > 0 || status.pullRequest !== void 0;
}
//#endregion
//#region src/session-root-ledger.ts
/** Which extra checkout roots a session's routes may act on.
*
*  A session's linked repositories are re-derived on every projection sweep,
*  and any one sweep's git/gh probes can transiently fail -- dropping a
*  checkout the client is still showing a bar for. Replacing the authorised
*  set each sweep would then 409 that bar's controls until the next good
*  sweep, which reads as a control that silently does nothing. A session only
*  ever gains checkouts it has genuinely written into, so the ledger only
*  grows within a session's lifetime and never un-vouches a root a later
*  probe happened to miss. Bounded so a long session cannot grow it forever. */
var SessionRootLedger = class {
	#roots = /* @__PURE__ */ new Map();
	#max;
	constructor(max) {
		this.#max = max;
	}
	/** Add the roots this sweep vouched for; existing ones stay. */
	vouch(sessionId, roots) {
		let set = this.#roots.get(sessionId);
		if (set === void 0) {
			set = /* @__PURE__ */ new Set();
			this.#roots.set(sessionId, set);
		}
		for (const root of roots) {
			set.delete(root);
			set.add(root);
			if (set.size > this.#max) set.delete(set.values().next().value);
		}
	}
	allows(sessionId, root) {
		return this.#roots.get(sessionId)?.has(root) === true;
	}
	forget(sessionId) {
		this.#roots.delete(sessionId);
	}
};
//#endregion
//#region src/update-routes.ts
const PLUGIN_PACKAGE_NAME = "@norman-else/dsh-claude";
const MAX_MANIFEST_BYTES = 262144;
const MAX_UPDATE_OUTPUT_BYTES = 32768;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const PROFILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** The route owns the deadline now. A direct caller with nothing to cancel
*  against gets a signal that never fires, rather than a second timeout
*  competing with the budget the route already declared. */
const NEVER_ABORTS = new AbortController().signal;
function safeMessage$1(error) {
	return redactText(error instanceof Error ? error.message : String(error), 500);
}
async function readManifest(path) {
	const text = await readFile(path, "utf8");
	if (Buffer.byteLength(text) > MAX_MANIFEST_BYTES) throw new Error("package manifest is too large");
	const value = JSON.parse(text);
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("package manifest is invalid");
	return value;
}
function dependencySpec(manifest) {
	if (typeof manifest.dependencies !== "object" || manifest.dependencies === null || Array.isArray(manifest.dependencies)) return void 0;
	const value = manifest.dependencies[PLUGIN_PACKAGE_NAME];
	return typeof value === "string" && value.length <= 2e3 ? value : void 0;
}
function classifyInstallSpec(spec) {
	if (/^(?:link|file|workspace):/i.test(spec)) return "link";
	if (/^(?:git(?:\+[^:]+)?:|github:|https?:|npm:)/i.test(spec) || /\.git(?:#|$)/i.test(spec)) return "unsupported";
	return /^(?:\^|~|>=?|<=?|=)?\s*v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\s*\|\|\s*(?:\^|~|>=?|<=?|=)?\s*v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)*$/.test(spec.trim()) ? "registry" : "unsupported";
}
async function samePath(left, right) {
	try {
		const [a, b] = await Promise.all([realpath(left), realpath(right)]);
		return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
	} catch {
		return false;
	}
}
function linkedTarget(profileDir, spec) {
	const match = /^(?:link|file):(.*)$/i.exec(spec);
	return match?.[1] === void 0 ? void 0 : resolve(profileDir, match[1]);
}
async function discoverInstallation(dshHome, packageDir) {
	const profilesDir = join(dshHome, "profiles");
	const matches = [];
	let profiles;
	try {
		profiles = await opendir(profilesDir);
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
	for await (const entry of profiles) {
		if (!entry.isDirectory() || !PROFILE_NAME.test(entry.name)) continue;
		const profileDir = join(profilesDir, entry.name);
		let manifest;
		try {
			manifest = await readManifest(join(profileDir, "package.json"));
		} catch {
			continue;
		}
		const spec = dependencySpec(manifest);
		if (spec === void 0) continue;
		const source = classifyInstallSpec(spec);
		if (source === "link" ? linkedTarget(profileDir, spec) !== void 0 && await samePath(linkedTarget(profileDir, spec), packageDir) : await samePath(join(profileDir, "node_modules", ..."@norman-else/dsh-claude".split("/")), packageDir)) matches.push({
			profile: entry.name,
			profileDir,
			source,
			spec
		});
	}
	return matches.length === 1 ? matches[0] : void 0;
}
function parseVersion(version) {
	const match = SEMVER.exec(version);
	if (match === null) throw new Error("package version is not valid semver");
	return match;
}
function compareVersions(left, right) {
	const a = parseVersion(left);
	const b = parseVersion(right);
	for (const index of [
		1,
		2,
		3
	]) {
		const difference = Number(a[index]) - Number(b[index]);
		if (difference !== 0) return Math.sign(difference);
	}
	const aPre = a[4];
	const bPre = b[4];
	if (aPre === void 0) return bPre === void 0 ? 0 : 1;
	if (bPre === void 0) return -1;
	return aPre.localeCompare(bPre, "en", { numeric: true });
}
async function registryLatest(signal) {
	const response = await fetch("https://registry.npmjs.org/%40norman-else%2Fdsh-claude", {
		headers: { accept: "application/vnd.npm.install-v1+json" },
		signal
	});
	if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
	const latest = (await response.json())["dist-tags"]?.latest;
	if (typeof latest !== "string") throw new Error("npm registry response has no latest version");
	parseVersion(latest);
	return latest;
}
async function resolvePackageContextDir(configured) {
	const moduleDir = dirname(fileURLToPath(import.meta.url));
	const candidates = configured === void 0 ? [moduleDir, dirname(moduleDir)] : [configured];
	for (const packageDir of candidates) try {
		const manifest = await readManifest(join(packageDir, "package.json"));
		if (manifest.name === "@norman-else/dsh-claude") return {
			packageDir,
			manifest
		};
	} catch {}
	throw new Error("plugin package manifest is invalid");
}
async function packageContext(deps) {
	const { packageDir, manifest } = await resolvePackageContextDir(deps.packageDir);
	if (typeof manifest.version !== "string") throw new Error("plugin package manifest is invalid");
	parseVersion(manifest.version);
	const installation = await discoverInstallation(deps.dshHome ?? resolveDshHome(), packageDir);
	return {
		version: manifest.version,
		...installation === void 0 ? {} : { installation }
	};
}
async function checkPluginUpdate(deps = {}, signal = NEVER_ABORTS) {
	try {
		const { version, installation } = await packageContext(deps);
		if (installation === void 0) return {
			currentVersion: version,
			source: "unknown",
			state: "unavailable",
			canUpdate: false,
			restartRequired: false,
			message: "Active DSH profile could not be identified uniquely"
		};
		if (installation.source === "link") return {
			currentVersion: version,
			source: "link",
			state: "linked",
			canUpdate: false,
			restartRequired: false,
			message: "Local development link; updates come from the linked checkout"
		};
		if (installation.source !== "registry") return {
			currentVersion: version,
			source: installation.source,
			state: "unsupported",
			canUpdate: false,
			restartRequired: false,
			message: "This installation source cannot be updated from the npm registry"
		};
		const latest = await (deps.fetchLatest ?? registryLatest)(signal);
		const comparison = compareVersions(version, latest);
		return {
			currentVersion: version,
			latestVersion: latest,
			source: "registry",
			state: comparison < 0 ? "available" : "current",
			canUpdate: comparison < 0,
			restartRequired: comparison < 0
		};
	} catch (error) {
		return {
			currentVersion: "unknown",
			source: "unknown",
			state: "error",
			canUpdate: false,
			restartRequired: false,
			message: safeMessage$1(error)
		};
	}
}
async function verifyInstalledVersion(installation, expectedVersion) {
	if (dependencySpec(await readManifest(join(installation.profileDir, "package.json"))) !== expectedVersion) throw new Error("DSH plugin update completed without updating the profile dependency");
	const installedManifest = await readManifest(join(installation.profileDir, "node_modules", ...PLUGIN_PACKAGE_NAME.split("/"), "package.json"));
	if (installedManifest.name !== "@norman-else/dsh-claude" || installedManifest.version !== expectedVersion) throw new Error("DSH plugin update completed without installing the requested version");
}
async function updatePlugin(deps = {}, signal = NEVER_ABORTS) {
	const { version, installation } = await packageContext(deps);
	if (installation === void 0 || installation.source !== "registry") throw new Error("Plugin update is unavailable for this installation");
	const latest = await (deps.fetchLatest ?? registryLatest)(signal);
	if (compareVersions(version, latest) >= 0) return {
		currentVersion: version,
		latestVersion: latest,
		source: "registry",
		state: "current",
		canUpdate: false,
		restartRequired: false
	};
	const resolveExecutable = deps.resolveExecutable;
	const spawn = deps.spawn;
	if (resolveExecutable === void 0 || spawn === void 0) throw new Error("DSH update runtime is unavailable");
	const handle = spawn({
		argv: [
			await resolveExecutable("dsh", {}, signal),
			"plugin",
			"--profile",
			installation.profile,
			"add",
			`${PLUGIN_PACKAGE_NAME}@${latest}`
		],
		cwd: installation.profileDir,
		env: {},
		stdio: {
			stdin: "ignore",
			stdout: { maxBytes: MAX_UPDATE_OUTPUT_BYTES },
			stderr: { maxBytes: MAX_UPDATE_OUTPUT_BYTES }
		},
		graceMs: 2e3,
		signal
	});
	const outcome = await handle.done;
	if (outcome.exitCode !== 0) {
		const detail = handle.collected.stderr?.readFrom(0).text ?? "";
		throw new Error(`DSH plugin update failed (${outcome.exitCode ?? outcome.signal ?? "unknown exit"}): ${safeMessage$1(detail)}`);
	}
	await verifyInstalledVersion(installation, latest);
	if (deps.requestRestart !== void 0) setTimeout(() => deps.requestRestart?.(), 100).unref?.();
	return {
		currentVersion: latest,
		latestVersion: latest,
		source: "registry",
		state: "current",
		canUpdate: false,
		restartRequired: deps.requestRestart === void 0,
		message: deps.requestRestart === void 0 ? "Update installed; restart DeepSeek Harness to load it" : "Update installed; DeepSeek Harness is restarting to load it"
	};
}
function registerClaudeUpdateRoutes(ctx, runtime, deps = {}) {
	const shared = {
		...deps,
		resolveExecutable: runtime.resolveExecutable.bind(runtime),
		spawn: runtime.spawn.bind(runtime)
	};
	const routes = [{
		path: CLAUDE_UPDATE_CHECK_PATH,
		method: "GET",
		run: (signal) => checkPluginUpdate(shared, signal)
	}, {
		path: CLAUDE_UPDATE_PATH,
		method: "POST",
		run: (signal) => updatePlugin(shared, signal)
	}];
	for (const route of routes) registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: route.path,
		methods: [route.method],
		budget: "remote",
		handler: async (io) => {
			try {
				return {
					status: 200,
					value: await route.run(io.signal)
				};
			} catch (error) {
				return {
					status: 500,
					value: { error: safeMessage$1(error) }
				};
			}
		}
	});
}
//#endregion
//#region src/windows-job-runner.ts
const RUN_AS_NODE = "ELECTRON_RUN_AS_NODE";
/**
* Make the Host's Windows Job runner start as Node when the Host itself is an
* Electron utility process.
*
* Since DSH Desktop 2.0.7 the Host runs in `utilityProcess.fork` and, on
* Windows, `subprocess-local` launches every ordinary target through a helper
* it spawns as `[process.execPath, runner.js]`. Inside Electron that path is
* `DSH Desktop.exe`, and the fork carries no `ELECTRON_RUN_AS_NODE`, so the
* helper starts as a second GUI instance, yields to the running one, and exits
* 0 without ever reporting -- the Host then fails the spawn with "Windows Job
* runner exited with exit code 0 before proving its managed range empty".
*
* The runner's environment is read from `process.env` synchronously inside
* `spawn()`, so the flag is set for exactly that call and removed after. The
* target's own environment is built the same way, so the spec tells the Host
* to drop the flag there: a target must not inherit a variable that turns any
* Electron app it launches into a bare Node process.
*/
function withElectronNodeRunner(runtime, options = {}) {
	const platform = options.platform ?? process.platform;
	const electron = options.electron ?? process.versions.electron !== void 0;
	if (platform !== "win32" || !electron) return runtime;
	return new Proxy(runtime, { get(target, property, receiver) {
		if (property !== "spawn") {
			const value = Reflect.get(target, property, receiver);
			return typeof value === "function" ? value.bind(target) : value;
		}
		return (spec) => {
			const withoutFlag = {
				...spec,
				env: {
					...spec.env,
					[RUN_AS_NODE]: void 0
				}
			};
			if (process.env[RUN_AS_NODE] !== void 0) return target.spawn(withoutFlag);
			process.env[RUN_AS_NODE] = "1";
			try {
				return target.spawn(withoutFlag);
			} finally {
				delete process.env[RUN_AS_NODE];
			}
		};
	} });
}
//#endregion
//#region src/system-proxy.ts
const PROXY_NAMES = /* @__PURE__ */ new Set([
	"HTTPS_PROXY",
	"HTTP_PROXY",
	"ALL_PROXY"
]);
const INTERNET_SETTINGS_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
const ALWAYS_DIRECT = [
	"localhost",
	"127.0.0.1",
	"::1"
];
const REG_QUERY_TIMEOUT_MS = 3e3;
/** Whether an environment already routes traffic through a proxy of its own. */
function hasProxyEnv(env) {
	return Object.entries(env).some(([name, value]) => PROXY_NAMES.has(name.toUpperCase()) && value !== void 0 && value.trim() !== "");
}
function proxyUrl(server) {
	return /^[a-z][a-z0-9+.-]*:\/\//iu.test(server) ? server : `http://${server}`;
}
/** `10.*` → `10.0.0.0/8`; `*.corp.example` → `.corp.example`; `<local>` and
*  other wildcards have no NO_PROXY spelling and are dropped. */
function noProxyEntry(pattern) {
	const entry = pattern.trim();
	if (entry === "" || entry === "<local>") return void 0;
	const ip = /^(\d{1,3}(?:\.\d{1,3}){0,3})\.\*$/u.exec(entry);
	if (ip !== null) {
		const octets = ip[1].split(".");
		return `${[
			...octets,
			"0",
			"0",
			"0"
		].slice(0, 4).join(".")}/${octets.length * 8}`;
	}
	if (entry.startsWith("*.") && !entry.slice(2).includes("*")) return entry.slice(1);
	return entry.includes("*") ? void 0 : entry;
}
/** Read the WinINet proxy from `reg query` output.
*
*  `ProxyServer` is either one `host:port` for every scheme or a
*  `scheme=host:port;…` list; the HTTPS entry wins, then HTTP. A SOCKS-only
*  setting is not expressible as HTTP(S)_PROXY and yields nothing. */
function parseWindowsInternetSettings(output) {
	const values = /* @__PURE__ */ new Map();
	for (const line of output.split(/\r?\n/u)) {
		const match = /^\s+(\S+)\s+REG_\w+\s+(.*?)\s*$/u.exec(line);
		if (match !== null) values.set(match[1], match[2]);
	}
	if (Number(values.get("ProxyEnable")) !== 1) return void 0;
	const server = values.get("ProxyServer")?.trim();
	if (server === void 0 || server === "") return void 0;
	let target = server;
	if (server.includes("=")) {
		const byScheme = new Map(server.split(";").map((part) => {
			const [scheme, address] = part.split("=", 2);
			return [scheme?.trim().toLowerCase() ?? "", address?.trim() ?? ""];
		}));
		const chosen = byScheme.get("https") || byScheme.get("http");
		if (chosen === void 0 || chosen === "") return void 0;
		target = chosen;
	}
	const url = proxyUrl(target);
	const bypass = (values.get("ProxyOverride") ?? "").split(";").map(noProxyEntry).filter((entry) => entry !== void 0);
	return {
		HTTPS_PROXY: url,
		HTTP_PROXY: url,
		NO_PROXY: [.../* @__PURE__ */ new Set([...ALWAYS_DIRECT, ...bypass])].join(",")
	};
}
/** The Windows system proxy, or undefined off Windows, when disabled, or when
*  the registry cannot be read. Never throws: a missing proxy only means the
*  children connect directly, as they did before. */
async function detectWindowsSystemProxy(runtime, platform = process.platform) {
	if (platform !== "win32") return void 0;
	try {
		const handle = runtime.spawn({
			argv: [
				`${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\reg.exe`,
				"query",
				INTERNET_SETTINGS_KEY
			],
			cwd: process.cwd(),
			stdio: {
				stdin: "ignore",
				stdout: { maxBytes: 65536 },
				stderr: { maxBytes: 4096 }
			},
			graceMs: 500,
			signal: AbortSignal.timeout(REG_QUERY_TIMEOUT_MS),
			env: {}
		});
		if ((await handle.done).exitCode !== 0) return void 0;
		return parseWindowsInternetSettings(handle.collected.stdout?.readFrom(0).text ?? "");
	} catch {
		return;
	}
}
/**
* Give child processes the system proxy when nothing else configured one.
*
* DSH Desktop copies the Windows system proxy into its Host's environment; the
* official DeepSeek Harness app does not (it reads only `~/.dsh/.env`), so
* Claude Code, git, and gh connected directly and Anthropic refused the
* request ("403 Request not allowed"). A proxy already present in the Host or
* in the spawn spec always wins.
*/
function withSystemProxy(runtime, proxy) {
	return new Proxy(runtime, { get(target, property, receiver) {
		if (property !== "spawn") {
			const value = Reflect.get(target, property, receiver);
			return typeof value === "function" ? value.bind(target) : value;
		}
		return (spec) => {
			const env = proxy();
			if (env === void 0 || hasProxyEnv(process.env) || hasProxyEnv(spec.env ?? {})) return target.spawn(spec);
			return target.spawn({
				...spec,
				env: {
					...env,
					...spec.env
				}
			});
		};
	} });
}
//#endregion
//#region src/plan-usage-routes.ts
const EMPTY = {
	available: false,
	windows: [],
	fetchedAt: 0
};
function safeMessage(error) {
	return redactText(error instanceof Error ? error.message : String(error), 1e3);
}
/** Plan usage: GET serves the value the metadata bridge last cached (free —
*  it rides an already-running session), POST reads fresh numbers from a
*  throwaway probe process so a refresh never depends on, or disturbs, a live
*  Claude session. */
function registerPlanUsageRoute(ctx, probe, now = Date.now) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_USAGE_PATH,
		methods: ["GET", "POST"],
		budget: "git",
		handler: async (io) => {
			if (io.method === "GET") return {
				status: 200,
				value: latestPlanUsage() ?? EMPTY
			};
			try {
				const report = await probe(now());
				recordPlanUsage(report);
				return {
					status: 200,
					value: report
				};
			} catch (error) {
				return {
					status: 500,
					value: { error: safeMessage(error) }
				};
			}
		}
	});
}
//#endregion
//#region src/preset-model-sync.ts
function isClaudeSelection(selection) {
	return CLAUDE_CODE_PROVIDER_IDS.includes(selection.provider);
}
function createPresetModelSync(deps) {
	let lastClaude;
	let lastOther;
	const remember = (selection) => {
		if (selection === void 0) return;
		if (isClaudeSelection(selection)) lastClaude = selection;
		else lastOther = selection;
	};
	return {
		remember,
		/** Move the session to its preset's side when it sits on the other one. */
		async sync(sessionId, preset) {
			if (!deps.isBlank(sessionId)) return;
			const current = deps.currentSelection(sessionId);
			remember(current);
			const wantsClaude = preset === CLAUDE_CODE_PRESET_ID;
			if (current !== void 0 && isClaudeSelection(current) === wantsClaude) return;
			const target = wantsClaude ? lastClaude ?? {
				provider: "claude",
				model: canonicalClaudeModelId(deps.defaultClaudeModel())
			} : lastOther ?? await deps.fallbackOtherModel();
			if (target === void 0) return;
			try {
				await deps.selectModel({
					sessionId,
					...target
				});
			} catch (error) {
				deps.warn(`dsh-claude: could not move session ${sessionId} to ${target.provider}/${target.model} for preset ${preset}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	};
}
//#endregion
//#region src/global-settings.ts
const MAX_SETTINGS_BYTES = 262144;
const MAX_REQUEST_BYTES = 8192;
const MAX_STYLE_BYTES = 65536;
const MAX_STYLE_FILES = 256;
const BUILTIN_OUTPUT_STYLES = [
	"Default",
	"Proactive",
	"Concise",
	"Explanatory",
	"Learning"
];
const STYLE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._()\[\]-]{0,127}$/u;
const DEFAULT_WORKTREE_BRANCH_PREFIX = "claude";
const MAX_BRANCH_PREFIX_CHARS = 128;
const MAX_PROCESSES_LIMIT = 16;
const MAX_IDLE_TIMEOUT_MINUTES = 1440;
const DEFAULT_LIMITS = {
	maxProcesses: 4,
	idleTimeoutMs: 18e5
};
function pathsFor(deps) {
	const root = join(homedir(), ".claude");
	return {
		settingsFile: deps.paths?.settingsFile ?? join(root, "settings.json"),
		outputStylesDir: deps.paths?.outputStylesDir ?? join(root, "output-styles"),
		pluginSettingsFile: deps.paths?.pluginSettingsFile ?? dshHomePath("plugins", "dsh-claude", "settings.json")
	};
}
function object(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
async function readDocument(path) {
	try {
		const text = await readFile(path, "utf8");
		if (Buffer.byteLength(text) > MAX_SETTINGS_BYTES) throw new Error("Claude Code settings file is too large");
		const parsed = object(JSON.parse(text));
		if (parsed === void 0) throw new Error("Claude Code settings file must contain a JSON object");
		return parsed;
	} catch (error) {
		if (error.code === "ENOENT") return {};
		throw error;
	}
}
function frontmatterName(text) {
	if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return void 0;
	const normalized = text.replaceAll("\r\n", "\n");
	const end = normalized.indexOf("\n---\n", 4);
	if (end < 0) return void 0;
	for (const line of normalized.slice(4, end).split("\n")) {
		const match = /^name:\s*(.+?)\s*$/.exec(line);
		if (match?.[1] === void 0) continue;
		const raw = match[1];
		const value = raw.startsWith("\"") && raw.endsWith("\"") || raw.startsWith("'") && raw.endsWith("'") ? raw.slice(1, -1) : raw;
		return STYLE_NAME.test(value) ? value : void 0;
	}
}
async function userOutputStyleOptions(directory) {
	const options = [];
	let entries;
	try {
		entries = await opendir(directory);
	} catch (error) {
		if (error.code === "ENOENT") return options;
		throw error;
	}
	for await (const entry of entries) {
		if (options.length >= MAX_STYLE_FILES) break;
		if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".md") continue;
		try {
			const text = await readFile(join(directory, entry.name), "utf8");
			if (Buffer.byteLength(text) > MAX_STYLE_BYTES) continue;
			const name = frontmatterName(text) ?? entry.name.slice(0, -3);
			if (STYLE_NAME.test(name)) options.push({
				value: name,
				label: name,
				source: "user"
			});
		} catch {}
	}
	return options;
}
const OUTPUT_STYLE = {
	key: "outputStyle",
	kind: "select",
	document: "claude",
	effect: "new-session",
	async options(paths) {
		const builtIn = BUILTIN_OUTPUT_STYLES.map((value) => ({
			value,
			label: value,
			source: "built-in"
		}));
		const user = await userOutputStyleOptions(paths.outputStylesDir);
		const seen = new Set(builtIn.map((option) => option.value));
		return [...builtIn, ...user.filter((option) => !seen.has(option.value)).sort((a, b) => a.label.localeCompare(b.label))];
	},
	read(document, options) {
		const value = document.outputStyle;
		return typeof value === "string" && STYLE_NAME.test(value) ? value : "Default";
	},
	apply(document, value, options) {
		if (typeof value !== "string" || !options.some((option) => option.value === value)) throw new Error("Invalid value for global setting outputStyle");
		if (value === "Default") delete document.outputStyle;
		else document.outputStyle = value;
	}
};
function isValidWorktreeBranchPrefix(value) {
	return value.length > 0 && value.length <= MAX_BRANCH_PREFIX_CHARS && value.trim() === value && !value.startsWith("/") && !value.endsWith("/") && !value.includes("//") && !value.includes("..") && !value.includes("@{") && !/[\0-\x20\x7f~^:?*[\\]/u.test(value) && value.split("/").every((segment) => segment.length > 0 && !segment.startsWith(".") && !segment.endsWith(".lock"));
}
const WORKTREE_BRANCH_PREFIX = {
	key: "worktreeBranchPrefix",
	kind: "text",
	document: "plugin",
	effect: "next-worktree",
	maxLength: MAX_BRANCH_PREFIX_CHARS,
	read(document) {
		const value = document.worktreeBranchPrefix;
		return typeof value === "string" && isValidWorktreeBranchPrefix(value) ? value : DEFAULT_WORKTREE_BRANCH_PREFIX;
	},
	apply(document, value) {
		if (typeof value !== "string" || !isValidWorktreeBranchPrefix(value)) throw new Error("Invalid value for global setting worktreeBranchPrefix");
		if (value === DEFAULT_WORKTREE_BRANCH_PREFIX) delete document.worktreeBranchPrefix;
		else document.worktreeBranchPrefix = value;
	}
};
/** Which access control Claude sessions get. `native` is the Host's own
*  selector and nothing else: the sandbox alone decides the mode, as it did
*  before this plugin grew a selector; the default-mode setting and the
*  creation-time alignment stand down. The Client reads this to decide which
*  selector to draw, so the switch shows at once; a turn already running
*  keeps the mode it started under. */
const PERMISSION_SELECTOR = {
	key: "permissionSelector",
	kind: "select",
	document: "plugin",
	effect: "immediate",
	async options() {
		return CLAUDE_PERMISSION_SELECTORS.map((value) => ({
			value,
			label: value,
			source: "built-in"
		}));
	},
	read(document) {
		const value = document.permissionSelector;
		return isClaudePermissionSelector(value) ? value : DEFAULT_CLAUDE_PERMISSION_SELECTOR;
	},
	apply(document, value) {
		if (!isClaudePermissionSelector(value)) throw new Error("Invalid value for global setting permissionSelector");
		if (value === "plugin") delete document.permissionSelector;
		else document.permissionSelector = value;
	}
};
/** `auto` unless the user says otherwise: Claude Code's classifier approves the
*  routine and asks about the rest, which is the mode a fresh session should
*  start in when nobody has thought about it yet. */
const DEFAULT_CLAUDE_PERMISSION_MODE = "auto";
/** The Claude permission mode a session runs under until its own selector
*  is used. Plugin settings: a new Claude session is moved onto the DSH
*  sandbox this mode needs as it is created (permission-mode-host.ts); a
*  session whose sandbox was switched since yields to that sandbox's own
*  mode (permission-mode.ts). */
const PERMISSION_MODE = {
	key: "permissionMode",
	kind: "select",
	document: "plugin",
	effect: "new-session",
	async options() {
		return CLAUDE_PERMISSION_MODES.map((value) => ({
			value,
			label: value,
			source: "built-in"
		}));
	},
	read(document) {
		const value = document.permissionMode;
		return isClaudePermissionMode(value) ? value : DEFAULT_CLAUDE_PERMISSION_MODE;
	},
	apply(document, value) {
		if (!isClaudePermissionMode(value)) throw new Error("Invalid value for global setting permissionMode");
		if (value === "auto") delete document.permissionMode;
		else document.permissionMode = value;
	}
};
/** Which renderer draws Claude's visible output. Plugin settings, not Claude's:
*  the CLI has no opinion about how DSH paints a turn. The option labels stay
*  machine-readable ids; the Client translates the two known values. */
const RENDERER = {
	key: "renderer",
	kind: "select",
	document: "plugin",
	effect: "next-turn",
	async options() {
		return CLAUDE_RENDER_MODES.map((value) => ({
			value,
			label: value,
			source: "built-in"
		}));
	},
	read(document) {
		const value = document.renderer;
		return isClaudeRenderMode(value) ? value : DEFAULT_CLAUDE_RENDER_MODE;
	},
	apply(document, value) {
		if (!isClaudeRenderMode(value)) throw new Error("Invalid value for global setting renderer");
		if (value === "plugin") delete document.renderer;
		else document.renderer = value;
	}
};
/** Whether Claude's prose gets the highlight palette. Presentation only: no
*  record carries it and nothing on the server reads it back, so unlike
*  {@link RENDERER} the switch lands the moment the Client rewrites its own
*  stylesheet — hence 'immediate' rather than 'next-turn'. */
const PROSE = {
	key: "prose",
	kind: "select",
	document: "plugin",
	effect: "immediate",
	async options() {
		return CLAUDE_PROSE_MODES.map((value) => ({
			value,
			label: value,
			source: "built-in"
		}));
	},
	read(document) {
		const value = document.prose;
		return isClaudeProseMode(value) ? value : DEFAULT_CLAUDE_PROSE_MODE;
	},
	apply(document, value) {
		if (!isClaudeProseMode(value)) throw new Error("Invalid value for global setting prose");
		if (value === "plain") delete document.prose;
		else document.prose = value;
	}
};
function isBoundedInteger(value, min, max) {
	return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
function integerSetting(key, min, max, defaultFor, effect = "new-session") {
	return {
		key,
		kind: "text",
		document: "plugin",
		effect,
		maxLength: String(max).length,
		read(document, defaults = DEFAULT_LIMITS) {
			const value = document[key];
			return String(isBoundedInteger(value, min, max) ? value : defaultFor(defaults));
		},
		apply(document, value) {
			const parsed = typeof value === "string" && /^\d{1,6}$/u.test(value.trim()) ? Number(value.trim()) : value;
			if (!isBoundedInteger(parsed, min, max)) throw new Error(`Invalid value for global setting ${key}`);
			document[key] = parsed;
		}
	};
}
const DESCRIPTORS = [
	OUTPUT_STYLE,
	PERMISSION_SELECTOR,
	PERMISSION_MODE,
	RENDERER,
	PROSE,
	WORKTREE_BRANCH_PREFIX,
	integerSetting("maxProcesses", 1, MAX_PROCESSES_LIMIT, (limits) => limits.maxProcesses, "immediate"),
	integerSetting("idleTimeoutMinutes", 1, MAX_IDLE_TIMEOUT_MINUTES, (limits) => Math.max(1, Math.round(limits.idleTimeoutMs / 6e4)))
];
const DESCRIPTOR_BY_KEY = new Map(DESCRIPTORS.map((descriptor) => [descriptor.key, descriptor]));
let pendingWrite = Promise.resolve();
function documentFor(descriptor, documents) {
	return documents[descriptor.document];
}
async function views(documents, paths, defaults) {
	return { settings: await Promise.all(DESCRIPTORS.map(async (descriptor) => {
		const document = documentFor(descriptor, documents);
		if (descriptor.kind === "text") return {
			key: descriptor.key,
			kind: descriptor.kind,
			value: descriptor.read(document, defaults),
			maxLength: descriptor.maxLength,
			effect: descriptor.effect
		};
		const discovered = await descriptor.options(paths);
		const value = descriptor.read(document, discovered);
		const options = discovered.some((option) => option.value === value) ? discovered : [...discovered, {
			value,
			label: value,
			source: "configured"
		}];
		return {
			key: descriptor.key,
			kind: descriptor.kind,
			value,
			options,
			effect: descriptor.effect
		};
	})) };
}
async function readDocuments(paths) {
	const [claude, plugin] = await Promise.all([readDocument(paths.settingsFile), readDocument(paths.pluginSettingsFile)]);
	return {
		claude,
		plugin
	};
}
async function readGlobalSettings(deps = {}) {
	const paths = pathsFor(deps);
	return views(await readDocuments(paths), paths, deps.defaultLimits ?? DEFAULT_LIMITS);
}
/** Supervisor limits the user overrode in Settings; absent keys fall back to the plugin config. */
async function readSupervisorLimitOverrides(deps = {}) {
	let document;
	try {
		document = await readDocument(pathsFor(deps).pluginSettingsFile);
	} catch {
		return {};
	}
	const maxProcesses = document.maxProcesses;
	const idleTimeoutMinutes = document.idleTimeoutMinutes;
	return {
		...isBoundedInteger(maxProcesses, 1, MAX_PROCESSES_LIMIT) ? { maxProcesses } : {},
		...isBoundedInteger(idleTimeoutMinutes, 1, MAX_IDLE_TIMEOUT_MINUTES) ? { idleTimeoutMs: idleTimeoutMinutes * 6e4 } : {}
	};
}
/** The renderer the Host should produce output for. A missing, unreadable, or
*  malformed plugin settings file keeps today's plugin-owned transcript. */
async function readRenderMode(deps = {}) {
	let document;
	try {
		document = await readDocument(pathsFor(deps).pluginSettingsFile);
	} catch {
		return DEFAULT_CLAUDE_RENDER_MODE;
	}
	return isClaudeRenderMode(document.renderer) ? document.renderer : DEFAULT_CLAUDE_RENDER_MODE;
}
/** Which selector Claude sessions use; unreadable settings mean this plugin's. */
async function readPermissionSelector(deps = {}) {
	let document;
	try {
		document = await readDocument(pathsFor(deps).pluginSettingsFile);
	} catch {
		return DEFAULT_CLAUDE_PERMISSION_SELECTOR;
	}
	return isClaudePermissionSelector(document.permissionSelector) ? document.permissionSelector : DEFAULT_CLAUDE_PERMISSION_SELECTOR;
}
/** The mode a session runs under until it chooses one. A missing, unreadable,
*  or malformed plugin settings file means Claude Code's classifier decides. */
async function readDefaultPermissionMode(deps = {}) {
	let document;
	try {
		document = await readDocument(pathsFor(deps).pluginSettingsFile);
	} catch {
		return DEFAULT_CLAUDE_PERMISSION_MODE;
	}
	return isClaudePermissionMode(document.permissionMode) ? document.permissionMode : DEFAULT_CLAUDE_PERMISSION_MODE;
}
async function readWorktreeBranchPrefix(deps = {}) {
	const paths = pathsFor(deps);
	return WORKTREE_BRANCH_PREFIX.read(await readDocument(paths.pluginSettingsFile));
}
async function atomicWrite(path, document) {
	await mkdir(dirname(path), {
		recursive: true,
		mode: 448
	});
	const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, {
			encoding: "utf8",
			mode: 384,
			flag: "wx"
		});
		await chmod(temporary, 384);
		await rename(temporary, path);
		await chmod(path, 384);
	} finally {
		await rm(temporary, { force: true }).catch(() => void 0);
	}
}
function updateGlobalSettings(changes, deps = {}) {
	const changeObject = object(changes);
	if (changeObject === void 0 || Object.keys(changeObject).length === 0) return Promise.reject(/* @__PURE__ */ new Error("Global settings changes must be a non-empty object"));
	for (const key of Object.keys(changeObject)) if (!DESCRIPTOR_BY_KEY.has(key)) return Promise.reject(/* @__PURE__ */ new Error(`Unsupported global setting: ${key}`));
	const paths = pathsFor(deps);
	const operation = pendingWrite.catch(() => void 0).then(async () => {
		const documents = await readDocuments(paths);
		const changedDocuments = /* @__PURE__ */ new Set();
		for (const [key, value] of Object.entries(changeObject)) {
			const descriptor = DESCRIPTOR_BY_KEY.get(key);
			const document = documentFor(descriptor, documents);
			if (descriptor.kind === "select") descriptor.apply(document, value, await descriptor.options(paths));
			else descriptor.apply(document, value);
			changedDocuments.add(descriptor.document);
		}
		if (changedDocuments.has("claude")) await atomicWrite(paths.settingsFile, documents.claude);
		if (changedDocuments.has("plugin")) await atomicWrite(paths.pluginSettingsFile, documents.plugin);
		return views(documents, paths, deps.defaultLimits ?? DEFAULT_LIMITS);
	});
	pendingWrite = operation;
	return operation;
}
async function requestJson(io) {
	const body = object(await io.body(MAX_REQUEST_BYTES));
	if (body === void 0 || Object.keys(body).some((key) => key !== "changes")) throw new Error("Invalid global settings request");
	return body.changes;
}
function registerClaudeGlobalSettingsRoute(ctx, deps = {}) {
	registerPluginRoute(ctx, {
		mode: "unary",
		kind: "exact",
		path: CLAUDE_GLOBAL_SETTINGS_PATH,
		methods: ["GET", "PATCH"],
		budget: "fast",
		handler: async (io) => {
			try {
				const result = io.method === "GET" ? await readGlobalSettings(deps) : await updateGlobalSettings(await requestJson(io), deps);
				if (io.method === "PATCH") await deps.onUpdated?.();
				return {
					status: 200,
					value: result
				};
			} catch (error) {
				return {
					status: 400,
					value: { error: error instanceof Error ? error.message : "Invalid global settings request" }
				};
			}
		}
	});
}
//#endregion
//#region src/index.ts
const name = "llm-claude";
const inject = [
	"llm",
	"agents",
	"agentPresets",
	"commands",
	"subprocess",
	"approval",
	"userQuestions",
	"attachments"
];
const Config = z.object({
	executablePath: z.string().default(""),
	model: z.string().default("default"),
	idleTimeoutMs: z.number().min(1e3).max(2147483647).default(18e5),
	maxProcesses: z.number().step(1).min(1).default(4)
});
const CLAUDE_SCOPE_UNAVAILABLE_MESSAGE = "agent command scope unavailable (preset route not mounted?)";
const CATALOG_RETRY_MS = 5e3;
const SCOPE_RETRY_MS = 500;
const MAX_CATALOG_RETRIES = 3;
/** Bounded: each extra checkout costs a git chain and a `gh pr view` per sweep.
*  A fan-out over every backend service is the largest real case. */
const MAX_EXTRA_REPOSITORIES = 12;
const MAX_SCOPE_RETRIES = 24;
function mountClaudeMetadata(ctx, supervisor, agent, model, publishCommands = () => {}, resolveCommands = () => ctx.agentPresets.serviceFor(agent, CLAUDE_COMMANDS_SERVICE)) {
	if (ctx.agentPresets.composedPreset(agent.ctx) !== "claude") return void 0;
	let stopped = false;
	let pending = Promise.resolve();
	let commandScope;
	const scopedCommands = () => {
		const scoped = commandScope ?? resolveCommands();
		if (scoped === void 0) throw new Error(CLAUDE_SCOPE_UNAVAILABLE_MESSAGE);
		commandScope = scoped;
		return scoped;
	};
	const commandTarget = { list: () => scopedCommands().list(agent) };
	const warn = (area, error) => {
		ctx.logger.warn(`dsh-claude: ${area} refresh failed for ${String(agent.id)}: ${error instanceof Error ? error.message : String(error)}`);
	};
	/** A session that is mid-turn, or a process pool with no free slot, is not a
	*  failed refresh: it is one that has to wait. The metadata lane refuses to
	*  disturb a running turn by design, so warning about it filled the log for
	*  the whole length of every long turn. A busy session refreshes again on its
	*  own idle transition; a full pool is another session's turn, so the catalog
	*  keeps its bounded retry, just without the warning. */
	const deferrable = (error) => error instanceof ClaudeTurnBusyError || error instanceof ClaudeProcessLimitError;
	const isScopeUnavailable = (error) => {
		if (error instanceof Error) return error.message === CLAUDE_SCOPE_UNAVAILABLE_MESSAGE;
		return String(error) === CLAUDE_SCOPE_UNAVAILABLE_MESSAGE;
	};
	const diagnostic = claudeBridgeDiagnostics.get(agent) ?? { attempts: 0 };
	claudeBridgeDiagnostics.set(agent, diagnostic);
	let catalogRetries = 0;
	let scopeRetries = 0;
	let retryTimer;
	const scheduleRetry = (area, attempt) => {
		if (retryTimer !== void 0) clearTimeout(retryTimer);
		const delay = area === "command catalog" ? CATALOG_RETRY_MS * attempt : Math.min(SCOPE_RETRY_MS * 2 ** attempt, 5e3);
		retryTimer = setTimeout(() => {
			if (!stopped) refresh();
		}, delay);
		retryTimer.unref?.();
	};
	const refresh = () => {
		pending = pending.then(async () => {
			if (stopped) return;
			diagnostic.attempts += 1;
			let catalog;
			try {
				catalog = await supervisor.supportedCommands(agent, model);
				catalogRetries = 0;
				scopeRetries = 0;
				diagnostic.lastCatalog = catalog.length;
				delete diagnostic.lastError;
			} catch (error) {
				diagnostic.lastError = error instanceof Error ? error.message : String(error);
				if (!deferrable(error)) warn("command catalog", error);
				if (!stopped && !(error instanceof ClaudeTurnBusyError) && catalogRetries < MAX_CATALOG_RETRIES) {
					catalogRetries += 1;
					scheduleRetry("command catalog", catalogRetries);
				}
			}
			if (stopped || catalog === void 0) return;
			try {
				const commands = projectClaudeCommands(catalog, commandTarget);
				publishCommands(commands);
				diagnostic.registered = commands.map((view) => view.publicName);
				if (!stopped) scopeRetries = 0;
			} catch (error) {
				diagnostic.lastError = error instanceof Error ? error.message : String(error);
				warn("command catalog", error);
				if (!stopped && isScopeUnavailable(error) && scopeRetries < MAX_SCOPE_RETRIES) {
					scopeRetries += 1;
					scheduleRetry("command scope", scopeRetries);
				}
			}
			if (stopped) return;
			try {
				const plan = await supervisor.planUsage(agent, model);
				if (!stopped) recordPlanUsage(normalizePlanUsage(plan, Date.now()));
			} catch (error) {
				if (!deferrable(error)) warn("plan usage", error);
			}
		});
	};
	return agent.ctx.effect(() => {
		const stopStatus = agent.ctx.on("agent/status", ({ status }) => {
			if (status === "idle") refresh();
		});
		refresh();
		return async () => {
			stopped = true;
			publishCommands([]);
			if (retryTimer !== void 0) clearTimeout(retryTimer);
			stopStatus();
			await pending;
		};
	}, "dsh-claude: agent metadata bridge");
}
async function apply(ctx, config) {
	process.env.IS_SANDBOX = "1";
	const runner = withElectronNodeRunner(ctx.subprocess);
	let systemProxy;
	const subprocess = withSystemProxy(runner, () => systemProxy);
	detectWindowsSystemProxy(runner).then((proxy) => {
		systemProxy = proxy;
		if (proxy !== void 0) ctx.logger.info("dsh-claude: child processes use the Windows system proxy");
	});
	const defaultLimits = {
		idleTimeoutMs: config.idleTimeoutMs ?? 18e5,
		maxProcesses: config.maxProcesses ?? 4
	};
	const supervisorConfig = {
		executablePath: "",
		defaultModel: config.model ?? "default",
		...defaultLimits
	};
	const applySettingsOverrides = async () => {
		const overrides = await readSupervisorLimitOverrides();
		supervisorConfig.idleTimeoutMs = overrides.idleTimeoutMs ?? defaultLimits.idleTimeoutMs;
		supervisorConfig.maxProcesses = overrides.maxProcesses ?? defaultLimits.maxProcesses;
	};
	await applySettingsOverrides();
	let permissionSelector = await readPermissionSelector();
	const sidecar = new ClaudeSidecarRepository();
	const repositoryStatus = new RepositoryStatusService(subprocess);
	const repositorySetup = new RepositorySetupService(subprocess, {
		branchPrefix: () => readWorktreeBranchPrefix(),
		summarizeBranch: (intent) => summarizeBranchSlug(supervisorConfig.executablePath, intent)
	});
	const reviewComments = new ReviewCommentStore();
	const commandCatalogs = /* @__PURE__ */ new Map();
	/** The Host's access knobs, driven from a Claude mode; see permission-mode-host.ts. */
	const hostPresets = {
		presets: () => ctx.get("permissionPresets"),
		setPolicy: (agent, policy) => {
			ctx.approval.setPolicy(agent, policy);
		}
	};
	const supervisor = new ClaudeSupervisor({
		runtime: subprocess,
		approval: ctx.approval,
		userQuestions: ctx.userQuestions,
		config: supervisorConfig,
		resolveAgent: (sessionId) => ctx.agents.get(sessionId),
		runDetached: (operation) => ctx.agents.withoutInitiator(operation),
		sidecar,
		defaultPermissionMode: () => readDefaultPermissionMode(),
		permissionSelector: async () => permissionSelector,
		logger: { warn: (message) => {
			ctx.logger.warn(message);
		} },
		hostJobs: new ClaudeHostJobs(() => ctx.get("jobs"), (message) => {
			ctx.logger.warn(message);
		})
	});
	let bootFailure;
	let executableResolved = false;
	try {
		supervisorConfig.executablePath = (await resolveClaudeExecutable(subprocess, config.executablePath === void 0 || config.executablePath.length === 0 ? void 0 : config.executablePath)).path;
		executableResolved = true;
		ctx.llm.registerAdapter([...CLAUDE_CODE_PROVIDER_IDS], createClaudeCodeAdapter(supervisor, ctx.agents, ctx.attachments, (agent) => ctx.agentPresets.composedPreset(agent.ctx), (sessionId) => reviewComments.drain(sessionId), () => readRenderMode(), (request) => summarizeSessionTitle(supervisorConfig.executablePath, request), () => probeClaudeModels(supervisorConfig.executablePath)));
		ensureClaudeModels(() => probeClaudeModels(supervisorConfig.executablePath)).then(() => {
			const defaults = ctx.get("agentDefaultModel");
			const current = defaults?.currentSelection();
			if (defaults === void 0 || current === void 0 || !CLAUDE_CODE_PROVIDER_IDS.includes(current.provider)) return;
			const model = canonicalClaudeModelId(current.model);
			if (model === current.model) return;
			return defaults.saveSelection({
				...current,
				model
			});
		}).catch((error) => {
			ctx.logger.warn(`dsh-claude: could not normalize the default model: ${error instanceof Error ? error.message : String(error)}`);
		});
		ctx.provide(CLAUDE_STEERING_SERVICE, { deliver: (sessionId, prompt) => supervisor.deliverSteering(sessionId, prompt) });
		ctx.effect(() => mountClaudeSteering(ctx, supervisor, ctx.attachments, async () => await readRenderMode() === "native", (message) => {
			ctx.logger.warn(message);
		}), "dsh-claude: steering bridge");
		ctx.effect(() => {
			const mounted = /* @__PURE__ */ new Map();
			const pending = /* @__PURE__ */ new Set();
			const MOUNT_RETRY_MS = 200;
			const MOUNT_RETRY_LIMIT = 50;
			/** A session this plugin just met (created, or switched to the Claude
			*  preset) is put on the sandbox its default mode needs, so a Host whose
			*  default preset is full access does not turn a configured `auto` into
			*  bypass. Sessions found on boot keep whatever they were on. */
			const align = async (agent) => {
				if (permissionSelector === "native") return;
				const sessionId = agent.id;
				try {
					const [projection, defaultMode] = await Promise.all([sidecar.read(sessionId), readDefaultPermissionMode()]);
					alignSessionWithDefault(hostPresets, agent, projection.permissionMode, defaultMode);
				} catch (error) {
					ctx.logger.warn(`dsh-claude: default permission mode not applied for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
				}
			};
			const mount = (agent, fresh) => {
				if (mounted.has(agent)) return;
				const sessionId = agent.id;
				if (fresh) align(agent);
				const dispose = mountClaudeMetadata(ctx, supervisor, agent, supervisorConfig.defaultModel, (commands) => {
					if (commands.length === 0) commandCatalogs.delete(sessionId);
					else commandCatalogs.set(sessionId, commands);
				});
				if (dispose !== void 0) mounted.set(agent, dispose);
				pending.delete(agent);
			};
			const mountWhenPresetSettles = (agent, fresh) => {
				if (mounted.has(agent) || pending.has(agent)) return;
				if (ctx.agentPresets.composedPreset(agent.ctx) !== void 0) {
					mount(agent, fresh);
					return;
				}
				pending.add(agent);
				let attempts = 0;
				const retry = () => {
					if (mounted.has(agent) || !pending.has(agent)) return;
					if (ctx.agentPresets.composedPreset(agent.ctx) !== void 0) {
						mount(agent, fresh);
						return;
					}
					attempts += 1;
					if (attempts >= MOUNT_RETRY_LIMIT) {
						pending.delete(agent);
						return;
					}
					setTimeout(retry, MOUNT_RETRY_MS).unref?.();
				};
				setTimeout(retry, MOUNT_RETRY_MS).unref?.();
			};
			const stopCreated = ctx.on("agent/created", ({ agent }) => {
				mountWhenPresetSettles(agent, true);
			});
			const onPresetSelected = ctx.on;
			const stopSelected = onPresetSelected("agent-preset/selected", (sessionId, preset) => {
				if (preset !== "claude") return;
				const agent = ctx.agents.get(sessionId);
				if (agent !== void 0) mountWhenPresetSettles(agent, true);
			});
			for (const agent of ctx.agents.list()) mountWhenPresetSettles(agent, false);
			return async () => {
				stopCreated();
				stopSelected();
				pending.clear();
				await Promise.allSettled([...mounted.values()].map((dispose) => dispose()));
				mounted.clear();
			};
		}, "dsh-claude: metadata bridges");
		ctx.effect(() => {
			const agentOf = (sessionId) => ctx.agents.get(sessionId);
			const defaults = () => ctx.get("agentDefaultModel");
			const sync = createPresetModelSync({
				currentSelection: (sessionId) => {
					const agent = agentOf(sessionId);
					const projections = ctx.get("sessionProjections");
					return (agent === void 0 ? void 0 : projections?.stateOf(agent.session, "modelSelection")?.pending) ?? defaults()?.currentSelection();
				},
				isBlank: (sessionId) => {
					const session = agentOf(sessionId)?.session;
					if (session === void 0 || session.header.origin === "subagent" || session.header.parentSession !== void 0) return false;
					return session.requestHeader?.() === void 0;
				},
				selectModel: async (request) => {
					const controller = ctx.get("sessionController");
					if (controller === void 0) throw new Error("the Host mounts no session controller");
					return controller.selectModel(request);
				},
				fallbackOtherModel: async () => {
					for (const provider of ctx.llm.listProviders()) {
						if (CLAUDE_CODE_PROVIDER_IDS.includes(provider.id)) continue;
						const models = await ctx.llm.listModels(provider.id).catch(() => []);
						if (models[0] !== void 0) return {
							provider: provider.id,
							model: models[0].id
						};
					}
				},
				defaultClaudeModel: () => supervisorConfig.defaultModel,
				warn: (message) => {
					ctx.logger.warn(message);
				}
			});
			sync.remember(defaults()?.currentSelection());
			const onPresetSelected = ctx.on;
			const stopSelected = onPresetSelected("agent-preset/selected", (sessionId, preset) => {
				sync.sync(sessionId, preset);
			});
			const stopCreated = ctx.on("agent/created", ({ agent }) => {
				let attempts = 0;
				const check = () => {
					const preset = ctx.agentPresets.composedPreset(agent.ctx);
					if (preset !== void 0) {
						sync.sync(agent.id, preset);
						return;
					}
					if (++attempts < 25) setTimeout(check, 200).unref?.();
				};
				check();
			});
			return () => {
				stopSelected();
				stopCreated();
			};
		}, "dsh-claude: preset model sync");
	} catch (error) {
		bootFailure = {
			step: executableResolved ? "initialization" : "executable",
			error
		};
	}
	ctx.on("agent/disposed", async ({ agent }) => {
		reviewComments.disposeSession(agent.id);
		await supervisor.disposeSession(agent.id, "agent disposed by the Host");
	});
	let sweepWorktrees;
	const injectWorkspaceRegistry = ctx.inject;
	injectWorkspaceRegistry(["workspaceRegistry"], (sweepCtx) => {
		const archiveSessions = async (worktreePath) => {
			const persistence = sweepCtx.get("sessionPersistence");
			if (persistence === void 0) return;
			const target = comparablePath(worktreePath);
			for (const header of await persistence.list()) {
				if (typeof header.id !== "string" || typeof header.cwd !== "string") continue;
				if (comparablePath(header.cwd) !== target) continue;
				await sweepCtx.workspaceRegistry.archiveSession(header.id).catch(() => void 0);
			}
		};
		const sweep = () => {
			try {
				const paths = sweepCtx.workspaceRegistry.list().map((workspace) => workspace.path);
				repositorySetup.cleanupOrphans(paths, archiveSessions).catch(() => void 0);
			} catch {}
		};
		sweepCtx.effect(() => {
			sweep();
			sweepWorktrees = sweep;
			const timer = setInterval(sweep, 6e4);
			timer.unref?.();
			return () => {
				sweepWorktrees = void 0;
				clearInterval(timer);
			};
		}, "dsh-claude: worktree reconciliation");
	});
	ctx.effect(() => () => reviewComments.dispose(), "dsh-claude: review comments store");
	ctx.effect(() => () => supervisor.dispose(), "dsh-claude: process supervisor");
	ctx.effect(() => () => repositoryStatus.dispose(), "dsh-claude: repository status cache");
	ctx.inject(["webServer"], (webCtx) => {
		registerClaudeClientDiagnosticsRoute(webCtx);
		registerClaudeDoctorRoutes(webCtx, subprocess, supervisor, supervisorConfig, bootFailure);
		const desktopActions = webCtx.get("desktopActions");
		registerClaudeUpdateRoutes(webCtx, subprocess, { ...typeof desktopActions?.requestRestart === "function" ? { requestRestart: desktopActions.requestRestart.bind(desktopActions) } : {} });
		registerClaudeGlobalSettingsRoute(webCtx, {
			defaultLimits,
			onUpdated: async () => {
				await applySettingsOverrides();
				permissionSelector = await readPermissionSelector();
				supervisor.limitsChanged();
			}
		});
		/** Linked pull requests cleaned up, as `clone root + branch`: the log
		*  still names them, so the sweep has to be told to stop listing them. */
		const cleanedLinked = /* @__PURE__ */ new Set();
		registerRepositorySetupRoute(webCtx, repositorySetup, () => sweepWorktrees?.(), (path, branch) => {
			repositoryStatus.invalidate(path);
			if (branch !== void 0) cleanedLinked.add(`${path}\0${branch}`);
		});
		registerRepositoryFileRoute(webCtx, repositoryStatus);
		registerJiraRoute(webCtx, new JiraService());
		const repositoryActions = new RepositoryActionService(subprocess, supervisorConfig.executablePath, (cwd) => repositoryStatus.invalidate(cwd));
		/** Checkouts besides its own a session's routes may act on: every root a
		*  projection sweep has ever vouched for, so a transient probe failure in
		*  one sweep does not un-authorise a linked bar the client still shows. */
		const extraRoots = new SessionRootLedger(48);
		const cwdForClaudeSession = (sessionId, root) => {
			const agent = webCtx.agents.get(sessionId);
			if (agent === void 0 || webCtx.agentPresets.composedPreset(agent.ctx) !== "claude") return void 0;
			if (root === void 0) return agent.session.header.cwd;
			return extraRoots.allows(sessionId, root) ? root : void 0;
		};
		const extraRepositoriesForClaudeSession = async (sessionId, activities) => {
			const cwd = cwdForClaudeSession(sessionId);
			if (cwd === void 0) return [];
			const [own, ownStatus] = await Promise.all([repositoryStatus.rootOf(cwd), repositoryStatus.inspect(cwd)]);
			const roots = await touchedRepositoryRoots(touchedFilePaths(activities), own ?? cwd, (directory) => repositoryStatus.rootOf(directory), MAX_EXTRA_REPOSITORIES);
			const probed = await Promise.all(roots.map((root) => repositoryStatus.inspect(root)));
			const checkouts = probed.filter(linkedRepositoryShown);
			const covered = new Set(checkouts.map((status) => `${status.remote?.toLowerCase()}#${status.pullRequest?.number}`));
			const pullRequests = touchedPullRequests(activities, ownStatus.remote).filter((item) => !covered.has(`${item.repository}#${item.number}`)).slice(0, Math.max(0, MAX_EXTRA_REPOSITORIES - checkouts.length));
			const parents = [...new Set([own ?? cwd, ...probed.flatMap((status) => status.root === void 0 ? [] : [status.root])].map((root) => dirname(root)))];
			const visited = pullRequests.length === 0 ? [] : visitedPaths(activities);
			const cloneFor = async (item) => {
				const named = probed.find((status) => status.status === "ready" && status.remote?.toLowerCase() === item.repository && status.root !== void 0);
				if (named?.root !== void 0) return named.root;
				const name = item.repository.split("/").at(-1) ?? "";
				const went = visited.filter((path) => path.toLowerCase().includes(name.toLowerCase()));
				for (const candidate of [...went, ...parents.map((parent) => join(parent, name))]) {
					const root = await repositoryStatus.rootOf(candidate);
					if (root === void 0) continue;
					const status = await repositoryStatus.inspect(root);
					if (status.status === "ready" && status.remote?.toLowerCase() === item.repository) return root;
				}
			};
			const detached = (await Promise.all(pullRequests.map(async (item) => {
				const cloneRoot = await cloneFor(item);
				const status = await repositoryStatus.inspectPullRequest(cloneRoot ?? cwd, item.repository, item.number);
				if (cloneRoot === void 0 || status.status !== "ready") return status;
				if (status.branch !== void 0 && cleanedLinked.has(`${cloneRoot}\0${status.branch}`)) return {
					status: "unavailable",
					cwd
				};
				return {
					...status,
					root: cloneRoot
				};
			}))).filter(linkedRepositoryShown);
			const linked = [...checkouts, ...detached];
			extraRoots.vouch(sessionId, linked.flatMap((status) => status.root === void 0 ? [] : [status.root]));
			return linked;
		};
		registerRepositoryActionRoute(webCtx, repositoryActions, cwdForClaudeSession);
		registerClaudePromptsRoute(webCtx);
		const promptAssist = new PromptAssistService(subprocess, () => supervisorConfig.executablePath);
		registerClaudePromptNameRoute(webCtx, promptAssist);
		registerClaudePromptRefineRoute(webCtx, promptAssist);
		registerPullRequestFeedbackRoute(webCtx, new PullRequestFeedbackService(subprocess), cwdForClaudeSession);
		registerAskRoute(webCtx, new AskService(subprocess, supervisorConfig.executablePath), cwdForClaudeSession, (sessionId) => {
			const snapshot = supervisor.snapshots().find((item) => item.sessionId === sessionId);
			return snapshot === void 0 ? void 0 : {
				model: claudeModelValue(snapshot.model),
				...snapshot.thinkingMode === void 0 ? {} : { thinkingMode: snapshot.thinkingMode }
			};
		});
		const ownsClaudeSession = (sessionId) => {
			const agent = webCtx.agents.get(sessionId);
			return agent !== void 0 && webCtx.agentPresets.composedPreset(agent.ctx) === "claude";
		};
		registerReviewCommentRoute(webCtx, reviewComments, ownsClaudeSession);
		registerPlanFeedbackRoute(webCtx, supervisor.planFeedback, ownsClaudeSession);
		registerClaudeBackgroundTaskRoute(webCtx, { background: (sessionId, toolUseId) => supervisor.backgroundToolCall(sessionId, toolUseId) });
		registerClaudeRewindRoute(webCtx, sidecar, {
			eventsFor: (sessionId) => {
				const agent = webCtx.agents.get(sessionId);
				return agent === void 0 || webCtx.agentPresets.composedPreset(agent.ctx) !== "claude" ? void 0 : agent.session.snapshotEvents();
			},
			busy: (sessionId) => supervisor.snapshots().some((item) => item.sessionId === sessionId && (item.state === "running" || item.state === "interrupting")),
			reset: (sessionId) => supervisor.disposeSession(sessionId, "rewind reset"),
			restoreFiles: async (sessionId, tree) => {
				const cwd = webCtx.agents.get(sessionId)?.session.header.cwd;
				return cwd === void 0 ? false : restoreWorktreeTree(subprocess, cwd, tree);
			}
		});
		registerPlanUsageRoute(webCtx, (fetchedAt) => probePlanUsage(supervisorConfig.executablePath, fetchedAt));
		const claudeSessionBusy = (sessionId) => supervisor.snapshots().some((item) => item.sessionId === sessionId && (item.state === "running" || item.state === "interrupting"));
		registerClaudePermissionModeRoute(webCtx, sidecar, {
			ownsSession: ownsClaudeSession,
			busy: claudeSessionBusy,
			applyHostPreset: async (sessionId, sandbox) => {
				const agent = webCtx.agents.get(sessionId);
				return agent !== void 0 && applyHostPreset(hostPresets, agent, sandbox);
			}
		});
		const permissionModeForClaudeSession = async (sessionId) => {
			const agent = webCtx.agents.get(sessionId);
			if (agent === void 0 || webCtx.agentPresets.composedPreset(agent.ctx) !== "claude") return void 0;
			const projection = await sidecar.read(sessionId);
			const folded = claudePermissionMode(agent.session.snapshotEvents(), permissionSelector === "native" ? void 0 : projection.permissionMode ?? await readDefaultPermissionMode());
			const live = supervisor.snapshots().find((item) => item.sessionId === sessionId);
			const autoSupported = live === void 0 ? void 0 : claudeModelRow(live.model)?.supportsAutoMode;
			return {
				mode: folded === "auto" && autoSupported === false ? "default" : folded,
				locked: claudeSessionBusy(sessionId),
				...autoSupported === void 0 ? {} : { autoSupported }
			};
		};
		registerClaudeProjectionRoute(webCtx, sidecar, ownsClaudeSession, (sessionId) => commandCatalogs.get(sessionId) ?? [], async (sessionId) => {
			const agent = webCtx.agents.get(sessionId);
			if (agent === void 0 || webCtx.agentPresets.composedPreset(agent.ctx) !== "claude") return void 0;
			const cwd = agent.session.header.cwd;
			return cwd === void 0 ? void 0 : repositoryStatus.inspect(cwd);
		}, (sessionId) => reviewComments.list(sessionId), extraRepositoriesForClaudeSession, permissionModeForClaudeSession, () => permissionSelector, (listener) => {
			const onPresetSelected = webCtx.on;
			return onPresetSelected("agent-preset/selected", (sessionId, preset) => {
				let attempts = 0;
				const check = () => {
					attempts += 1;
					if (ownsClaudeSession(sessionId) === (preset === "claude") || attempts >= 25) {
						listener(sessionId);
						return;
					}
					setTimeout(check, 200).unref?.();
				};
				check();
			});
		});
	});
}
//#endregion
export { CLAUDE_STEERING_SERVICE, Config, apply, inject, mountClaudeMetadata, name };

//# sourceMappingURL=index.mjs.map