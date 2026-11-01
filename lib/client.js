window.__ModuleLoader__.load({
	id: "@norman-else/dsh-claude",
	factory: (require) => {
		var module = { exports: {} };
		module.exports;
		var { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } = require("react");
		var { Button, DiffBlock, DisclosureRow, HoverCard, IconAgentPresetOutlineRegular, IconApiOutlineRegular, IconBranchOutlineRegular, IconCheckOutlineRegular, IconChevronDownOutlineRegular, IconChevronRightOutlineRegular, IconChevronUpOutlineRegular, IconCloseOutlineRegular, IconListPenOutlineRegular, IconLoadingOutlineRegular, IconRefreshOutlineRegular, IconRightUpOutlineRegular, IconSearchOutlineRegular, IconSparkleRegular, IconThinkOutlineRegular, IconTrashOutlineRegular, IconUserOutlineRegular, IconUsersOutlineRegular, MarkdownText, Menu, Modal, RiskConfirmation, StateDot, Toast, Tooltip, useDismissOnOutsidePointer } = require("@deepseek-ai/dsh-client-ui-primitives");
		var { Fragment: Fragment$1, jsx, jsxs } = require("react/jsx-runtime");
		var { createPortal } = require("react-dom");
		/** The preset description cordis.patch.yml publishes. The Host renders a
		*  third-party preset's description verbatim, so the client swaps this exact
		*  text for its own translation (see preset-seat-mark.ts). */
		const CLAUDE_PRESET_DESCRIPTION = "Use the local Claude Code as the complete agent runtime inside DSH.";
		/** Claude's subagent dispatch tools; rendered as plugin-owned group cards
		*  gathering subagent activity instead of native tool cards. */
		const TASK_TOOL_NAMES = /* @__PURE__ */ new Set(["Task", "Agent"]);
		const CLAUDE_DOCTOR_PATH = "/plugins/dsh-claude/doctor";
		const CLAUDE_CLIENT_DIAGNOSTICS_PATH = "/plugins/dsh-claude/client-diagnostics";
		const CLAUDE_UPDATE_CHECK_PATH = "/plugins/dsh-claude/update/check";
		const CLAUDE_USAGE_PATH = "/plugins/dsh-claude/usage";
		const CLAUDE_UPDATE_PATH = "/plugins/dsh-claude/update";
		const CLAUDE_PROJECTION_PATH = "/plugins/dsh-claude/projection";
		const CLAUDE_GLOBAL_SETTINGS_PATH = "/plugins/dsh-claude/settings/global";
		const CLAUDE_REPOSITORY_SETUP_PATH = "/plugins/dsh-claude/repository/setup";
		const CLAUDE_REPOSITORY_ACTION_PATH = "/plugins/dsh-claude/repository/action";
		const CLAUDE_REVIEW_COMMENT_PATH = "/plugins/dsh-claude/review-comments";
		const CLAUDE_REPOSITORY_FEEDBACK_PATH = "/plugins/dsh-claude/repository/feedback";
		const CLAUDE_REPOSITORY_FILE_PATH = "/plugins/dsh-claude/repository/file";
		const CLAUDE_JIRA_PATH = "/plugins/dsh-claude/jira";
		const CLAUDE_ASK_PATH = "/plugins/dsh-claude/ask";
		const CLAUDE_REWIND_PATH = "/plugins/dsh-claude/rewind";
		const CLAUDE_BACKGROUND_TASK_PATH = "/plugins/dsh-claude/background-task";
		const CLAUDE_PERMISSION_MODE_PATH = "/plugins/dsh-claude/permission-mode";
		const CLAUDE_PLAN_FEEDBACK_PATH = "/plugins/dsh-claude/plan/feedback";
		const CLAUDE_PROMPTS_PATH = "/plugins/dsh-claude/prompts";
		const CLAUDE_PROMPT_NAME_PATH = "/plugins/dsh-claude/prompts/name";
		const CLAUDE_PROMPT_REFINE_PATH = "/plugins/dsh-claude/prompts/refine";
		function isClaudeRenderMode(value) {
			return value === "plugin" || value === "native";
		}
		const DEFAULT_CLAUDE_PROSE_MODE = "plain";
		function isClaudeProseMode(value) {
			return value === "plain" || value === "enhanced";
		}
		//#endregion
		//#region src/client/task-projection.ts
		/** Tasks UI is reserved for detached work and genuine Claude subagents. */
		function isProjectedTask(task) {
			if (task.backgrounded === true) return true;
			return task.subagentType !== void 0 && task.subagentType.trim().length > 0;
		}
		function isProjectedTaskActivity(activity, tasks) {
			if (activity.kind !== "subagent" || activity.parentToolUseId !== void 0) return true;
			if (activity.taskId === void 0) return false;
			const task = tasks.find((candidate) => candidate.taskId === activity.taskId);
			return task !== void 0 && isProjectedTask(task);
		}
		//#endregion
		//#region src/client/conversation-sidecar.ts
		function isTaskActivity(value) {
			return (value.kind === "tool-call" || value.kind === "tool-result") && value.toolName !== void 0 && TASK_TOOL_NAMES.has(value.toolName);
		}
		function presentable(activity) {
			if (isTaskActivity(activity)) return true;
			if (activity.kind === "tool-call" || activity.kind === "tool-result") return false;
			if (activity.isError === true) return true;
			if (activity.title?.startsWith("Unknown Claude SDK message") === true) return false;
			switch (activity.kind) {
				case "subagent":
				case "permission":
				case "warning":
				case "error": return true;
				case "steering": return activity.summary !== void 0 && activity.summary.length > 0;
				case "thinking": return activity.summary !== void 0 && activity.summary.length > 0;
				default: return false;
			}
		}
		function running(activity) {
			return activity.phase === "started" || activity.phase === "updated";
		}
		function subcallOf(value) {
			if (value.kind !== "subagent" || value.toolUseId === void 0) return void 0;
			return {
				toolUseId: value.toolUseId,
				...value.toolName === void 0 ? {} : { toolName: value.toolName },
				...value.phase === void 0 ? {} : { phase: value.phase },
				...value.summary === void 0 ? {} : { summary: value.summary },
				...value.isError === void 0 ? {} : { isError: value.isError }
			};
		}
		/** Row identity for lifecycle folding. A subagent reports progress once per
		*  tool it runs, so its dispatch, every one of those pings, and its terminal
		*  notification all address the SAME row — they are one piece of work being
		*  re-described, not a queue of separate steps.
		*
		*  `known` reports whether a row already exists under a candidate id, which is
		*  what lets a Task tool-result land on the row its tool-call opened. */
		function foldKey(value, known) {
			const taskCallId = value.toolUseId === void 0 ? void 0 : `task-${value.toolUseId}`;
			const updatesExistingTask = value.kind === "tool-result" && taskCallId !== void 0 && known(taskCallId);
			if (!presentable(value) && !updatesExistingTask) return void 0;
			if ((isTaskActivity(value) || updatesExistingTask) && taskCallId !== void 0) return taskCallId;
			if (value.kind === "subagent" && value.parentToolUseId !== void 0) return `task-${value.parentToolUseId}`;
			if (value.kind === "subagent" && value.taskId !== void 0) return `subagent-task-${value.taskId}`;
			if (value.kind === "subagent" && value.toolUseId !== void 0) return `call-${value.toolUseId}`;
			if (value.kind === "warning" && value.title === "Claude API retry") return `api-retry-${value.turn}-${value.step}`;
			return `act-${value.turn}-${value.step}-${value.ordinal}`;
		}
		/** The task snapshot is authoritative over the lifecycle stream: a row whose
		*  task already settled must not keep pulsing just because the last ping it
		*  received said 'updated'. */
		function settled(row, taskStatus) {
			const taskId = row.activity.taskId;
			const status = taskId === void 0 ? void 0 : taskStatus.get(taskId);
			if (status === void 0 || status === "running") return row;
			const failed = status === "failed" || status === "stopped" || status === "killed";
			const settledTitle = row.activity.title?.replace(/^Running\s+/u, "");
			return {
				...row,
				running: false,
				activity: {
					...row.activity,
					phase: failed ? "failed" : "completed",
					...settledTitle === void 0 ? {} : { title: settledTitle },
					...failed ? { isError: true } : {}
				}
			};
		}
		/** Fold raw sidecar activity into the same lifecycle cards the old event
		*  projection rendered, keyed so a caller that interleaves these rows with
		*  other transcript items can look one up instead of re-folding per activity. */
		function foldedRows(activities, tasks) {
			const rows = /* @__PURE__ */ new Map();
			for (const value of activities) {
				const id = foldKey(value, (candidate) => rows.has(candidate));
				if (id === void 0) continue;
				const previous = rows.get(id);
				if (previous === void 0) {
					rows.set(id, {
						activity: value,
						running: running(value),
						subcalls: []
					});
					continue;
				}
				if (value.kind === "subagent" && value.parentToolUseId !== void 0) {
					const nested = subcallOf(value);
					if (nested === void 0) continue;
					const nestedIndex = previous.subcalls.findIndex((item) => item.toolUseId === nested.toolUseId);
					const subcalls = nestedIndex === -1 ? [...previous.subcalls, nested] : previous.subcalls.map((item, position) => position === nestedIndex ? {
						...item,
						...nested
					} : item);
					rows.set(id, {
						...previous,
						subcalls
					});
					continue;
				}
				rows.set(id, {
					activity: {
						...value,
						...value.toolName === void 0 && previous.activity.toolName !== void 0 ? { toolName: previous.activity.toolName } : {}
					},
					running: running(value),
					subcalls: previous.subcalls
				});
			}
			const taskStatus = new Map(tasks.map((task) => [task.taskId, task.status]));
			return new Map([...rows].map(([id, row]) => [id, settled(row, taskStatus)]));
		}
		function inputRecord(detail) {
			if (detail === void 0) return void 0;
			try {
				const value = JSON.parse(detail);
				return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
			} catch {
				return;
			}
		}
		const ASK_USER_QUESTION = "AskUserQuestion";
		/** Question and answer pairs from a record's `answers` map.
		*
		*  Both sources share the shape: the bridge's completed question row stores
		*  `{ answers }`, and Claude's own AskUserQuestion result echoes its input
		*  with `answers` filled in. The map is keyed by the question text. */
		function questionAnswers(detail) {
			const answers = inputRecord(detail)?.answers;
			if (answers === null || typeof answers !== "object" || Array.isArray(answers)) return void 0;
			const pairs = Object.entries(answers).filter((entry) => typeof entry[1] === "string" && entry[1].length > 0).map(([question, answer]) => ({
				question,
				answer
			}));
			return pairs.length === 0 ? void 0 : pairs;
		}
		/** Answers the question bridge recorded, by the tool call they belong to.
		*
		*  The bridge's row is the reliable copy: Claude's tool result carries the
		*  same answers only at the end of a bounded blob, which a long question can
		*  push past the cut. */
		function answeredQuestions(activities) {
			const answered = /* @__PURE__ */ new Map();
			for (const activity of activities) {
				if (activity.kind !== "question" || activity.phase !== "completed" || activity.toolUseId === void 0) continue;
				const pairs = questionAnswers(activity.detail);
				if (pairs !== void 0) answered.set(activity.toolUseId, pairs);
			}
			return answered;
		}
		/** The answers a finished AskUserQuestion card shows: the bridge's copy first,
		*  then the one inside Claude's own result, for sessions recorded before the
		*  bridge kept it. A failed or cancelled call shows none. */
		function cardAnswers(previous, resultDetail, failed) {
			if (previous.toolName !== ASK_USER_QUESTION || failed) return void 0;
			return previous.answers ?? questionAnswers(resultDetail);
		}
		function inputString(input, key) {
			const value = input?.[key];
			return typeof value === "string" && value.length > 0 ? value : void 0;
		}
		/** Read the compaction figures the supervisor stored as redacted JSON detail.
		*  Every field is optional: an older CLI reports the boundary without metadata,
		*  and the divider still renders — just without the token counts. */
		function compactionOf(activity) {
			const detail = inputRecord(activity.detail);
			const trigger = detail?.trigger;
			const preTokens = detail?.preTokens;
			const postTokens = detail?.postTokens;
			return {
				...trigger === "manual" || trigger === "auto" ? { trigger } : {},
				...typeof preTokens === "number" ? { preTokens } : {},
				...typeof postTokens === "number" ? { postTokens } : {}
			};
		}
		function lineCount(text) {
			return text.length === 0 ? 0 : text.split(/\r?\n/u).length;
		}
		function editDiffs(toolName, input) {
			const path = inputString(input, "file_path");
			if (path === void 0) return void 0;
			if (toolName === "MultiEdit" && Array.isArray(input?.edits)) {
				const diffs = input.edits.flatMap((edit) => {
					if (edit === null || typeof edit !== "object" || Array.isArray(edit)) return [];
					const item = edit;
					const newText = inputString(item, "new_string");
					if (newText === void 0) return [];
					return [{
						path,
						oldText: inputString(item, "old_string") ?? null,
						newText
					}];
				});
				return diffs.length === 0 ? void 0 : diffs;
			}
			if (toolName === "Edit") {
				const newText = inputString(input, "new_string");
				return newText === void 0 ? void 0 : [{
					path,
					oldText: inputString(input, "old_string") ?? null,
					newText
				}];
			}
			if (toolName === "Write") {
				const content = inputString(input, "content");
				return content === void 0 ? void 0 : [{
					path,
					oldText: null,
					newText: content
				}];
			}
		}
		function askedQuestions(input) {
			const questions = input?.questions;
			if (!Array.isArray(questions)) return [];
			return questions.map((item) => item !== null && typeof item === "object" ? item.question : void 0).filter((question) => typeof question === "string" && question.length > 0);
		}
		function toolDescription(toolName, input, failed = false, answers) {
			const path = inputString(input, "file_path") ?? inputString(input, "path");
			const pattern = inputString(input, "pattern") ?? inputString(input, "query");
			const description = inputString(input, "description");
			const target = path ?? pattern;
			let completed;
			let failedAction;
			switch (toolName) {
				case "Grep":
					completed = path === void 0 ? `Searched for ${pattern ?? "matches"}` : `Searched ${path} for ${pattern ?? "matches"}`;
					failedAction = path === void 0 ? `search for ${pattern ?? "matches"}` : `search ${path} for ${pattern ?? "matches"}`;
					break;
				case "Glob":
					completed = `Searched for ${pattern ?? "files"}`;
					failedAction = `search for ${pattern ?? "files"}`;
					break;
				case "Read":
					completed = `Read ${path ?? "a file"}`;
					failedAction = `read ${path ?? "a file"}`;
					break;
				case "WebFetch": {
					const url = inputString(input, "url") ?? "a web page";
					completed = `Fetched ${url}`;
					failedAction = `load ${url}`;
					break;
				}
				case "WebSearch":
					completed = `Searched the web for ${pattern ?? "results"}`;
					failedAction = `search the web for ${pattern ?? "results"}`;
					break;
				case "Edit":
				case "MultiEdit":
					completed = `Edited ${path ?? "a file"}`;
					failedAction = `edit ${path ?? "a file"}`;
					break;
				case "Write":
					completed = `Wrote ${path ?? "a file"}`;
					failedAction = `write ${path ?? "a file"}`;
					break;
				case "Bash": {
					const command = inputString(input, "command") ?? "a command";
					completed = description ?? `Ran ${command}`;
					failedAction = description === void 0 ? `run ${command}` : description;
					break;
				}
				case "ExitPlanMode":
					completed = "Proposed a plan";
					failedAction = "propose a plan";
					break;
				case ASK_USER_QUESTION: {
					const asked = askedQuestions(input);
					const single = answers?.length === 1 ? answers[0] : void 0;
					if (single !== void 0) completed = `${single.question} · ${single.answer}`;
					else if (answers !== void 0) completed = `Answered ${answers.length} questions`;
					else if (asked.length === 1) completed = asked[0];
					else completed = asked.length > 1 ? `Asked ${asked.length} questions` : "Asked a question";
					failedAction = "ask a question";
					break;
				}
				default:
					completed = description ?? `${toolName}${target === void 0 ? "" : ` ${target}`}`;
					failedAction = completed.charAt(0).toLowerCase() + completed.slice(1);
			}
			return failed ? `Failed to ${failedAction}` : completed;
		}
		/** The call id a task's own lifecycle pings were dispatched from. */
		function taskParentToolUseId(activities, taskId) {
			for (const activity of activities) {
				if (activity.taskId !== taskId) continue;
				const id = inputRecord(activity.detail)?.tool_use_id;
				if (typeof id === "string" && id.length > 0) return id;
			}
		}
		/**
		* The tools one task ran, in the shape the transcript's tool cards take.
		*
		* The task's own activities are lifecycle pings whose detail is the raw
		* protocol message -- useful to nobody reading a panel. The work is in the
		* activities addressed to the call that dispatched the task: a subagent's
		* nested calls carry it as `parentToolUseId`, and a backgrounded command IS
		* that call. Both are folded here the way {@link transcriptItemsForStep} folds
		* a step, so one card renderer serves the transcript and the task panel.
		*/
		function taskTools(activities, taskId, dispatchedBy) {
			const parent = dispatchedBy ?? taskParentToolUseId(activities, taskId);
			if (parent === void 0) return [];
			const tools = /* @__PURE__ */ new Map();
			const answered = answeredQuestions(activities);
			const ordered = [...activities].sort((left, right) => left.ordinal - right.ordinal);
			for (const activity of ordered) {
				const own = activity.parentToolUseId === parent;
				const isRoot = activity.parentToolUseId === void 0 && activity.toolUseId === parent;
				if (!own && !isRoot) continue;
				const toolUseId = activity.toolUseId;
				if (toolUseId === void 0) continue;
				const previous = tools.get(toolUseId);
				if (previous === void 0) {
					if (activity.toolName === void 0) continue;
					const input = inputRecord(activity.detail);
					const recorded = activity.toolName === ASK_USER_QUESTION ? answered.get(toolUseId) : void 0;
					tools.set(toolUseId, {
						toolUseId,
						toolName: activity.toolName,
						description: toolDescription(activity.toolName, input, false, recorded),
						...recorded === void 0 ? {} : { answers: recorded },
						...activity.summary === void 0 ? {} : { summary: activity.summary },
						...activity.detail === void 0 ? {} : { input: activity.detail },
						...activity.phase === void 0 ? {} : { phase: activity.phase },
						...activity.isError === void 0 ? {} : { isError: activity.isError },
						subcalls: []
					});
					continue;
				}
				const failed = activity.isError === true || activity.phase === "failed";
				const answers = cardAnswers(previous, activity.detail, failed);
				tools.set(toolUseId, {
					...previous,
					description: toolDescription(previous.toolName, inputRecord(previous.input), failed, answers),
					...answers === void 0 ? {} : { answers },
					...activity.detail === void 0 ? {} : { output: activity.detail },
					...activity.phase === void 0 ? {} : { phase: activity.phase },
					...activity.isError === void 0 ? {} : { isError: activity.isError }
				});
			}
			return [...tools.values()];
		}
		/**
		* One task's conversation as transcript items: the prose it wrote and the
		* tools it ran, in order, folded the way {@link transcriptItemsForStep} folds
		* a step. Only records addressed to the dispatching call take part; the
		* call itself and the task's lifecycle pings do not.
		*/
		function teammateTranscript(activities, taskId, dispatchedBy) {
			const parent = dispatchedBy ?? taskParentToolUseId(activities, taskId);
			if (parent === void 0) return [];
			const tools = new Map(taskTools(activities, taskId, parent).map((tool) => [tool.toolUseId, tool]));
			const items = [];
			let group;
			const flush = () => {
				if (group !== void 0 && group.tools.length > 0) items.push({
					kind: "tools",
					ordinal: group.ordinal,
					tools: group.tools
				});
				group = void 0;
			};
			const own = activities.filter((activity) => activity.parentToolUseId === parent).sort((left, right) => left.ordinal - right.ordinal);
			for (const activity of own) {
				if (activity.kind === "text") {
					flush();
					if (activity.text !== void 0 && activity.text.length > 0) items.push({
						kind: "text",
						ordinal: activity.ordinal,
						text: activity.text
					});
					continue;
				}
				if (activity.toolUseId === void 0 || activity.toolName === void 0) continue;
				const tool = tools.get(activity.toolUseId);
				if (tool === void 0) continue;
				group ??= {
					ordinal: activity.ordinal,
					tools: []
				};
				group.tools.push(tool);
			}
			flush();
			return items;
		}
		/** The turn's own accounting, drawn as a footer.
		*
		*  It hangs off the turn rather than the step that reported it: a turn waiting
		*  on background tasks reports usage per settled segment, and the task badge
		*  the plugin draws at the turn's foot would otherwise sit *under* a line that
		*  reads as a closing total. Every report is cumulative, so the newest one
		*  supersedes the ones before it. Natively drawn steps keep the Host's footer.
		*/
		function latestTurnUsage(activities, turn) {
			let latest;
			for (const activity of activities) {
				if (activity.turn !== turn || activity.kind !== "usage" || activity.renderer === "native") continue;
				if (activity.usage !== void 0) latest = activity.usage;
			}
			return latest;
		}
		/** Fold one step's shared ordinal stream into Claude Code-style prose and tool groups. */
		function transcriptItemsForStep(activities, turn, step, tasks = []) {
			const ordered = activities.filter((activity) => activity.turn === turn && activity.step === step && activity.renderer !== "native" && isProjectedTaskActivity(activity, tasks)).slice().sort((left, right) => left.ordinal - right.ordinal);
			const answered = answeredQuestions(activities.filter((activity) => activity.turn === turn && activity.step === step));
			const rows = foldedRows(ordered, tasks);
			const placed = /* @__PURE__ */ new Set();
			const items = [];
			let group;
			/** Emit an activity's folded row where it first appears; later pings that
			*  fold onto the same row update it in place rather than stacking up. */
			const emitRow = (activity) => {
				const id = foldKey(activity, (candidate) => rows.has(candidate));
				if (id === void 0 || placed.has(id)) return;
				const row = rows.get(id);
				if (row === void 0) return;
				placed.add(id);
				items.push({
					kind: "activity",
					ordinal: activity.ordinal,
					row
				});
			};
			const flushGroup = () => {
				if (group === void 0 || group.tools.length === 0) return;
				const current = group;
				const diffs = current.tools.flatMap((tool) => tool.diffs ?? []);
				const additions = diffs.reduce((total, diff) => total + lineCount(diff.newText), 0);
				const deletions = diffs.reduce((total, diff) => total + (diff.oldText === null ? 0 : lineCount(diff.oldText)), 0);
				const files = new Set(diffs.map((diff) => diff.path)).size;
				items.push({
					kind: "tools",
					ordinal: current.ordinal,
					tools: current.tools,
					...diffs.length === 0 ? {} : {
						additions,
						deletions,
						files
					}
				});
				group = void 0;
				for (const activity of current.trailingActivities) emitRow(activity);
			};
			for (const activity of ordered) {
				if (activity.kind === "text") {
					if (activity.parentToolUseId !== void 0) continue;
					flushGroup();
					if (activity.answer === true) continue;
					if (activity.text !== void 0 && activity.text.length > 0) items.push({
						kind: "text",
						ordinal: activity.ordinal,
						text: activity.text
					});
					continue;
				}
				if (activity.kind === "compaction") {
					flushGroup();
					items.push({
						kind: "compaction",
						ordinal: activity.ordinal,
						compaction: compactionOf(activity)
					});
					continue;
				}
				if (activity.kind === "tool-call" && activity.toolUseId !== void 0 && activity.toolName !== void 0) {
					group ??= {
						ordinal: activity.ordinal,
						tools: [],
						byId: /* @__PURE__ */ new Map(),
						trailingActivities: []
					};
					group.byId.set(activity.toolUseId, group.tools.length);
					const input = inputRecord(activity.detail);
					const recorded = activity.toolName === ASK_USER_QUESTION ? answered.get(activity.toolUseId) : void 0;
					group.tools.push({
						toolUseId: activity.toolUseId,
						toolName: activity.toolName,
						description: toolDescription(activity.toolName, input, false, recorded),
						...recorded === void 0 ? {} : { answers: recorded },
						...activity.summary === void 0 ? {} : { summary: activity.summary },
						...activity.detail === void 0 ? {} : { input: activity.detail },
						...activity.phase === void 0 ? {} : { phase: activity.phase },
						...activity.isError === void 0 ? {} : { isError: activity.isError },
						subcalls: []
					});
					continue;
				}
				if ((activity.kind === "tool-result" || activity.kind === "permission") && activity.toolUseId !== void 0 && group !== void 0) {
					const index = group.byId.get(activity.toolUseId);
					const previous = index === void 0 ? void 0 : group.tools[index];
					if (index !== void 0 && previous !== void 0) {
						const failed = activity.isError === true || activity.phase === "failed" || activity.kind === "permission";
						const diffs = failed ? void 0 : editDiffs(previous.toolName, inputRecord(previous.input));
						const additions = diffs?.reduce((total, diff) => total + lineCount(diff.newText), 0);
						const deletions = diffs?.reduce((total, diff) => total + (diff.oldText === null ? 0 : lineCount(diff.oldText)), 0);
						const answers = activity.kind === "permission" ? void 0 : cardAnswers(previous, activity.detail, failed);
						group.tools[index] = {
							...previous,
							description: toolDescription(previous.toolName, inputRecord(previous.input), failed, answers),
							...answers === void 0 ? {} : { answers },
							...activity.detail === void 0 ? {} : { output: activity.detail },
							...activity.phase === void 0 ? {} : { phase: activity.phase },
							...activity.isError === void 0 ? {} : { isError: activity.isError },
							...diffs === void 0 ? {} : {
								diffs,
								additions: additions ?? 0,
								deletions: deletions ?? 0
							},
							...activity.kind === "permission" ? {
								output: activity.summary,
								isError: true
							} : {}
						};
					}
					continue;
				}
				if (activity.kind === "subagent" && activity.parentToolUseId !== void 0 && group !== void 0) {
					const index = group.byId.get(activity.parentToolUseId);
					const previous = index === void 0 ? void 0 : group.tools[index];
					const nested = subcallOf(activity);
					if (index !== void 0 && previous !== void 0 && nested !== void 0) {
						const nestedIndex = previous.subcalls.findIndex((item) => item.toolUseId === nested.toolUseId);
						const subcalls = nestedIndex === -1 ? [...previous.subcalls, nested] : previous.subcalls.map((item, position) => position === nestedIndex ? {
							...item,
							...nested
						} : item);
						group.tools[index] = {
							...previous,
							subcalls
						};
					}
					continue;
				}
				if (!presentable(activity)) continue;
				if (group !== void 0) {
					group.trailingActivities.push(activity);
					continue;
				}
				emitRow(activity);
			}
			flushGroup();
			return items;
		}
		/** Keep one sidecar-backed activity group at the live chat tail, then anchor it
		* before the native assistant message or at step settlement when none appears. */
		const claudeActivityStepDefinition = {
			kind: "claude-activity-step",
			target: "chat",
			match(event) {
				if (event.type === "step/start") return {
					id: `${event.data.turn}:${event.data.step}`,
					role: "start"
				};
				if (event.type === "step/end") return {
					id: `${event.data.turn}:${event.data.step}`,
					role: "update"
				};
				if (event.type !== "assistant/message" || event.data.message.source.provider !== "claude") return null;
				return {
					id: `${event.data.turn}:${event.data.step}`,
					role: "update"
				};
			},
			start(_context, match) {
				if (match.event.type !== "step/start") throw new Error("Claude activity step requires step/start");
				return {
					turn: match.event.data.turn,
					step: match.event.data.step,
					anchorSeq: Number.MAX_SAFE_INTEGER - 1
				};
			},
			update(context, match) {
				if (match.event.type === "assistant/message") return {
					...context.state,
					assistantSeq: match.event.seq,
					anchorSeq: match.event.seq - .1
				};
				if (match.event.type === "step/end") return context.state.assistantSeq === void 0 ? {
					...context.state,
					anchorSeq: match.event.seq - .1
				} : context.state;
				throw new Error("Claude activity step update requires assistant/message or step/end");
			},
			buildViewNode(context) {
				const state = context.state;
				if (state === void 0) return null;
				return {
					key: context.key,
					kind: "claude-activity-step",
					id: context.id,
					target: "chat",
					anchorSeq: state.anchorSeq,
					location: context.start?.location ?? { kind: "unresolved" },
					visibility: "visible",
					data: {
						turn: state.turn,
						step: state.step
					}
				};
			}
		};
		/** Publish a marker for turns containing standard assistant output from the Claude adapter. */
		const claudeTurnDefinition = {
			kind: "claudeCode",
			match(event) {
				if (event.type === "turn/start") return {
					id: String(event.data.turn),
					role: "start"
				};
				if (event.type !== "assistant/message" || event.data.message.source.provider !== "claude") return null;
				return {
					id: String(event.data.turn),
					role: "update"
				};
			},
			start(_context, match) {
				if (match.event.type !== "turn/start") throw new Error("Claude turn marker requires turn/start");
				return {
					turn: match.event.data.turn,
					claude: false
				};
			},
			update(context, match) {
				if (match.event.type !== "assistant/message") throw new Error("Claude turn marker update requires assistant/message");
				return context.state.claude ? context.state : {
					turn: context.state.turn,
					claude: true
				};
			},
			buildLocationData(context, scope) {
				if (scope !== "turn" || context.state?.claude !== true) return null;
				const value = { turn: context.state.turn };
				return {
					kind: "turn",
					turn: context.state.turn,
					key: "claudeCode",
					value
				};
			}
		};
		/** Only Claude-produced turns render the sidecar-backed tail. The turn tail is
		*  a list Slot since Host 0.1.7, so every entry sees every turn and filters here. */
		function selectClaudeTurn(owner) {
			return owner.turn.data.get("claudeCode") ?? null;
		}
		//#endregion
		//#region src/client/markdown-theme.ts
		/** Claude Code's code presentation over the Host's Markdown renderer.
		*
		*  This package renders no Markdown of its own — prose, fenced blocks and the
		*  copy affordance all come from the Host's `MarkdownText` primitive. What it
		*  can own is what that primitive reads: the palette (custom properties) and
		*  the block's chrome (CSS over the primitive's own markup).
		*
		*  PARITY IS PARTIAL BY CONSTRUCTION. Both renderers highlight with shiki, but
		*  Claude Code's desktop build loads a full TextMate theme (Pierre Dark /
		*  Pierre Light Soft: 248 tokenColor rules over 424 scopes) and bakes the
		*  resolved colour into every span, while the Host loads shiki's legacy
		*  `css-variables` theme, which collapses every scope into the eleven buckets
		*  below. Those eleven carry the colours that dominate a code block —
		*  keywords, strings, comments, functions, numbers — and nothing here can
		*  recover the rest: `constant.numeric` and `constant` are two different
		*  colours in Pierre and one bucket here, and Pierre's string-coloured string
		*  delimiters share this sheet's single punctuation bucket. Matching the rest
		*  means this package running its own shiki, which is a different decision
		*  with a different cost.
		*
		*  Every rule fails open the way `host-chrome` does: the palette is
		*  declarations on this package's own wrapper, and the chrome rules match the
		*  primitive's CSS Module local names, so a Host that renames either simply
		*  stops matching and its stock presentation comes back.
		*/
		/** Wrapper class carrying the palette and scoping the chrome rules.
		*  `display:contents` so the extra element generates no box — custom
		*  properties inherit through it regardless. */
		const CLAUDE_MARKDOWN_SCOPE = "dsh-claude-markdown";
		/** Pierre mapped onto the Host's eleven buckets. Each entry names the theme
		*  scope the value was taken from, because the mapping — not the colour — is
		*  the part a reader has to check. */
		const PIERRE_DARK = [
			[
				"--shiki-background",
				"var(--dsw-alias-markdown-code-block)",
				"DSH code-block surface"
			],
			[
				"--shiki-foreground",
				"#fafafa",
				"editor.foreground"
			],
			[
				"--shiki-token-comment",
				"#737373",
				"comment"
			],
			[
				"--shiki-token-keyword",
				"#ff678d",
				"keyword, storage.type"
			],
			[
				"--shiki-token-string",
				"#5ecc71",
				"string"
			],
			[
				"--shiki-token-string-expression",
				"#ffa359",
				"punctuation.section.embedded"
			],
			[
				"--shiki-token-function",
				"#9d6afb",
				"entity.name.function"
			],
			[
				"--shiki-token-constant",
				"#68cdf2",
				"constant.numeric, constant.language"
			],
			[
				"--shiki-token-parameter",
				"#a3a3a3",
				"variable.parameter"
			],
			[
				"--shiki-token-punctuation",
				"#636363",
				"punctuation"
			],
			[
				"--shiki-token-link",
				"#ff678d",
				"markup.underline.link.markdown"
			]
		];
		const PIERRE_LIGHT = [
			[
				"--shiki-background",
				"var(--dsw-alias-markdown-code-block)",
				"DSH code-block surface"
			],
			[
				"--shiki-foreground",
				"#525252",
				"editor.foreground"
			],
			[
				"--shiki-token-comment",
				"#8a8a8a",
				"comment"
			],
			[
				"--shiki-token-keyword",
				"#ff678d",
				"keyword, storage.type"
			],
			[
				"--shiki-token-string",
				"#0dbe4e",
				"string"
			],
			[
				"--shiki-token-string-expression",
				"#fe8c2c",
				"punctuation.section.embedded"
			],
			[
				"--shiki-token-function",
				"#9d6afb",
				"entity.name.function"
			],
			[
				"--shiki-token-constant",
				"#08c0ef",
				"constant.numeric, constant.language"
			],
			[
				"--shiki-token-parameter",
				"#737373",
				"variable.parameter"
			],
			[
				"--shiki-token-punctuation",
				"#737373",
				"punctuation"
			],
			[
				"--shiki-token-link",
				"#ff678d",
				"markup.underline.link.markdown"
			]
		];
		/** Claude's brand clay (`--cds-hsl-clay`), its inline-code TEXT colour; the
		*  emphasized ramp is the light-theme variant. The chip's fill is deliberately
		*  NOT tinted with it — see {@link INLINE_FILL_DARK}. */
		const CLAY = "#d97757";
		const CLAY_EMPHASIZED = "#c8603f";
		/** Prose colours for the body of a Claude answer.
		*
		*  These are NOT Pierre: the palette above exists to match Claude's desktop
		*  build inside code blocks, and Claude paints prose in plain body text. This
		*  block is a deliberate departure — headings, emphasis and links get their
		*  own hues so a long answer is scannable, the way a Markdown-highlighting
		*  editor shows it. Values are theme-independent by design (the same six read
		*  acceptably on both surfaces); split them if the light theme ever needs its
		*  own ramp. The two `code*` entries are the exception: they are a dark surface
		*  and are only applied under a dark body.
		*
		*  The inline-code entry REPLACES {@link CLAY} rather than sitting beside it:
		*  two colours on the same chip is not a choice a stylesheet can make. */
		const PROSE = {
			heading: "#7C9EFF",
			bold: "#FFB454",
			italic: "#5BD6C0",
			inlineCode: "#FF7A93",
			listMarker: "#F2C94C",
			quote: "#9AA3B2",
			link: "#4DA3FF",
			codeBackground: "#0F1218",
			codeBorder: "#2E3546"
		};
		/** The inline-code chip fill: a neutral 4% wash (Claude's `--t1`), not a tint
		*  of the text colour. A clay-tinted fill reads as a coloured box around every
		*  identifier; the neutral one disappears into the surface and lets the text
		*  carry the accent, which is what the chip is for. */
		const INLINE_FILL_DARK = "hsl(0 0% 100% / .04)";
		const INLINE_FILL_LIGHT = "hsl(0 0% 4.3% / .04)";
		/** Block corner radius (Claude's `--r6`), against the Host's own 12px. */
		const BLOCK_RADIUS = "8px";
		function palette(entries, inlineFill) {
			return [...entries.map(([name, value]) => `${name}:${value};`), `--dsw-alias-markdown-inline-code:${inlineFill}`].join("");
		}
		const CLAUDE_MARKDOWN_THEME_CSS = [
			`.${CLAUDE_MARKDOWN_SCOPE}{display:contents;`,
			palette(PIERRE_LIGHT, INLINE_FILL_LIGHT),
			"}",
			`body[data-ds-dark-theme] .${CLAUDE_MARKDOWN_SCOPE}{`,
			palette(PIERRE_DARK, INLINE_FILL_DARK),
			"}",
			`.${CLAUDE_MARKDOWN_SCOPE} :not(pre)>code{color:${CLAY_EMPHASIZED};border-radius:4px;padding:1px 2px;font-size:1.05em!important}`,
			`body[data-ds-dark-theme] .${CLAUDE_MARKDOWN_SCOPE} :not(pre)>code{color:${CLAY}}`,
			`.${CLAUDE_MARKDOWN_SCOPE} [class*="bannerWrap"]{position:absolute;top:0;right:0;z-index:7;background:transparent;border-radius:0}`,
			`.${CLAUDE_MARKDOWN_SCOPE} [class*="banner"]:not([class*="bannerWrap"]){background:transparent;padding:6px 8px}`,
			`.${CLAUDE_MARKDOWN_SCOPE} [class*="infostring"]{display:none}`,
			`.${CLAUDE_MARKDOWN_SCOPE} pre{white-space:pre;word-break:normal;overflow-x:auto}`,
			`.${CLAUDE_MARKDOWN_SCOPE} [class*="block"]{--dsl-code-block-border-radius:${BLOCK_RADIUS}}`,
			`.${CLAUDE_MARKDOWN_SCOPE} [class*="block"] pre{border-radius:var(--dsl-code-block-border-radius)}`,
			`.${CLAUDE_MARKDOWN_SCOPE} [class*="block"]:has([class*="bannerWrap"]){box-shadow:0 0 0 1px #e1e5ee}`,
			`body[data-ds-dark-theme] .${CLAUDE_MARKDOWN_SCOPE} [class*="block"]:has([class*="bannerWrap"]){box-shadow:0 0 0 1px #353638}`
		].join("");
		/** The class the review-comment card puts on a rendered comment body. Declared
		*  here rather than imported because it is a literal inside `styles.ts`'s CSS
		*  string, not a constant; a rename there makes these rules miss and the
		*  comment keeps its stock colours, which is the same fail-open the chrome
		*  rules above rely on. */
		const COMMENT_BODY_SCOPE = "dshClaudeDiffCommentBody";
		/** Everything the `prose: 'enhanced'` setting adds, and nothing the base sheet
		*  needs. Appended AFTER the base sheet so its rules win ties on source order —
		*  see the note on the inline-code selector below. */
		const CLAUDE_MARKDOWN_ENHANCED_CSS = [
			`.${CLAUDE_MARKDOWN_SCOPE} :is(h1,h2,h3,h4,h5,h6){color:${PROSE.heading}}`,
			`.${CLAUDE_MARKDOWN_SCOPE} strong{color:${PROSE.bold}}`,
			`.${CLAUDE_MARKDOWN_SCOPE} em{color:${PROSE.italic}}`,
			`.${CLAUDE_MARKDOWN_SCOPE} li::marker{color:${PROSE.listMarker}}`,
			`.${CLAUDE_MARKDOWN_SCOPE} blockquote{border-left-color:${PROSE.quote};color:${PROSE.quote}}`,
			`.${CLAUDE_MARKDOWN_SCOPE} a{color:${PROSE.link}}`,
			`.${CLAUDE_MARKDOWN_SCOPE} :not(pre)>code,body[data-ds-dark-theme] .${CLAUDE_MARKDOWN_SCOPE} :not(pre)>code{color:${PROSE.inlineCode}}`,
			`body[data-ds-dark-theme] .${CLAUDE_MARKDOWN_SCOPE} [class*="block"]:has([class*="bannerWrap"]){background:${PROSE.codeBackground};box-shadow:0 0 0 1px ${PROSE.codeBorder}}`,
			`body[data-ds-dark-theme] .${CLAUDE_MARKDOWN_SCOPE} pre{background:${PROSE.codeBackground}}`,
			`.${COMMENT_BODY_SCOPE} :is(h1,h2,h3,h4,h5,h6){color:${PROSE.heading}}`,
			`.${COMMENT_BODY_SCOPE} strong{color:${PROSE.bold}}`,
			`.${COMMENT_BODY_SCOPE} em{color:${PROSE.italic}}`,
			`.${COMMENT_BODY_SCOPE} li::marker{color:${PROSE.listMarker}}`,
			`.${COMMENT_BODY_SCOPE} blockquote{border-left-color:${PROSE.quote};color:${PROSE.quote}}`,
			`.${COMMENT_BODY_SCOPE} a{color:${PROSE.link}}`,
			`.${COMMENT_BODY_SCOPE} :not(pre)>code{color:${PROSE.inlineCode}}`
		].join("");
		/** Live reference to this package's sheet, and the mode it currently holds.
		*  The mode is remembered so `ensureClaudeMarkdownTheme` — called on every
		*  Markdown render — cannot undo a choice boot or the settings panel made. */
		let styleTag = null;
		let mode = DEFAULT_CLAUDE_PROSE_MODE;
		function write() {
			if (typeof document === "undefined") return;
			if (styleTag === null || styleTag.parentNode === null) {
				styleTag = document.createElement("style");
				styleTag.dataset.dshClaudeMarkdownTheme = "";
				document.head.appendChild(styleTag);
			}
			styleTag.textContent = mode === "enhanced" ? CLAUDE_MARKDOWN_THEME_CSS + CLAUDE_MARKDOWN_ENHANCED_CSS : CLAUDE_MARKDOWN_THEME_CSS;
		}
		/** Attach the sheet, keeping whatever mode is already set. Idempotent. */
		function ensureClaudeMarkdownTheme() {
			write();
		}
		/** Switch the prose palette. Rewriting one global sheet repaints every mounted
		*  Markdown block at once, so no render state has to carry the setting. */
		function applyClaudeMarkdownTheme(next) {
			mode = next;
			write();
		}
		//#endregion
		//#region src/client/markdown-labels.tsx
		/** Stable across renders: MarkdownText keys its streaming renderer on this
		*  object's identity and reparses from scratch whenever it changes. */
		function useClaudeMarkdownLabels(t) {
			return useMemo(() => ({
				code: {
					copyLabel: t("markdownCopy"),
					copiedLabel: t("markdownCopied"),
					toolbarLabels: {
						codeLabel: t("codeBlockTitle"),
						wrapLabel: t("codeBlockWrap"),
						unwrapLabel: t("codeBlockUnwrap")
					}
				},
				footnotes: t("markdownFootnotes")
			}), [t]);
		}
		/** MarkdownText with the labels the running Host demands.
		*
		*  The published primitives package still types the old `codeLabels` prop, so
		*  the new shape cannot typecheck against it — the cast is confined here rather
		*  than repeated at every call site. Drop it once the installed
		*  @deepseek-ai/dsh-client-ui-primitives matches the Desktop build. */
		function ClaudeMarkdown({ text, labels, streaming, fileMentions }) {
			const props = {
				text,
				labels,
				...streaming === void 0 ? {} : { streaming },
				...fileMentions === void 0 ? {} : { fileMentions }
			};
			const Renderer = MarkdownText;
			ensureClaudeMarkdownTheme();
			return /* @__PURE__ */ jsx("div", {
				className: CLAUDE_MARKDOWN_SCOPE,
				children: /* @__PURE__ */ jsx(Renderer, { ...props })
			});
		}
		//#endregion
		//#region src/client/file-mentions.ts
		const MAX_TOKEN_CHARS = 512;
		const LINE_SUFFIX = /:(\d+)(?:[-–]\d+)?$/u;
		/** The file a token names, or undefined when it cannot be a path: commands,
		*  URLs, globs, and bare words stay code without costing a Host round trip. */
		function parseFileToken(value) {
			if (value.length === 0 || value.length > MAX_TOKEN_CHARS || /[\s`*?<>|"]/u.test(value)) return void 0;
			if (value.includes("://") || /^[-$~]/u.test(value)) return void 0;
			const suffix = LINE_SUFFIX.exec(value);
			const path = suffix === null ? value : value.slice(0, suffix.index);
			if (!/[/\\]/u.test(path) && !/\.[A-Za-z0-9]+$/u.test(path)) return void 0;
			return suffix === null ? { path } : {
				path,
				line: Number(suffix[1])
			};
		}
		/** Every distinct inline-code token in the text. Tokens inside fences are
		*  harmless extras: the renderer only asks about inline code. */
		function inlineCodeTokens(markdown) {
			return [...new Set([...markdown.matchAll(/`([^`\n]+)`/gu)].map((match) => match[1]))];
		}
		/** The Sidebar address of a path read through one Session; mirrors the
		*  Host's `sessionFileAddress`, which it does not export.
		*  ponytail: an absolute path inside the workspace keeps its absolute form, so
		*  it can open a second tab beside one opened by relative path. */
		function sessionFileAddress(sessionId, path) {
			const encode = (segment) => encodeURIComponent(segment).replace(/%3A/giu, ":");
			const normalized = path.replace(/\\/gu, "/").replace(/^(?:\.\/)+/u, "");
			return `dsh-resource://file/session/${encode(sessionId)}/${normalized.split("/").map(encode).join("/")}`;
		}
		/** One Session's existence answers, shared by every message in it.
		*  ponytail: answers never expire, so a token checked before its file existed
		*  stays inert until reload; Claude names files after writing them. */
		function cachedExists(stat, limit = 2e3) {
			const answers = /* @__PURE__ */ new Map();
			return (path) => {
				let answer = answers.get(path);
				if (answer === void 0) {
					if (answers.size >= limit) answers.clear();
					answer = stat(path).catch(() => false);
					answers.set(path, answer);
				}
				return answer;
			};
		}
		/** The mentions of one settled message: undefined until a token resolves, so
		*  the renderer keeps its plain first paint. */
		function useFileMentions(text, source, label) {
			const [found, setFound] = useState(() => /* @__PURE__ */ new Map());
			useEffect(() => {
				if (source === void 0) return;
				let live = true;
				for (const value of inlineCodeTokens(text)) {
					const token = parseFileToken(value);
					if (token === void 0) continue;
					source.exists(token.path).then((ok) => {
						if (!ok || !live) return;
						setFound((current) => current.has(value) ? current : new Map(current).set(value, token));
					});
				}
				return () => {
					live = false;
				};
			}, [text, source]);
			return useMemo(() => {
				if (source === void 0 || found.size === 0) return void 0;
				return { resolve(value) {
					const token = found.get(value);
					if (token === void 0) return void 0;
					return {
						open: () => source.open(token.path, token.line),
						label: label(token.path),
						title: token.path
					};
				} };
			}, [
				found,
				source,
				label
			]);
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
		/** The client waits one round trip longer, so the route's own 504 wins the
		*  race and the caller learns which budget elapsed instead of guessing. */
		const CLIENT_GRACE_MS = 3e3;
		function clientBudgetMs(budget) {
			return ROUTE_BUDGET_MS[budget] + CLIENT_GRACE_MS;
		}
		/** A request that never got a permit fails fast and says so, rather than
		*  spending its whole budget queued behind work it cannot see. */
		const QUEUE_WAIT_BUDGET_MS = 6e4;
		/** Per-lane ceilings inside the global budget.
		*
		*  The projection carrier holds a permanently reserved permit outside these,
		*  so three remain. `write + stream <= 2` leaves one permit that only a read
		*  can take: a diagnostic read always has somewhere to go, however many slow
		*  actions are in flight. That invariant is what stops a 150s repository
		*  action from reproducing the original symptom through a new mechanism. */
		const PLUGIN_LANE_CAPS = {
			read: 8,
			write: 4,
			stream: 2
		};
		/** How long a worktree hand-off holds its new Session when the Host never
		*  reports the submitted draft taken. Releasing earlier would abort the send;
		*  the Host's own submission path has no shorter bound to wait on. */
		const HANDOFF_HOLD_BUDGET_MS = 12e4;
		//#endregion
		//#region src/rewind.ts
		function isRewound(ranges, seq) {
			return ranges.some((range) => seq >= range.start && seq <= range.end);
		}
		//#endregion
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
		function isClaudePermissionSelector(value) {
			return value === "plugin" || value === "native";
		}
		//#endregion
		//#region src/client/plugin-transport.ts
		/**
		* The plugin's only door to the network.
		*
		* Every request the Client makes goes through here, and the shape of the
		* public functions is the point. There is no `signal` property, no `headers`,
		* no `RequestInit` and no millisecond number in any parameter: a caller cannot
		* hand this module an options object whose later spread silently overwrites
		* the deadline sitting above it. That is not a hypothetical — it is exactly
		* how four call sites lost their deadlines while looking completely ordinary,
		* because `exactOptionalPropertyTypes` forbids writing `signal: undefined` and
		* the spread idiom is what people reach for instead. `cancel` is positional
		* here, so `undefined` is simply passable and the idiom has nothing to do.
		*
		* The second seal is arithmetic. The browser shares a small fixed connection
		* budget between this plugin and the Host, and the plugin used to spend it
		* proportionally to how many Claude sessions existed. Here every request takes
		* a permit from a fixed pool first, so more call sites and more sessions
		* cannot become more sockets — a saturated plugin queues, and says `starved`
		* within `QUEUE_WAIT_BUDGET_MS` instead of dying silently at its full budget.
		*
		* Lane caps guarantee a read always has somewhere to go: the projection
		* carrier holds a reserved permit, and `write + stream` can occupy at most two
		* of the remaining three. The panel that diagnoses a saturated pool is
		* therefore the one request that cannot be starved by it.
		*/
		var PluginRequestError = class extends Error {
			reason;
			status;
			code;
			constructor(reason, message, status, code) {
				super(message);
				this.name = "PluginRequestError";
				this.reason = reason;
				if (status !== void 0) this.status = status;
				if (code !== void 0) this.code = code;
			}
		};
		let send = (...args) => fetch(...args);
		let held = 0;
		const laneHeld = {
			read: 0,
			write: 0,
			stream: 0
		};
		let projectionHeld = false;
		let queue = [];
		const inFlight = /* @__PURE__ */ new Map();
		/** The projection carrier owns a permit of its own, outside the lane caps, so
		*  the transcript stream and the panels never compete for the same slot. */
		function laneHasRoom(lane) {
			return held < 16 && laneHeld[lane] < PLUGIN_LANE_CAPS[lane];
		}
		function pump() {
			for (let index = 0; index < queue.length; index += 1) {
				const waiter = queue[index];
				if (waiter === void 0 || !laneHasRoom(waiter.lane)) continue;
				queue.splice(index, 1);
				index -= 1;
				clearTimeout(waiter.timer);
				held += 1;
				laneHeld[waiter.lane] += 1;
				waiter.admit();
			}
		}
		function release(lane) {
			held -= 1;
			laneHeld[lane] -= 1;
			pump();
		}
		/** Runs at most once, so a release can be wired to every ending of a stream
		*  without any of them having to know about the others. */
		function once(action) {
			let done = false;
			return () => {
				if (done) return;
				done = true;
				action();
			};
		}
		function acquire(lane) {
			let released = false;
			const releaseOnce = () => {
				if (released) return;
				released = true;
				release(lane);
			};
			if (laneHasRoom(lane)) {
				held += 1;
				laneHeld[lane] += 1;
				return Promise.resolve(releaseOnce);
			}
			return new Promise((resolve, reject) => {
				const waiter = {
					lane,
					admit: () => resolve(releaseOnce),
					reject,
					timer: setTimeout(() => {
						queue = queue.filter((item) => item !== waiter);
						reject(new PluginRequestError("starved", "The plugin is holding every connection it is allowed to open."));
					}, QUEUE_WAIT_BUDGET_MS)
				};
				queue.push(waiter);
			});
		}
		function withQuery(path, query) {
			if (query === void 0) return path;
			const encoded = new URLSearchParams(query).toString();
			return encoded.length === 0 ? path : `${path}?${encoded}`;
		}
		function failureOf(error, cancel) {
			if (error instanceof PluginRequestError) return error;
			if (cancel?.aborted === true) return new PluginRequestError("cancelled", "The caller cancelled the request.");
			const name = error instanceof Error ? error.name : "";
			if (name === "TimeoutError" || name === "AbortError") return new PluginRequestError("timeout", "The plugin route did not answer inside its budget.");
			return new PluginRequestError("http", error instanceof Error ? error.message : String(error));
		}
		async function decode(response) {
			let payload;
			try {
				payload = await response.json();
			} catch {
				if (response.ok) throw new PluginRequestError("shape", "The plugin route answered with a body this build cannot read.");
				throw new PluginRequestError("http", `HTTP ${response.status}`, response.status);
			}
			if (response.ok) return payload;
			if (response.status === 404) throw new PluginRequestError("route-missing", "The Host is running an older plugin build without this route.", 404);
			const record = typeof payload === "object" && payload !== null ? payload : void 0;
			const message = typeof record?.message === "string" ? record.message : typeof record?.error === "string" ? record.error : `HTTP ${response.status}`;
			const code = typeof record?.error === "string" ? record.error : void 0;
			throw new PluginRequestError("http", message, response.status, code);
		}
		async function dispatch(lane, method, path, budget, cancel, options) {
			const url = withQuery(path, options?.query);
			const key = options?.key ?? `${method} ${url}`;
			const existing = inFlight.get(key);
			if (existing !== void 0) return await existing;
			const run = (async () => {
				const free = await acquire(lane);
				try {
					const timeout = AbortSignal.timeout(clientBudgetMs(budget));
					const signal = cancel === void 0 ? timeout : AbortSignal.any([cancel, timeout]);
					return await decode(await send(url, {
						method,
						credentials: "same-origin",
						signal,
						headers: options?.json === void 0 ? { accept: "application/json" } : {
							accept: "application/json",
							"content-type": "application/json"
						},
						...options?.json === void 0 ? {} : { body: JSON.stringify(options.json) }
					}));
				} catch (error) {
					throw failureOf(error, cancel);
				} finally {
					free();
				}
			})();
			inFlight.set(key, run);
			try {
				return await run;
			} finally {
				if (inFlight.get(key) === run) inFlight.delete(key);
			}
		}
		/** A bounded read of a plugin route. */
		function pluginRead(path, budget, cancel, options) {
			return dispatch("read", "GET", path, budget, cancel, options);
		}
		/** A bounded write. Writes never coalesce by default: two of them are two
		*  intents, even when their bodies match. */
		function pluginWrite(path, budget, cancel, options) {
			const method = options?.method ?? "POST";
			return dispatch("write", method, path, budget, cancel, {
				...options,
				key: options?.key ?? `${method} ${withQuery(path, options?.query)} #${nextWriteId()}`
			});
		}
		let writeId = 0;
		function nextWriteId() {
			writeId += 1;
			return writeId;
		}
		/**
		* A reader that gives its permit back however the stream ends.
		*
		* The permit used to be released by one event only -- the caller's abort --
		* and a stream has three endings, two of which the caller does not cause: the
		* server closing the response, and the body failing mid-read. Either one left
		* the permit held. For the reserved carrier that permit is a single boolean,
		* so one such ending closed the transcript stream for the life of the page and
		* every reopen answered `starved`, silently, forever.
		*
		* Binding the release to the reader rather than to the signal is what makes
		* that unrepresentable: a caller cannot hold the permit past the stream it is
		* reading, because every way of leaving the read passes through here. `free`
		* is idempotent, so the abort listener below stays as the belt to this brace.
		*/
		function releasingReader(reader, free) {
			return {
				get closed() {
					return reader.closed;
				},
				read: async () => {
					try {
						const chunk = await reader.read();
						if (chunk.done) free();
						return chunk;
					} catch (error) {
						free();
						throw error;
					}
				},
				cancel: async (reason) => {
					try {
						await reader.cancel(reason);
					} finally {
						free();
					}
				},
				releaseLock: () => {
					reader.releaseLock();
				}
			};
		}
		async function openStream(lane, path, cancel, options, reserved) {
			const url = withQuery(path, options?.query);
			const free = reserved ? once(() => {
				projectionHeld = false;
			}) : await acquire(lane);
			try {
				const response = await send(url, {
					method: options?.method ?? "GET",
					credentials: "same-origin",
					signal: cancel,
					headers: options?.json === void 0 ? { accept: "application/x-ndjson" } : {
						accept: "application/x-ndjson",
						"content-type": "application/json"
					},
					...options?.json === void 0 ? {} : { body: JSON.stringify(options.json) }
				});
				if (!response.ok || response.body === null) {
					free();
					if (response.status === 404) throw new PluginRequestError("route-missing", "The Host is running an older plugin build without this route.", 404);
					throw new PluginRequestError("http", `HTTP ${response.status}`, response.status);
				}
				cancel.addEventListener("abort", free, { once: true });
				return releasingReader(response.body.getReader(), free);
			} catch (error) {
				free();
				throw failureOf(error, cancel);
			}
		}
		/** A long-lived NDJSON response. No deadline — it is meant to stay open — but
		*  it takes a counted permit for its whole life, which is the bound that
		*  matters. */
		function pluginNdjson(path, cancel, options) {
			return openStream("stream", path, cancel, options, false);
		}
		/** The reserved projection carrier: exactly one live connection, ever,
		*  whatever the session count. */
		function pluginProjectionStream(path, cancel, options) {
			if (projectionHeld) return Promise.reject(new PluginRequestError("starved", "The projection carrier is already open."));
			projectionHeld = true;
			return openStream("stream", path, cancel, options, true);
		}
		/** Fire-and-forget diagnostics. Dropped rather than queued when saturated:
		*  the channel that reports the plugin's own failures must never be the
		*  traffic that causes them. */
		function pluginBeacon(path, body) {
			if (!laneHasRoom("write")) return;
			pluginWrite(path, "fast", void 0, { json: body }).catch(() => void 0);
		}
		//#endregion
		//#region src/client/projection.ts
		const EMPTY_CLAUDE_PROJECTION = {
			schemaVersion: 1,
			revision: 0,
			owned: false,
			commands: [],
			activities: []
		};
		const RETRY_DELAY_MS = 2e3;
		/** Floor between carrier reopens forced by a desync. A carrier that is losing
		*  lines must not be answered with a reconnect per lost line. */
		const RESYNC_COOLDOWN_MS = 5e3;
		/** Wait for the subscribed set to stop moving before reopening the carrier:
		*  mounting a session list changes it once per row. */
		const SUBSCRIPTION_SETTLE_MS = 250;
		const NDJSON_SEPARATOR = String.fromCharCode(10);
		/** Coalesce stream deltas into at most one React notification per frame. */
		const FRAME_MS = 16;
		/** Typewriter smoothing: drain newly arrived prose over roughly this window,
		*  so the CLI's paragraph-sized deltas read as a continuous character flow. */
		const REVEAL_WINDOW_MS = 1200;
		/** A burst larger than this (redaction rewrite, reconnect catch-up) shows
		*  instantly instead of animating for a long stretch. */
		const MAX_INSTANT_REVEAL = 4e3;
		const MAX_ACTIVITIES = 1e4;
		const MAX_COMMANDS = 2e3;
		const MAX_REPOSITORY_TEXT_CHARS = 1024;
		const MAX_DIFF_CHARS = 262144;
		const MAX_CONFLICT_PATHS = 100;
		const MAX_REVIEW_COMMENTS = 50;
		/** Matches the server's cap on probed checkouts. */
		const MAX_REPOSITORIES = 8;
		const MAX_REVIEW_COMMENT_CHARS = 2e3;
		const MAX_TRANSCRIPT_CHARS = 64e3;
		function record$9(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
		}
		function nonNegativeInteger(value) {
			return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
		}
		function optionalBoundedString(value) {
			return value === void 0 || typeof value === "string" && value.length <= MAX_REPOSITORY_TEXT_CHARS;
		}
		function validateRepository(value) {
			const repository = record$9(value);
			if (repository === void 0 || ![
				"ready",
				"not-repository",
				"unavailable"
			].includes(String(repository.status)) || typeof repository.cwd !== "string" || repository.cwd.length > MAX_REPOSITORY_TEXT_CHARS || !optionalBoundedString(repository.root) || !optionalBoundedString(repository.branch) || !optionalBoundedString(repository.remote) || repository.detached !== void 0 && typeof repository.detached !== "boolean" || repository.worktree !== void 0 && typeof repository.worktree !== "boolean" || repository.dirty !== void 0 && typeof repository.dirty !== "boolean" || repository.upstream !== void 0 && typeof repository.upstream !== "boolean" || repository.ahead !== void 0 && !nonNegativeInteger(repository.ahead) || repository.behind !== void 0 && !nonNegativeInteger(repository.behind) || repository.operation !== void 0 && ![
				"rebase",
				"merge",
				"cherry-pick",
				"revert"
			].includes(String(repository.operation)) || repository.pullRequestOnly !== void 0 && typeof repository.pullRequestOnly !== "boolean" || repository.conflicts !== void 0 && (!Array.isArray(repository.conflicts) || repository.conflicts.length > MAX_CONFLICT_PATHS || repository.conflicts.some((path) => typeof path !== "string" || path.length > MAX_REPOSITORY_TEXT_CHARS))) return false;
			if (repository.diff !== void 0) {
				const diff = record$9(repository.diff);
				if (diff === void 0 || !nonNegativeInteger(diff.additions) || !nonNegativeInteger(diff.deletions) || !nonNegativeInteger(diff.files) || typeof diff.truncated !== "boolean" || diff.elided !== void 0 && !(Array.isArray(diff.elided) && diff.elided.length <= 1e3 && diff.elided.every((item) => typeof item === "string")) || diff.patch !== void 0 && (typeof diff.patch !== "string" || diff.patch.length > MAX_DIFF_CHARS)) return false;
			}
			if (repository.pullRequest === void 0) return true;
			const pullRequest = record$9(repository.pullRequest);
			if (pullRequest === void 0 || !Number.isSafeInteger(pullRequest.number) || Number(pullRequest.number) <= 0 || typeof pullRequest.title !== "string" || pullRequest.title.length > MAX_REPOSITORY_TEXT_CHARS || typeof pullRequest.url !== "string" || pullRequest.url.length > MAX_REPOSITORY_TEXT_CHARS || ![
				"open",
				"closed",
				"merged"
			].includes(String(pullRequest.state)) || typeof pullRequest.draft !== "boolean" || ![
				"approved",
				"changes-requested",
				"review-required",
				"none"
			].includes(String(pullRequest.review)) || ![
				"passing",
				"pending",
				"failing",
				"none"
			].includes(String(pullRequest.checks)) || !optionalBoundedString(pullRequest.mergeState) || !optionalBoundedString(pullRequest.author) || !optionalBoundedString(pullRequest.baseBranch) || pullRequest.createdAt !== void 0 && (typeof pullRequest.createdAt !== "string" || !Number.isFinite(Date.parse(pullRequest.createdAt))) || pullRequest.mergedAt !== void 0 && (typeof pullRequest.mergedAt !== "string" || !Number.isFinite(Date.parse(pullRequest.mergedAt)))) return false;
			try {
				const url = new URL(pullRequest.url);
				return url.protocol === "https:" && url.hostname === "github.com";
			} catch {
				return false;
			}
		}
		/** Validate the public route envelope before publishing it to UI components. */
		function parseClaudeClientProjection(value) {
			const input = record$9(value);
			if (input === void 0 || input.schemaVersion !== 1 || !nonNegativeInteger(input.revision) || typeof input.owned !== "boolean" || !Array.isArray(input.commands) || input.commands.length > MAX_COMMANDS || !Array.isArray(input.activities) || input.activities.length > MAX_ACTIVITIES) throw new Error("invalid Claude sidecar projection");
			for (const item of input.commands) {
				const command = record$9(item);
				if (command === void 0 || typeof command.publicName !== "string" || typeof command.claudeName !== "string" || typeof command.description !== "string" || command.hint !== void 0 && typeof command.hint !== "string" || typeof command.prefixed !== "boolean") throw new Error("invalid Claude command projection");
			}
			for (const item of input.activities) {
				const activity = record$9(item);
				if (activity === void 0 || !nonNegativeInteger(activity.turn) || !nonNegativeInteger(activity.step) || !nonNegativeInteger(activity.ordinal) || typeof activity.kind !== "string") throw new Error("invalid Claude sidecar activity");
			}
			const tasks = input.tasks === void 0 ? void 0 : record$9(input.tasks);
			if (tasks !== void 0 && !Array.isArray(tasks.tasks)) throw new Error("invalid Claude tasks projection");
			if (input.repository !== void 0 && !validateRepository(input.repository)) throw new Error("invalid Claude repository projection");
			if (input.repositories !== void 0 && (!Array.isArray(input.repositories) || input.repositories.length > MAX_REPOSITORIES || !input.repositories.every(validateRepository))) throw new Error("invalid Claude repositories projection");
			if (input.reviewComments !== void 0) {
				if (!Array.isArray(input.reviewComments) || input.reviewComments.length > MAX_REVIEW_COMMENTS) throw new Error("invalid Claude review comment projection");
				for (const item of input.reviewComments) {
					const comment = record$9(item);
					if (comment === void 0 || typeof comment.id !== "string" || comment.id.length === 0 || comment.id.length > 128 || typeof comment.path !== "string" || comment.path.length === 0 || comment.path.length > MAX_REPOSITORY_TEXT_CHARS || !nonNegativeInteger(comment.line) || comment.side !== "old" && comment.side !== "new" || typeof comment.text !== "string" || comment.text.length > MAX_REVIEW_COMMENT_CHARS) throw new Error("invalid Claude review comment projection");
				}
			}
			if (input.promptSuggestion !== void 0 && typeof input.promptSuggestion !== "string") throw new Error("invalid Claude prompt suggestion projection");
			if (input.permissionSelector !== void 0 && !isClaudePermissionSelector(input.permissionSelector)) throw new Error("invalid Claude permission selector projection");
			if (input.permissionMode !== void 0) {
				const view = record$9(input.permissionMode);
				if (view === void 0 || !isClaudePermissionMode(view.mode) || typeof view.locked !== "boolean" || view.autoSupported !== void 0 && typeof view.autoSupported !== "boolean") throw new Error("invalid Claude permission mode projection");
			}
			if (input.rewind !== void 0) {
				const ranges = record$9(input.rewind)?.ranges;
				if (!Array.isArray(ranges) || ranges.length > 200) throw new Error("invalid Claude rewind projection");
				for (const item of ranges) {
					const range = record$9(item);
					if (range === void 0 || !nonNegativeInteger(range.start) || !nonNegativeInteger(range.end)) throw new Error("invalid Claude rewind projection");
				}
			}
			return input;
		}
		/** Validate one incremental delta payload with the same rules as a snapshot. */
		function validateEnvelopeFragment(fragment) {
			parseClaudeClientProjection({
				schemaVersion: 1,
				revision: 0,
				owned: false,
				commands: [],
				activities: [],
				...fragment
			});
		}
		function stepKeyOf(turn, step) {
			return `${turn}:${step}`;
		}
		const EMPTY_ACTIVITIES = [];
		/** Identity-stable per-step slice; untouched steps never re-render while
		*  another step streams. Falls back to filtering for snapshot-only hooks. */
		function selectStepActivities(value, turn, step) {
			const sliced = value.byStep?.get(stepKeyOf(turn, step));
			if (sliced !== void 0) return sliced;
			const filtered = value.activities.filter((activity) => activity.turn === turn && activity.step === step);
			return filtered.length === 0 ? EMPTY_ACTIVITIES : filtered;
		}
		function isAbort(error) {
			return error?.name === "AbortError";
		}
		function delay(ms) {
			return new Promise((resolve) => {
				setTimeout(resolve, ms).unref?.();
			});
		}
		/** One session's reducer over the shared carrier's lines.
		*
		*  A source opens nothing. It used to hold a stream of its own, which made the
		*  plugin's connection count a function of how many sessions existed;
		*  {@link ClaudeProjectionStore} now owns the single carrier and feeds each
		*  session's lines here. `onDemand` reports whether anyone is watching, which
		*  is what the store uses to decide which sessions the carrier subscribes to. */
		function createClaudeProjectionSource(sessionId, onDemand = () => {}, onDesync = () => {}) {
			let snapshot = EMPTY_CLAUDE_PROJECTION;
			let revision = 0;
			/** Last carrier line this reducer applied, by the server's count. Undefined
			*  until a snapshot states where the stream stands. */
			let seq;
			let owned = false;
			let commands = [];
			let tasks;
			let promptSuggestion;
			let repository;
			let repositories;
			let reviewComments;
			let rewind;
			let permissionMode;
			let permissionSelector;
			const byStep = /* @__PURE__ */ new Map();
			const stepOrder = [];
			/** Streaming prose still being revealed: full arrived text plus shown chars. */
			const reveal = /* @__PURE__ */ new Map();
			let disposed = false;
			let frame;
			let usedAnimationFrame = false;
			const listeners = /* @__PURE__ */ new Set();
			const ensureStep = (turn, step) => {
				const key = stepKeyOf(turn, step);
				const existing = byStep.get(key);
				if (existing !== void 0) return existing;
				const created = [];
				byStep.set(key, created);
				const at = stepOrder.findIndex((entry) => entry.turn > turn || entry.turn === turn && entry.step > step);
				stepOrder.splice(at === -1 ? stepOrder.length : at, 0, {
					turn,
					step,
					key
				});
				return created;
			};
			const upsertActivity = (activity) => {
				const key = stepKeyOf(activity.turn, activity.step);
				const next = ensureStep(activity.turn, activity.step).slice();
				const index = next.findIndex((item) => item.ordinal === activity.ordinal);
				if (index === -1) {
					const at = next.findIndex((item) => item.ordinal > activity.ordinal);
					next.splice(at === -1 ? next.length : at, 0, activity);
				} else next[index] = activity;
				byStep.set(key, next);
			};
			const reset = (activities) => {
				byStep.clear();
				stepOrder.length = 0;
				reveal.clear();
				for (const activity of activities) ensureStep(activity.turn, activity.step).push(activity);
			};
			/** Advance every pending typewriter reveal by one frame's worth of characters.
			*  The per-frame step scales with the backlog so any burst drains in roughly
			*  REVEAL_WINDOW_MS. Returns whether another frame is still needed. */
			const advanceReveals = () => {
				let remaining = false;
				for (const [key, entry] of reveal) {
					const total = entry.full.text?.length ?? 0;
					if (entry.shown >= total) {
						reveal.delete(key);
						continue;
					}
					const step = Math.max(1, Math.ceil((total - entry.shown) * FRAME_MS / REVEAL_WINDOW_MS));
					entry.shown = Math.min(total, entry.shown + step);
					upsertActivity({
						...entry.full,
						text: (entry.full.text ?? "").slice(0, entry.shown)
					});
					if (entry.shown >= total) reveal.delete(key);
					else remaining = true;
				}
				return remaining;
			};
			const publish = () => {
				frame = void 0;
				if (disposed) return;
				const revealing = advanceReveals();
				const activities = [];
				for (const entry of stepOrder) {
					const slice = byStep.get(entry.key);
					if (slice !== void 0) for (const item of slice) activities.push(item);
				}
				snapshot = {
					schemaVersion: 1,
					revision,
					owned,
					commands,
					activities,
					...tasks === void 0 ? {} : { tasks },
					...promptSuggestion === void 0 ? {} : { promptSuggestion },
					...repository === void 0 ? {} : { repository },
					...repositories === void 0 ? {} : { repositories },
					...reviewComments === void 0 ? {} : { reviewComments },
					...rewind === void 0 ? {} : { rewind },
					...permissionMode === void 0 ? {} : { permissionMode },
					...permissionSelector === void 0 ? {} : { permissionSelector },
					byStep: new Map(byStep)
				};
				for (const listener of [...listeners]) listener();
				if (revealing) schedulePublish();
			};
			const cancelFrame = () => {
				if (frame === void 0) return;
				if (usedAnimationFrame) globalThis.cancelAnimationFrame?.(frame);
				else clearTimeout(frame);
				frame = void 0;
			};
			const schedulePublish = () => {
				if (disposed || frame !== void 0 || listeners.size === 0) return;
				const raf = globalThis.requestAnimationFrame;
				if (typeof raf === "function") {
					usedAnimationFrame = true;
					frame = raf(publish);
				} else {
					usedAnimationFrame = false;
					frame = setTimeout(publish, FRAME_MS);
				}
			};
			const applyText = (event) => {
				const { turn, step, ordinal, append, text, renderer, answer } = event;
				if (!nonNegativeInteger(turn) || !nonNegativeInteger(step) || !nonNegativeInteger(ordinal)) return false;
				if (append !== void 0 && (typeof append !== "string" || append.length > MAX_TRANSCRIPT_CHARS)) return false;
				if (text !== void 0 && (typeof text !== "string" || text.length > MAX_TRANSCRIPT_CHARS)) return false;
				if (append === void 0 && text === void 0) return false;
				const revealKey = `${turn}:${step}:${ordinal}`;
				const existing = byStep.get(stepKeyOf(turn, step))?.find((item) => item.ordinal === ordinal);
				const pending = reveal.get(revealKey);
				if (existing === void 0 && pending === void 0 && typeof text !== "string") return false;
				const baseText = pending?.full.text ?? existing?.text ?? "";
				const fullText = (typeof text === "string" ? text : `${baseText}${append}`).slice(0, MAX_TRANSCRIPT_CHARS);
				const full = {
					...pending?.full ?? existing ?? {
						turn,
						step,
						ordinal,
						kind: "text",
						phase: "updated",
						...isClaudeRenderMode(renderer) ? { renderer } : {}
					},
					text: fullText,
					...answer === true ? { answer: true } : {}
				};
				const shown = Math.min(pending?.shown ?? existing?.text?.length ?? 0, fullText.length);
				if (fullText.length - shown > MAX_INSTANT_REVEAL) {
					reveal.delete(revealKey);
					upsertActivity(full);
					return true;
				}
				reveal.set(revealKey, {
					full,
					shown
				});
				upsertActivity({
					...full,
					text: fullText.slice(0, shown)
				});
				return true;
			};
			/** This reducer is behind the server and cannot catch up on its own: only a
			*  fresh snapshot can. Reported as well as acted on, because a silent
			*  self-heal hides how often the carrier is losing lines.
			*
			*  Numbering stops until that snapshot arrives and states it again; every
			*  line in between would only be measured against a count already known to
			*  be wrong. */
			const desync = (kind, detail) => {
				seq = void 0;
				onDesync(kind, `${sessionId}: ${detail}`);
			};
			const applyLine = (line) => {
				const trimmed = line.trim();
				if (trimmed.length === 0) return;
				let value;
				try {
					value = JSON.parse(trimmed);
				} catch {
					return;
				}
				const event = record$9(value);
				if (event === void 0 || typeof event.type !== "string") return;
				if (event.type === "checkpoint") {
					if (nonNegativeInteger(event.seq) && seq !== void 0 && event.seq !== seq) desync("projection-gap", `checkpoint at ${event.seq}, applied ${seq}`);
					return;
				}
				if (event.type !== "snapshot" && nonNegativeInteger(event.seq) && seq !== void 0 && event.seq !== seq + 1) desync("projection-gap", `expected ${seq + 1}, received ${event.seq}`);
				try {
					switch (event.type) {
						case "snapshot": {
							const next = parseClaudeClientProjection(event);
							seq = nonNegativeInteger(event.seq) ? event.seq : void 0;
							revision = next.revision;
							owned = next.owned;
							commands = next.commands;
							tasks = next.tasks;
							promptSuggestion = next.promptSuggestion;
							repository = next.repository;
							repositories = next.repositories;
							reviewComments = next.reviewComments;
							rewind = next.rewind;
							permissionMode = next.permissionMode;
							permissionSelector = next.permissionSelector;
							reset(next.activities);
							break;
						}
						case "text":
							if (!applyText(event)) {
								if (seq !== void 0) desync("projection-delta-rejected", "text not applied");
								return;
							}
							revision += 1;
							break;
						case "activity":
							validateEnvelopeFragment({ activities: [event.activity] });
							upsertActivity(event.activity);
							revision += 1;
							break;
						case "tasks":
							validateEnvelopeFragment({ tasks: event.value });
							tasks = event.value;
							revision += 1;
							break;
						case "promptSuggestion":
							validateEnvelopeFragment(event.value === void 0 ? {} : { promptSuggestion: event.value });
							promptSuggestion = event.value;
							revision += 1;
							break;
						case "meta":
							validateEnvelopeFragment({
								owned: event.owned,
								commands: event.commands,
								...event.repository === void 0 ? {} : { repository: event.repository },
								...event.repositories === void 0 ? {} : { repositories: event.repositories },
								...event.reviewComments === void 0 ? {} : { reviewComments: event.reviewComments },
								...event.permissionMode === void 0 ? {} : { permissionMode: event.permissionMode },
								...event.permissionSelector === void 0 ? {} : { permissionSelector: event.permissionSelector }
							});
							owned = event.owned;
							commands = event.commands;
							repository = event.repository;
							repositories = event.repositories;
							reviewComments = event.reviewComments;
							if (event.permissionMode !== void 0) permissionMode = event.permissionMode;
							permissionSelector = event.permissionSelector;
							revision += 1;
							break;
						default:
							if (nonNegativeInteger(event.seq)) seq = event.seq;
							return;
					}
				} catch {
					desync("projection-delta-rejected", `rejected ${event.type}`);
					return;
				}
				if (nonNegativeInteger(event.seq)) seq = event.seq;
				schedulePublish();
			};
			return {
				getSnapshot: () => snapshot,
				feed: applyLine,
				subscribe(listener) {
					if (disposed) return () => {};
					listeners.add(listener);
					onDemand(true);
					return () => {
						listeners.delete(listener);
						if (listeners.size !== 0) return;
						cancelFrame();
						onDemand(false);
					};
				},
				dispose() {
					disposed = true;
					listeners.clear();
					cancelFrame();
					onDemand(false);
				}
			};
		}
		/** Whether two lane sets carry the same sessions. Order is the LRU's business,
		*  not the carrier's: the server reads `sessions=` as a set. */
		function sameLanes(before, after) {
			if (before.length !== after.length) return false;
			const held = new Set(before);
			return after.every((sessionId) => held.has(sessionId));
		}
		/**
		* Every session's projection over ONE connection.
		*
		* The plugin used to open an NDJSON stream per session, so its share of the
		* browser's small per-origin connection budget grew with the number of Claude
		* sessions — and the overview panel subscribes one per LISTED session, not per
		* open one. Past a handful of sessions the plugin's own settings panel could no
		* longer get a connection at all, which is the failure this class exists to
		* make impossible: the carrier is one connection whatever the session count.
		*
		* `source(sessionId)` keeps its shape, so consumers are unaware of any of this.
		*/
		var ClaudeProjectionStore = class {
			#sources = /* @__PURE__ */ new Map();
			/** Sessions with at least one live subscriber, newest interest last. */
			#wanted = /* @__PURE__ */ new Set();
			#open;
			#retryDelayMs;
			#settleMs;
			#report;
			#resyncCooldownMs;
			#resyncedAt = 0;
			/** Whether the carrier is in a run of failures. One report per outage: the
			*  retry loop runs every couple of seconds and a beacon per attempt would
			*  be the plugin reporting its own noise. */
			#carrierFailing = false;
			#controller;
			#settle;
			#running = false;
			#disposed = false;
			constructor(options = {}) {
				this.#open = options.open ?? ((path, cancel) => pluginProjectionStream(path, cancel));
				this.#retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
				this.#settleMs = options.settleMs ?? SUBSCRIPTION_SETTLE_MS;
				this.#report = options.report ?? (() => {});
				this.#resyncCooldownMs = options.resyncCooldownMs ?? RESYNC_COOLDOWN_MS;
			}
			source(sessionId) {
				let source = this.#sources.get(sessionId);
				if (source === void 0) {
					source = createClaudeProjectionSource(sessionId, (active) => {
						this.#demand(sessionId, active);
					}, (kind, detail) => {
						this.#resync(kind, detail);
					});
					this.#sources.set(sessionId, source);
				}
				return source;
			}
			/** Reopen the carrier so every lane is restated from a fresh snapshot.
			*
			*  One session noticed the hole, but the carrier is shared and a dropped
			*  line is a property of the carrier, so the others are suspect too --
			*  reopening restates all of them for the price of the one reconnect. */
			#resync(kind, detail) {
				if (this.#disposed) return;
				this.#report(kind, detail);
				const now = Date.now();
				if (now - this.#resyncedAt < this.#resyncCooldownMs) return;
				this.#resyncedAt = now;
				this.#reopen();
			}
			dispose() {
				this.#disposed = true;
				if (this.#settle !== void 0) clearTimeout(this.#settle);
				this.#settle = void 0;
				this.#controller?.abort();
				this.#controller = void 0;
				for (const source of this.#sources.values()) source.dispose();
				this.#sources.clear();
				this.#wanted.clear();
			}
			/** Note interest and reopen the carrier once the set stops moving. Mounting
			*  a session list would otherwise reopen it once per row. */
			#demand(sessionId, active) {
				if (this.#disposed) return;
				const before = this.#lanes();
				if (active) {
					this.#wanted.delete(sessionId);
					this.#wanted.add(sessionId);
				} else if (!this.#wanted.delete(sessionId)) return;
				if (sameLanes(before, this.#lanes())) return;
				if (this.#settle !== void 0) clearTimeout(this.#settle);
				const timer = setTimeout(() => {
					this.#settle = void 0;
					this.#reopen();
				}, this.#settleMs);
				timer.unref?.();
				this.#settle = timer;
			}
			#lanes() {
				const wanted = [...this.#wanted];
				return wanted.slice(Math.max(0, wanted.length - 16));
			}
			#reopen() {
				this.#controller?.abort();
				this.#controller = void 0;
				if (this.#disposed || this.#wanted.size === 0) return;
				this.#run();
			}
			async #run() {
				if (this.#running) return;
				this.#running = true;
				try {
					while (!this.#disposed && this.#wanted.size > 0) {
						const controller = new AbortController();
						this.#controller = controller;
						const lanes = this.#lanes();
						let superseded = false;
						try {
							const reader = await this.#open(`${CLAUDE_PROJECTION_PATH}/multi?sessions=${lanes.map(encodeURIComponent).join(",")}`, controller.signal);
							this.#carrierFailing = false;
							const stop = () => {
								superseded = true;
								reader.cancel().catch(() => void 0);
							};
							controller.signal.addEventListener("abort", stop, { once: true });
							const decoder = new TextDecoder();
							let buffer = "";
							while (!controller.signal.aborted) {
								const chunk = await reader.read();
								buffer += decoder.decode(chunk.value, { stream: !chunk.done });
								const lines = buffer.split(NDJSON_SEPARATOR);
								buffer = lines.pop() ?? "";
								for (const line of lines) this.#dispatch(line);
								if (chunk.done) break;
							}
							controller.signal.removeEventListener("abort", stop);
							await reader.cancel().catch(() => void 0);
						} catch (error) {
							if (isAbort(error)) {
								if (this.#controller !== controller) continue;
								return;
							}
							if (!this.#carrierFailing) {
								this.#carrierFailing = true;
								this.#report("projection-carrier-unavailable", error instanceof Error ? error.message : String(error));
							}
						} finally {
							if (this.#controller === controller) this.#controller = void 0;
						}
						if (this.#disposed || this.#wanted.size === 0) return;
						if (superseded) continue;
						await delay(this.#retryDelayMs);
					}
				} finally {
					this.#running = false;
				}
			}
			/** Route one carrier line to the session that owns it. A line for a session
			*  nobody is watching any more is dropped rather than reviving its lane. */
			#dispatch(line) {
				if (line.length === 0) return;
				let session;
				try {
					session = JSON.parse(line).session;
				} catch {
					return;
				}
				if (typeof session !== "string") return;
				this.#sources.get(session)?.feed(line);
			}
		};
		//#endregion
		//#region src/client/token-format.ts
		function formatTokenCount(tokens) {
			if (tokens >= 1e6) return `${Number((tokens / 1e6).toFixed(tokens >= 1e7 ? 0 : 1))}M`;
			if (tokens >= 1e3) return `${Number((tokens / 1e3).toFixed(tokens >= 1e5 ? 0 : 1))}K`;
			return String(tokens);
		}
		//#endregion
		//#region src/client/ClaudeActivityNode.tsx
		const EMPTY_TASKS$2 = [];
		const ACTIVITY_CSS = [
			".dsh-claude-flow{display:flex;flex-direction:column;gap:10px}",
			".dsh-claude-tool-background{flex:none;margin-left:auto;padding:0 8px;border:0;border-radius:6px;background:transparent;",
			"color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;line-height:20px;cursor:pointer}",
			".dsh-claude-tool-background:hover,.dsh-claude-tool-background:focus-visible{outline:none;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dsh-claude-tool-background:disabled{cursor:default;opacity:.6}",
			".dsh-claude-transcript-text{color:var(--dsw-alias-label-primary);font-size:15px;line-height:24px;overflow-wrap:anywhere}",
			".dsh-claude-tool-group-native{overflow:visible}",
			".dsh-claude-tool-group-native>.dsh-claude-flow-row{padding:0}",
			".dsh-claude-flow-row .dsh-claude-tool-stats{margin-left:8px}",
			".dsh-claude-tool-list{max-height:min(420px,calc(100vh - 320px));overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;margin-top:4px;border:1px solid var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 12%, transparent));border-radius:10px;scrollbar-gutter:stable}",
			".dsh-claude-tool-item{border-top:1px solid var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 12%, transparent))}",
			".dsh-claude-tool-item:first-child{border-top:0}",
			".dsh-claude-tool-summary-row{display:flex;align-items:center;min-height:34px;gap:8px;padding:0 10px;cursor:pointer;list-style:none}",
			".dsh-claude-tool-summary-row::-webkit-details-marker{display:none}",
			".dsh-claude-tool-summary-row::after{content:\"›\";margin-left:2px;flex:none;align-self:center;color:var(--dsw-alias-label-secondary);font-size:22px;line-height:1;transform-origin:center;transition:transform .15s ease}",
			".dsh-claude-tool-item[open]>.dsh-claude-tool-summary-row::after{transform:rotate(90deg)}",
			".dsh-claude-tool-content{min-width:0;padding:0 10px 8px}",
			".dsh-claude-tool-content>*{max-width:100%;box-sizing:border-box}",
			".dsh-claude-tool-section{margin-top:8px}",
			".dsh-claude-tool-section-title{margin-bottom:4px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-transform:uppercase;letter-spacing:.04em}",
			".dsh-claude-tool-fields{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:3px 12px;font-size:13px;line-height:20px}",
			".dsh-claude-tool-field-key{color:var(--dsw-alias-label-tertiary)}",
			".dsh-claude-tool-field-value{min-width:0;color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere}",
			".dsh-claude-tool-paths{display:flex;flex-direction:column;gap:2px;margin:0;padding:0;list-style:none;font:var(--dsw-font-markdown-code-block-small)}",
			".dsh-claude-tool-path{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}",
			".dsh-claude-tool-code{max-height:260px;overflow:auto;margin:0;padding:8px 0;border-radius:8px;background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small)}",
			".dsh-claude-tool-code-line{display:grid;grid-template-columns:44px minmax(max-content,1fr);min-height:18px}",
			".dsh-claude-tool-line-number{padding-right:10px;text-align:right;user-select:none;color:var(--dsw-alias-label-caption);border-right:1px solid var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 12%, transparent))}",
			".dsh-claude-tool-line-text{padding:0 10px;white-space:pre}",
			".dsh-claude-tool-label{width:72px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}",
			".dsh-claude-tool-description{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary)}",
			".dsh-claude-tool-stats{display:inline-flex;gap:4px;flex:none;font-size:13px;line-height:20px}",
			".dsh-claude-diff-add{color:var(--dsw-alias-state-success-primary,#21c55d)}",
			".dsh-claude-diff-delete{color:var(--dsw-alias-state-error-primary)}",
			".dsh-claude-tool-name{font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}",
			".dsh-claude-tool-summary{margin-left:8px;color:var(--dsw-alias-label-tertiary)}",
			".dsh-claude-turn-usage{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-top:10px;",
			"color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}",
			".dsh-claude-turn-usage-label{color:var(--dsw-alias-label-caption)}",
			".dsh-claude-tool-terminal{display:flex;gap:8px;margin:6px 0 0;padding:8px 10px;max-height:220px;overflow:auto;",
			"border-radius:8px;background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small)}",
			".dsh-claude-tool-prompt{flex:none;user-select:none;color:var(--dsw-alias-label-caption)}",
			".dsh-claude-tool-command{min-width:0;margin:0;color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere}",
			".dsh-claude-tool-detail{margin:6px 0 0;padding:8px 10px;max-height:220px;overflow:auto;border-radius:8px;background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small);white-space:pre-wrap;overflow-wrap:anywhere}",
			".dsh-claude-flow-row{position:relative;overflow:hidden}",
			".dsh-claude-flow-leading{flex-shrink:0}",
			".dsh-claude-flow-title{font-weight:400}",
			".dsh-claude-flow-chevron{color:var(--dsw-alias-label-secondary)}",
			".dsh-claude-flow-separator{width:2px;height:2px;margin:0 8px;border-radius:1px;background:var(--dsw-alias-label-caption);flex:none}",
			".dsh-claude-flow-summary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:24px;flex:auto}",
			".dsh-claude-flow-summary[data-error]{color:var(--dsw-alias-state-error-primary)}",
			".dsh-claude-flow-body{margin:4px 0 4px 22px;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:24px;white-space:pre-wrap;overflow-wrap:anywhere}",
			".dsh-claude-flow-detail{max-height:260px;overflow:auto;margin:4px 0 4px 4px;padding:12px 16px;border:1px solid var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 12%, transparent));border-radius:12px;background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-primary);font:var(--dsw-font-markdown-code-block-small);white-space:pre-wrap}",
			".dsh-claude-flow-subcalls{display:flex;flex-direction:column;gap:2px;margin:4px 0 4px 22px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:22px}",
			".dsh-claude-compaction{display:flex;align-items:center;gap:10px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}",
			".dsh-claude-compaction::before,.dsh-claude-compaction::after{content:\"\";flex:1;height:1px;background:var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 12%, transparent))}",
			".dsh-claude-compaction-label{flex:none;white-space:nowrap}",
			".dsh-claude-act-running{animation:dsh-claude-act-pulse 1.2s ease-in-out infinite}",
			"@keyframes dsh-claude-act-pulse{0%,100%{opacity:1}50%{opacity:.3}}"
		].join("");
		let cssInjected$4 = false;
		function ensureActivityCss() {
			if (cssInjected$4 || typeof document === "undefined") return;
			cssInjected$4 = true;
			const element = document.createElement("style");
			element.dataset.dshClaudeActivity = "";
			element.textContent = ACTIVITY_CSS;
			document.head.appendChild(element);
		}
		function subcallGlyph(subcall) {
			if (subcall.isError === true || subcall.phase === "failed") return "×";
			if (subcall.phase === "started" || subcall.phase === "updated") return "●";
			return "✓";
		}
		function title(activity) {
			return activity.toolName ?? activity.title ?? activity.kind.replaceAll("-", " ");
		}
		function activityState(activity, running) {
			if (activity.isError === true || activity.kind === "error" || activity.phase === "denied" || activity.phase === "failed") return "error";
			if (running) return "ongoing";
			if (activity.kind === "warning") return "warning";
			return "done";
		}
		function ActivityRow({ row, t }) {
			const { activity, running, subcalls } = row;
			const [open, setOpen] = useState(false);
			const state = activityState(activity, running);
			const detail = activity.detail;
			const expandable = detail !== void 0 || subcalls.length > 0 || activity.kind === "thinking" || activity.kind === "steering";
			const summary = activity.summary ?? (running ? t("running") : state === "error" ? t("failed") : t("done"));
			const body = activity.kind === "thinking" || activity.kind === "steering" ? activity.summary : detail;
			return /* @__PURE__ */ jsxs(DisclosureRow, {
				rowClassName: "dsh-claude-flow-row",
				leadingClassName: "dsh-claude-flow-leading",
				titleClassName: "dsh-claude-flow-title",
				chevronClassName: "dsh-claude-flow-chevron",
				icon: activity.kind === "thinking" ? /* @__PURE__ */ jsx(IconThinkOutlineRegular, { size: 14 }) : state === "done" ? /* @__PURE__ */ jsx(IconApiOutlineRegular, { size: 14 }) : /* @__PURE__ */ jsx(StateDot, { state }),
				title: activity.kind === "thinking" ? t("thinking") : activity.kind === "steering" ? t(activity.title === "Plan sent back for changes" ? "planFeedbackMessage" : "steeredMessage") : title(activity),
				open,
				expandable,
				expandOnRowClick: true,
				keepContentWhenOpen: true,
				onToggle: () => setOpen((value) => !value),
				collapsedContent: /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", {
					className: "dsh-claude-flow-separator",
					"aria-hidden": "true"
				}), /* @__PURE__ */ jsx("span", {
					className: "dsh-claude-flow-summary",
					"data-error": state === "error" || void 0,
					children: summary
				})] }),
				children: [subcalls.length === 0 ? null : /* @__PURE__ */ jsx("div", {
					className: "dsh-claude-flow-subcalls",
					children: subcalls.map((subcall) => /* @__PURE__ */ jsxs("div", { children: [
						subcallGlyph(subcall),
						" ",
						subcall.toolName ?? t("subagent"),
						subcall.summary === void 0 ? "" : ` · ${subcall.summary}`
					] }, subcall.toolUseId))
				}), body === void 0 ? null : activity.kind === "thinking" ? /* @__PURE__ */ jsx("div", {
					className: "dsh-claude-flow-body",
					children: body
				}) : /* @__PURE__ */ jsx("pre", {
					className: "dsh-claude-flow-detail",
					children: body
				})]
			});
		}
		/** Compaction has no turn of its own to render, so the transcript marks it with
		*  a rule instead of a row: it separates prose rather than reporting work. */
		function ClaudeCompactionDivider({ compaction, t }) {
			const { trigger, preTokens, postTokens } = compaction;
			const label = trigger === "auto" ? t("compactedAuto") : t("compacted");
			const shrink = preTokens === void 0 || postTokens === void 0 ? void 0 : `${formatTokenCount(preTokens)} → ${formatTokenCount(postTokens)}`;
			return /* @__PURE__ */ jsx("div", {
				className: "dsh-claude-compaction",
				role: "separator",
				children: /* @__PURE__ */ jsx("span", {
					className: "dsh-claude-compaction-label",
					children: shrink === void 0 ? label : `${label} · ${shrink}`
				})
			});
		}
		function parsedValue(value) {
			if (value === void 0 || value.length === 0) return void 0;
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		}
		function record$8(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
		}
		function text$2(value) {
			return typeof value === "string" && value.length > 0 ? value : void 0;
		}
		function numberValue(value) {
			return typeof value === "number" && Number.isFinite(value) ? value : void 0;
		}
		function displayValue(value) {
			if (value === null) return "null";
			if (typeof value === "string") return value;
			if (typeof value === "number" || typeof value === "boolean") return String(value);
			if (Array.isArray(value)) return value.map(displayValue).join(", ");
			return record$8(value) === void 0 ? String(value) : Object.entries(value).map(([key, item]) => `${key}: ${displayValue(item)}`).join("\n");
		}
		function Section({ title, children }) {
			return /* @__PURE__ */ jsxs("section", {
				className: "dsh-claude-tool-section",
				children: [/* @__PURE__ */ jsx("div", {
					className: "dsh-claude-tool-section-title",
					children: title
				}), children]
			});
		}
		function Fields({ value, omit = [] }) {
			const entries = Object.entries(value).filter(([key, item]) => !omit.includes(key) && item !== void 0 && item !== "");
			if (entries.length === 0) return null;
			return /* @__PURE__ */ jsx("div", {
				className: "dsh-claude-tool-fields",
				children: entries.map(([key, item]) => /* @__PURE__ */ jsxs("div", {
					style: { display: "contents" },
					children: [/* @__PURE__ */ jsx("span", {
						className: "dsh-claude-tool-field-key",
						children: key.replaceAll("_", " ")
					}), /* @__PURE__ */ jsx("span", {
						className: "dsh-claude-tool-field-value",
						children: displayValue(item)
					})]
				}, key))
			});
		}
		function Paths({ paths }) {
			if (paths.length === 0) return null;
			return /* @__PURE__ */ jsx("ul", {
				className: "dsh-claude-tool-paths",
				children: paths.map((path, index) => /* @__PURE__ */ jsx("li", {
					className: "dsh-claude-tool-path",
					children: path
				}, `${path}:${index}`))
			});
		}
		function Source({ content, start = 1 }) {
			return /* @__PURE__ */ jsx("div", {
				className: "dsh-claude-tool-code",
				children: content.split(/\r?\n/u).map((line, index) => /* @__PURE__ */ jsxs("div", {
					className: "dsh-claude-tool-code-line",
					children: [/* @__PURE__ */ jsx("span", {
						className: "dsh-claude-tool-line-number",
						children: start + index
					}), /* @__PURE__ */ jsx("span", {
						className: "dsh-claude-tool-line-text",
						children: line || " "
					})]
				}, index))
			});
		}
		/** The command as a shell prompt rather than a labelled field: it was typed
		*  at one, and the prompt is what tells a reader that at a glance. */
		function Terminal({ command }) {
			return /* @__PURE__ */ jsxs("div", {
				className: "dsh-claude-tool-terminal",
				children: [/* @__PURE__ */ jsx("span", {
					className: "dsh-claude-tool-prompt",
					"aria-hidden": "true",
					children: "$"
				}), /* @__PURE__ */ jsx("pre", {
					className: "dsh-claude-tool-command",
					children: command
				})]
			});
		}
		function TextDetail({ title, value }) {
			if (value === void 0 || value.length === 0) return null;
			return /* @__PURE__ */ jsx(Section, {
				title,
				children: /* @__PURE__ */ jsx("pre", {
					className: "dsh-claude-tool-detail",
					children: value
				})
			});
		}
		function filenameList(value) {
			if (!Array.isArray(value)) return [];
			return value.filter((item) => typeof item === "string");
		}
		/** The diff card's chrome, which primitives 0.1.2 moved onto the caller.
		*
		*  The card reads `labels.copy` while it builds, so omitting them throws
		*  mid-render -- and React answers by tearing down the whole conversation, not
		*  the one tool row.
		*
		*  The aria strings deliberately repeat the visible ones: both already say
		*  exactly what the control does. */
		function diffBlockLabels(t) {
			const expand = (hidden) => t("diffCardExpand", { count: hidden });
			return {
				copy: t("markdownCopy"),
				copied: t("markdownCopied"),
				collapse: t("diffCardCollapse"),
				collapseAria: t("diffCardCollapse"),
				expand,
				expandAria: expand,
				codeLabel: t("codeBlockTitle"),
				wrapLabel: t("codeBlockWrap"),
				unwrapLabel: t("codeBlockUnwrap")
			};
		}
		function ToolPresentation({ tool, t }) {
			const inputValue = parsedValue(tool.input);
			const outputValue = parsedValue(tool.output);
			const input = record$8(inputValue);
			const output = record$8(outputValue);
			const outputTitle = tool.isError === true ? t("toolError") : t("toolOutput");
			if (tool.toolName === "AskUserQuestion" && tool.answers !== void 0 && tool.answers.length > 0) return /* @__PURE__ */ jsx(Section, {
				title: t("toolAnswers"),
				children: /* @__PURE__ */ jsx("div", {
					className: "dsh-claude-tool-fields",
					children: tool.answers.map((pair, index) => /* @__PURE__ */ jsxs("div", {
						style: { display: "contents" },
						children: [/* @__PURE__ */ jsx("span", {
							className: "dsh-claude-tool-field-key",
							children: pair.question
						}), /* @__PURE__ */ jsx("span", {
							className: "dsh-claude-tool-field-value",
							children: pair.answer
						})]
					}, `${index}:${pair.question}`))
				})
			});
			if (tool.diffs !== void 0) return /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx(DiffBlock, {
				diffs: [...tool.diffs],
				labels: diffBlockLabels(t)
			}), /* @__PURE__ */ jsx(TextDetail, {
				title: outputTitle,
				value: typeof outputValue === "string" ? outputValue : void 0
			})] });
			if (tool.toolName === "Read") {
				const file = record$8(output?.file);
				const path = text$2(file?.filePath) ?? text$2(input?.file_path);
				const content = text$2(file?.content) ?? (typeof outputValue === "string" ? outputValue : void 0);
				const offset = numberValue(input?.offset) ?? 1;
				return /* @__PURE__ */ jsxs(Fragment$1, { children: [
					path === void 0 ? null : /* @__PURE__ */ jsx(Section, {
						title: "File",
						children: /* @__PURE__ */ jsx("div", {
							className: "dsh-claude-tool-path",
							children: path
						})
					}),
					input === void 0 ? null : /* @__PURE__ */ jsx(Section, {
						title: t("toolInput"),
						children: /* @__PURE__ */ jsx(Fields, {
							value: input,
							omit: ["file_path"]
						})
					}),
					content === void 0 ? null : /* @__PURE__ */ jsx(Section, {
						title: outputTitle,
						children: /* @__PURE__ */ jsx(Source, {
							content,
							start: offset
						})
					})
				] });
			}
			if (tool.toolName === "Grep" || tool.toolName === "Glob") {
				const filenames = filenameList(output?.filenames);
				return /* @__PURE__ */ jsxs(Fragment$1, { children: [input === void 0 ? /* @__PURE__ */ jsx(TextDetail, {
					title: t("toolInput"),
					value: typeof inputValue === "string" ? inputValue : void 0
				}) : /* @__PURE__ */ jsx(Section, {
					title: t("toolInput"),
					children: /* @__PURE__ */ jsx(Fields, { value: input })
				}), filenames.length === 0 ? /* @__PURE__ */ jsx(TextDetail, {
					title: outputTitle,
					value: typeof outputValue === "string" ? outputValue : output === void 0 ? void 0 : displayValue(output)
				}) : /* @__PURE__ */ jsx(Section, {
					title: outputTitle,
					children: /* @__PURE__ */ jsx(Paths, { paths: filenames })
				})] });
			}
			if (tool.toolName === "Bash" || tool.toolName === "PowerShell") {
				const command = text$2(input?.command);
				const terminal = [text$2(output?.stdout), text$2(output?.stderr)].filter((value) => value !== void 0).join("\n");
				const typed = command ?? (typeof inputValue === "string" ? inputValue : void 0);
				return /* @__PURE__ */ jsxs(Fragment$1, { children: [
					typed === void 0 ? null : /* @__PURE__ */ jsx(Terminal, { command: typed }),
					input === void 0 ? null : /* @__PURE__ */ jsx(Section, {
						title: t("toolInput"),
						children: /* @__PURE__ */ jsx(Fields, {
							value: input,
							omit: ["command", "description"]
						})
					}),
					/* @__PURE__ */ jsx(TextDetail, {
						title: outputTitle,
						value: terminal || (typeof outputValue === "string" ? outputValue : void 0)
					})
				] });
			}
			return /* @__PURE__ */ jsxs(Fragment$1, { children: [input === void 0 ? /* @__PURE__ */ jsx(TextDetail, {
				title: t("toolInput"),
				value: typeof inputValue === "string" ? inputValue : void 0
			}) : /* @__PURE__ */ jsx(Section, {
				title: t("toolInput"),
				children: /* @__PURE__ */ jsx(Fields, { value: input })
			}), output === void 0 ? /* @__PURE__ */ jsx(TextDetail, {
				title: outputTitle,
				value: typeof outputValue === "string" ? outputValue : void 0
			}) : /* @__PURE__ */ jsx(Section, {
				title: outputTitle,
				children: /* @__PURE__ */ jsx(Fields, { value: output })
			})] });
		}
		/** Whether a card is a blocking Bash call the reader may move to the background. */
		function canBackground(tool) {
			return tool.toolName === "Bash" && (tool.phase === "started" || tool.phase === "updated") && tool.isError !== true;
		}
		function ClaudeTranscriptToolItem({ tool, t, onBackground }) {
			const [moving, setMoving] = useState(false);
			return /* @__PURE__ */ jsxs("details", {
				className: "dsh-claude-tool-item",
				children: [/* @__PURE__ */ jsxs("summary", {
					className: "dsh-claude-tool-summary-row",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "dsh-claude-tool-label",
							children: tool.toolName
						}),
						/* @__PURE__ */ jsx("span", {
							className: "dsh-claude-tool-description",
							children: tool.description
						}),
						onBackground === void 0 || !canBackground(tool) ? null : /* @__PURE__ */ jsx("button", {
							type: "button",
							className: "dsh-claude-tool-background",
							disabled: moving,
							"aria-label": t("toolBackground"),
							onClick: (event) => {
								event.preventDefault();
								event.stopPropagation();
								setMoving(true);
								onBackground(tool.toolUseId).finally(() => {
									setMoving(false);
								});
							},
							children: t(moving ? "toolBackgrounding" : "toolBackground")
						}),
						tool.additions === void 0 && tool.deletions === void 0 ? null : /* @__PURE__ */ jsxs("span", {
							className: "dsh-claude-tool-stats",
							children: [/* @__PURE__ */ jsxs("span", {
								className: "dsh-claude-diff-add",
								children: ["+", tool.additions ?? 0]
							}), /* @__PURE__ */ jsxs("span", {
								className: "dsh-claude-diff-delete",
								children: ["−", tool.deletions ?? 0]
							})]
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "dsh-claude-tool-content",
					children: [tool.subcalls.length === 0 ? null : /* @__PURE__ */ jsx("div", {
						className: "dsh-claude-flow-subcalls",
						children: tool.subcalls.map((subcall) => /* @__PURE__ */ jsxs("div", { children: [
							subcallGlyph(subcall),
							" ",
							subcall.toolName ?? t("subagent"),
							subcall.summary === void 0 ? "" : ` · ${subcall.summary}`
						] }, subcall.toolUseId))
					}), /* @__PURE__ */ jsx(ToolPresentation, {
						tool,
						t
					})]
				})]
			});
		}
		function ClaudeTranscriptToolGroup({ tools, additions, deletions, files: _files, t, onBackground }) {
			const [open, setOpen] = useState(false);
			const failed = tools.some((tool) => tool.isError === true || tool.phase === "failed");
			const running = tools.some((tool) => tool.phase === "started" || tool.phase === "updated");
			const summary = tools.length === 1 ? t("usedTool") : t("usedTools", { count: tools.length });
			return /* @__PURE__ */ jsxs("div", {
				className: "dsh-claude-tool-group-native",
				children: [/* @__PURE__ */ jsx(DisclosureRow, {
					rowClassName: "dsh-claude-flow-row",
					leadingClassName: "dsh-claude-flow-leading",
					titleClassName: "dsh-claude-flow-title",
					chevronClassName: "dsh-claude-flow-chevron",
					icon: failed ? /* @__PURE__ */ jsx(StateDot, { state: "error" }) : running ? /* @__PURE__ */ jsx(StateDot, { state: "ongoing" }) : /* @__PURE__ */ jsx(IconApiOutlineRegular, { size: 14 }),
					title: summary,
					open,
					expandable: true,
					expandOnRowClick: true,
					keepContentWhenOpen: true,
					onToggle: () => setOpen((value) => !value),
					collapsedContent: additions !== void 0 || deletions !== void 0 ? /* @__PURE__ */ jsxs("span", {
						className: "dsh-claude-tool-stats",
						children: [/* @__PURE__ */ jsxs("span", {
							className: "dsh-claude-diff-add",
							children: ["+", additions ?? 0]
						}), /* @__PURE__ */ jsxs("span", {
							className: "dsh-claude-diff-delete",
							children: ["−", deletions ?? 0]
						})]
					}) : void 0
				}), open ? /* @__PURE__ */ jsx("div", {
					className: "dsh-claude-tool-list",
					children: tools.map((tool) => /* @__PURE__ */ jsx(ClaudeTranscriptToolItem, {
						tool,
						t,
						...onBackground === void 0 ? {} : { onBackground }
					}, tool.toolUseId))
				}) : null]
			});
		}
		/** Round a duration the way a reader reads one: no more precision than the
		*  number deserves. */
		function formatTurnDuration(ms) {
			if (ms < 1e3) return `${Math.max(1, Math.round(ms))}ms`;
			const seconds = ms / 1e3;
			if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : String(Math.round(seconds))}s`;
			const whole = Math.round(seconds);
			return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, "0")}s`;
		}
		/** Share of the prompt that was served from cache.
		*
		*  Cache reads are counted against everything the prompt cost to assemble --
		*  fresh input and cache writes included -- so a turn that read nothing scores
		*  zero rather than dividing by nothing. */
		function cacheHitRate(usage) {
			const read = usage.cacheReadTokens ?? 0;
			const total = read + (usage.cacheCreationTokens ?? 0) + (usage.inputTokens ?? 0);
			return total === 0 ? void 0 : read / total;
		}
		/** The turn's accounting, in the order a reader wants it: size, then cost of
		*  assembling it, then how long it took, then money. */
		function turnUsageParts(usage, t) {
			const tokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheCreationTokens ?? 0);
			const cached = cacheHitRate(usage);
			const parts = [];
			if (tokens > 0) parts.push(t("turnUsageTokens", { count: formatTokenCount(tokens) }));
			if (cached !== void 0) parts.push(t("turnUsageCache", { percent: (cached * 100).toFixed(1) }));
			if (usage.durationMs !== void 0) parts.push(formatTurnDuration(usage.durationMs));
			if (usage.ttftMs !== void 0) parts.push(t("turnUsageTtft", { duration: formatTurnDuration(usage.ttftMs) }));
			if (usage.cumulativeCostUsd !== void 0) parts.push(t("turnUsageCost", { cost: usage.cumulativeCostUsd.toFixed(2) }));
			return parts;
		}
		/** The footer the Host draws under its own assistant message, drawn here for
		*  the steps the Host never had a message for. Mounted at the turn's foot, so
		*  it closes the turn under the task badge rather than above it. */
		function ClaudeTurnUsage({ usage, t }) {
			ensureActivityCss();
			const parts = turnUsageParts(usage, t);
			if (parts.length === 0) return null;
			return /* @__PURE__ */ jsxs("div", {
				className: "dsh-claude-turn-usage",
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "dsh-claude-turn-usage-label",
						children: t("turnUsage")
					}),
					/* @__PURE__ */ jsx("span", {
						"aria-hidden": "true",
						children: "·"
					}),
					/* @__PURE__ */ jsx("span", { children: parts.join(" · ") })
				]
			});
		}
		function ClaudeActivityNode({ node, useClaudeProjection, t, backgroundCall, files }) {
			ensureActivityCss();
			const marker = node.data;
			const activities = useClaudeProjection((value) => selectStepActivities(value, marker.turn, marker.step));
			const tasks = useClaudeProjection((value) => value.tasks?.tasks ?? EMPTY_TASKS$2);
			const items = useMemo(() => transcriptItemsForStep(activities, marker.turn, marker.step, tasks), [
				activities,
				marker.step,
				marker.turn,
				tasks
			]);
			if (items.length === 0) return null;
			return /* @__PURE__ */ jsx(ClaudeTranscriptFlow, {
				items,
				t,
				...backgroundCall === void 0 ? {} : { onBackground: backgroundCall },
				...files === void 0 ? {} : { files }
			});
		}
		function ClaudeTranscriptText({ text, labels, files, t }) {
			const fileMentions = useFileMentions(text, files, useCallback((path) => t("fileMentionOpen", { name: path }), [t]));
			return /* @__PURE__ */ jsx("div", {
				className: "dsh-claude-transcript-text",
				children: /* @__PURE__ */ jsx(ClaudeMarkdown, {
					text,
					labels,
					...fileMentions === void 0 ? {} : { fileMentions }
				})
			});
		}
		/** The transcript items of one step or one teammate, drawn as the chat draws them. */
		function ClaudeTranscriptFlow({ items, t, onBackground, files }) {
			const markdownLabels = useClaudeMarkdownLabels(t);
			ensureActivityCss();
			return /* @__PURE__ */ jsx("div", {
				className: "dsh-claude-flow",
				children: items.map((item) => item.kind === "text" ? /* @__PURE__ */ jsx(ClaudeTranscriptText, {
					text: item.text,
					labels: markdownLabels,
					files,
					t
				}, `text:${item.ordinal}`) : item.kind === "compaction" ? /* @__PURE__ */ jsx(ClaudeCompactionDivider, {
					compaction: item.compaction,
					t
				}, `compaction:${item.ordinal}`) : item.kind === "tools" ? /* @__PURE__ */ jsx(ClaudeTranscriptToolGroup, {
					tools: item.tools,
					...item.additions === void 0 ? {} : { additions: item.additions },
					...item.deletions === void 0 ? {} : { deletions: item.deletions },
					...item.files === void 0 ? {} : { files: item.files },
					...onBackground === void 0 ? {} : { onBackground },
					t
				}, `tools:${item.ordinal}`) : /* @__PURE__ */ jsx(ActivityRow, {
					row: item.row,
					t
				}, `activity:${item.ordinal}`))
			});
		}
		//#endregion
		//#region src/client/ClaudeActivityTail.tsx
		/** What the turn cost, once it is over. Background work is the Host's own
		*  session-header job list (see host-jobs.ts), not a launcher here. */
		function ClaudeActivityTail({ turn, useClaudeProjection, t }) {
			const matched = selectClaudeTurn({ turn });
			const usage = useClaudeProjection((value) => matched === null ? void 0 : latestTurnUsage(value.activities, matched.turn));
			if (matched === null || usage === void 0) return null;
			return /* @__PURE__ */ jsx(ClaudeTurnUsage, {
				usage,
				t
			});
		}
		//#endregion
		//#region src/client/background-task-api.ts
		/** Move one running Bash call to the background; resolves with the Host's
		*  answer code (`moved`, `not-running`, `unavailable`) rather than throwing
		*  for the expected refusals, so a card can just show what happened. */
		async function backgroundToolCall(sessionId, toolUseId) {
			try {
				const answer = await pluginWrite(CLAUDE_BACKGROUND_TASK_PATH, "fast", void 0, { json: {
					sessionId,
					toolUseId
				} });
				return typeof answer?.outcome === "string" ? answer.outcome : "moved";
			} catch (error) {
				if (!(error instanceof PluginRequestError)) throw error;
				return error.code ?? error.reason;
			}
		}
		//#endregion
		//#region src/client/styles.ts
		const chevronOpen = { transform: "rotate(90deg)" };
		const settingsPage = {
			display: "flex",
			flexDirection: "column",
			gap: 16,
			width: "100%",
			maxWidth: 820,
			paddingBottom: 28
		};
		const settingsHero = {
			display: "flex",
			alignItems: "center",
			gap: 14,
			padding: "2px 2px 8px"
		};
		const settingsMark = {
			width: 42,
			height: 42,
			display: "grid",
			placeItems: "center",
			flex: "none",
			borderRadius: 13,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-static-blue-450)",
			fontSize: 18,
			fontWeight: 700
		};
		const settingsHeading = {
			margin: 0,
			color: "var(--dsw-alias-label-primary)",
			fontSize: 20,
			lineHeight: "28px",
			fontWeight: 650
		};
		const settingsSectionHeading = {
			margin: 0,
			color: "var(--dsw-alias-label-primary)",
			fontSize: 15,
			lineHeight: "22px",
			fontWeight: 650
		};
		const settingsBody = {
			margin: 0,
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 14,
			lineHeight: "22px"
		};
		const settingsCard = {
			display: "flex",
			flexDirection: "column",
			gap: 14,
			padding: 18,
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 14,
			background: "var(--dsw-alias-bg-layer-1)"
		};
		const settingsCardHeader = {
			display: "flex",
			alignItems: "flex-start",
			justifyContent: "space-between",
			gap: 16
		};
		const diagnosticGrid = {
			display: "grid",
			gridTemplateColumns: "minmax(130px, 0.36fr) minmax(0, 1fr)",
			gap: "10px 18px",
			padding: "14px 0",
			borderTop: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderBottom: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			fontSize: 13
		};
		const diagnosticLabel = { color: "var(--dsw-alias-label-tertiary)" };
		const diagnosticValue = {
			color: "var(--dsw-alias-label-primary)",
			fontWeight: 500,
			overflowWrap: "anywhere"
		};
		const settingSelect = {
			position: "relative",
			minWidth: 0
		};
		const settingTextInput = {
			width: "100%",
			minWidth: 0,
			boxSizing: "border-box",
			minHeight: 38,
			padding: "7px 13px",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 10,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 14,
			lineHeight: "22px"
		};
		const settingSelectTriggerClass = "dshClaudeSettingSelectTrigger";
		const settingSelectChevronClass = "dshClaudeSettingSelectChevron";
		/**
		* The listbox trigger and its chevron, in a stylesheet rather than inline
		* because the states it has to draw cannot be expressed inline.
		*
		* Focus is the reason. An inline style carries no pseudo-class, so the blue
		* ring used to ride on the open state alone: choosing an option closed the
		* menu and took the ring with it while the button kept DOM focus, leaving the
		* UA's own focus ring -- white on a dark theme, drawn outside the radius --
		* as the only indicator. Focus and open are separate states; both draw the
		* ring here, and `outline: none` retires the UA's.
		*
		* The open state reads `aria-expanded` instead of a second class because the
		* attribute is already on the element and already correct. Its value is left
		* unquoted: a valid identifier needs no quotes, and the sheet then survives
		* React's server escaping, which would otherwise write `&quot;` into markup a
		* browser reads as raw text.
		*/
		const settingSelectCss = `
		.${settingSelectTriggerClass} {
		  width: 100%;
		  min-height: 38px;
		  display: flex;
		  align-items: center;
		  justify-content: space-between;
		  gap: 12px;
		  padding: 7px 11px 7px 13px;
		  border: 1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent));
		  border-radius: 10px;
		  background: var(--dsw-alias-bg-layer-2);
		  color: var(--dsw-alias-label-primary);
		  box-shadow: 0 1px 2px color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);
		  font: inherit;
		  font-size: 14px;
		  line-height: 22px;
		  text-align: left;
		  cursor: pointer;
		  transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
		}
		.${settingSelectTriggerClass}:focus-visible,
		.${settingSelectTriggerClass}[aria-expanded=true] {
		  outline: none;
		  border-color: var(--dsw-static-blue-450);
		  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-static-blue-450) 15%, transparent);
		}
		.${settingSelectChevronClass} {
		  flex: none;
		  display: grid;
		  place-items: center;
		  width: 16px;
		  height: 16px;
		  color: var(--dsw-alias-label-tertiary);
		  transition: transform 120ms ease;
		}
		.${settingSelectTriggerClass}[aria-expanded=true] .${settingSelectChevronClass} {
		  transform: rotate(180deg);
		}
		`;
		const settingSelectValue = {
			minWidth: 0,
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const settingSelectMenu = {
			position: "absolute",
			zIndex: 20,
			top: "calc(100% + 6px)",
			left: 0,
			right: 0,
			maxHeight: 240,
			overflowY: "auto",
			padding: 5,
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 11,
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "0 12px 32px color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent), 0 2px 8px color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)"
		};
		const settingSelectOption = {
			width: "100%",
			minHeight: 34,
			display: "flex",
			alignItems: "center",
			gap: 8,
			padding: "6px 9px",
			border: "none",
			borderRadius: 7,
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 14,
			lineHeight: "22px",
			textAlign: "left",
			cursor: "pointer"
		};
		const settingSelectOptionActive = { background: "var(--dsw-alias-bg-layer-2)" };
		const settingSelectCheck = {
			width: 14,
			flex: "none",
			color: "var(--dsw-static-blue-450)",
			fontSize: 12,
			fontWeight: 700,
			textAlign: "center"
		};
		const settingHint = {
			display: "inline-grid",
			placeItems: "center",
			width: 14,
			height: 14,
			marginLeft: 6,
			verticalAlign: "text-top",
			borderRadius: "50%",
			border: "1px solid currentColor",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 9,
			fontWeight: 600,
			lineHeight: 1,
			cursor: "help",
			userSelect: "none"
		};
		const planUsageMeter = {
			display: "flex",
			alignItems: "center",
			gap: 10,
			minWidth: 0
		};
		const planUsageTrack = {
			flex: "1 1 auto",
			height: 6,
			minWidth: 60,
			borderRadius: 3,
			background: "var(--dsw-alias-bg-layer-2)",
			overflow: "hidden"
		};
		const planUsageFill = {
			display: "block",
			height: "100%",
			borderRadius: 3,
			transition: "width 200ms ease"
		};
		const planUsageMeta = {
			flex: "0 0 auto",
			fontSize: 12,
			whiteSpace: "nowrap"
		};
		/** Bar colour, plus a matching text colour once a window is worth noticing.
		*  Below the warning threshold the reading stays quiet: accent bar, muted text. */
		function planUsageTone(utilization) {
			if (utilization !== void 0 && utilization >= 90) return {
				fill: "var(--dsw-alias-state-error-primary)",
				text: "var(--dsw-alias-state-error-primary)"
			};
			if (utilization !== void 0 && utilization >= 75) return {
				fill: "var(--dsw-alias-state-warning-primary, #d69e2e)",
				text: "var(--dsw-alias-state-warning-primary, #d69e2e)"
			};
			return {
				fill: utilization === void 0 ? "transparent" : "var(--dsw-static-blue-450)",
				text: "var(--dsw-alias-label-tertiary)"
			};
		}
		const settingsActions = {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 8
		};
		const notice = {
			margin: 0,
			padding: "10px 12px",
			borderRadius: 9,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		const button = {
			alignSelf: "flex-start",
			flex: "none",
			minHeight: 34,
			padding: "6px 14px",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 9,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			fontWeight: 550,
			whiteSpace: "nowrap",
			cursor: "pointer"
		};
		const primaryButton = {
			...button,
			borderColor: "transparent",
			background: "var(--dsw-static-blue-450)",
			color: "var(--dsw-static-white)"
		};
		const tasksPanel = {
			display: "flex",
			flexDirection: "column",
			minWidth: 0,
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 12,
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "0 4px 16px color-mix(in srgb, #000 12%, transparent)"
		};
		const detailsCardClass = "dshClaudeDetailsCard";
		/**
		* Geometry shared by every details-column card. Lives in a stylesheet rather
		* than inline so the DSH Desktop macOS shell can be special-cased: its
		* "advanced" frame floats a 32px opaque caption/drag row over the top of the
		* conversation and details columns, 12px of which lands inside the column and
		* used to cover the card's top border and corners.
		*/
		const detailsCardCss = `
		.${detailsCardClass} {
		  box-sizing: border-box;
		  width: calc(100% - 16px);
		  height: calc(100% - 16px);
		  margin: 8px;
		}
		.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="darwin"] .dshDesktopDetailsSurface .${detailsCardClass} {
		  height: calc(100% - 28px);
		  margin-top: 20px;
		}
		`;
		const tasksHeader = {
			boxSizing: "border-box",
			height: 58,
			flex: "none",
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 10,
			padding: "9px 12px",
			borderBottom: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))"
		};
		const tasksHeading = {
			display: "block",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 15,
			lineHeight: "20px",
			fontWeight: 600
		};
		const panelIconButtonClass = "dshClaudePanelIconButton";
		const panelIconButtonCss = `
		.${panelIconButtonClass} {
		  width: 26px;
		  height: 26px;
		  display: grid;
		  place-items: center;
		  padding: 0;
		  border: none;
		  border-radius: 7px;
		  background: transparent;
		  color: var(--dsw-alias-label-tertiary);
		  font: inherit;
		  line-height: 1;
		  cursor: pointer;
		  transition: background-color 120ms ease, color 120ms ease;
		}
		.${panelIconButtonClass}:hover {
		  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
		  color: var(--dsw-alias-label-primary);
		}
		.${panelIconButtonClass}:active {
		  background: color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent);
		}
		.${panelIconButtonClass}:focus-visible {
		  outline: 2px solid var(--dsw-static-blue-450);
		  outline-offset: 1px;
		}
		`;
		const tasksBody = {
			flex: 1,
			minHeight: 0,
			overflowY: "auto",
			padding: "12px 14px 20px",
			background: "var(--dsw-alias-bg-base)"
		};
		const tasksGroupEmpty = {
			margin: "5px 4px 2px",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		/** Title and state chip: one phrase at the header's left end. */
		const planHeaderStart = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			minWidth: 0
		};
		/** "2 / 5" next to the title when the session has proposed more than one. */
		const planCount = {
			flex: "none",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			lineHeight: "17px",
			fontVariantNumeric: "tabular-nums"
		};
		/** The review composer: notes filed so far, the pending quote, and the box.
		*  Docked below the plan body so the plan itself keeps the scrolling room. */
		const planComposer = {
			flex: "none",
			display: "flex",
			flexDirection: "column",
			gap: 6,
			maxHeight: "45%",
			overflowY: "auto",
			padding: "10px 14px 12px",
			borderTop: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			background: "var(--dsw-alias-bg-layer-1)"
		};
		const planNoteList = {
			display: "flex",
			flexDirection: "column",
			gap: 6,
			margin: 0,
			padding: 0,
			listStyle: "none"
		};
		const planNote = {
			position: "relative",
			padding: "6px 26px 6px 8px",
			borderRadius: 7,
			background: "var(--dsw-alias-bg-base)"
		};
		/** The quoted passage, marked as someone else's words by the rule down its
		*  left edge rather than by quotation marks it may already contain. */
		const planNoteQuote = {
			display: "-webkit-box",
			WebkitLineClamp: 3,
			WebkitBoxOrient: "vertical",
			overflow: "hidden",
			margin: 0,
			paddingLeft: 8,
			borderLeft: "2px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 24%, transparent))",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			lineHeight: "16px",
			whiteSpace: "pre-wrap"
		};
		const planNoteText = {
			margin: "4px 0 0",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			lineHeight: "17px",
			whiteSpace: "pre-wrap"
		};
		const planNoteRemove = {
			position: "absolute",
			top: 4,
			right: 4,
			width: 18,
			height: 18,
			display: "grid",
			placeItems: "center",
			padding: 0,
			border: 0,
			borderRadius: 5,
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 14,
			lineHeight: 1,
			cursor: "pointer"
		};
		/** The live selection, shown attached to the box it will be filed with. */
		const planQuoteChip = {
			position: "relative",
			padding: "6px 26px 6px 8px",
			borderRadius: 7,
			background: "var(--dsw-alias-interactive-bg-hover)"
		};
		const planComposerInput = {
			boxSizing: "border-box",
			width: "100%",
			minHeight: 56,
			padding: "7px 9px",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-base)",
			color: "var(--dsw-alias-label-primary)",
			fontFamily: "inherit",
			fontSize: 12,
			lineHeight: "18px",
			resize: "vertical"
		};
		const planComposerActions = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8
		};
		const planComposerHint = {
			minWidth: 0,
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			lineHeight: "16px"
		};
		const planComposerError = {
			margin: 0,
			color: "var(--dsw-alias-state-error-primary)",
			fontSize: 11,
			lineHeight: "16px"
		};
		/** Maximize and close: the control group at the header's right end. */
		const planHeaderEnd = {
			flex: "none",
			display: "flex",
			alignItems: "center",
			gap: 2
		};
		const planBadge = {
			flex: "none",
			padding: "2px 8px",
			borderRadius: 999,
			background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent)",
			color: "var(--dsw-alias-state-success-primary)",
			fontSize: 11,
			lineHeight: "16px",
			fontWeight: 600,
			whiteSpace: "nowrap"
		};
		const planBadgePending = {
			background: "var(--dsw-alias-interactive-bg-hover)",
			color: "var(--dsw-alias-label-secondary)"
		};
		const planBadgeRejected = {
			background: "color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent)",
			color: "var(--dsw-alias-state-error-primary)"
		};
		/** Says where the decision is made, since this panel deliberately does not
		*  make it: the Host's approval dialog owns the buttons. */
		const planHint = {
			margin: "0 0 12px",
			padding: "8px 10px",
			borderRadius: 8,
			background: "var(--dsw-alias-interactive-bg-hover)",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		/** The task's tool cards. No inset panel of their own: each card already
		*  carries its own surface, and nesting two would read as a box in a box. */
		const heroRepositoryControls = {
			position: "relative",
			display: "inline-flex",
			alignItems: "center",
			gap: 8,
			minWidth: 0
		};
		const heroRepositoryCapsule = {
			height: 30,
			display: "inline-flex",
			alignItems: "center",
			minWidth: 0,
			padding: 2,
			border: "1px solid var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 12%, transparent))",
			borderRadius: 10,
			background: "var(--dsw-alias-interactive-bg-base, var(--dsw-alias-bg-layer-1))",
			color: "var(--dsw-alias-label-secondary)"
		};
		const heroBranchPicker = {
			position: "relative",
			display: "inline-flex",
			minWidth: 0
		};
		const heroBranchTrigger = {
			height: 26,
			maxWidth: 230,
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			minWidth: 0,
			padding: "0 7px",
			border: "none",
			borderRadius: 7,
			background: "transparent",
			color: "inherit",
			font: "inherit",
			fontSize: 13,
			lineHeight: "18px",
			cursor: "pointer"
		};
		const heroBranchName = {
			minWidth: 0,
			overflow: "hidden",
			color: "var(--dsw-alias-label-primary)",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const heroBranchMenu = {
			position: "absolute",
			zIndex: 1100,
			top: "calc(100% + 6px)",
			left: 0,
			width: 280,
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			gap: 4,
			padding: 4,
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 10,
			background: "var(--dsw-specific-menu)",
			boxShadow: "var(--dsw-shadow-lv3)"
		};
		const heroBranchSearchRow = {
			display: "flex",
			alignItems: "center",
			gap: 4
		};
		/** The branch search shares its row with the refresh button; the ticket search
		*  owns its row and keeps the plain style. */
		const heroBranchSearchGrow = {
			minWidth: 0,
			flex: 1
		};
		const heroBranchSearch = {
			height: 32,
			boxSizing: "border-box",
			display: "flex",
			alignItems: "center",
			gap: 6,
			padding: "0 8px",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 7,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const heroBranchSearchInput = {
			minWidth: 0,
			flex: 1,
			border: "none",
			outline: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			lineHeight: "18px"
		};
		const heroBranchRefresh = {
			width: 32,
			height: 32,
			boxSizing: "border-box",
			display: "grid",
			placeItems: "center",
			flex: "none",
			padding: 0,
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 7,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-secondary)",
			cursor: "pointer"
		};
		const heroBranchRefreshHover = {
			background: "var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2))",
			color: "var(--dsw-alias-label-primary)"
		};
		const heroBranchRefreshBusy = {
			color: "var(--dsw-alias-label-tertiary)",
			cursor: "default"
		};
		const heroBranchNotice = {
			padding: "0 8px",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			lineHeight: "16px"
		};
		const heroBranchNoticeError = { color: "var(--dsw-alias-state-error-primary)" };
		const heroBranchList = {
			maxHeight: 170,
			display: "flex",
			flexDirection: "column",
			overflowY: "auto",
			overscrollBehavior: "contain"
		};
		const heroBranchItem = {
			width: "100%",
			height: 36,
			minHeight: 36,
			display: "flex",
			alignItems: "center",
			gap: 8,
			padding: "0 9px",
			border: "none",
			borderRadius: 7,
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			lineHeight: "18px",
			textAlign: "left",
			cursor: "pointer"
		};
		const heroBranchItemActive = { background: "var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2))" };
		const heroBranchItemName = {
			minWidth: 0,
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const heroBranchEmpty = {
			height: 36,
			display: "grid",
			placeItems: "center",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 13
		};
		const heroRepositoryDivider = {
			width: 1,
			height: 16,
			flex: "none",
			background: "var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))"
		};
		const heroWorktreeToggle = {
			height: 26,
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			padding: "0 7px",
			border: "none",
			borderRadius: 7,
			outline: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			fontSize: 13,
			lineHeight: "18px",
			whiteSpace: "nowrap",
			cursor: "pointer",
			transition: "background 120ms ease, color 120ms ease, box-shadow 120ms ease"
		};
		const heroWorktreeToggleActive = {
			background: "color-mix(in srgb, var(--dsw-static-blue-450) 10%, transparent)",
			color: "var(--dsw-alias-label-primary)"
		};
		const heroWorktreeToggleFocused = { boxShadow: "0 0 0 2px color-mix(in srgb, var(--dsw-static-blue-450) 28%, transparent)" };
		const heroWorktreeCheckbox = {
			width: 15,
			height: 15,
			boxSizing: "border-box",
			display: "grid",
			placeItems: "center",
			flex: "none",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 4,
			background: "var(--dsw-alias-bg-layer-2)",
			boxShadow: "inset 0 1px 1px rgba(0, 0, 0, 0.08)",
			color: "var(--dsw-alias-label-on-accent, #fff)",
			transition: "border-color 120ms ease, background 120ms ease, box-shadow 120ms ease"
		};
		const heroWorktreeCheckboxChecked = {
			borderColor: "var(--dsw-static-blue-450)",
			background: "var(--dsw-static-blue-450)",
			boxShadow: "0 1px 3px color-mix(in srgb, var(--dsw-static-blue-450) 35%, transparent)"
		};
		const heroWorktreeCheckboxIcon = {
			width: 12,
			height: 12,
			display: "block"
		};
		const heroWorktreeProgressCard = {
			position: "absolute",
			zIndex: 1050,
			top: "calc(100% + 10px)",
			left: 0,
			width: 320,
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			gap: 12,
			padding: 14,
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 12,
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "var(--dsw-shadow-lv3)"
		};
		const heroWorktreeProgressHeader = {
			display: "flex",
			alignItems: "flex-start",
			gap: 10
		};
		const heroWorktreeProgressSpinner = {
			width: 18,
			height: 18,
			flex: "none",
			color: "var(--dsw-static-blue-450)"
		};
		const heroWorktreeProgressError = {
			width: 18,
			height: 18,
			display: "grid",
			placeItems: "center",
			flex: "none",
			borderRadius: "50%",
			background: "var(--dsw-alias-state-error-primary)",
			color: "var(--dsw-alias-label-on-accent, #fff)",
			fontSize: 13,
			lineHeight: 1
		};
		const heroWorktreeProgressCopy = {
			minWidth: 0,
			display: "flex",
			flex: 1,
			flexDirection: "column",
			gap: 2
		};
		const heroWorktreeProgressTitle = {
			color: "var(--dsw-alias-label-primary)",
			fontSize: 13,
			lineHeight: "18px",
			fontWeight: 600
		};
		const heroWorktreeProgressCurrent = {
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			lineHeight: "18px",
			overflowWrap: "anywhere"
		};
		const heroWorktreeProgressContext = {
			color: "var(--dsw-alias-label-secondary)",
			fontWeight: 500
		};
		const heroWorktreeProgressDismiss = {
			width: 24,
			height: 24,
			display: "grid",
			placeItems: "center",
			flex: "none",
			padding: 0,
			border: "none",
			borderRadius: 6,
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			font: "inherit",
			cursor: "pointer"
		};
		const heroWorktreeProgressSteps = {
			display: "flex",
			flexDirection: "column",
			gap: 7,
			paddingLeft: 2
		};
		const heroWorktreeProgressStep = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 11,
			lineHeight: "16px"
		};
		const heroWorktreeProgressDot = {
			width: 14,
			height: 14,
			display: "grid",
			placeItems: "center",
			flex: "none",
			boxSizing: "border-box",
			borderRadius: "50%",
			fontSize: 9,
			lineHeight: 1
		};
		const heroWorktreeProgressDotDone = {
			background: "var(--dsw-static-blue-450)",
			color: "var(--dsw-alias-label-on-accent, #fff)"
		};
		const heroWorktreeProgressDotActive = { border: "2px solid var(--dsw-static-blue-450)" };
		const heroRepositoryStatus = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			whiteSpace: "nowrap"
		};
		const heroRepositoryError = {
			maxWidth: 240,
			overflow: "hidden",
			color: "var(--dsw-alias-state-error-primary)",
			fontSize: 11,
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		/** Sized like the Host's own dock panels (the todo dock): inset from the
		*  composer card by four dock insets, so the bars line up with it. */
		const DOCK_WIDTH = "calc(100% - 2 * var(--dsh-composer-side-clearance, 16px) - 4 * var(--dsh-composer-dock-inset, 8px))";
		const DOCK_MAX_WIDTH = "calc(var(--dsh-composer-card-max-width, 782px) - 4 * var(--dsh-composer-dock-inset, 8px))";
		/** The Host dock panel's surface: menu fill, elevation shadow, no border. */
		const dockSurface = {
			border: 0,
			borderRadius: "var(--dsw-radius-lg, 12px)",
			background: "var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1))",
			backdropFilter: "var(--dsw-menu-backdrop-filter)",
			boxShadow: "var(--dsw-elevation-panel)"
		};
		const repositoryBarFrame = {
			width: DOCK_WIDTH,
			maxWidth: DOCK_MAX_WIDTH,
			minWidth: 0,
			margin: "0 auto",
			boxSizing: "border-box"
		};
		const repositoryBar = {
			width: "100%",
			minWidth: 0,
			minHeight: 36,
			boxSizing: "border-box",
			display: "flex",
			alignItems: "center",
			gap: 10,
			padding: "6px 12px",
			...dockSurface,
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 14,
			lineHeight: "22px",
			textAlign: "left"
		};
		const repositoryBarMerged = {
			boxShadow: "0 0 0 1px color-mix(in srgb, #a78bfa 35%, transparent), var(--dsw-elevation-panel)",
			background: "color-mix(in srgb, #a78bfa 5%, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1)))"
		};
		/** A checkout the session wrote into besides its own: lighter, dashed, and
		*  stacked above the session bar so it reads as attached rather than primary.
		*  It keeps the bar's fill: the dock floats over the end of the
		*  transcript, and a transparent bar let the prose show through. */
		const repositoryBarLinked = {
			marginBottom: 6,
			minHeight: 32,
			padding: "4px 12px",
			border: "1px dashed var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 12%, transparent))",
			boxShadow: "none",
			color: "var(--dsw-alias-label-secondary)"
		};
		const repositoryPrIcon = {
			width: 20,
			height: 20,
			display: "grid",
			placeItems: "center",
			flex: "none",
			borderRadius: 6,
			color: "var(--dsw-alias-state-success-primary, var(--dsw-static-blue-450))"
		};
		const repositoryPrIconMerged = { color: "#a78bfa" };
		const repositoryPrimary = {
			minWidth: 0,
			flex: 1,
			overflow: "hidden",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 13,
			fontWeight: 600,
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const repositoryPrLinkFrame = {
			position: "relative",
			flex: "none"
		};
		const repositoryPrLink = {
			color: "var(--dsw-alias-state-success-primary)",
			fontSize: 13,
			fontWeight: 650,
			textDecoration: "none",
			cursor: "pointer"
		};
		const repositoryPrLinkMerged = { color: "#a78bfa" };
		const repositoryPrHoverCard = {
			position: "absolute",
			zIndex: 30,
			left: -34,
			bottom: "calc(100% + 14px)",
			width: 340,
			display: "flex",
			flexDirection: "column",
			gap: 10,
			padding: "13px 14px",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 12,
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "0 14px 38px color-mix(in srgb, #000 34%, transparent)",
			color: "var(--dsw-alias-label-primary)",
			pointerEvents: "auto"
		};
		const repositoryPrHoverTop = {
			display: "flex",
			alignItems: "center",
			gap: 7,
			minWidth: 0
		};
		const repositoryPrStateBadge = {
			flex: "none",
			display: "inline-flex",
			alignItems: "center",
			gap: 5,
			padding: "2px 8px",
			borderRadius: 999,
			background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 22%, transparent)",
			color: "var(--dsw-alias-state-success-primary)",
			fontSize: 11,
			fontWeight: 650
		};
		const repositoryPrStateBadgeMerged = {
			background: "color-mix(in srgb, #a78bfa 18%, transparent)",
			color: "#a78bfa"
		};
		const repositoryPrHoverRepo = {
			minWidth: 0,
			flex: 1,
			overflow: "hidden",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const repositoryPrHoverAge = {
			flex: "none",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11
		};
		const repositoryPrHoverTitle = {
			color: "var(--dsw-alias-label-primary)",
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 650,
			textDecoration: "underline",
			textUnderlineOffset: 2,
			cursor: "pointer"
		};
		const repositoryPrHoverBottom = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12
		};
		const repositoryPrAuthor = {
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11
		};
		const repositoryPrAvatar = {
			width: 18,
			height: 18,
			display: "grid",
			placeItems: "center",
			borderRadius: 999,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 9,
			fontWeight: 700
		};
		const repositoryPrHoverStats = {
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			fontSize: 11,
			fontWeight: 650
		};
		const repositoryPrFiles = {
			padding: "2px 7px",
			borderRadius: 6,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-tertiary)",
			fontWeight: 500
		};
		/** The repository name reads whole while there is room; it is the first
		*  thing to give way when the controls need it, and never wider than its text. */
		const repositoryRemote = {
			minWidth: 0,
			flex: "0 1 auto",
			overflow: "hidden",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const repositoryBranch = {
			minWidth: 0,
			maxWidth: 125,
			overflow: "hidden",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			fontWeight: 550,
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const repositoryWorktree = {
			flex: "none",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12
		};
		const repositoryStatusItems = {
			minWidth: 0,
			flex: 1,
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 8,
			overflow: "hidden"
		};
		const repositoryGlyph = {
			width: 16,
			height: 16,
			flex: "none",
			display: "grid",
			placeItems: "center",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const repositoryItemSuccess = { color: "var(--dsw-alias-state-success-primary)" };
		const repositoryItemWarning = { color: "var(--dsw-alias-state-warning-primary, #d69e2e)" };
		const repositoryItemError = { color: "var(--dsw-alias-state-error-primary)" };
		const repositoryMergedStatus = {
			minWidth: 0,
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			overflow: "hidden",
			color: "#a78bfa",
			fontSize: 12,
			fontWeight: 600,
			whiteSpace: "nowrap",
			textOverflow: "ellipsis"
		};
		const repositoryMergedDot = {
			width: 6,
			height: 6,
			flex: "none",
			borderRadius: 999,
			background: "currentColor"
		};
		const repositoryMergedAge = {
			overflow: "hidden",
			color: "var(--dsw-alias-label-tertiary)",
			fontWeight: 500,
			textOverflow: "ellipsis"
		};
		const diffTrigger = {
			flex: "none",
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			minHeight: 26,
			padding: "3px 8px",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 7,
			background: "var(--dsw-alias-bg-layer-2)",
			font: "inherit",
			fontSize: 12,
			lineHeight: "18px",
			fontWeight: 650,
			cursor: "pointer"
		};
		const diffTriggerMuted = {
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const repositoryAutoFixClass = "dshClaudeAutoFix";
		/** The switch is styled entirely from a stylesheet: its base look, its on
		*  state off `aria-checked`, its ring off `:focus-visible`. Nothing is set
		*  inline, because an inline border, background or colour would outrank the
		*  on-state rule and the switch would toggle without ever looking switched. */
		const repositoryAutoFixCss = `
		.${repositoryAutoFixClass} {
		  width: 26px;
		  min-height: 26px;
		  flex: none;
		  display: inline-flex;
		  align-items: center;
		  justify-content: center;
		  padding: 0;
		  border: 1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent));
		  border-radius: 7px;
		  outline: none;
		  background: var(--dsw-alias-bg-layer-2);
		  color: var(--dsw-alias-label-tertiary);
		  font: inherit;
		  line-height: 18px;
		  cursor: pointer;
		}
		.${repositoryAutoFixClass}:focus-visible {
		  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-static-blue-450) 28%, transparent);
		}
		.${repositoryAutoFixClass}[aria-checked="true"] {
		  border-color: var(--dsw-static-blue-450);
		  background: var(--dsw-static-blue-450);
		  color: var(--dsw-alias-label-on-accent, #fff);
		}
		`;
		const repositoryUpdateTrigger = {
			flex: "none",
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			minHeight: 26,
			padding: "3px 8px",
			border: "1px solid color-mix(in srgb, var(--dsw-static-blue-450) 45%, transparent)",
			borderRadius: 7,
			background: "color-mix(in srgb, var(--dsw-static-blue-450) 12%, transparent)",
			color: "var(--dsw-static-blue-450)",
			font: "inherit",
			fontSize: 12,
			lineHeight: "18px",
			fontWeight: 650,
			whiteSpace: "nowrap",
			cursor: "pointer"
		};
		/** A stopped rebase is the one bar control that reports a blocked checkout
		*  rather than an available action, so it carries the warning tone. */
		const repositoryConflictTrigger = {
			...repositoryUpdateTrigger,
			borderColor: "color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d69e2e) 55%, transparent)",
			background: "color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d69e2e) 14%, transparent)",
			color: "var(--dsw-alias-state-warning-primary, #d69e2e)"
		};
		const repositoryChecksFrame = {
			position: "relative",
			display: "inline-flex",
			minWidth: 0
		};
		const repositoryChecksTrigger = {
			display: "inline-flex",
			alignItems: "center",
			minWidth: 0,
			padding: 0,
			border: "none",
			background: "transparent",
			font: "inherit",
			color: "inherit",
			cursor: "pointer"
		};
		const repositoryChecksCard = {
			position: "absolute",
			zIndex: 1100,
			bottom: "calc(100% + 8px)",
			right: 0,
			width: 360,
			maxWidth: "calc(100vw - 32px)",
			maxHeight: "min(480px, calc(100dvh - 48px))",
			overflowY: "auto",
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			alignItems: "stretch",
			gap: 12,
			padding: 18,
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 14,
			background: "var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1))",
			boxShadow: "var(--dsw-shadow-lv3)",
			textAlign: "left",
			cursor: "default"
		};
		const repositoryChecksTitle = {
			color: "var(--dsw-alias-label-primary)",
			fontSize: 14,
			fontWeight: 650,
			lineHeight: "22px",
			paddingBottom: 10,
			borderBottom: "1px solid var(--dsw-alias-border-l2)"
		};
		const repositoryChecksHint = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12
		};
		const repositoryChecksError = {
			color: "var(--dsw-alias-state-error-primary)",
			fontSize: 12
		};
		const repositoryChecksItem = {
			display: "flex",
			flexDirection: "column",
			gap: 5,
			minWidth: 0,
			padding: "10px 12px",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-2)"
		};
		const repositoryChecksName = {
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			fontWeight: 600,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const repositoryChecksDesc = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			lineHeight: "18px",
			overflowWrap: "anywhere"
		};
		const repositoryChecksFix = {
			alignSelf: "flex-end",
			minHeight: 32,
			padding: "6px 12px",
			border: "none",
			borderRadius: 7,
			background: "var(--dsw-static-blue-450)",
			color: "var(--dsw-alias-label-on-accent, #fff)",
			font: "inherit",
			fontSize: 12,
			fontWeight: 650,
			cursor: "pointer"
		};
		const diffPrCommentsButton = {
			minHeight: 28,
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			padding: "4px 8px",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 7,
			background: "var(--dsw-alias-bg-layer-2)",
			font: "inherit",
			fontSize: 12,
			fontWeight: 650,
			whiteSpace: "nowrap",
			cursor: "pointer"
		};
		const diffGhCommentAvatar = {
			flex: "none",
			width: 16,
			height: 16,
			borderRadius: "50%",
			background: "var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 10%, transparent))",
			objectFit: "cover"
		};
		const diffGhCommentIdentity = {
			display: "inline-flex",
			alignItems: "center",
			gap: 5,
			minWidth: 0
		};
		const diffGhCommentAuthor = {
			color: "var(--dsw-alias-label-tertiary)",
			fontWeight: 600
		};
		const diffGhCommentLink = {
			display: "inline-flex",
			alignItems: "center",
			flex: "none",
			color: "var(--dsw-alias-label-tertiary)",
			textDecoration: "none"
		};
		const diffModalConflicts = {
			display: "flex",
			flexDirection: "column",
			gap: 4,
			margin: 0,
			padding: "8px 10px",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-2)",
			fontSize: 12,
			listStyle: "none"
		};
		const diffModalConflictResolve = {
			alignSelf: "flex-start",
			minHeight: 28,
			padding: "4px 12px",
			border: "none",
			borderRadius: 7,
			background: "var(--dsw-static-blue-450)",
			color: "var(--dsw-alias-label-on-accent, #fff)",
			font: "inherit",
			fontSize: 12,
			fontWeight: 650,
			cursor: "pointer"
		};
		/** Ticket summaries need room; the branch menu's 280px truncates them badly. */
		const heroTicketMenu = { width: 420 };
		const heroTicketKey = {
			flex: "none",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			fontWeight: 650,
			letterSpacing: .2
		};
		const heroTicketChips = {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: 6,
			padding: "2px 2px 6px",
			borderBottom: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 12%, transparent))"
		};
		const heroTicketChip = {
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			padding: "2px 4px 2px 8px",
			border: "1px solid color-mix(in srgb, var(--dsw-static-blue-450) 40%, transparent)",
			borderRadius: 999,
			background: "color-mix(in srgb, var(--dsw-static-blue-450) 12%, transparent)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			fontWeight: 600,
			letterSpacing: .2
		};
		const heroTicketChipRemove = {
			width: 16,
			height: 16,
			display: "grid",
			placeItems: "center",
			padding: 0,
			border: "none",
			borderRadius: 999,
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			lineHeight: 1,
			cursor: "pointer"
		};
		const heroTicketChipsClear = {
			padding: "2px 4px",
			border: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			cursor: "pointer"
		};
		const heroTicketCheckbox = {
			width: 15,
			height: 15,
			boxSizing: "border-box",
			display: "grid",
			placeItems: "center",
			flex: "none",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 4,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-on-accent, #fff)",
			transition: "border-color 120ms ease, background 120ms ease"
		};
		const heroTicketStatus = {
			flex: "none",
			maxWidth: 110,
			overflow: "hidden",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const settingsLink = {
			color: "var(--dsw-static-blue-450)",
			fontSize: 12,
			textDecoration: "none",
			marginRight: "auto"
		};
		const askSurfaceBorder = "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))";
		const askSurfaceShadow = "var(--dsw-shadow-lv3, 0 8px 24px color-mix(in srgb, #000 24%, transparent))";
		/** Painted through CSS.highlights while the follow-up popup is open. */
		const askHighlightCss = `
		::highlight(dsh-claude-ask) {
		  background-color: color-mix(in srgb, var(--dsw-static-blue-450) 30%, transparent);
		  color: inherit;
		}
		`;
		const askToolbar = {
			position: "fixed",
			zIndex: 2e3,
			pointerEvents: "auto",
			display: "inline-flex",
			alignItems: "center",
			gap: 2,
			padding: 3,
			border: askSurfaceBorder,
			borderRadius: 9,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			boxShadow: askSurfaceShadow
		};
		const askPopup = {
			position: "fixed",
			zIndex: 2e3,
			pointerEvents: "auto",
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			gap: 14,
			padding: 18,
			overflowY: "auto",
			border: askSurfaceBorder,
			borderRadius: 14,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			boxShadow: askSurfaceShadow,
			fontSize: 13,
			lineHeight: "20px"
		};
		const askQuote = {
			flex: "none",
			display: "-webkit-box",
			WebkitLineClamp: 3,
			WebkitBoxOrient: "vertical",
			margin: 0,
			padding: "10px 12px",
			overflow: "hidden",
			borderLeft: "3px solid color-mix(in srgb, var(--dsw-static-blue-450) 60%, transparent)",
			borderRadius: 6,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			lineHeight: "18px",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word"
		};
		const askQuestion = {
			flex: "none",
			margin: 0,
			color: "var(--dsw-alias-label-primary)",
			fontWeight: 600,
			whiteSpace: "pre-wrap",
			wordBreak: "break-word"
		};
		const askTextarea = {
			width: "100%",
			minHeight: 88,
			flexShrink: 0,
			boxSizing: "border-box",
			padding: "8px 10px",
			border: askSurfaceBorder,
			borderRadius: 8,
			outline: "none",
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			lineHeight: "20px",
			resize: "vertical"
		};
		const askActions = {
			flex: "none",
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 8,
			flexWrap: "wrap",
			paddingTop: 12,
			borderTop: "1px solid var(--dsw-alias-border-l2)"
		};
		const askAnswer = {
			flex: "1 1 auto",
			minHeight: 0,
			overflowY: "auto",
			padding: "2px 2px 0",
			wordBreak: "break-word"
		};
		const askButton = {
			minHeight: 32,
			padding: "6px 12px",
			border: askSurfaceBorder,
			borderRadius: 7,
			outline: "none",
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 12,
			lineHeight: "18px",
			fontWeight: 600,
			cursor: "pointer"
		};
		const askPrimaryButton = {
			border: "1px solid transparent",
			background: "var(--dsw-static-blue-450)",
			color: "var(--dsw-alias-label-on-accent, #fff)"
		};
		const askThinkingRow = {
			width: "100%",
			display: "flex",
			alignItems: "baseline",
			gap: 6,
			margin: "0 0 8px",
			padding: 0,
			border: "none",
			outline: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			font: "inherit",
			fontSize: 12,
			lineHeight: "18px",
			textAlign: "left",
			cursor: "pointer"
		};
		const askThinkingLabel = {
			flex: "none",
			fontWeight: 600
		};
		const askThinkingPreview = {
			minWidth: 0,
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const askThinkingFull = {
			minWidth: 0,
			flex: 1,
			maxHeight: 200,
			overflowY: "auto",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word"
		};
		const askToolRow = {
			display: "flex",
			alignItems: "baseline",
			gap: 6,
			margin: "2px 0 6px",
			minWidth: 0,
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		const askToolGlyph = {
			flex: "none",
			width: 14,
			textAlign: "center",
			color: "var(--dsw-static-blue-450)"
		};
		const askToolGlyphDone = { color: "var(--dsw-alias-state-success-primary)" };
		const askToolGlyphError = { color: "var(--dsw-alias-state-error-primary)" };
		const askToolName = {
			flex: "none",
			color: "var(--dsw-alias-label-secondary)",
			fontWeight: 600
		};
		const askToolSummary = {
			minWidth: 0,
			flex: 1,
			overflow: "hidden",
			fontFamily: "var(--dsw-font-family-code, ui-monospace, monospace)",
			fontSize: 11,
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const askStatus = {
			marginRight: "auto",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12
		};
		const askError = {
			margin: 0,
			color: "var(--dsw-alias-state-error-primary)",
			fontSize: 12
		};
		const repositoryMergeTrigger = {
			flex: "none",
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			minHeight: 26,
			padding: "3px 8px",
			border: "1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 45%, transparent)",
			borderRadius: 7,
			background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)",
			color: "var(--dsw-alias-state-success-primary)",
			font: "inherit",
			fontSize: 12,
			lineHeight: "18px",
			fontWeight: 650,
			cursor: "pointer"
		};
		const diffAdd = { color: "var(--dsw-alias-state-success-primary)" };
		const diffDelete = { color: "var(--dsw-alias-state-error-primary)" };
		const diffCommentButtonClass = "dshClaudeDiffCommentButton";
		const diffLineRowClass = "dshClaudeDiffLineRow";
		const diffCommentTextareaClass = "dshClaudeDiffCommentTextarea";
		const diffCommentCss = `
		.${diffCommentButtonClass} {
		  width: 18px;
		  height: 18px;
		  flex: none;
		  display: grid;
		  place-items: center;
		  /* Stay on the line-number row: a wrapped line makes the flex row taller, and
		     centering would float the button into the middle of the wrapped block.
		     The margin centers the 18px button inside the first 22px line box. */
		  align-self: flex-start;
		  margin: 2px 2px 0;
		  padding: 0;
		  border: none;
		  border-radius: 4px;
		  background: var(--dsw-static-blue-450);
		  color: var(--dsw-alias-label-on-accent, #fff);
		  font: inherit;
		  font-size: 13px;
		  line-height: 1;
		  cursor: pointer;
		  opacity: 0;
		  transition: opacity 100ms ease;
		}
		.${diffLineRowClass}:hover .${diffCommentButtonClass},
		.${diffCommentButtonClass}:focus-visible {
		  opacity: 1;
		}
		.${diffCommentButtonClass}[disabled] {
		  visibility: hidden;
		}
		.${diffCommentTextareaClass}:focus {
		  outline: none;
		  box-shadow: inset 0 0 0 1px var(--dsw-static-blue-450);
		}
		`;
		const diffCommentBlock = {
			boxSizing: "border-box",
			width: "min(640px, calc(var(--dsh-claude-diff-viewport, 520px) - 72px))",
			position: "sticky",
			left: 62,
			margin: "4px 8px 8px 62px",
			padding: "8px 10px",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1)",
			fontFamily: "var(--dsw-font-family, system-ui)",
			fontSize: 12,
			lineHeight: "18px",
			whiteSpace: "normal"
		};
		const diffCommentCardText = {
			margin: 0,
			color: "var(--dsw-alias-label-primary)",
			overflowWrap: "anywhere"
		};
		const diffCommentCardMeta = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
			marginBottom: 4,
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11
		};
		const diffCommentTextarea = {
			width: "100%",
			minHeight: 56,
			boxSizing: "border-box",
			padding: "6px 8px",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 6,
			background: "var(--dsw-alias-bg-base)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			resize: "vertical"
		};
		const diffGhComment = {
			display: "flex",
			flexDirection: "column",
			gap: 4
		};
		/** Every comment after the first opens with a rule, the way GitHub separates
		*  the entries of one conversation. */
		const diffGhCommentNext = {
			marginTop: 8,
			paddingTop: 8,
			borderTop: "1px solid var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 12%, transparent))"
		};
		const diffGhCommentAge = {
			flex: "none",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11
		};
		/** Big enough to aim at: the 11px "›" glyph was a hard target. */
		const diffFileChevron = {
			width: 14,
			height: 14,
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "none",
			color: "var(--dsw-alias-label-secondary)",
			transition: "transform 120ms ease"
		};
		/** Sits at the far end of the summary row; the rest of the button is the shared icon-button class. */
		const diffSummaryAction = { marginLeft: "auto" };
		const diffCommentNav = {
			display: "inline-flex",
			alignItems: "center",
			gap: 2
		};
		const diffCommentNavCount = {
			minWidth: 34,
			textAlign: "center",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			fontVariantNumeric: "tabular-nums"
		};
		/** Where the walk stopped, so the eye lands without hunting for it. */
		const diffCommentBlockActive = {
			borderColor: "var(--dsw-static-blue-450)",
			boxShadow: "0 0 0 1px var(--dsw-static-blue-450)"
		};
		const diffThreadBadges = {
			display: "flex",
			gap: 6
		};
		const diffThreadBadge = {
			flex: "none",
			padding: "0 6px",
			borderRadius: 999,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			lineHeight: "18px"
		};
		const diffThreadSummary = {
			width: "100%",
			display: "flex",
			alignItems: "center",
			gap: 6,
			minWidth: 0,
			padding: 0,
			border: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			font: "inherit",
			fontSize: 12,
			textAlign: "left",
			cursor: "pointer"
		};
		const diffThreadExcerpt = {
			minWidth: 0,
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		/** The composer is a region of its own: without the rule it reads as more of
		*  the comment it sits under. */
		const diffThreadComposer = {
			display: "flex",
			flexDirection: "column",
			gap: 6,
			marginTop: 10,
			paddingTop: 10,
			borderTop: "1px solid var(--dsw-alias-border-l1, color-mix(in srgb, currentColor 12%, transparent))"
		};
		const diffThreadComposerCaption = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			lineHeight: "16px"
		};
		const mentionField = {
			position: "relative",
			display: "block"
		};
		const mentionList = {
			position: "absolute",
			zIndex: 1100,
			top: "100%",
			left: 0,
			width: 240,
			maxHeight: 176,
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			gap: 2,
			padding: 4,
			overflowY: "auto",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 8,
			background: "var(--dsw-specific-menu)",
			boxShadow: "var(--dsw-shadow-lv3)"
		};
		const mentionItem = {
			height: 28,
			display: "flex",
			alignItems: "center",
			gap: 6,
			padding: "0 8px",
			border: "none",
			borderRadius: 6,
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			textAlign: "left",
			cursor: "pointer"
		};
		const mentionItemActive = { background: "var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2))" };
		const mentionAvatar = {
			width: 16,
			height: 16,
			flex: "none",
			borderRadius: "50%"
		};
		const diffCommentActions = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 8,
			marginTop: 6
		};
		const diffCommentActionButton = {
			minHeight: 24,
			padding: "2px 10px",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 6,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer"
		};
		const diffCommentSubmitButton = {
			border: "none",
			background: "var(--dsw-static-blue-450)",
			color: "var(--dsw-alias-label-on-accent, #fff)",
			fontWeight: 600
		};
		const diffCommentError = {
			margin: "4px 0 0",
			color: "var(--dsw-alias-state-error-primary)",
			fontSize: 11
		};
		const reviewCommentBarFrame = {
			width: DOCK_WIDTH,
			maxWidth: DOCK_MAX_WIDTH,
			margin: "0 auto",
			boxSizing: "border-box"
		};
		const reviewCommentBar = {
			width: "100%",
			minWidth: 0,
			minHeight: 36,
			boxSizing: "border-box",
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: 8,
			padding: "6px 12px",
			...dockSurface,
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			lineHeight: "20px"
		};
		const reviewCommentIcon = {
			width: 20,
			height: 20,
			display: "grid",
			placeItems: "center",
			flex: "none",
			color: "var(--dsw-static-blue-450)"
		};
		const reviewCommentClearSeat = {
			marginLeft: "auto",
			alignSelf: "flex-start",
			flex: "none",
			display: "inline-flex"
		};
		const reviewCommentChip = {
			display: "inline-flex",
			alignItems: "center",
			gap: 3,
			maxWidth: 240,
			padding: "1px 4px 1px 9px",
			border: "1px solid color-mix(in srgb, var(--dsw-static-blue-450) 32%, transparent)",
			borderRadius: 999,
			background: "color-mix(in srgb, var(--dsw-static-blue-450) 10%, transparent)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			lineHeight: "20px"
		};
		const reviewCommentChipLabel$1 = {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const reviewCommentChipRemove = {
			width: 16,
			height: 16,
			flex: "none",
			display: "grid",
			placeItems: "center",
			padding: 0,
			border: "none",
			borderRadius: 999,
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			font: "inherit",
			fontSize: 12,
			lineHeight: 1,
			cursor: "pointer"
		};
		const reviewCommentHoverCard = {
			display: "block",
			maxWidth: 360,
			padding: "8px 10px",
			fontSize: 12,
			lineHeight: "18px"
		};
		const reviewCommentHoverPath = {
			display: "block",
			marginBottom: 4,
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			overflowWrap: "anywhere"
		};
		const reviewCommentHoverText = {
			margin: 0,
			color: "var(--dsw-alias-label-primary)",
			whiteSpace: "pre-wrap",
			overflowWrap: "anywhere"
		};
		const promptSaveTriggerClass = "dshClaudePromptSaveTrigger";
		const promptSpinClass = "dshClaudePromptSpin";
		const promptUndoClass = "dshClaudePromptUndo";
		const promptSaveFieldClass = "dshClaudePromptSaveField";
		/** The composer's own attach button geometry (InputBar.module.css `.add`:
		*  28x28 circle on --dsw-specific-selector, 14px glyph). The primitives'
		*  Button has no icon-only form — its `sm` is a 36px-wide capsule around a
		*  16px slot, which is why this reads oversized beside its neighbours. */
		const promptSaveTriggerCss = `
		.${promptSaveTriggerClass} {
		  width: 28px;
		  height: 28px;
		  flex: none;
		  display: grid;
		  place-items: center;
		  padding: 0;
		  border: none;
		  border-radius: 999px;
		  background: var(--dsw-specific-selector);
		  color: var(--dsw-alias-label-primary);
		  cursor: pointer;
		  transition: background-color 120ms ease, color 120ms ease;
		}
		.${promptSaveTriggerClass}:disabled {
		  cursor: default;
		  background: transparent;
		  color: var(--dsw-alias-label-tertiary);
		}
		.${promptSaveTriggerClass}:focus-visible { outline: none; }
		.${promptSaveFieldClass} {
		  box-sizing: border-box;
		  width: 100%;
		  height: 38px;
		  padding: 0 11px;
		  border: 1px solid var(--dsw-alias-border-inverted);
		  border-radius: 7px;
		  background: var(--dsw-alias-interactive-bg-hover);
		  color: var(--dsw-alias-label-primary);
		  font-family: var(--dsw-font-family);
		  font-size: 13px;
		  line-height: 20px;
		}
		/* Not --dsw-alias-brand-primary: in the dark theme that alias resolves to
		 * neutral-bluish-50, so a focused field draws a near-white slab around
		 * itself. The focus ring is a step up in the same greys the card is made of. */
		.${promptSaveFieldClass}:focus-visible {
		  outline: none;
		  border-color: var(--dsw-alias-label-tertiary);
		  background: var(--dsw-alias-interactive-bg-active);
		}
		.${promptSaveFieldClass}:disabled { opacity: 0.6; }
		/* ic_ds_loading_outline_16 is a bare open ring and nothing in the primitives
		 * turns it, so a four-second rewrite sat behind a frozen glyph that reads as
		 * the letter C. The spin is what makes it a spinner. */
		.${promptSpinClass} { animation: dshClaudePromptSpin 900ms linear infinite; }
		@keyframes dshClaudePromptSpin { to { transform: rotate(360deg); } }
		/* The icon set has no undo arrow, and ic_ds_refresh_outline_16 turns
		 * clockwise — the redo direction. Mirrored, it is the ordinary undo glyph. */
		.${promptUndoClass} { transform: scaleX(-1); }
		@media (prefers-reduced-motion: reduce) {
		  .${promptSpinClass} { animation: none; }
		}
		`;
		/** The naming card hangs off the composer tool row, portaled so the composer
		*  card cannot clip it and positioned by useAnchoredPosition. */
		const promptSaveCard = {
			position: "fixed",
			zIndex: 120,
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			gap: 14,
			width: 360,
			maxWidth: "calc(100vw - 32px)",
			maxHeight: "calc(100dvh - 32px)",
			overflowY: "auto",
			padding: 18,
			border: "1px solid var(--dsw-alias-border-inverted)",
			borderRadius: 14,
			background: "var(--dsw-alias-bg-layer-3, var(--dsw-specific-menu))",
			boxShadow: "var(--dsw-shadow-lv3)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			lineHeight: "20px"
		};
		const promptSaveHeading = {
			color: "var(--dsw-alias-label-primary)",
			fontSize: 14,
			fontWeight: 600,
			lineHeight: "22px"
		};
		const promptSaveActions = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 8,
			paddingTop: 12,
			borderTop: "1px solid var(--dsw-alias-border-l2)"
		};
		/** The saved file, wrapped rather than truncated: a path the user cannot read
		*  in full does not tell them where to go and edit it. */
		const promptSaveLocation = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			lineHeight: "16px",
			overflowWrap: "anywhere",
			padding: "10px 12px",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-2)"
		};
		/** Wider than the naming card: each row carries a name and its opening line. */
		const promptManageCard = { width: 480 };
		const promptManageList = {
			display: "flex",
			flexDirection: "column",
			gap: 4,
			margin: 0,
			padding: 0,
			listStyle: "none"
		};
		const promptManageRow = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			minHeight: 36
		};
		const promptManageText = {
			flex: 1,
			minWidth: 0,
			display: "flex",
			flexDirection: "column"
		};
		const promptManageName = {
			flex: 1,
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			fontSize: 13
		};
		const promptManageDescription = {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			lineHeight: "16px"
		};
		const promptSaveError = {
			color: "var(--dsw-static-red-450, #d64545)",
			overflowWrap: "anywhere"
		};
		const diffAhead = { color: "var(--dsw-static-blue-450)" };
		const diffAheadMuted = { color: "color-mix(in srgb, var(--dsw-static-blue-450) 62%, var(--dsw-alias-label-tertiary))" };
		const diffAddMuted = { color: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 62%, var(--dsw-alias-label-tertiary))" };
		const diffDeleteMuted = { color: "color-mix(in srgb, var(--dsw-alias-state-error-primary) 62%, var(--dsw-alias-label-tertiary))" };
		const diffPanel = {
			display: "flex",
			flexDirection: "column",
			minWidth: 0,
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			borderRadius: 12,
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "0 4px 16px color-mix(in srgb, #000 12%, transparent)"
		};
		const diffHeader = {
			boxSizing: "border-box",
			height: 49,
			flex: "none",
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 10,
			padding: "9px 12px",
			borderBottom: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))"
		};
		const diffHeaderTitle = {
			minWidth: 0,
			display: "flex",
			alignItems: "center",
			gap: 8,
			overflow: "hidden",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 15,
			fontWeight: 650,
			whiteSpace: "nowrap"
		};
		const diffHeaderActions = {
			flex: "none",
			display: "flex",
			alignItems: "center",
			gap: 5
		};
		const diffSplitButton = {
			display: "inline-flex",
			alignItems: "stretch"
		};
		const diffCommitButton = {
			minHeight: 28,
			padding: "4px 10px",
			border: "none",
			borderRadius: "7px 0 0 7px",
			background: "var(--dsw-static-blue-450)",
			color: "var(--dsw-alias-label-on-accent, #fff)",
			font: "inherit",
			fontSize: 12,
			fontWeight: 650,
			cursor: "pointer"
		};
		const diffActionDisabled = {
			opacity: .45,
			cursor: "default"
		};
		const diffCommitMenuButton = {
			width: 28,
			minHeight: 28,
			display: "grid",
			placeItems: "center",
			padding: 0,
			border: "none",
			borderLeft: "1px solid color-mix(in srgb, #fff 32%, transparent)",
			borderRadius: "0 7px 7px 0",
			background: "var(--dsw-static-blue-450)",
			color: "var(--dsw-alias-label-on-accent, #fff)",
			font: "inherit",
			cursor: "pointer"
		};
		const diffRepositoryTriggerClass = "dshClaudeDiffRepositoryTrigger";
		const diffFileHeaderClass = "dshClaudeDiffFileHeader";
		/** The checkout switch: a quiet pill in the header's own type, lit on hover
		*  and while its menu is open, with the chevron set off in a lighter tone. */
		const diffRepositoryCss = `
		.${diffRepositoryTriggerClass} {
		  flex: none;
		  display: inline-flex;
		  align-items: center;
		  gap: 4px;
		  max-width: 220px;
		  padding: 2px 5px 2px 8px;
		  border: none;
		  border-radius: 7px;
		  background: var(--dsw-alias-interactive-bg-hover);
		  color: inherit;
		  font: inherit;
		  cursor: pointer;
		  transition: background .12s ease;
		}
		.${diffRepositoryTriggerClass}:hover,
		.${diffRepositoryTriggerClass}:focus-visible,
		.${diffRepositoryTriggerClass}[aria-expanded="true"] {
		  background: var(--dsw-alias-interactive-bg-active);
		}
		.${diffRepositoryTriggerClass}:focus-visible { outline: none; }
		.${diffRepositoryTriggerClass} > span {
		  min-width: 0;
		  overflow: hidden;
		  text-overflow: ellipsis;
		  white-space: nowrap;
		}
		.${diffRepositoryTriggerClass} > svg {
		  flex: none;
		  color: var(--dsw-alias-label-tertiary);
		}
		/* Sticky headers each form a stacking context, so the host Tooltip bubble
		   (rendered inline, position: fixed) is painted under the next file's header.
		   Lift the hovered header above its siblings while the bubble can be open. */
		.${diffFileHeaderClass} {
		  z-index: 1;
		}
		.${diffFileHeaderClass}:hover {
		  z-index: 2;
		}
		`;
		/** A row of the checkout menu: name left, its counts right in tabular figures. */
		const diffRepositoryRow = {
			display: "flex",
			alignItems: "baseline",
			gap: 14,
			minWidth: 0
		};
		const diffRepositoryRowName = {
			minWidth: 0,
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const diffRepositoryRowCounts = {
			flex: "none",
			display: "inline-flex",
			gap: 6,
			fontSize: 12,
			fontVariantNumeric: "tabular-nums"
		};
		/** The branch is the panel's title: it inherits the header's primary weight
		*  and colour, and only yields to an ellipsis once the actions need the room. */
		const diffHeaderBranch = {
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const diffSummary = {
			minHeight: 34,
			display: "flex",
			alignItems: "center",
			gap: 7,
			padding: "6px 12px",
			borderBottom: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12
		};
		const diffBody = {
			flex: 1,
			minHeight: 0,
			overflow: "auto",
			background: "var(--dsw-alias-bg-base)"
		};
		const diffFile = { borderBottom: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))" };
		const diffFileHeader = {
			position: "sticky",
			top: 0,
			width: "100%",
			minHeight: 38,
			display: "flex",
			alignItems: "center",
			gap: 7,
			padding: "7px 10px",
			border: "none",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			lineHeight: "20px",
			textAlign: "left",
			cursor: "pointer"
		};
		/** The sticky row a file header lives in: the expand toggle plus its revert control. */
		const diffFileHeaderRow = {
			position: "sticky",
			top: 0,
			display: "flex",
			alignItems: "center",
			background: "var(--dsw-alias-bg-layer-1)"
		};
		const diffFileHeaderToggle = {
			...diffFileHeader,
			position: "static",
			flex: 1,
			width: "auto",
			minWidth: 0
		};
		const diffFileRevert = {
			flex: "none",
			marginRight: 6,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const diffDangerButton = { background: "var(--dsw-alias-state-error-primary)" };
		const diffRevertQuestion = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-primary)",
			overflowWrap: "anywhere"
		};
		const diffRevertAllButton = {
			minHeight: 28,
			padding: "4px 10px",
			fontSize: 12
		};
		const diffFilePath = {
			minWidth: 0,
			flex: 1,
			display: "flex",
			alignItems: "baseline",
			overflow: "hidden"
		};
		const diffFileName = {
			flex: "none",
			fontWeight: 650,
			whiteSpace: "nowrap"
		};
		/** Comment count on a file header: the one hint that survives collapsing. */
		const diffFileComments = {
			flex: "none",
			display: "inline-flex",
			alignItems: "center",
			gap: 3,
			padding: "0 6px",
			height: 18,
			borderRadius: 9,
			background: "color-mix(in srgb, var(--dsw-static-blue-450) 18%, transparent)",
			color: "var(--dsw-static-blue-450)",
			fontSize: 11,
			fontWeight: 650,
			lineHeight: "18px"
		};
		/** GitHub review comments render through this plugin's own Markdown pipeline
		*  (see comment-markdown.ts), so the card owns their typography too. */
		const diffCommentMarkdownCss = `
		.dshClaudeDiffCommentBody > :first-child { margin-top: 0 }
		.dshClaudeDiffCommentBody > :last-child { margin-bottom: 0 }
		.dshClaudeDiffCommentBody :is(h1, h2, h3, h4, h5, h6) {
		  margin: 8px 0 4px;
		  font-size: 12px;
		  line-height: 18px;
		  font-weight: 650;
		}
		.dshClaudeDiffCommentBody :is(p, ul, ol, pre, blockquote, table, details) { margin: 4px 0 }
		.dshClaudeDiffCommentBody :is(ul, ol) { padding-left: 18px }
		.dshClaudeDiffCommentBody li { margin: 2px 0 }
		.dshClaudeDiffCommentBody li input[type='checkbox'] {
		  margin: 0 6px 0 -14px;
		  vertical-align: middle;
		  accent-color: var(--dsw-static-blue-450);
		}
		.dshClaudeDiffCommentBody li:has(> input[type='checkbox']) { list-style: none }
		.dshClaudeDiffCommentBody code {
		  padding: 1px 4px;
		  border-radius: 4px;
		  background: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 10%, transparent));
		  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, monospace);
		  font-size: 11px;
		}
		.dshClaudeDiffCommentBody pre {
		  max-width: 100%;
		  padding: 8px 10px;
		  border-radius: 6px;
		  background: var(--dsw-alias-bg-layer-2, color-mix(in srgb, currentColor 8%, transparent));
		  overflow-x: auto;
		}
		.dshClaudeDiffCommentBody pre code { padding: 0; background: none }
		.dshClaudeDiffCommentBody blockquote {
		  padding-left: 8px;
		  border-left: 2px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent));
		  color: var(--dsw-alias-label-secondary);
		}
		.dshClaudeDiffCommentBody a { color: var(--dsw-static-blue-450) }
		.dshClaudeDiffCommentBody img { max-width: 100%; vertical-align: middle }
		.dshClaudeDiffCommentBody table { border-collapse: collapse }
		.dshClaudeDiffCommentBody :is(th, td) {
		  padding: 3px 8px;
		  border: 1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent));
		}
		.dshClaudeDiffCommentBody summary { cursor: pointer; font-weight: 650 }
		.dshClaudeDiffCommentBody :is(sup, sub) { font-size: 9px; line-height: 0 }
		.dshClaudeDiffCommentBody hr {
		  margin: 8px 0;
		  border: none;
		  border-top: 1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent));
		}
		`;
		const diffFileStats = {
			flex: "none",
			display: "inline-flex",
			gap: 4,
			fontSize: 13,
			fontWeight: 650
		};
		const diffCode = {
			padding: "4px 0 8px",
			background: "var(--dsw-alias-bg-base)",
			fontFamily: "var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Consolas, monospace)",
			fontSize: 14,
			lineHeight: "22px"
		};
		const diffLine = {
			minHeight: 17,
			display: "flex",
			whiteSpace: "pre-wrap",
			overflowWrap: "anywhere"
		};
		const diffLineText = {
			flex: 1,
			minWidth: 0
		};
		const diffLineNumber = {
			width: 38,
			flex: "none",
			paddingRight: 8,
			color: "var(--dsw-alias-label-tertiary)",
			textAlign: "right",
			userSelect: "none"
		};
		const diffLineMarker = {
			width: 16,
			flex: "none",
			color: "inherit",
			textAlign: "center",
			userSelect: "none"
		};
		const diffLineAdd = {
			background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent)",
			color: "var(--dsw-alias-state-success-primary)"
		};
		const diffLineDelete = {
			background: "color-mix(in srgb, var(--dsw-alias-state-error-primary) 13%, transparent)",
			color: "var(--dsw-alias-state-error-primary)"
		};
		const diffLineHunk = {
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-tertiary)",
			fontStyle: "italic"
		};
		const diffLineSelected = {
			background: "color-mix(in srgb, var(--dsw-static-blue-450) 14%, transparent)",
			boxShadow: "inset 2px 0 0 var(--dsw-static-blue-450)"
		};
		/** Sits where the comment button, line number and marker would be so the label aligns with code. */
		const diffGapControls = {
			width: 84,
			flex: "none",
			boxSizing: "border-box",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 2,
			paddingRight: 6
		};
		const diffGapButton = {
			width: 20,
			height: 18,
			display: "grid",
			placeItems: "center",
			padding: 0,
			border: "none",
			borderRadius: 4,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			cursor: "pointer"
		};
		const diffCommentRange = {
			marginBottom: 6,
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			fontWeight: 600
		};
		const diffLineContext = { color: "var(--dsw-alias-label-secondary)" };
		const diffNotice = {
			margin: 10,
			padding: "9px 10px",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 11,
			lineHeight: "17px"
		};
		const diffEmpty = {
			margin: 16,
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11
		};
		const diffModalCss = `
		.dshClaudeRepositoryActionModal {
		  box-sizing: border-box;
		  width: min(760px, calc(100vw - 48px));
		  max-width: calc(100vw - 48px);
		  max-height: min(680px, calc(100vh - 48px));
		}
		.dshClaudeRepositoryActionModalContent {
		  flex: 1;
		  min-height: 0;
		  overflow-y: auto;
		}
		.dshClaudeRepositoryActionModalContent > div:first-child {
		  position: sticky;
		  top: 0;
		  z-index: 2;
		  background: var(--dsw-alias-bg-layer-2);
		}
		.dshClaudeRepositoryActionModalContent h2 {
		  font-size: 16px;
		  line-height: 24px;
		}
		.dshClaudeRepositoryActionModalContent > p {
		  font-size: 13px;
		  line-height: 20px;
		}
		.dshClaudeRepositoryActionModal input:is([type='checkbox'], [type='radio']) {
		  width: 16px;
		  height: 16px;
		  margin: 0;
		  accent-color: var(--dsw-static-blue-450);
		}
		.dshClaudeRepositoryActionModal textarea:focus,
		.dshClaudeRepositoryActionModal input:not([type='checkbox'], [type='radio']):focus {
		  outline: none;
		  box-shadow: inset 0 0 0 1px var(--dsw-static-blue-450);
		}
		.dshClaudeUtilityDialog {
		  width: min(580px, calc(100vw - 32px));
		  max-width: calc(100vw - 32px);
		  max-height: calc(100dvh - 32px);
		  gap: 0;
		  padding: 0;
		  border: 1px solid var(--dsw-alias-border-l2);
		  border-radius: 16px;
		}
		.dshClaudeUtilityContent { box-sizing: border-box; padding: 24px; }
		.dshClaudeUtilityContent > div:first-child { padding: 0 0 12px; }
		.dshClaudeUtilityContent h2 { font-size: 19px; line-height: 28px; letter-spacing: -.3px; }
		.dshClaudeUtilityContent > p { padding: 0; margin: 0 0 20px; color: var(--dsw-alias-label-secondary); }
		.dshClaudeUtilityContent > div:last-child:not(:first-child) { padding: 0; margin-top: 0; }
		.dshClaudeUtilityDialog > div:last-child:not(.dshClaudeUtilityContent) { padding: 16px 24px; border-top: 1px solid var(--dsw-alias-border-l2); }
		.dshClaudeUtilitySummary {
		  padding: 14px;
		  border: 1px solid var(--dsw-alias-border-l2);
		  border-radius: 10px;
		  background: var(--dsw-alias-bg-layer-1);
		  flex-wrap: wrap;
		  align-items: center;
		}
		.dshClaudeUtilitySummary > strong { color: var(--dsw-alias-label-primary); }
		.dshClaudeUtilitySummary > span { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
		.dshClaudeUtilityOption {
		  padding: 13px 14px;
		  border: 1px solid var(--dsw-alias-border-l2);
		  border-radius: 10px;
		  line-height: 20px;
		  cursor: pointer;
		}
		.dshClaudeUtilityOption input { flex-shrink: 0; }
		.dshClaudeUtilityOption:has(input:checked) { border-color: color-mix(in srgb, var(--dsw-static-blue-450) 45%, var(--dsw-alias-border-l2)); background: color-mix(in srgb, var(--dsw-static-blue-450) 5%, transparent); }
		.dshClaudeUtilityOption:has(input:disabled) { cursor: default; }
		.dshClaudeUtilityContent ul { max-height: 240px; overflow-y: auto; }
		.dshClaudeUtilityContent li { padding: 8px 4px; overflow-wrap: anywhere; }
		.dshClaudeUtilityContent li + li { border-top: 1px solid var(--dsw-alias-border-l2); }
		.dshClaudeUtilityContent [role='alert'] { padding: 12px; border-radius: 8px; background: var(--dsw-alias-bg-layer-1); overflow-wrap: anywhere; }
		.dshClaudeUtilityDialog button:focus-visible { outline: 2px solid var(--dsw-static-blue-450); outline-offset: 2px; }
		@media (max-width: 640px) {
		  .dshClaudeUtilityContent { padding: 18px; }
		  .dshClaudeUtilityDialog > div:last-child:not(.dshClaudeUtilityContent) { padding: 14px 18px; }
		}
		.dshClaudeCommitDialog {
		  gap: 0;
		  padding: 0;
		  width: min(880px, calc(100vw - 32px));
		  max-width: calc(100vw - 32px);
		  max-height: calc(100dvh - 32px);
		  border: 1px solid var(--dsw-alias-border-l2);
		  border-radius: 16px;
		  overflow: hidden;
		}
		.dshClaudeCommitContent { padding: 24px; box-sizing: border-box; }
		.dshClaudeCommitContent > div:first-child { padding: 0 0 16px; }
		.dshClaudeCommitContent > div:last-child:not(:first-child) { padding: 0; margin-top: 0; }
		.dshClaudeCommitContent h2 { font-size: 19px; line-height: 28px; letter-spacing: -.3px; }
		.dshClaudeCommitContext {
		  display: flex;
		  align-items: center;
		  flex-wrap: wrap;
		  gap: 8px;
		  padding-bottom: 18px;
		  border-bottom: 1px solid var(--dsw-alias-border-l2);
		  color: var(--dsw-alias-label-secondary);
		  font-size: 12px;
		  overflow-wrap: anywhere;
		}
		.dshClaudeCommitContext strong { color: var(--dsw-alias-label-primary); margin-right: 4px; }
		.dshClaudeCommitBranch {
		  min-width: 0;
		  padding: 3px 8px;
		  border-radius: 6px;
		  background: var(--dsw-alias-bg-layer-1);
		  font-family: ui-monospace, monospace;
		}
		.dshClaudeCommitGrid { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 24px; }
		.dshClaudeCommitSection, .dshClaudeCommitEditor { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
		.dshClaudeCommitSection h3 { margin: 0; font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary); }
		.dshClaudeCommitChanges { padding-right: 24px; border-right: 1px solid var(--dsw-alias-border-l2); }
		.dshClaudeCommitFiles { max-height: 320px; overflow-y: auto; min-width: 0; }
		.dshClaudeCommitFile { display: flex; align-items: center; gap: 10px; padding: 11px 0; font-size: 12px; line-height: 18px; }
		.dshClaudeCommitFile + .dshClaudeCommitFile { border-top: 1px solid var(--dsw-alias-border-l2); }
		.dshClaudeCommitPath { flex: 1; min-width: 0; overflow-wrap: anywhere; }
		.dshClaudeCommitState { flex: none; max-width: 45%; padding: 2px 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 16px; }
		.dshClaudeCommitState[data-staged='true'] { color: var(--dsw-static-green-450, var(--dsw-alias-label-primary)); }
		.dshClaudeCommitHash { flex: none; color: var(--dsw-alias-label-secondary); font-size: 11px; }
		.dshClaudeCommitEditor textarea, .dshClaudeCommitEditor input { border-radius: 8px; }
		.dshClaudeCommitEditor textarea { width: 100%; box-sizing: border-box; }
		.dshClaudeCommitHint { margin: -6px 0 0; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 18px; }
		.dshClaudeCommitProgress { margin: 0 0 16px; padding: 10px 12px; border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
		.dshClaudeCommitDialog > div:last-child:not(.dshClaudeCommitContent) { padding: 16px 24px; border-top: 1px solid var(--dsw-alias-border-l2); }
		.dshClaudeCommitDialog button:focus-visible { outline: 2px solid var(--dsw-static-blue-450); outline-offset: 2px; }
		@media (max-width: 640px) {
		  .dshClaudeCommitContent { padding: 18px; }
		  .dshClaudeCommitGrid { grid-template-columns: minmax(0, 1fr); gap: 20px; }
		  .dshClaudeCommitChanges { padding: 0 0 18px; border-right: 0; border-bottom: 1px solid var(--dsw-alias-border-l2); }
		  .dshClaudeCommitFiles { max-height: 180px; }
		  .dshClaudeCommitDialog > div:last-child:not(.dshClaudeCommitContent) { padding: 14px 18px; }
		}
		`;
		const diffModalBody = {
			display: "flex",
			flexDirection: "column",
			gap: 14,
			width: "100%",
			minWidth: 0,
			boxSizing: "border-box"
		};
		const diffModalMeta = {
			display: "flex",
			justifyContent: "space-between",
			gap: 16,
			minWidth: 0,
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 13,
			lineHeight: "20px"
		};
		const diffModalMetaText = {
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const diffModalFileState = { flex: "none" };
		const diffModalField = {
			display: "flex",
			flexDirection: "column",
			gap: 6,
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			lineHeight: "18px",
			fontWeight: 550
		};
		const diffModalTextarea = {
			...settingTextInput,
			minHeight: 120,
			padding: "9px 12px",
			fontSize: 13,
			lineHeight: "20px",
			resize: "vertical"
		};
		const diffModalTextInput = {
			...settingTextInput,
			minHeight: 36,
			padding: "7px 12px",
			fontSize: 13,
			lineHeight: "20px"
		};
		const diffModalCheckbox = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 13,
			lineHeight: "20px"
		};
		const diffModalFooter = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 12
		};
		const diffModalButton = {
			minHeight: 34,
			padding: "6px 16px",
			fontSize: 13,
			lineHeight: "20px"
		};
		const diffModalStatus = {
			margin: 0,
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 13,
			lineHeight: "20px"
		};
		const diffModalError = {
			margin: "8px 0 0",
			color: "var(--dsw-alias-state-error-primary)",
			fontSize: 13,
			lineHeight: "20px"
		};
		const rewindActionCss = `
		[data-dsh-claude-rewind]:empty {
		  display: none;
		}
		[data-dsh-claude-rewind] > button {
		  width: 28px;
		  height: 28px;
		  padding: 6px;
		  display: inline-flex;
		  align-items: center;
		  justify-content: center;
		  border: none;
		  border-radius: 28px;
		  background: transparent;
		  color: var(--dsw-alias-label-tertiary);
		  cursor: pointer;
		}
		[data-dsh-claude-rewind] > button:hover {
		  background: var(--dsw-alias-interactive-bg-hover);
		  color: var(--dsw-alias-label-secondary);
		}
		[data-dsh-claude-rewind] > button:is(:disabled, [data-unavailable]) {
		  opacity: 0.4;
		  cursor: default;
		}
		[data-dsh-claude-rewind] > button[data-unavailable]:hover {
		  background: transparent;
		  color: var(--dsw-alias-label-tertiary);
		}
		`;
		const rewindDangerButton = {
			...primaryButton,
			background: "var(--dsw-alias-state-error-primary)"
		};
		const rewindModalMessage = {
			margin: 0,
			padding: 12,
			maxHeight: 160,
			overflowY: "auto",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word",
			borderRadius: 9,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 13,
			lineHeight: "20px"
		};
		const permissionSelectClass = "dshClaudePermissionSelect";
		const permissionSelectTriggerClass = "dshClaudePermissionSelectTrigger";
		const permissionSelectIconClass = "dshClaudePermissionSelectIcon";
		const permissionSelectLabelClass = "dshClaudePermissionSelectLabel";
		const permissionSelectChevronClass = "dshClaudePermissionSelectChevron";
		/** The Host's PermissionSelect trigger (PermissionSelect.module.css
		*  `.trigger`): a 28px capsule of 13px/500 secondary text with a 4px gap,
		*  hover fill, no border. Matched here so the plugin's selector sits where the
		*  Host's did without the row noticing the swap. */
		const permissionSelectCss = `
		.${permissionSelectClass} { display: inline-flex; align-items: center; min-width: 0; }
		.${permissionSelectTriggerClass} {
		  min-width: 0;
		  max-width: 220px;
		  height: 28px;
		  display: inline-flex;
		  align-items: center;
		  gap: 4px;
		  padding: 0 4px 0 8px;
		  border: none;
		  border-radius: 24px;
		  background: transparent;
		  color: var(--dsw-alias-label-secondary);
		  font-size: 13px;
		  font-weight: 500;
		  line-height: 20px;
		  cursor: pointer;
		  outline: none;
		}
		.${permissionSelectTriggerClass}:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
		.${permissionSelectTriggerClass}:disabled { cursor: default; opacity: 0.5; }
		.${permissionSelectTriggerClass}:focus-visible { outline: none; }
		.${permissionSelectIconClass} { display: inline-flex; flex: none; }
		.${permissionSelectLabelClass} { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
		.${permissionSelectChevronClass} { flex: none; transition: transform 120ms ease; }
		.${permissionSelectChevronClass}[data-open] { transform: rotate(180deg); }
		`;
		const permissionSelectRowClass = "dshClaudePermissionSelectRow";
		const permissionSelectRowNameClass = "dshClaudePermissionSelectRowName";
		const permissionSelectRowHintClass = "dshClaudePermissionSelectRowHint";
		/** A mode row: its name, and under it the one line that says what the mode
		*  does. In the row rather than a native title, which the Host never draws. */
		const permissionSelectRowCss = `
		.${permissionSelectRowClass} { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
		.${permissionSelectRowNameClass} { white-space: nowrap; }
		.${permissionSelectRowHintClass} { font-size: 12px; line-height: 16px; font-weight: 400; color: var(--dsw-alias-label-tertiary); white-space: normal; max-width: 260px; }
		`;
		const promptSuggestionAttribute = "data-dsh-claude-suggestion";
		const promptSuggestionProperty = "--dsh-claude-suggestion";
		/** Ghost text for the next-prompt suggestion, in the Host's own hint grey.
		*  Mid-draft it trails the last paragraph the way the Host's command hints
		*  do; on an empty draft it takes the placeholder's seat, since the editor's
		*  empty paragraph holds a <br> that would push an `::after` to a second
		*  line. Both give way while an IME is composing. */
		const promptSuggestionCss = `
		[${promptSuggestionAttribute}="inline"] > [data-composer-input]:not([data-composer-composing]) p:last-child::after {
		  content: var(${promptSuggestionProperty});
		  color: var(--dsw-alias-label-caption);
		}
		[${promptSuggestionAttribute}="empty"] > [data-composer-placeholder] { visibility: hidden; }
		[${promptSuggestionAttribute}="empty"] > [data-composer-input]:not([data-composer-composing]) + [data-composer-placeholder]::before {
		  content: var(${promptSuggestionProperty});
		  visibility: visible;
		  color: var(--dsw-alias-label-caption);
		}
		`;
		//#endregion
		//#region src/client/jira-api.ts
		var JiraClientError = class extends Error {
			code;
			constructor(message, code) {
				super(message);
				this.name = "JiraClientError";
				if (code !== void 0) this.code = code;
			}
		};
		function record$7(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
		}
		/**
		* Every Jira failure the panels catch is a `JiraClientError`, whatever the
		* transport threw: `ClaudeHeroRepositoryControls` branches on `code` to tell
		* 'not-connected' apart from a real outage, and the settings card renders the
		* message verbatim.
		*
		* The routes answer `{ error, message }`, so `message` is already the sentence
		* to show. A body carrying only a code — a 405, a bad JSON body — used to read
		* 'Jira is unavailable.' rather than leaking the code as prose, and it still
		* does. Transport failures (a starved pool, an elapsed budget, an older Host
		* without the route) carry their own wording and keep it.
		*/
		function jiraFailure(cause) {
			if (cause instanceof JiraClientError) return cause;
			if (!(cause instanceof PluginRequestError)) return new JiraClientError(cause instanceof Error ? cause.message : String(cause));
			return new JiraClientError(cause.message === cause.code ? "Jira is unavailable." : cause.message, cause.code);
		}
		function payload(value) {
			const body = record$7(value);
			if (body === void 0) throw new JiraClientError("Invalid Jira response.");
			return body;
		}
		function status(value) {
			const body = payload(value);
			if (typeof body.connected !== "boolean") throw new JiraClientError("Invalid Jira status response.");
			return body;
		}
		async function loadJiraStatus(signal) {
			try {
				return status(await pluginRead(`${CLAUDE_JIRA_PATH}/status`, "remote", signal));
			} catch (cause) {
				throw jiraFailure(cause);
			}
		}
		async function connectJira(input) {
			try {
				return status(await pluginWrite(`${CLAUDE_JIRA_PATH}/connect`, "remote", void 0, { json: input }));
			} catch (cause) {
				throw jiraFailure(cause);
			}
		}
		async function disconnectJira() {
			try {
				await pluginWrite(`${CLAUDE_JIRA_PATH}/disconnect`, "remote");
			} catch (cause) {
				throw jiraFailure(cause);
			}
		}
		async function searchJiraTickets(query, signal) {
			try {
				const body = payload(await pluginRead(`${CLAUDE_JIRA_PATH}/search`, "remote", signal, { query: { query } }));
				if (!Array.isArray(body.tickets)) throw new JiraClientError("Invalid Jira search response.");
				const tickets = [];
				for (const item of body.tickets) {
					const ticket = record$7(item);
					if (ticket === void 0 || typeof ticket.key !== "string" || typeof ticket.summary !== "string" || typeof ticket.url !== "string") continue;
					tickets.push(ticket);
				}
				return tickets;
			} catch (cause) {
				throw jiraFailure(cause);
			}
		}
		async function assignJiraTicket(key) {
			try {
				await pluginWrite(`${CLAUDE_JIRA_PATH}/assign`, "remote", void 0, { json: { key } });
			} catch (cause) {
				throw jiraFailure(cause);
			}
		}
		/** Draft seeded into the composer when a session starts from a ticket. */
		function ticketPrompt(ticket) {
			return `Work on Jira ticket ${ticket.key}: ${ticket.summary}\n${ticket.url}\n\nRead the ticket, implement what it asks for, and reference ${ticket.key} in the commit and pull request.`;
		}
		/** Appended to a user-written draft so the session still knows its ticket. */
		function ticketContext(ticket) {
			return `This task is for Jira ticket ${ticket.key}: ${ticket.summary}\n${ticket.url}\n\nRead the ticket for full context and reference ${ticket.key} in the commit and pull request.`;
		}
		//#endregion
		//#region src/client/ClaudeCodeSettings.tsx
		function isPluginUpdateStatus(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const status = value;
			return typeof status.currentVersion === "string" && (status.latestVersion === void 0 || typeof status.latestVersion === "string") && [
				"registry",
				"link",
				"unsupported",
				"unknown"
			].includes(String(status.source)) && [
				"current",
				"available",
				"linked",
				"unsupported",
				"unavailable",
				"error"
			].includes(String(status.state)) && typeof status.canUpdate === "boolean" && typeof status.restartRequired === "boolean" && (status.message === void 0 || typeof status.message === "string");
		}
		function isGlobalSettingsView(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const settings = value.settings;
			return Array.isArray(settings) && settings.every((setting) => {
				if (typeof setting !== "object" || setting === null || Array.isArray(setting)) return false;
				const item = setting;
				if (typeof item.key !== "string" || typeof item.value !== "string" || ![
					"immediate",
					"new-session",
					"next-turn",
					"next-worktree",
					"restart"
				].includes(String(item.effect))) return false;
				if (item.kind === "text") return typeof item.maxLength === "number" && item.maxLength > 0;
				return item.kind === "select" && Array.isArray(item.options) && item.options.every((option) => typeof option === "object" && option !== null && typeof option.value === "string" && typeof option.label === "string" && [
					"built-in",
					"user",
					"configured"
				].includes(String(option.source)));
			});
		}
		function value(status, detail) {
			return detail === void 0 ? status : `${status} · ${detail}`;
		}
		/** The trigger's disclosure chevron.
		*
		*  Geometry rather than a character: the ink spans y 6 to 10 in a 16-unit box,
		*  so it is centred on the box's own centre and the open state's 180-degree
		*  flip lands exactly where the closed state sat. A text arrowhead carries its
		*  ink below the centre of the em box, which is why this needed a hand-tuned
		*  nudge that could only be right in one of the two states. */
		function SelectChevron() {
			return /* @__PURE__ */ jsx("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx("path", { d: "M4 6l4 4 4-4" })
			});
		}
		function GlobalSettingText({ setting, disabled, onChange }) {
			const [draft, setDraft] = useState(setting.value);
			useEffect(() => {
				setDraft(setting.value);
			}, [setting.value]);
			const save = () => {
				if (draft !== setting.value) onChange(draft);
			};
			return /* @__PURE__ */ jsx("input", {
				type: "text",
				value: draft,
				maxLength: setting.maxLength,
				disabled,
				style: settingTextInput,
				onChange: (event) => {
					setDraft(event.currentTarget.value);
				},
				onBlur: save,
				onKeyDown: (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						save();
						event.currentTarget.blur();
					} else if (event.key === "Escape") {
						setDraft(setting.value);
						event.currentTarget.blur();
					}
				}
			});
		}
		function GlobalSettingSelect({ setting, disabled, onChange, labelFor = (option) => option.label }) {
			const [open, setOpen] = useState(false);
			const [activeIndex, setActiveIndex] = useState(0);
			const rootRef = useRef(null);
			const triggerRef = useRef(null);
			const listboxId = useId();
			const selectedIndex = Math.max(0, setting.options.findIndex((option) => option.value === setting.value));
			const selectedOption = setting.options[selectedIndex];
			useEffect(() => {
				if (!open) return;
				const closeOnOutsidePointer = (event) => {
					if (!rootRef.current?.contains(event.target)) setOpen(false);
				};
				document.addEventListener("mousedown", closeOnOutsidePointer);
				return () => document.removeEventListener("mousedown", closeOnOutsidePointer);
			}, [open]);
			const openMenu = (index = selectedIndex) => {
				setActiveIndex(index);
				setOpen(true);
			};
			const choose = (index) => {
				const option = setting.options[index];
				if (option === void 0) return;
				setOpen(false);
				triggerRef.current?.focus();
				if (option.value !== setting.value) onChange(option.value);
			};
			const move = (offset) => {
				const count = setting.options.length;
				if (count === 0) return;
				setActiveIndex((current) => (current + offset + count) % count);
			};
			return /* @__PURE__ */ jsxs("div", {
				ref: rootRef,
				style: settingSelect,
				onBlur: (event) => {
					if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
				},
				children: [
					/* @__PURE__ */ jsx("style", {
						"data-dsh-claude-setting-select-styles": true,
						children: settingSelectCss
					}),
					/* @__PURE__ */ jsxs("button", {
						ref: triggerRef,
						type: "button",
						"aria-haspopup": "listbox",
						"aria-expanded": open,
						"aria-controls": open ? listboxId : void 0,
						"aria-activedescendant": open ? `${listboxId}-${activeIndex}` : void 0,
						disabled: disabled || setting.options.length === 0,
						className: settingSelectTriggerClass,
						onClick: () => {
							if (open) setOpen(false);
							else openMenu();
						},
						onKeyDown: (event) => {
							if (event.key === "ArrowDown" || event.key === "ArrowUp") {
								event.preventDefault();
								if (!open) openMenu(event.key === "ArrowDown" ? selectedIndex : Math.max(0, setting.options.length - 1));
								else move(event.key === "ArrowDown" ? 1 : -1);
							} else if (event.key === "Home" && open) {
								event.preventDefault();
								setActiveIndex(0);
							} else if (event.key === "End" && open) {
								event.preventDefault();
								setActiveIndex(Math.max(0, setting.options.length - 1));
							} else if ((event.key === "Enter" || event.key === " ") && open) {
								event.preventDefault();
								choose(activeIndex);
							} else if (event.key === "Escape" && open) {
								event.preventDefault();
								setOpen(false);
							}
						},
						children: [/* @__PURE__ */ jsx("span", {
							style: settingSelectValue,
							children: selectedOption === void 0 ? setting.value : labelFor(selectedOption)
						}), /* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							className: settingSelectChevronClass,
							children: /* @__PURE__ */ jsx(SelectChevron, {})
						})]
					}),
					open ? /* @__PURE__ */ jsx("div", {
						id: listboxId,
						role: "listbox",
						"aria-activedescendant": `${listboxId}-${activeIndex}`,
						style: settingSelectMenu,
						children: setting.options.map((option, index) => {
							const selected = option.value === setting.value;
							const active = index === activeIndex;
							return /* @__PURE__ */ jsxs("button", {
								id: `${listboxId}-${index}`,
								type: "button",
								role: "option",
								"aria-selected": selected,
								style: {
									...settingSelectOption,
									...active ? settingSelectOptionActive : {}
								},
								onMouseEnter: () => setActiveIndex(index),
								onMouseDown: (event) => event.preventDefault(),
								onClick: () => choose(index),
								children: [/* @__PURE__ */ jsx("span", {
									style: settingSelectCheck,
									"aria-hidden": "true",
									children: selected ? "✓" : ""
								}), /* @__PURE__ */ jsx("span", { children: labelFor(option) })]
							}, `${option.source}:${option.value}`);
						})
					}) : null
				]
			});
		}
		/** Fixed windows carry a translated label; server-named model buckets (e.g.
		*  'Fable') arrive with their own `label` and are shown verbatim. */
		const TRANSLATED_WINDOWS = /* @__PURE__ */ new Set([
			"five_hour",
			"seven_day",
			"seven_day_opus",
			"seven_day_sonnet"
		]);
		/** The prose mode a settings payload carries, or the default when it carries
		*  none — an older Host, or a response this Client does not fully understand,
		*  leaves the palette alone rather than guessing. */
		function proseModeOf(settings) {
			const value = settings.find((setting) => setting.key === "prose")?.value;
			return isClaudeProseMode(value) ? value : DEFAULT_CLAUDE_PROSE_MODE;
		}
		/** Settings whose row only makes sense under a particular value of another.
		*  Filtering here rather than server-side keeps the descriptor list flat: the
		*  server has no view of what the Client can paint. Fails OPEN — a payload
		*  missing the setting a row depends on shows the row rather than hiding it,
		*  so an older Host cannot make a setting unreachable. */
		function visibleGlobalSettings(settings) {
			const renderer = settings.find((setting) => setting.key === "renderer");
			const withProse = renderer === void 0 || renderer.value !== "native" ? settings : settings.filter((setting) => setting.key !== "prose");
			const selector = settings.find((setting) => setting.key === "permissionSelector");
			return selector === void 0 || selector.value !== "native" ? withProse : withProse.filter((setting) => setting.key !== "permissionMode");
		}
		/** Per-setting label and the effect note that used to sit as a standalone
		*  paragraph under the card; it now hangs off the label as a hover hint. */
		const SETTING_COPY = {
			outputStyle: {
				label: "outputStyle",
				hint: "globalSettingsNewSession"
			},
			permissionSelector: {
				label: "permissionSelector",
				hint: "permissionSelectorEffect"
			},
			permissionMode: {
				label: "defaultPermissionMode",
				hint: "defaultPermissionModeEffect"
			},
			renderer: {
				label: "renderer",
				hint: "rendererEffect"
			},
			prose: {
				label: "prose",
				hint: "proseEffect"
			},
			worktreeBranchPrefix: {
				label: "worktreeBranchPrefix",
				hint: "worktreeBranchPrefixEffect"
			},
			maxProcesses: {
				label: "maxProcessesSetting",
				hint: "maxProcessesEffect"
			},
			idleTimeoutMinutes: {
				label: "idleTimeoutSetting",
				hint: "idleTimeoutEffect"
			}
		};
		/** Translated display text for the option vocabularies this plugin owns,
		*  keyed `<setting>:<option>`. Options discovered on the machine (output style
		*  names) carry no entry and keep the label the route reported. */
		const SETTING_OPTION_COPY = {
			"permissionSelector:plugin": "permissionSelectorPlugin",
			"permissionSelector:native": "permissionSelectorNative",
			"permissionMode:plan": "permissionModePlan",
			"permissionMode:default": "permissionModeDefault",
			"permissionMode:acceptEdits": "permissionModeAcceptEdits",
			"permissionMode:dontAsk": "permissionModeDontAsk",
			"permissionMode:auto": "permissionModeAuto",
			"permissionMode:bypassPermissions": "permissionModeBypass",
			"renderer:plugin": "rendererPlugin",
			"renderer:native": "rendererNative",
			"prose:plain": "prosePlain",
			"prose:enhanced": "proseEnhanced"
		};
		function settingOptionLabel(settingKey, option, t) {
			const key = SETTING_OPTION_COPY[`${settingKey}:${option.value}`];
			return key === void 0 ? option.label : t(key);
		}
		/** '?' badge that reveals a setting's effect note on hover or keyboard focus. */
		function SettingHint({ text, label }) {
			return /* @__PURE__ */ jsx(Tooltip, {
				label: text,
				side: "top",
				delayMs: 150,
				maxWidth: 320,
				children: /* @__PURE__ */ jsx("span", {
					role: "note",
					tabIndex: 0,
					"aria-label": `${label}: ${text}`,
					style: settingHint,
					children: "?"
				})
			});
		}
		function isPlanUsageReport(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const report = value;
			return typeof report.available === "boolean" && typeof report.fetchedAt === "number" && Array.isArray(report.windows) && report.windows.every((entry) => typeof entry === "object" && entry !== null && typeof entry.id === "string");
		}
		/** Coarse duration for a reset countdown or the age of a reading: minutes
		*  below an hour, then hours, then days. Never negative — a passed reset
		*  reads '0m'. */
		function durationLabel(milliseconds) {
			const minutes = Math.max(0, Math.round(milliseconds / 6e4));
			if (minutes < 60) return `${minutes}m`;
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
			return `${Math.floor(hours / 24)}d`;
		}
		function PlanUsageMeter({ window: usageWindow, t, now }) {
			const used = usageWindow.utilization;
			const tone = planUsageTone(used);
			const resetsIn = usageWindow.resetsAt === void 0 ? void 0 : Date.parse(usageWindow.resetsAt);
			return /* @__PURE__ */ jsxs("span", {
				style: planUsageMeter,
				children: [/* @__PURE__ */ jsx("span", {
					style: planUsageTrack,
					children: /* @__PURE__ */ jsx("span", { style: {
						...planUsageFill,
						width: `${used ?? 0}%`,
						background: tone.fill
					} })
				}), /* @__PURE__ */ jsxs("span", {
					style: {
						...planUsageMeta,
						color: tone.text
					},
					children: [used === void 0 ? "—" : t("planUsageUsed", { percent: Math.round(used) }), resetsIn === void 0 || !Number.isFinite(resetsIn) ? null : ` · ${t("planUsageResets", { age: durationLabel(resetsIn - now) })}`]
				})]
			});
		}
		function cardFailure(cause) {
			return {
				detail: cause instanceof Error ? cause.message : String(cause),
				starved: cause instanceof PluginRequestError && cause.reason === "starved"
			};
		}
		function FailureNotice({ label, failure }) {
			return /* @__PURE__ */ jsxs("p", {
				role: "alert",
				style: {
					...notice,
					color: failure.starved ? "var(--dsw-alias-state-warning-primary, #d69e2e)" : "var(--dsw-alias-state-error-primary)"
				},
				children: [
					label,
					": ",
					failure.detail
				]
			});
		}
		/** The plan usage report. A plain read serves the cached reading from memory;
		*  the refresh spawns a probe process, which is why only it pays the remote
		*  budget. */
		async function loadPlanUsage(refresh) {
			const payload = refresh ? await pluginWrite(CLAUDE_USAGE_PATH, "remote") : await pluginRead(CLAUDE_USAGE_PATH, "git");
			if (!isPlanUsageReport(payload)) throw new Error("Invalid plan usage response");
			return payload;
		}
		function PlanUsageCard({ t, load }) {
			const [report, setReport] = useState();
			const [busy, setBusy] = useState(false);
			const [error, setError] = useState();
			const request = useCallback(async (refresh) => {
				setBusy(true);
				setError(void 0);
				try {
					setReport(await load(refresh));
				} catch (cause) {
					setError(cardFailure(cause));
				} finally {
					setBusy(false);
				}
			}, [load]);
			useEffect(() => {
				request(false);
			}, [request]);
			const now = Date.now();
			return /* @__PURE__ */ jsxs("section", {
				style: settingsCard,
				children: [
					/* @__PURE__ */ jsxs("div", {
						style: settingsCardHeader,
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
							style: settingsSectionHeading,
							children: t("planUsage")
						}), /* @__PURE__ */ jsx("p", {
							style: settingsBody,
							children: t("planUsageBody")
						})] }), /* @__PURE__ */ jsx("button", {
							type: "button",
							style: button,
							disabled: busy,
							onClick: () => {
								request(true);
							},
							children: busy ? t("planUsageRefreshing") : t("planUsageRefresh")
						})]
					}),
					report === void 0 ? /* @__PURE__ */ jsx("p", {
						style: notice,
						children: busy ? t("planUsageLoading") : t("planUsageNever")
					}) : report.windows.length === 0 ? /* @__PURE__ */ jsx("p", {
						style: notice,
						children: report.fetchedAt === 0 ? t("planUsageNever") : t("planUsageUnavailable")
					}) : /* @__PURE__ */ jsxs("div", {
						style: diagnosticGrid,
						children: [report.subscription === void 0 ? null : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", {
							style: diagnosticLabel,
							children: t("planUsageSubscription")
						}), /* @__PURE__ */ jsx("span", {
							style: diagnosticValue,
							children: report.subscription
						})] }), report.windows.flatMap((usageWindow) => [/* @__PURE__ */ jsx("span", {
							style: diagnosticLabel,
							children: usageWindow.label ?? (TRANSLATED_WINDOWS.has(usageWindow.id) ? t(`planWindow_${usageWindow.id}`) : usageWindow.id)
						}, `${usageWindow.id}-label`), /* @__PURE__ */ jsx(PlanUsageMeter, {
							window: usageWindow,
							t,
							now
						}, `${usageWindow.id}-meter`)])]
					}),
					report !== void 0 && report.fetchedAt > 0 ? /* @__PURE__ */ jsx("p", {
						style: notice,
						children: t("planUsageUpdated", { age: durationLabel(now - report.fetchedAt) })
					}) : null,
					error === void 0 ? null : /* @__PURE__ */ jsx(FailureNotice, {
						label: t("planUsageError"),
						failure: error
					})
				]
			});
		}
		function ClaudeCodeSettings({ t }) {
			const [report, setReport] = useState();
			const [error, setError] = useState();
			const [busy, setBusy] = useState(false);
			const [updateStatus, setUpdateStatus] = useState();
			const [updateError, setUpdateError] = useState();
			const [updateBusy, setUpdateBusy] = useState();
			const [globalSettings, setGlobalSettings] = useState();
			const [globalSettingsError, setGlobalSettingsError] = useState();
			const [globalSettingsBusy, setGlobalSettingsBusy] = useState(false);
			const [jiraStatus, setJiraStatus] = useState();
			const [jiraError, setJiraError] = useState();
			const [jiraBusy, setJiraBusy] = useState(false);
			const [jiraSite, setJiraSite] = useState("");
			const [jiraEmail, setJiraEmail] = useState("");
			const [jiraToken, setJiraToken] = useState("");
			useEffect(() => {
				const controller = new AbortController();
				loadJiraStatus(controller.signal).then(setJiraStatus, (reason) => {
					if (!controller.signal.aborted) setJiraError(cardFailure(reason));
				});
				return () => {
					controller.abort();
				};
			}, []);
			const connectJiraNow = async () => {
				setJiraBusy(true);
				setJiraError(void 0);
				try {
					setJiraStatus(await connectJira({
						siteUrl: jiraSite,
						email: jiraEmail,
						apiToken: jiraToken
					}));
					setJiraToken("");
				} catch (cause) {
					setJiraError(cardFailure(cause));
				} finally {
					setJiraBusy(false);
				}
			};
			const disconnectJiraNow = async () => {
				setJiraBusy(true);
				setJiraError(void 0);
				try {
					await disconnectJira();
					setJiraStatus({ connected: false });
				} catch (cause) {
					setJiraError(cardFailure(cause));
				} finally {
					setJiraBusy(false);
				}
			};
			const refresh = useCallback(async () => {
				setBusy(true);
				setError(void 0);
				setReport(void 0);
				try {
					setReport(await pluginRead(CLAUDE_DOCTOR_PATH, "git"));
				} catch (cause) {
					setError(cardFailure(cause));
				} finally {
					setBusy(false);
				}
			}, []);
			useEffect(() => {
				refresh();
			}, [refresh]);
			const requestGlobalSettings = useCallback(async (changes) => {
				setGlobalSettingsBusy(true);
				setGlobalSettingsError(void 0);
				try {
					const payload = changes === void 0 ? await pluginRead(CLAUDE_GLOBAL_SETTINGS_PATH, "fast") : await pluginWrite(CLAUDE_GLOBAL_SETTINGS_PATH, "fast", void 0, {
						method: "PATCH",
						json: { changes }
					});
					if (!isGlobalSettingsView(payload)) throw new Error("Invalid global settings response");
					setGlobalSettings(payload);
					applyClaudeMarkdownTheme(proseModeOf(payload.settings));
				} catch (cause) {
					setGlobalSettingsError(cardFailure(cause));
				} finally {
					setGlobalSettingsBusy(false);
				}
			}, []);
			useEffect(() => {
				requestGlobalSettings();
			}, [requestGlobalSettings]);
			const requestUpdate = useCallback(async (action) => {
				setUpdateBusy(action);
				setUpdateError(void 0);
				try {
					const payload = action === "check" ? await pluginRead(CLAUDE_UPDATE_CHECK_PATH, "remote") : await pluginWrite(CLAUDE_UPDATE_PATH, "remote");
					if (!isPluginUpdateStatus(payload)) throw new Error("Invalid update response");
					setUpdateStatus(payload);
				} catch (cause) {
					setUpdateError(cardFailure(cause));
				} finally {
					setUpdateBusy(void 0);
				}
			}, []);
			const rows = report === void 0 ? [] : [
				[t("executable"), report.executable.status === "found" ? report.executable.path ?? t("unknown") : `${t("missing")} · ${report.executable.searched.join(", ")}`],
				[t("version"), value(report.version.status, report.version.value ?? report.version.message)],
				[t("authentication"), value(report.authentication.status, [report.authentication.method, report.authentication.subscription].filter(Boolean).join(" · ") || report.authentication.message)],
				[t("handshake"), report.handshake],
				...report.initialization === void 0 ? [] : [[t("initialization"), `${t("failed")} · ${report.initialization.message}`]],
				[t("processes"), t("processSummary", {
					total: report.processes.count,
					active: report.processes.active
				})],
				[t("limits"), t("limitSummary", {
					max: report.limits.maxProcesses,
					minutes: Math.round(report.limits.idleTimeoutMs / 6e4)
				})]
			];
			return /* @__PURE__ */ jsxs("div", {
				style: settingsPage,
				children: [
					/* @__PURE__ */ jsxs("header", {
						style: settingsHero,
						children: [/* @__PURE__ */ jsx("div", {
							style: settingsMark,
							"aria-hidden": "true",
							children: "C"
						}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
							style: settingsHeading,
							children: t("title")
						}), /* @__PURE__ */ jsx("p", {
							style: settingsBody,
							children: t("description")
						})] })]
					}),
					/* @__PURE__ */ jsxs("section", {
						style: settingsCard,
						children: [
							/* @__PURE__ */ jsxs("div", {
								style: settingsCardHeader,
								children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
									style: settingsSectionHeading,
									children: t("diagnostics")
								}), /* @__PURE__ */ jsx("p", {
									style: settingsBody,
									children: t("diagnosticsBody")
								})] }), /* @__PURE__ */ jsx("button", {
									type: "button",
									style: button,
									onClick: () => {
										refresh();
									},
									disabled: busy,
									children: busy ? t("refreshing") : t("doctor")
								})]
							}),
							rows.length === 0 ? /* @__PURE__ */ jsx("p", {
								style: notice,
								children: t("diagnosticsLoading")
							}) : /* @__PURE__ */ jsx("div", {
								style: diagnosticGrid,
								children: rows.flatMap(([label, rowValue]) => [/* @__PURE__ */ jsx("span", {
									style: diagnosticLabel,
									children: label
								}, `${label}-label`), /* @__PURE__ */ jsx("span", {
									style: diagnosticValue,
									children: rowValue
								}, `${label}-value`)])
							}),
							error === void 0 ? null : /* @__PURE__ */ jsx(FailureNotice, {
								label: t("error"),
								failure: error
							})
						]
					}),
					/* @__PURE__ */ jsx(PlanUsageCard, {
						t,
						load: loadPlanUsage
					}),
					/* @__PURE__ */ jsxs("section", {
						style: settingsCard,
						children: [
							/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
								style: settingsSectionHeading,
								children: t("globalSettings")
							}), /* @__PURE__ */ jsx("p", {
								style: settingsBody,
								children: t("globalSettingsBody")
							})] }),
							globalSettings === void 0 ? /* @__PURE__ */ jsx("p", {
								style: notice,
								children: t("globalSettingsLoading")
							}) : visibleGlobalSettings(globalSettings.settings).map((setting) => {
								const copy = SETTING_COPY[setting.key];
								return /* @__PURE__ */ jsxs("div", {
									style: diagnosticGrid,
									children: [/* @__PURE__ */ jsxs("span", {
										style: diagnosticLabel,
										children: [copy === void 0 ? setting.key : t(copy.label), copy === void 0 ? null : /* @__PURE__ */ jsx(SettingHint, {
											text: t(copy.hint),
											label: t("settingHint")
										})]
									}), setting.kind === "select" ? /* @__PURE__ */ jsx(GlobalSettingSelect, {
										setting,
										disabled: globalSettingsBusy,
										labelFor: (option) => settingOptionLabel(setting.key, option, t),
										onChange: (nextValue) => {
											requestGlobalSettings({ [setting.key]: nextValue });
										}
									}) : /* @__PURE__ */ jsx(GlobalSettingText, {
										setting,
										disabled: globalSettingsBusy,
										onChange: (nextValue) => {
											requestGlobalSettings({ [setting.key]: nextValue });
										}
									})]
								}, setting.key);
							}),
							globalSettingsError === void 0 ? null : /* @__PURE__ */ jsx(FailureNotice, {
								label: t("globalSettingsError"),
								failure: globalSettingsError
							})
						]
					}),
					/* @__PURE__ */ jsxs("section", {
						style: settingsCard,
						children: [
							/* @__PURE__ */ jsxs("div", {
								style: settingsCardHeader,
								children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
									style: settingsSectionHeading,
									children: t("jiraTitle")
								}), /* @__PURE__ */ jsx("p", {
									style: settingsBody,
									children: t("jiraBody")
								})] }), jiraStatus?.connected === true ? /* @__PURE__ */ jsx("button", {
									type: "button",
									style: button,
									disabled: jiraBusy,
									onClick: () => {
										disconnectJiraNow();
									},
									children: t("jiraDisconnect")
								}) : null]
							}),
							jiraStatus === void 0 && jiraError === void 0 ? /* @__PURE__ */ jsx("p", {
								style: notice,
								children: t("jiraLoading")
							}) : null,
							jiraStatus?.connected === true ? /* @__PURE__ */ jsxs("div", {
								style: diagnosticGrid,
								children: [/* @__PURE__ */ jsx("span", {
									style: diagnosticLabel,
									children: t("jiraConnected")
								}), /* @__PURE__ */ jsxs("span", { children: [
									jiraStatus.siteUrl,
									" · ",
									jiraStatus.displayName ?? jiraStatus.email
								] })]
							}) : jiraStatus === void 0 ? null : /* @__PURE__ */ jsxs(Fragment$1, { children: [
								/* @__PURE__ */ jsxs("div", {
									style: diagnosticGrid,
									children: [/* @__PURE__ */ jsx("span", {
										style: diagnosticLabel,
										children: t("jiraSite")
									}), /* @__PURE__ */ jsx("input", {
										type: "url",
										value: jiraSite,
										placeholder: t("jiraSitePlaceholder"),
										disabled: jiraBusy,
										style: settingTextInput,
										onChange: (event) => {
											setJiraSite(event.currentTarget.value);
										}
									})]
								}),
								/* @__PURE__ */ jsxs("div", {
									style: diagnosticGrid,
									children: [/* @__PURE__ */ jsx("span", {
										style: diagnosticLabel,
										children: t("jiraEmail")
									}), /* @__PURE__ */ jsx("input", {
										type: "email",
										value: jiraEmail,
										disabled: jiraBusy,
										style: settingTextInput,
										onChange: (event) => {
											setJiraEmail(event.currentTarget.value);
										}
									})]
								}),
								/* @__PURE__ */ jsxs("div", {
									style: diagnosticGrid,
									children: [/* @__PURE__ */ jsx("span", {
										style: diagnosticLabel,
										children: t("jiraToken")
									}), /* @__PURE__ */ jsx("input", {
										type: "password",
										value: jiraToken,
										disabled: jiraBusy,
										autoComplete: "off",
										style: settingTextInput,
										onChange: (event) => {
											setJiraToken(event.currentTarget.value);
										}
									})]
								}),
								/* @__PURE__ */ jsxs("div", {
									style: settingsActions,
									children: [/* @__PURE__ */ jsx("a", {
										href: "https://id.atlassian.com/manage-profile/security/api-tokens",
										target: "_blank",
										rel: "noopener noreferrer",
										style: settingsLink,
										children: t("jiraTokenHelp")
									}), /* @__PURE__ */ jsx("button", {
										type: "button",
										style: primaryButton,
										disabled: jiraBusy || jiraSite.trim() === "" || jiraEmail.trim() === "" || jiraToken.trim() === "",
										onClick: () => {
											connectJiraNow();
										},
										children: jiraBusy ? t("jiraConnecting") : t("jiraConnect")
									})]
								})
							] }),
							jiraError === void 0 ? null : /* @__PURE__ */ jsx(FailureNotice, {
								label: t("jiraError"),
								failure: jiraError
							})
						]
					}),
					/* @__PURE__ */ jsxs("section", {
						style: settingsCard,
						children: [
							/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
								style: settingsSectionHeading,
								children: t("pluginUpdate")
							}), /* @__PURE__ */ jsx("p", {
								style: settingsBody,
								children: t("pluginUpdateBody")
							})] }),
							updateStatus === void 0 ? /* @__PURE__ */ jsx("p", {
								style: notice,
								children: t("updateNotChecked")
							}) : /* @__PURE__ */ jsxs("div", {
								style: diagnosticGrid,
								children: [
									/* @__PURE__ */ jsx("span", {
										style: diagnosticLabel,
										children: t("installedVersion")
									}),
									/* @__PURE__ */ jsx("span", {
										style: diagnosticValue,
										children: updateStatus.currentVersion
									}),
									/* @__PURE__ */ jsx("span", {
										style: diagnosticLabel,
										children: t("installSource")
									}),
									/* @__PURE__ */ jsx("span", {
										style: diagnosticValue,
										children: t(`updateSource_${updateStatus.source}`)
									}),
									/* @__PURE__ */ jsx("span", {
										style: diagnosticLabel,
										children: t("updateStatus")
									}),
									/* @__PURE__ */ jsx("span", {
										style: diagnosticValue,
										children: t(`updateState_${updateStatus.state}`)
									}),
									updateStatus.latestVersion === void 0 ? null : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", {
										style: diagnosticLabel,
										children: t("latestVersion")
									}), /* @__PURE__ */ jsx("span", {
										style: diagnosticValue,
										children: updateStatus.latestVersion
									})] })
								]
							}),
							updateStatus?.message === void 0 ? null : /* @__PURE__ */ jsx("p", {
								style: notice,
								children: updateStatus.message
							}),
							updateStatus?.restartRequired !== true ? null : /* @__PURE__ */ jsx("p", {
								style: notice,
								children: t("restartRequired")
							}),
							updateError === void 0 ? null : /* @__PURE__ */ jsx(FailureNotice, {
								label: t("updateError"),
								failure: updateError
							}),
							/* @__PURE__ */ jsxs("div", {
								style: settingsActions,
								children: [/* @__PURE__ */ jsx("button", {
									type: "button",
									style: button,
									onClick: () => {
										requestUpdate("check");
									},
									disabled: updateBusy !== void 0,
									children: updateBusy === "check" ? t("checkingUpdates") : t("checkUpdates")
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									style: primaryButton,
									onClick: () => {
										requestUpdate("update");
									},
									disabled: updateBusy !== void 0 || updateStatus?.canUpdate !== true,
									children: updateBusy === "update" ? t("updatingPlugin") : t("updatePlugin")
								})]
							})
						]
					}),
					/* @__PURE__ */ jsxs("section", {
						style: settingsCard,
						children: [/* @__PURE__ */ jsx("h3", {
							style: settingsSectionHeading,
							children: t("security")
						}), /* @__PURE__ */ jsx("p", {
							style: settingsBody,
							children: t("securityBody")
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/plan-feedback-api.ts
		/** Send one plan back for changes. */
		async function sendPlanForChanges(sessionId, toolUseId, notes) {
			try {
				await pluginWrite(CLAUDE_PLAN_FEEDBACK_PATH, "fast", void 0, {
					query: { sessionId },
					json: {
						toolUseId,
						notes
					}
				});
			} catch (error) {
				const settled = error instanceof PluginRequestError && error.reason === "http" && error.status === 409;
				throw new Error(settled ? "planSettled" : "planFeedbackFailed");
			}
		}
		//#endregion
		//#region src/client/ClaudePlanPanel.tsx
		const PLAN_TOOL = "ExitPlanMode";
		/** Every plan this session handed over, oldest first, each with where its
		*  approval stands.
		*
		*  The permission bridge writes one `started` record carrying the plan and,
		*  once the user decides, a second record under the same `toolUseId` whose
		*  phase says which way it went. Both arrive on the ordinary activity stream,
		*  so the panel needs no channel of its own — it reads the transcript the
		*  session already has. */
		function planReviews(activities) {
			const plans = /* @__PURE__ */ new Map();
			const states = /* @__PURE__ */ new Map();
			for (const activity of activities) {
				const { toolUseId } = activity;
				if (activity.kind !== "permission" || toolUseId === void 0) continue;
				if (activity.toolName === PLAN_TOOL && activity.phase === "started" && activity.text !== void 0 && activity.text.length > 0) {
					plans.set(toolUseId, activity.text);
					if (!states.has(toolUseId)) states.set(toolUseId, "pending");
				}
				if (activity.phase === "completed") states.set(toolUseId, "approved");
				else if (activity.phase === "denied" || activity.phase === "failed") states.set(toolUseId, "rejected");
			}
			return [...plans].map(([toolUseId, plan]) => ({
				toolUseId,
				plan,
				state: states.get(toolUseId) ?? "pending"
			}));
		}
		/** The newest plan, for readers that only care what is on the table now. */
		function latestPlanReview(activities) {
			return planReviews(activities).at(-1);
		}
		/** A plan's own first heading, so a list of several can name them.
		*
		*  Falls back to the opening line: a plan without a heading is unusual but
		*  still has to be pickable. Fenced blocks are not scanned — a `#` comment in
		*  the first code block of a heading-less plan is a worse label than the first
		*  line, but not a wrong one, and the cost of getting it exactly right is a
		*  fence-state machine for a fallback. */
		function planTitle(plan) {
			for (const raw of plan.split("\n")) {
				const line = raw.trim();
				if (line.length === 0) continue;
				const heading = /^#{1,6}\s+(.+?)\s*#*$/u.exec(line);
				if (heading?.[1] !== void 0) return heading[1].slice(0, MAX_TITLE_CHARS);
				return line.slice(0, MAX_TITLE_CHARS);
			}
			return "";
		}
		const MAX_TITLE_CHARS = 80;
		const MAX_QUOTE_CHARS = 1e3;
		/** The passage under the current selection, when it lies inside the plan body.
		*
		*  Reads the live selection rather than mirroring the DOM: the body is the
		*  Host's Markdown output, which this package renders but does not own, and
		*  the only stable thing about it is that it is inside this element. */
		function quotedSelection(selection, body) {
			if (selection === null || body === null || selection.isCollapsed || selection.rangeCount === 0) return void 0;
			const range = selection.getRangeAt(0);
			if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return void 0;
			const text = selection.toString().trim();
			return text.length === 0 ? void 0 : text.slice(0, MAX_QUOTE_CHARS);
		}
		/** Whether a selection that quotes nothing is the reader dropping the quote.
		*
		*  Clicking inside the plan collapses the selection there and means "never
		*  mind". Clicking anywhere else — above all the composer, which takes focus
		*  to type the note — must leave the quote standing, or quoting is
		*  impossible. */
		function clearsQuote(selection, body) {
			return selection !== null && body !== null && selection.anchorNode !== null && body.contains(selection.anchorNode);
		}
		/** The newest review as one primitive, for readers that only need to know
		*  whether it changed. A snapshot hook keeps its value only while the
		*  selection compares equal, and a fresh object per snapshot would defeat
		*  that. Empty string when the session has proposed nothing. */
		function planReviewKey(activities) {
			const review = latestPlanReview(activities);
			return review === void 0 ? "" : `${review.state}:${review.toolUseId}`;
		}
		/** Split what {@link planReviewKey} joined. */
		function parsePlanReviewKey(key) {
			const cut = key.indexOf(":");
			if (cut < 0) return void 0;
			const state = key.slice(0, cut);
			if (state !== "pending" && state !== "approved" && state !== "rejected") return void 0;
			return {
				state,
				toolUseId: key.slice(cut + 1)
			};
		}
		/** Card and rows reproduce the primitives' menu surface, like the session
		*  menu next door: r7, inverted hairline, shadow-lv3, 2px inset. */
		const PICKER_CSS = [
			".dsh-claude-plan-picker-root{position:relative;display:inline-flex;min-width:0}",
			".dsh-claude-plan-picker{display:inline-flex;align-items:center;gap:4px;min-width:0;padding:2px 6px;",
			"margin:-2px -6px;border:0;border-radius:7px;background:transparent;color:inherit;font:inherit;cursor:pointer;",
			"transition:background .12s ease}",
			".dsh-claude-plan-picker:hover,.dsh-claude-plan-picker[aria-expanded=\"true\"]{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-claude-plan-picker:focus-visible{outline:none;background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-claude-plan-picker>svg{flex:none;transition:transform .12s ease}",
			".dsh-claude-plan-picker[aria-expanded=\"true\"]>svg{transform:rotate(180deg)}",
			".dsh-claude-plan-picker-card{box-sizing:border-box;position:absolute;top:calc(100% + 6px);left:-6px;z-index:100;",
			"display:flex;flex-direction:column;gap:1px;padding:2px;min-width:240px;max-width:min(420px,70vw);",
			"max-height:min(320px,50vh);overflow-y:auto;border:1px solid var(--dsw-alias-border-inverted);",
			"border-radius:7px;background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3)}",
			".dsh-claude-plan-picker-item{display:flex;align-items:center;gap:8px;width:100%;min-height:26px;",
			"padding:5px 8px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary);",
			"font:inherit;font-size:12px;line-height:17px;text-align:left;cursor:pointer}",
			".dsh-claude-plan-picker-item:hover,.dsh-claude-plan-picker-item:focus-visible{outline:none;",
			"background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-claude-plan-picker-item[aria-current=\"true\"]{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-claude-plan-picker-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-claude-plan-picker-ordinal{flex:none;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}"
		].join("");
		function ChevronDownIcon() {
			return /* @__PURE__ */ jsx("svg", {
				width: "12",
				height: "12",
				viewBox: "0 0 12 12",
				fill: "none",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx("path", {
					d: "m3 4.75 3 3 3-3",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		const STATE_LABEL = {
			pending: "planPending",
			approved: "planApproved",
			rejected: "planRejected"
		};
		/** The plan behind an `ExitPlanMode` approval, as the document it was written
		*  as. The decision itself stays with the Host's approval dialog; this panel
		*  is where the plan is actually read, under the reader's own prose palette. */
		function ClaudePlanPanel({ useClaudeProjection, t, sessionId, closeDetails, submitChanges = sendPlanForChanges }) {
			const markdownLabels = useClaudeMarkdownLabels(t);
			const owned = useClaudeProjection((projection) => projection.owned);
			const reviews = planReviews(useClaudeProjection((projection) => projection.activities));
			const [chosen, setChosen] = useState();
			const [open, setOpen] = useState(false);
			const picker = useRef(null);
			useDismissOnOutsidePointer(picker, open, (next) => {
				if (!next) setOpen(false);
			});
			const pendingId = reviews.find((item) => item.state === "pending")?.toolUseId;
			useEffect(() => {
				if (pendingId !== void 0) setChosen(pendingId);
			}, [pendingId]);
			const review = reviews.find((item) => item.toolUseId === chosen) ?? reviews.at(-1);
			const [notes, setNotes] = useState([]);
			const [draft, setDraft] = useState("");
			const [quote, setQuote] = useState();
			const [sending, setSending] = useState(false);
			const [failure, setFailure] = useState();
			const body = useRef(null);
			const composer = useRef(null);
			useEffect(() => {
				if (typeof document === "undefined") return;
				const read = () => {
					const selection = document.getSelection();
					const selected = quotedSelection(selection, body.current);
					if (selected !== void 0) setQuote(selected);
					else if (clearsQuote(selection, body.current)) setQuote(void 0);
				};
				document.addEventListener("selectionchange", read);
				return () => {
					document.removeEventListener("selectionchange", read);
				};
			}, []);
			useEffect(() => {
				setNotes([]);
				setDraft("");
				setQuote(void 0);
				setFailure(void 0);
			}, [review?.toolUseId]);
			const addNote = useCallback(() => {
				const text = draft.trim();
				if (text.length === 0) return;
				setNotes((current) => [...current, quote === void 0 ? { text } : {
					quote,
					text
				}]);
				setDraft("");
				setQuote(void 0);
			}, [draft, quote]);
			const send = useCallback(() => {
				if (review === void 0 || sending) return;
				const text = draft.trim();
				const pending = text.length === 0 ? notes : [...notes, quote === void 0 ? { text } : {
					quote,
					text
				}];
				if (pending.length === 0) return;
				setSending(true);
				setFailure(void 0);
				submitChanges(sessionId, review.toolUseId, pending).then(() => {
					setNotes([]);
					setDraft("");
					setQuote(void 0);
					setSending(false);
				}, (error) => {
					setFailure(error instanceof Error && error.message === "planSettled" ? "planSettled" : "planFeedbackFailed");
					setSending(false);
				});
			}, [
				draft,
				notes,
				quote,
				review,
				sending,
				sessionId,
				submitChanges
			]);
			useEffect(() => {
				if (!owned || review === void 0) closeDetails();
			}, [
				closeDetails,
				owned,
				review === void 0
			]);
			if (!owned) return null;
			const index = review === void 0 ? -1 : reviews.findIndex((item) => item.toolUseId === review.toolUseId);
			const badge = (state) => ({
				...planBadge,
				...state === "pending" ? planBadgePending : state === "rejected" ? planBadgeRejected : {}
			});
			return /* @__PURE__ */ jsxs("div", {
				className: detailsCardClass,
				style: tasksPanel,
				children: [
					/* @__PURE__ */ jsxs("style", {
						"data-dsh-claude-panel-icon-styles": true,
						children: [
							detailsCardCss,
							panelIconButtonCss,
							PICKER_CSS
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						style: tasksHeader,
						children: [/* @__PURE__ */ jsxs("div", {
							style: planHeaderStart,
							children: [reviews.length < 2 ? /* @__PURE__ */ jsx("span", {
								style: tasksHeading,
								children: t("planPanelTitle")
							}) : /* @__PURE__ */ jsxs("div", {
								className: "dsh-claude-plan-picker-root",
								ref: picker,
								children: [/* @__PURE__ */ jsxs("button", {
									type: "button",
									className: "dsh-claude-plan-picker",
									"aria-expanded": open,
									"aria-haspopup": "listbox",
									onClick: () => {
										setOpen((value) => !value);
									},
									children: [
										/* @__PURE__ */ jsx("span", {
											style: tasksHeading,
											children: t("planPanelTitle")
										}),
										/* @__PURE__ */ jsx("span", {
											style: planCount,
											children: t("planNth", {
												index: index + 1,
												total: reviews.length
											})
										}),
										/* @__PURE__ */ jsx(ChevronDownIcon, {})
									]
								}), !open ? null : /* @__PURE__ */ jsx("div", {
									className: "dsh-claude-plan-picker-card",
									role: "listbox",
									"aria-label": t("planHistory"),
									children: [...reviews].reverse().map((item, offset) => /* @__PURE__ */ jsxs("button", {
										type: "button",
										role: "option",
										className: "dsh-claude-plan-picker-item",
										"aria-current": item.toolUseId === review?.toolUseId,
										"aria-selected": item.toolUseId === review?.toolUseId,
										onClick: () => {
											setChosen(item.toolUseId);
											setOpen(false);
										},
										children: [
											/* @__PURE__ */ jsx("span", {
												className: "dsh-claude-plan-picker-ordinal",
												children: reviews.length - offset
											}),
											/* @__PURE__ */ jsx("span", {
												className: "dsh-claude-plan-picker-title",
												children: planTitle(item.plan)
											}),
											/* @__PURE__ */ jsx("span", {
												style: badge(item.state),
												children: t(STATE_LABEL[item.state])
											})
										]
									}, item.toolUseId))
								})]
							}), review === void 0 ? null : /* @__PURE__ */ jsx("span", {
								style: badge(review.state),
								children: t(STATE_LABEL[review.state])
							})]
						}), /* @__PURE__ */ jsx("div", {
							style: planHeaderEnd,
							children: /* @__PURE__ */ jsx("button", {
								type: "button",
								className: panelIconButtonClass,
								"aria-label": t("planClose"),
								onClick: closeDetails,
								children: /* @__PURE__ */ jsx(IconCloseOutlineRegular, {})
							})
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						style: tasksBody,
						ref: body,
						children: review === void 0 ? /* @__PURE__ */ jsx("p", {
							style: tasksGroupEmpty,
							children: t("planEmpty")
						}) : /* @__PURE__ */ jsxs(Fragment$1, { children: [review.state === "pending" ? /* @__PURE__ */ jsx("p", {
							style: planHint,
							children: t("planPendingHint")
						}) : null, /* @__PURE__ */ jsx(ClaudeMarkdown, {
							text: review.plan,
							labels: markdownLabels
						}, review.toolUseId)] })
					}),
					review?.state !== "pending" ? null : /* @__PURE__ */ jsxs("div", {
						style: planComposer,
						children: [
							notes.length === 0 ? null : /* @__PURE__ */ jsx("ul", {
								style: planNoteList,
								children: notes.map((note, index) => /* @__PURE__ */ jsxs("li", {
									style: planNote,
									children: [
										note.quote === void 0 ? null : /* @__PURE__ */ jsx("p", {
											style: planNoteQuote,
											children: note.quote
										}),
										/* @__PURE__ */ jsx("p", {
											style: planNoteText,
											children: note.text
										}),
										/* @__PURE__ */ jsx("button", {
											type: "button",
											style: planNoteRemove,
											"aria-label": t("planNoteRemove"),
											onClick: () => {
												setNotes((current) => current.filter((_, at) => at !== index));
											},
											children: "×"
										})
									]
								}, index))
							}),
							quote === void 0 ? null : /* @__PURE__ */ jsxs("div", {
								style: planQuoteChip,
								children: [/* @__PURE__ */ jsx("span", {
									style: planNoteQuote,
									children: quote
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									style: planNoteRemove,
									"aria-label": t("planQuoteClear"),
									onClick: () => {
										setQuote(void 0);
									},
									children: "×"
								})]
							}),
							/* @__PURE__ */ jsx("textarea", {
								ref: composer,
								value: draft,
								placeholder: t(quote === void 0 ? "planNotePlaceholder" : "planNoteQuotedPlaceholder"),
								style: planComposerInput,
								onChange: (event) => {
									setDraft(event.currentTarget.value);
								},
								onKeyDown: (event) => {
									if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
									event.preventDefault();
									if (event.metaKey || event.ctrlKey) send();
									else addNote();
								}
							}),
							failure === void 0 ? null : /* @__PURE__ */ jsx("p", {
								role: "alert",
								style: planComposerError,
								children: t(failure)
							}),
							/* @__PURE__ */ jsxs("div", {
								style: planComposerActions,
								children: [/* @__PURE__ */ jsx("span", {
									style: planComposerHint,
									children: t("planNoteHint")
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									style: {
										...askButton,
										...askPrimaryButton
									},
									disabled: sending || notes.length === 0 && draft.trim().length === 0,
									onClick: send,
									children: t(sending ? "planSending" : "planSendForChanges")
								})]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/ClaudePlanHeaderAction.tsx
		/** Same resting-quiet treatment as the diff action next to it, plus a dot for
		*  a plan still waiting on its approval dialog. */
		const ACTION_CSS$1 = [
			".dsh-claude-header-plan{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;",
			"width:32px;height:32px;padding:0;border:0;border-radius:9px;background:transparent;",
			"color:var(--dsw-alias-label-secondary);cursor:pointer;",
			"transition:background .12s ease,color .12s ease}",
			".dsh-claude-header-plan:hover,.dsh-claude-header-plan:focus-visible,.dsh-claude-header-plan[aria-pressed=\"true\"]{",
			"background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dsh-claude-header-plan:active{background:var(--dsw-alias-interactive-bg-active)}",
			".dsh-claude-header-plan:focus-visible{outline:none}",
			".dsh-claude-header-plan>*{flex:none}",
			".dsh-claude-header-plan>svg.dsh-claude-header-plan-glyph{",
			"width:18px;height:18px;display:block;overflow:visible;opacity:1;",
			"fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}",
			".dsh-claude-header-plan[data-pending]::after{content:\"\";position:absolute;top:6px;right:6px;",
			"width:6px;height:6px;border-radius:999px;background:var(--dsw-alias-state-warning-primary,#e2a03f);",
			"box-shadow:0 0 0 2px var(--dsw-alias-bg-base)}"
		].join("");
		let cssInjected$3 = false;
		function ensureCss$3() {
			if (cssInjected$3 || typeof document === "undefined") return;
			cssInjected$3 = true;
			const element = document.createElement("style");
			element.dataset.dshClaudeHeaderPlan = "";
			element.textContent = ACTION_CSS$1;
			document.head.appendChild(element);
		}
		/** A written page, not a checklist: a plan is a document to read, and ticks
		*  next to lines are what the task board means. Drawn inline for the same
		*  reason the diff glyph is — the primitives set ships neither. */
		function PlanGlyph() {
			return /* @__PURE__ */ jsxs("svg", {
				className: "dsh-claude-header-plan-glyph",
				width: "18",
				height: "18",
				viewBox: "0 0 18 18",
				fill: "none",
				"aria-hidden": "true",
				focusable: "false",
				children: [
					/* @__PURE__ */ jsx("path", { d: "M10.5 2.25H5a1.75 1.75 0 0 0-1.75 1.75v10A1.75 1.75 0 0 0 5 15.75h8A1.75 1.75 0 0 0 14.75 14V6.5Z" }),
					/* @__PURE__ */ jsx("path", { d: "M10.5 2.25V6.5h4.25" }),
					/* @__PURE__ */ jsx("path", { d: "M6.25 9h5.5M6.25 12h3.5" })
				]
			});
		}
		function ClaudePlanHeaderAction({ t, sessionId, togglePlan, planOpen, useClaudeProjection }) {
			const owned = useClaudeProjection((projection) => projection.owned);
			const review = parsePlanReviewKey(useClaudeProjection((projection) => planReviewKey(projection.activities)));
			const open = useSyncExternalStore(planOpen.subscribe, planOpen.getSnapshot, planOpen.getSnapshot);
			const opened = useRef();
			useEffect(() => {
				if (review?.state !== "pending" || opened.current === review.toolUseId) return;
				opened.current = review.toolUseId;
				if (!open) togglePlan();
			});
			if (!owned || review === void 0) return null;
			ensureCss$3();
			const label = t(open ? "planClose" : "planOpen");
			return /* @__PURE__ */ jsx(Tooltip, {
				label,
				side: "bottom",
				delayMs: 250,
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					className: "dsh-claude-header-plan",
					"aria-label": label,
					"aria-pressed": open,
					"data-pending": review.state === "pending" || void 0,
					"data-session": sessionId,
					onClick: togglePlan,
					children: /* @__PURE__ */ jsx(PlanGlyph, {})
				})
			});
		}
		//#endregion
		//#region src/client/repository-action-api.ts
		var RepositoryActionClientError = class extends Error {
			code;
			commit;
			constructor(message, code, commit) {
				super(message);
				this.name = "RepositoryActionClientError";
				if (code !== void 0) this.code = code;
				if (commit !== void 0) this.commit = commit;
			}
		};
		function record$6(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
		}
		/** The dialog branches on `code`, so a route refusal keeps arriving as this
		*  class rather than as the transport's own error.
		*
		*  `commit` cannot be carried across: the transport forwards a failed route's
		*  message and error code, not the rest of its body, so a commit that survived
		*  a failed push no longer reaches the dialog that offers its hash. */
		function actionError(error) {
			return error instanceof PluginRequestError ? new RepositoryActionClientError(error.message, error.code) : error;
		}
		function preview(value) {
			const input = record$6(value);
			if (input === void 0 || typeof input.root !== "string" || typeof input.branch !== "string" || typeof input.head !== "string" || typeof input.fingerprint !== "string" || !Array.isArray(input.files) || typeof input.patch !== "string" || typeof input.truncated !== "boolean" || typeof input.hasStaged !== "boolean" || typeof input.hasUnstaged !== "boolean" || typeof input.hasUntracked !== "boolean" || input.upstream !== void 0 && typeof input.upstream !== "string" || !Array.isArray(input.unpushedCommits) || typeof input.unpushedTruncated !== "boolean") throw new Error("Invalid repository action preview.");
			for (const file of input.files) {
				const item = record$6(file);
				if (item === void 0 || typeof item.path !== "string" || typeof item.staged !== "boolean" || typeof item.unstaged !== "boolean" || typeof item.untracked !== "boolean") throw new Error("Invalid repository action file.");
			}
			for (const commit of input.unpushedCommits) {
				const item = record$6(commit);
				if (item === void 0 || typeof item.hash !== "string" || typeof item.subject !== "string") throw new Error("Invalid repository action commit.");
			}
			return input;
		}
		function result(value) {
			const input = record$6(value);
			if (input === void 0 || typeof input.commit !== "string" || typeof input.pushed !== "boolean" || input.pullRequestUrl !== void 0 && typeof input.pullRequestUrl !== "string" || input.conflicts !== void 0 && (!Array.isArray(input.conflicts) || input.conflicts.some((item) => typeof item !== "string"))) throw new Error("Invalid repository action result.");
			return input;
		}
		/** `root` names another checkout the session wrote into; absent, the
		*  session's own. The Host only honours roots it has vouched for. */
		function sessionQuery(sessionId, root) {
			return {
				sessionId,
				...root === void 0 ? {} : { root }
			};
		}
		/** The preview only chains local Git; everything that writes may reach a remote. */
		async function loadRepositoryActionPreview(sessionId, signal, root) {
			try {
				return preview(await pluginRead(`${CLAUDE_REPOSITORY_ACTION_PATH}/preview`, "git", signal, { query: sessionQuery(sessionId, root) }));
			} catch (error) {
				throw actionError(error);
			}
		}
		async function generateCommitMessage(sessionId, fingerprint, signal, root) {
			try {
				const value = record$6(await pluginWrite(`${CLAUDE_REPOSITORY_ACTION_PATH}/message`, "remote", signal, {
					query: sessionQuery(sessionId, root),
					json: { fingerprint }
				}));
				if (typeof value?.message !== "string") throw new Error("Invalid generated commit message.");
				return value.message;
			} catch (error) {
				throw actionError(error);
			}
		}
		/** Title and Summary/Changes body for the pull request the branch would open;
		*  `baseBranch` empty means origin's default branch. */
		async function generatePullRequestText(sessionId, fingerprint, baseBranch, signal, root) {
			try {
				const value = record$6(await pluginWrite(`${CLAUDE_REPOSITORY_ACTION_PATH}/pull-request`, "remote", signal, {
					query: sessionQuery(sessionId, root),
					json: {
						fingerprint,
						...baseBranch === void 0 || baseBranch.trim() === "" ? {} : { baseBranch: baseBranch.trim() }
					}
				}));
				if (typeof value?.title !== "string" || typeof value.body !== "string") throw new Error("Invalid generated pull request text.");
				return {
					title: value.title,
					body: value.body
				};
			} catch (error) {
				throw actionError(error);
			}
		}
		async function executeRepositoryAction(sessionId, request, root) {
			try {
				return result(await pluginWrite(CLAUDE_REPOSITORY_ACTION_PATH, "remote", void 0, {
					query: sessionQuery(sessionId, root),
					json: request
				}));
			} catch (error) {
				throw actionError(error);
			}
		}
		//#endregion
		//#region src/client/action-toast.tsx
		/** Always a new id, even for the same text: the id is the Toast's key, and
		*  reporting the same outcome twice has to replay the banner rather than
		*  update the text of one that is already fading out. */
		function nextActionToast(current, text) {
			return {
				id: (current?.id ?? 0) + 1,
				text
			};
		}
		/** Report a finished Git action the way the Host reports everything else: a
		*  banner over the window, not a line inside the dialog that asked for it. The
		*  dialog closes the moment the work lands, so the notice has to outlive it. */
		function useActionToast() {
			const [shown, setShown] = useState();
			const done = useCallback(() => {
				setShown(void 0);
			}, []);
			const report = useCallback((text) => {
				setShown((current) => nextActionToast(current, text));
			}, []);
			return {
				toast: shown === void 0 ? null : /* @__PURE__ */ jsx(Toast, {
					text: shown.text,
					onDone: done
				}, shown.id),
				report
			};
		}
		//#endregion
		//#region src/client/repository-setup-api.ts
		const HOST_STAGES = /* @__PURE__ */ new Set([
			"inspecting",
			"fetching",
			"summarizing",
			"creating-worktree",
			"saving-worktree",
			"switching-branch"
		]);
		/** The draft only has to describe the work; the host truncates it again before
		*  summarizing, and the setup route caps the whole body at 16 KiB. */
		const MAX_INTENT_CHARS = 2e3;
		function record$5(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		function setupResult(value) {
			const item = record$5(value);
			if (item === void 0 || item.mode !== "checkout" && item.mode !== "worktree" || typeof item.root !== "string" || typeof item.path !== "string" || typeof item.branch !== "string" || item.leaseId !== void 0 && typeof item.leaseId !== "string") return void 0;
			return item;
		}
		function parseRepositorySetupEvent(line, onProgress) {
			const event = record$5(JSON.parse(line));
			if (event?.type === "progress" && typeof event.stage === "string" && HOST_STAGES.has(event.stage)) {
				onProgress(event.stage);
				return;
			}
			if (event?.type === "complete") {
				const result = setupResult(event.result);
				if (result !== void 0) return result;
			}
			if (event?.type === "error" && typeof event.message === "string") throw new Error(event.message);
			throw new Error("Invalid repository setup progress response.");
		}
		function loadRepositoryBranches(cwd, signal) {
			return pluginRead(`${CLAUDE_REPOSITORY_SETUP_PATH}/branches`, "git", signal, { query: { cwd } });
		}
		/** Pull remote refs down first, then list: a POST because `--prune` rewrites
		*  this checkout's remote-tracking refs, and on the remote budget because the
		*  host's own `git fetch` runs for up to a minute. */
		async function refreshRepositoryBranches(cwd, signal) {
			try {
				return await pluginWrite(`${CLAUDE_REPOSITORY_SETUP_PATH}/branches/refresh`, "remote", signal, { json: { cwd } });
			} catch (error) {
				if (error instanceof PluginRequestError && error.reason === "route-missing") throw new Error("route-missing");
				throw error;
			}
		}
		async function prepareRepository(cwd, branch, worktree, branchName, onProgress = () => {}, intent) {
			const carrier = new AbortController();
			try {
				const reader = await pluginNdjson(CLAUDE_REPOSITORY_SETUP_PATH, carrier.signal, {
					method: "POST",
					json: {
						cwd,
						branch,
						worktree,
						...branchName === void 0 ? {} : { branchName },
						...intent === void 0 || intent.trim().length === 0 ? {} : { intent: intent.slice(0, MAX_INTENT_CHARS) }
					}
				});
				const decoder = new TextDecoder();
				let buffer = "";
				let completed;
				while (true) {
					const chunk = await reader.read();
					buffer += decoder.decode(chunk.value, { stream: !chunk.done });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) {
						if (line.trim().length === 0) continue;
						const value = parseRepositorySetupEvent(line, onProgress);
						if (value !== void 0) completed = value;
					}
					if (chunk.done) break;
				}
				if (buffer.trim().length > 0) {
					const value = parseRepositorySetupEvent(buffer, onProgress);
					if (value !== void 0) completed = value;
				}
				if (completed === void 0) throw new Error("Repository setup progress ended before completion.");
				return completed;
			} finally {
				carrier.abort();
			}
		}
		async function bindRepositoryLease(leaseId, sessionId) {
			await pluginWrite(`${CLAUDE_REPOSITORY_SETUP_PATH}/bind`, "remote", void 0, { json: {
				leaseId,
				sessionId
			} });
		}
		/** `branch` names the merged branch when the checkout is no longer on it (a
		*  linked pull request whose clone is back on base). Without a pull request
		*  there is no base, and `requirePushed` has the Host refuse a branch whose
		*  commits are on no remote. */
		async function cleanupMergedRepository(path, baseBranch, branch, requirePushed) {
			const body = await pluginWrite(`${CLAUDE_REPOSITORY_SETUP_PATH}/cleanup`, "remote", void 0, { json: {
				path,
				...baseBranch === void 0 ? {} : { baseBranch },
				...branch === void 0 ? {} : { branch },
				...requirePushed === true ? { requirePushed: true } : {}
			} });
			if (body.mode !== "worktree" && body.mode !== "checkout" || typeof body.root !== "string" || typeof body.branch !== "string") throw new Error("Invalid repository cleanup response.");
			return body;
		}
		/** Ask the Host to reconcile worktrees against the workspace registry now.
		*  Deleting a workspace only touches the registry, so this kick is what makes
		*  the worktree and its sessions go without waiting out the sweep interval. */
		async function sweepWorktrees() {
			await pluginWrite(`${CLAUDE_REPOSITORY_SETUP_PATH}/sweep`, "fast");
		}
		/** Lines [from, to] of a working-tree file plus its total line count, for expanding unmodified diff context. */
		async function loadRepositoryFileLines(cwd, path, from, to, signal) {
			const body = await pluginRead(CLAUDE_REPOSITORY_FILE_PATH, "git", signal, { query: {
				cwd,
				path,
				from: String(from),
				to: String(to)
			} });
			if (!Array.isArray(body.lines) || typeof body.total !== "number") throw new Error("Invalid repository file response.");
			return {
				lines: body.lines.map(String),
				total: body.total
			};
		}
		//#endregion
		//#region src/client/relative-age.ts
		/** Compact age of an ISO timestamp, in the shape the panels already use
		*  ("<1h", "4h", "3d", "2mo"). `now` is a parameter so callers that re-render
		*  on a clock — and tests — stay deterministic. */
		function relativeAge(value, now = Date.now()) {
			if (value === void 0) return void 0;
			const elapsedHours = Math.max(0, Math.floor((now - Date.parse(value)) / 36e5));
			if (!Number.isFinite(elapsedHours)) return void 0;
			if (elapsedHours < 1) return "<1h";
			if (elapsedHours < 24) return `${elapsedHours}h`;
			const days = Math.floor(elapsedHours / 24);
			return days < 30 ? `${days}d` : `${Math.floor(days / 30)}mo`;
		}
		//#endregion
		//#region src/client/branch-label.ts
		/** `Detached HEAD` names a git implementation detail, not the user's checkout:
		*  a stopped rebase still knows which branch it parked, and that name is what
		*  every panel should show. Only a genuinely nameless HEAD falls back. */
		function branchLabel(repository, t) {
			if (repository.branch !== void 0) return repository.branch;
			return repository.detached === true ? t("repositoryDetached") : t("repositoryUnknownBranch");
		}
		/** The short name a checkout goes by: its GitHub repository, else the
		*  directory it lives in. */
		function repositoryLabel(repository) {
			return repository.remote?.split("/").at(-1) ?? repository.root?.split(/[\\/]/u).filter((part) => part.length > 0).at(-1) ?? repository.cwd;
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
		//#region src/client/pr-feedback-api.ts
		function record$4(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
		}
		/** `root` names another checkout the session wrote into; absent, the
		*  session's own. The Host only honours roots it has vouched for. */
		function feedbackQuery(sessionId, pullNumber, root, extra) {
			return {
				sessionId,
				number: String(pullNumber),
				...root === void 0 ? {} : { root },
				...extra
			};
		}
		function answer(value) {
			const body = record$4(value);
			if (body === void 0) throw new Error("Invalid pull request feedback response.");
			return body;
		}
		/** Every arm of this route shells out to `gh`, so reads and writes alike take
		*  the remote budget. */
		async function loadJson(path, sessionId, pullNumber, signal, root, extra) {
			return answer(await pluginRead(`${CLAUDE_REPOSITORY_FEEDBACK_PATH}${path}`, "remote", signal, { query: feedbackQuery(sessionId, pullNumber, root, extra) }));
		}
		async function postJson(path, sessionId, pullNumber, input, root) {
			return answer(await pluginWrite(`${CLAUDE_REPOSITORY_FEEDBACK_PATH}${path}`, "remote", void 0, {
				query: feedbackQuery(sessionId, pullNumber, root),
				json: input
			}));
		}
		function reviewComment(value) {
			const input = record$4(value);
			if (input === void 0 || typeof input.id !== "number" || typeof input.path !== "string" || typeof input.author !== "string" || typeof input.body !== "string" || typeof input.url !== "string" || input.avatarUrl !== void 0 && githubAvatarUrl(input.avatarUrl) === void 0 || input.side !== "new" && input.side !== "old" || input.line !== void 0 && typeof input.line !== "number" || input.createdAt !== void 0 && typeof input.createdAt !== "string" || input.bot !== void 0 && typeof input.bot !== "boolean") return void 0;
			return input;
		}
		async function loadPullRequestThreads(sessionId, pullNumber, signal, root) {
			const body = await loadJson("/comments", sessionId, pullNumber, signal, root);
			if (!Array.isArray(body.threads)) throw new Error("Invalid pull request comments response.");
			const threads = [];
			for (const item of body.threads) {
				const input = record$4(item);
				if (input === void 0 || typeof input.id !== "string" || typeof input.path !== "string" || input.side !== "new" && input.side !== "old" || input.line !== void 0 && typeof input.line !== "number" || !Array.isArray(input.comments)) continue;
				const comments = input.comments.map(reviewComment).filter((value) => value !== void 0);
				if (comments.length === 0) continue;
				threads.push({
					id: input.id,
					path: input.path,
					...typeof input.line === "number" ? { line: input.line } : {},
					side: input.side,
					resolved: input.resolved === true,
					outdated: input.outdated === true,
					comments
				});
			}
			return threads;
		}
		/** Post one reply into the thread that `commentId` belongs to. */
		async function replyToReviewThread(sessionId, pullNumber, commentId, body, root) {
			const comment = reviewComment((await postJson("/reply", sessionId, pullNumber, {
				commentId,
				body
			}, root)).comment);
			if (comment === void 0) throw new Error("Invalid pull request reply response.");
			return comment;
		}
		/** Resolve or reopen a thread; returns the state GitHub reports afterwards. */
		async function setReviewThreadResolved(sessionId, pullNumber, threadId, resolved, root) {
			const answer = await postJson("/resolve", sessionId, pullNumber, {
				threadId,
				resolved
			}, root);
			if (typeof answer.resolved !== "boolean") throw new Error("Invalid pull request resolve response.");
			return answer.resolved;
		}
		/** Logins GitHub would notify, for the reply composer's `@` completion. */
		async function loadMentionableUsers(sessionId, pullNumber, query, signal, root) {
			const body = await loadJson("/mentionables", sessionId, pullNumber, signal, root, { q: query });
			if (!Array.isArray(body.users)) return [];
			const users = [];
			for (const item of body.users) {
				const input = record$4(item);
				if (input === void 0 || typeof input.login !== "string" || input.login.length === 0) continue;
				const avatarUrl = githubAvatarUrl(input.avatarUrl);
				users.push({
					login: input.login,
					...avatarUrl === void 0 ? {} : { avatarUrl }
				});
			}
			return users;
		}
		async function loadFailingChecks(sessionId, pullNumber, signal, root) {
			const body = await loadJson("/checks", sessionId, pullNumber, signal, root);
			if (!Array.isArray(body.checks)) throw new Error("Invalid pull request checks response.");
			const checks = [];
			for (const item of body.checks) {
				const input = record$4(item);
				if (input === void 0 || typeof input.name !== "string" || input.link !== void 0 && typeof input.link !== "string" || input.description !== void 0 && typeof input.description !== "string" || input.log !== void 0 && typeof input.log !== "string") continue;
				checks.push(input);
			}
			return checks;
		}
		/** Review bots sign a comment with an attribution line and an actions checklist
		*  aimed at the bot itself; in a prompt both are noise, and "apply fix" reads as
		*  an instruction Claude cannot follow. */
		function commentText(body) {
			const lines = body.replaceAll(/<!--[\s\S]*?-->/g, "").split("\n").filter((line) => !/^\s*<sup>[\s\S]*<\/sup>\s*$/.test(line));
			let end = lines.length;
			while (end > 0 && /^\s*(?:-{3,}|\*\*[^*]+\*\*|[-*] \[[ xX]\].*)?\s*$/.test(lines[end - 1] ?? "")) end -= 1;
			return (lines.slice(end).some((line) => /^\s*[-*] \[[ xX]\]/.test(line)) ? lines.slice(0, end) : lines).join("\n").trim();
		}
		/** A one-line comment sits after the author; anything longer starts on its own
		*  line, so its headings and lists keep meaning instead of running into ours. */
		function attributed(prefix, body) {
			const text = commentText(body);
			const indented = text.split("\n").map((line) => line.length === 0 ? line : `  ${line}`).join("\n");
			return text.includes("\n") ? `${prefix}\n\n${indented}` : `${prefix} ${text}`;
		}
		/** Draft handed to Claude when the user forwards GitHub review comments. A
		*  resolved thread is a settled conversation: forwarding it would ask Claude to
		*  redo work the reviewers already signed off. */
		function composeCommentsPrompt(threads) {
			const open = threads.filter((thread) => !thread.resolved);
			if (open.length === 0) return "";
			return `Please address the following GitHub pull request review comments. Make the requested changes, or explain briefly when a comment should not be applied.\n\n${open.map((thread) => {
				const [first, ...rest] = thread.comments;
				if (first === void 0) return "";
				return [attributed(`- ${`${thread.path}${thread.line === void 0 ? "" : `:${thread.line}`}`} (@${first.author}):`, first.body), ...rest.map((reply) => attributed(`  (@${reply.author}):`, reply.body))].join("\n");
			}).filter((block) => block.length > 0).join("\n\n")}`;
		}
		/** Draft handed to Claude when the user forwards failing CI checks. */
		function composeChecksPrompt(checks) {
			return `The following CI checks are failing on the current pull request. Investigate the failure logs, fix the underlying problems, and re-run the relevant commands locally when possible.\n\n${checks.map((check) => {
				return `${`## ${check.name}${check.link === void 0 ? "" : ` (${check.link})`}`}${check.description === void 0 ? "" : `\n${check.description}`}${check.log === void 0 ? "" : `\n\n\`\`\`\n${check.log}\n\`\`\``}`;
			}).join("\n\n")}`;
		}
		/** Draft handed to Claude for a stopped merge, rebase, cherry-pick or revert --
		*  from the update-branch dialog that caused one, or from the repository bar
		*  for one already in the tree, where the base branch is not always known. */
		function composeConflictsPrompt(conflicts, operation = "merge", baseBranch) {
			const list = conflicts.map((file) => `- ${file}`).join("\n");
			const base = baseBranch === void 0 ? void 0 : `origin/${baseBranch}`;
			return `${operation === "rebase" ? `Rebasing the current branch${base === void 0 ? "" : ` onto ${base}`} stopped on conflicts in the files below.` : operation === "merge" ? `Merging ${base ?? "the base branch"} into the current branch left conflicts in the files below.` : `A ${operation} stopped on conflicts in the files below.`} Resolve each conflict preserving the intent of both sides, stage the resolved files, then run \`git ${operation} --continue\` until the ${operation} finishes.${operation === "rebase" && baseBranch !== void 0 ? " Once it finishes, push with `git push --force-with-lease`." : ""}\n\n${list}`;
		}
		//#endregion
		//#region src/client/auto-fix.ts
		const AUTO_FIX_INTERVAL_MS = 3e4;
		const AUTO_FIX_FOOTER = "This request was generated automatically by the pull request watcher. After making the changes, commit and push to the pull request branch so the checks re-run.";
		const EMPTY_MEMORY = { handledCommentIds: /* @__PURE__ */ new Set() };
		const sessions = /* @__PURE__ */ new Map();
		function session(sessionId) {
			let entry = sessions.get(sessionId);
			if (entry === void 0) {
				entry = {
					enabled: false,
					memory: EMPTY_MEMORY
				};
				sessions.set(sessionId, entry);
			}
			return entry;
		}
		function autoFixEnabled(sessionId) {
			return session(sessionId).enabled;
		}
		function setAutoFixEnabled(sessionId, enabled) {
			session(sessionId).enabled = enabled;
		}
		function autoFixMemory(sessionId) {
			return session(sessionId).memory;
		}
		function rememberAutoFix(sessionId, memory) {
			session(sessionId).memory = memory;
		}
		/** One failing CI run yields one fix attempt: run links change when CI re-runs. */
		function checksSignature(checks) {
			if (checks.length === 0) return void 0;
			return checks.map((check) => `${check.name}|${check.link ?? ""}`).sort().join("\n");
		}
		function planAutoFix(memory, threads, checks) {
			const unhandled = threads.filter((thread) => !thread.resolved).filter((thread) => thread.comments.some((comment) => !memory.handledCommentIds.has(comment.id)));
			const fresh = unhandled.flatMap((thread) => thread.comments);
			const signature = checksSignature(checks);
			const checksChanged = signature !== void 0 && signature !== memory.handledChecksSignature;
			const sections = [];
			if (unhandled.length > 0) sections.push(composeCommentsPrompt(unhandled));
			if (checksChanged) sections.push(composeChecksPrompt(checks));
			if (sections.length === 0) return { memory };
			const nextSignature = checksChanged ? signature : memory.handledChecksSignature;
			return {
				prompt: `${sections.join("\n\n")}\n\n${AUTO_FIX_FOOTER}`,
				memory: {
					handledCommentIds: /* @__PURE__ */ new Set([...memory.handledCommentIds, ...fresh.map((comment) => comment.id)]),
					...nextSignature === void 0 ? {} : { handledChecksSignature: nextSignature }
				}
			};
		}
		//#endregion
		//#region src/client/boot-check.ts
		/** Boot-time assertions against the running Host.
		*
		*  The Desktop build ships no type declarations and several of its client
		*  packages are unpublished, so `tsc` validates this plugin against whatever
		*  @deepseek-ai/* versions happen to be installed — never against the Host it
		*  will actually run inside. Every Desktop 2.0 breakage found so far was
		*  invisible at compile time AND at runtime: a missing service leaves its
		*  guarded registration silently unregistered, and a renamed custom property
		*  just freezes a style on its fallback. These checks make that drift say so. */
		/** Host-owned custom properties the styles read, and where each is scoped.
		*
		*  `var(--x, fallback)` cannot distinguish "the Host stopped publishing this"
		*  from "the Host says this", so anything listed here needs an explicit probe.
		*  The Host scopes these to a subtree rather than `:root` — custom properties
		*  inherit, so only an element inside that subtree can see one, and probing
		*  document.documentElement reports every one of them missing. Each entry
		*  therefore names the mounted element that must be measured instead.
		*
		*  Plugin-owned properties (--dsh-claude-*) are set by this package and are
		*  deliberately absent from this list. */
		const CLAUDE_SCOPED_CSS_VARIABLES = ["--dsh-composer-card-max-width"];
		/** Marks the bar the scoped-property probe measures. */
		const CLAUDE_COMPOSER_BAR_ATTRIBUTE = "data-dsh-claude-composer-bar";
		/** Methods this plugin calls on the Host services it injects.
		*
		*  A service that still resolves but has lost a method is the drift the
		*  service list above cannot see: Desktop 0.1.2 moved `connectWorkspace` off
		*  `workspaces` onto a new service, and the worktree flow went on registering
		*  itself and only broke once a user ran it. Naming the methods here turns
		*  that into a boot-time line. Methods with a runtime fallback stay out. */
		const CLAUDE_REQUIRED_SERVICE_METHODS = {
			sessions: ["scope", "binding"],
			workspaces: [
				"create",
				"delete",
				"archiveSession"
			],
			uiWorkspace: ["connectWorkspace", "openSession"],
			uiConversation: ["binding"],
			uiSession: ["provide"],
			inputTriggers: ["registerSource"],
			sidebarRight: [
				"openTabIn",
				"closeIn",
				"toggleExpanded",
				"openResourceIn"
			],
			sidebarRightTabs: ["register"]
		};
		/** One line per service the Host no longer provides, or provides without a
		*  method this plugin calls on it; empty when everything resolves. */
		function claudeBootCheckFindings(input, methods = CLAUDE_REQUIRED_SERVICE_METHODS) {
			const findings = [];
			for (const name of input.services) {
				const service = input.resolve(name);
				if (service === void 0) {
					findings.push(`service "${name}" is not provided by the Host`);
					continue;
				}
				for (const method of methods[name] ?? []) if (typeof service[method] !== "function") findings.push(`service "${name}" no longer provides ${method}(); the features calling it are broken`);
			}
			return findings;
		}
		/** One line per scoped custom property the measured element cannot see.
		*
		*  @param read - computed value of one property ON THE MOUNTED BAR, not on the
		*  document root: these properties are published to a subtree, so reading them
		*  anywhere above it returns '' whether or not the Host still defines them. */
		function claudeScopedCssFindings(read, names = CLAUDE_SCOPED_CSS_VARIABLES) {
			const findings = [];
			for (const name of names) if (read(name).trim() === "") findings.push(`CSS custom property "${name}" is not visible to the composer bar; styles reading it are stuck on their fallback`);
			return findings;
		}
		//#endregion
		//#region src/client/ClaudeRepositoryStatus.tsx
		/** Icon-only status: the tone carries the state, the full label lives in the tooltip and accessible name. */
		function StatusGlyph({ label, tone, children }) {
			const toneStyle = tone === "success" ? repositoryItemSuccess : tone === "warning" ? repositoryItemWarning : tone === "error" ? repositoryItemError : {};
			return /* @__PURE__ */ jsx(Tooltip, {
				label,
				side: "top",
				delayMs: 250,
				children: /* @__PURE__ */ jsx("span", {
					role: "img",
					"aria-label": label,
					style: {
						...repositoryGlyph,
						...toneStyle
					},
					children
				})
			});
		}
		function ChecksGlyph({ state }) {
			return /* @__PURE__ */ jsxs("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 14 14",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ jsx("circle", {
					cx: "7",
					cy: "7",
					r: "5.5"
				}), state === "passing" ? /* @__PURE__ */ jsx("path", { d: "M4.5 7.2l1.8 1.8 3.2-3.6" }) : state === "failing" ? /* @__PURE__ */ jsx("path", { d: "M5 5l4 4M9 5l-4 4" }) : /* @__PURE__ */ jsx("path", {
					d: "M4.6 7h.01M7 7h.01M9.4 7h.01",
					strokeWidth: "2"
				})]
			});
		}
		function ReviewGlyph() {
			return /* @__PURE__ */ jsxs("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 14 14",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ jsx("path", { d: "M1.5 7s2-3.5 5.5-3.5S12.5 7 12.5 7s-2 3.5-5.5 3.5S1.5 7 1.5 7Z" }), /* @__PURE__ */ jsx("circle", {
					cx: "7",
					cy: "7",
					r: "1.8"
				})]
			});
		}
		function PullRequestIcon({ size = 16, merged = false }) {
			if (merged) return /* @__PURE__ */ jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ jsx("circle", {
						cx: "4",
						cy: "3",
						r: "1.6"
					}),
					/* @__PURE__ */ jsx("circle", {
						cx: "4",
						cy: "13",
						r: "1.6"
					}),
					/* @__PURE__ */ jsx("circle", {
						cx: "12",
						cy: "8",
						r: "1.6"
					}),
					/* @__PURE__ */ jsx("path", { d: "M4 4.6v6.8" }),
					/* @__PURE__ */ jsx("path", { d: "M5.6 3H7a5 5 0 0 1 5 3.4" })
				]
			});
			return /* @__PURE__ */ jsxs("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ jsx("circle", {
						cx: "4",
						cy: "3",
						r: "1.6"
					}),
					/* @__PURE__ */ jsx("circle", {
						cx: "4",
						cy: "13",
						r: "1.6"
					}),
					/* @__PURE__ */ jsx("circle", {
						cx: "12",
						cy: "13",
						r: "1.6"
					}),
					/* @__PURE__ */ jsx("path", { d: "M4 4.6v6.8" }),
					/* @__PURE__ */ jsx("path", { d: "M7.5 3H9a3 3 0 0 1 3 3v5.4" })
				]
			});
		}
		function repositoryName(remote) {
			return remote?.split("/").at(-1);
		}
		function PullRequestHoverCard({ repository, t }) {
			const pullRequest = repository.pullRequest;
			if (pullRequest === void 0) return null;
			const merged = pullRequest.state === "merged";
			const age = relativeAge(merged ? pullRequest.mergedAt : pullRequest.createdAt);
			return /* @__PURE__ */ jsxs("span", {
				role: "tooltip",
				style: repositoryPrHoverCard,
				children: [
					/* @__PURE__ */ jsxs("span", {
						style: repositoryPrHoverTop,
						children: [
							/* @__PURE__ */ jsxs("span", {
								style: {
									...repositoryPrStateBadge,
									...merged ? repositoryPrStateBadgeMerged : {}
								},
								children: [/* @__PURE__ */ jsx(PullRequestIcon, {
									size: 13,
									merged
								}), t(`repositoryState_${pullRequest.state}`)]
							}),
							/* @__PURE__ */ jsxs("span", {
								style: repositoryPrHoverRepo,
								children: [
									repositoryName(repository.remote),
									" #",
									pullRequest.number,
									pullRequest.baseBranch === void 0 ? "" : ` → ${pullRequest.baseBranch}`
								]
							}),
							age === void 0 ? null : /* @__PURE__ */ jsx("span", {
								style: repositoryPrHoverAge,
								children: age
							})
						]
					}),
					/* @__PURE__ */ jsx("a", {
						href: pullRequest.url,
						target: "_blank",
						rel: "noopener noreferrer",
						style: repositoryPrHoverTitle,
						children: pullRequest.title
					}),
					/* @__PURE__ */ jsxs("span", {
						style: repositoryPrHoverBottom,
						children: [pullRequest.author === void 0 ? /* @__PURE__ */ jsx("span", {}) : /* @__PURE__ */ jsxs("span", {
							style: repositoryPrAuthor,
							children: [/* @__PURE__ */ jsx("span", {
								style: repositoryPrAvatar,
								children: pullRequest.author.slice(0, 1).toUpperCase()
							}), pullRequest.author]
						}), /* @__PURE__ */ jsxs("span", {
							style: repositoryPrHoverStats,
							children: [/* @__PURE__ */ jsxs("span", { children: [
								/* @__PURE__ */ jsxs("span", {
									style: diffAdd,
									children: ["+", repository.diff?.additions ?? 0]
								}),
								" ",
								/* @__PURE__ */ jsxs("span", {
									style: diffDelete,
									children: ["−", repository.diff?.deletions ?? 0]
								})
							] }), /* @__PURE__ */ jsx("span", {
								style: repositoryPrFiles,
								children: t("diffFilesShort", { count: repository.diff?.files ?? 0 })
							})]
						})]
					})
				]
			});
		}
		function PullRequestLink({ repository, t }) {
			const [hovered, setHovered] = useState(false);
			const closeTimer = useRef();
			const pullRequest = repository.pullRequest;
			const open = () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				closeTimer.current = void 0;
				setHovered(true);
			};
			const scheduleClose = () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				closeTimer.current = setTimeout(() => {
					closeTimer.current = void 0;
					setHovered(false);
				}, 350);
			};
			useEffect(() => () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
			}, []);
			if (pullRequest === void 0) return null;
			return /* @__PURE__ */ jsxs("span", {
				style: repositoryPrLinkFrame,
				onMouseEnter: open,
				onMouseLeave: scheduleClose,
				onFocus: open,
				onBlur: (event) => {
					if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
				},
				children: [hovered ? /* @__PURE__ */ jsx("span", {
					onMouseEnter: open,
					onMouseLeave: scheduleClose,
					children: /* @__PURE__ */ jsx(PullRequestHoverCard, {
						repository,
						t
					})
				}) : null, /* @__PURE__ */ jsxs("a", {
					href: pullRequest.url,
					target: "_blank",
					rel: "noopener noreferrer",
					style: {
						...repositoryPrLink,
						...pullRequest.state === "merged" ? repositoryPrLinkMerged : {}
					},
					"aria-label": t("repositoryOpenPr", { number: pullRequest.number }),
					children: ["#", pullRequest.number]
				})]
			});
		}
		/** Watches an open pull request and hands new review comments and failing
		*  CI runs to Claude automatically until the user switches it off. */
		/** A prompt about a linked checkout says which one, so Claude does not
		*  apply it to the session's own. */
		function linkedPreamble(repository, root, t) {
			return root === void 0 ? "" : `${t("linkedRepositoryPrompt", {
				root,
				branch: repository.branch ?? ""
			})}\n\n`;
		}
		function AutoFixControl({ sessionId, repository, root, running, t, submitPrompt }) {
			const pullRequest = repository.pullRequest;
			const open = pullRequest?.state === "open";
			const number = pullRequest?.number;
			const checks = pullRequest?.checks;
			const scope = root === void 0 ? sessionId : `${sessionId}#${root}`;
			const [enabled, setEnabled] = useState(() => autoFixEnabled(scope));
			useEffect(() => {
				setEnabled(autoFixEnabled(scope));
			}, [scope]);
			useEffect(() => {
				if (!enabled || !open || running || number === void 0 || submitPrompt === void 0) return;
				let cancelled = false;
				const tick = async () => {
					const [comments, failing] = await Promise.all([loadPullRequestThreads(sessionId, number, void 0, root).catch(() => []), checks === "failing" ? loadFailingChecks(sessionId, number, void 0, root).catch(() => []) : Promise.resolve([])]);
					if (cancelled) return;
					const plan = planAutoFix(autoFixMemory(scope), comments, failing);
					if (plan.prompt !== void 0 && submitPrompt(`${linkedPreamble(repository, root, t)}${plan.prompt}`, "idle")) rememberAutoFix(scope, plan.memory);
				};
				tick();
				const timer = setInterval(() => {
					tick();
				}, AUTO_FIX_INTERVAL_MS);
				return () => {
					cancelled = true;
					clearInterval(timer);
				};
			}, [
				checks,
				enabled,
				number,
				open,
				repository,
				root,
				running,
				scope,
				sessionId,
				submitPrompt,
				t
			]);
			if (!open || submitPrompt === void 0) return null;
			const toggle = () => {
				const next = !enabled;
				setEnabled(next);
				setAutoFixEnabled(scope, next);
			};
			return /* @__PURE__ */ jsx(Tooltip, {
				label: `${t("autoFixLabel")} · ${t("autoFixTitle")}`,
				side: "top",
				delayMs: 250,
				maxWidth: 320,
				children: /* @__PURE__ */ jsx("button", {
					type: "button",
					role: "switch",
					className: repositoryAutoFixClass,
					"aria-checked": enabled,
					"aria-label": t("autoFixLabel"),
					onClick: (event) => {
						toggle();
						event.currentTarget.blur();
					},
					children: /* @__PURE__ */ jsxs("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 16 16",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.6",
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": "true",
						children: [/* @__PURE__ */ jsx("path", { d: "M13.3 6.5A5.5 5.5 0 0 0 3.6 4.6M2.7 9.5a5.5 5.5 0 0 0 9.7 1.9" }), /* @__PURE__ */ jsx("path", { d: "M13.5 2.8v3.7H9.8M2.5 13.2V9.5h3.7" })]
					})
				})
			});
		}
		function FailingChecksControl({ sessionId, repository, root, t, submitPrompt }) {
			const pullNumber = repository.pullRequest.number;
			const [open, setOpen] = useState(false);
			const [loading, setLoading] = useState(false);
			const [checks, setChecks] = useState([]);
			const [error, setError] = useState();
			const frameRef = useRef(null);
			const controller = useRef();
			useEffect(() => () => controller.current?.abort(), []);
			useEffect(() => {
				if (!open) return;
				const closeOnOutsidePointer = (event) => {
					if (event.target instanceof Node && frameRef.current?.contains(event.target) !== true) setOpen(false);
				};
				document.addEventListener("pointerdown", closeOnOutsidePointer);
				return () => {
					document.removeEventListener("pointerdown", closeOnOutsidePointer);
				};
			}, [open]);
			const toggle = () => {
				const next = !open;
				setOpen(next);
				if (!next) return;
				controller.current?.abort();
				const aborter = new AbortController();
				controller.current = aborter;
				setLoading(true);
				setError(void 0);
				loadFailingChecks(sessionId, pullNumber, aborter.signal, root).then((value) => {
					setChecks(value);
					setLoading(false);
				}, (reason) => {
					if (aborter.signal.aborted) return;
					setError(reason instanceof Error ? reason.message : t("diffActionFailed"));
					setLoading(false);
				});
			};
			return /* @__PURE__ */ jsxs("span", {
				ref: frameRef,
				style: repositoryChecksFrame,
				children: [/* @__PURE__ */ jsx("button", {
					type: "button",
					style: repositoryChecksTrigger,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					"aria-label": t("repositoryChecksOpen"),
					onClick: toggle,
					children: /* @__PURE__ */ jsx(StatusGlyph, {
						label: t("repositoryChecks_failing"),
						tone: "error",
						children: /* @__PURE__ */ jsx(ChecksGlyph, { state: "failing" })
					})
				}), open ? /* @__PURE__ */ jsxs("span", {
					role: "dialog",
					"aria-label": t("checksCardTitle"),
					style: repositoryChecksCard,
					children: [
						/* @__PURE__ */ jsx("strong", {
							style: repositoryChecksTitle,
							children: t("checksCardTitle")
						}),
						loading ? /* @__PURE__ */ jsx("span", {
							style: repositoryChecksHint,
							children: t("checksCardLoading")
						}) : null,
						error === void 0 ? null : /* @__PURE__ */ jsx("span", {
							role: "alert",
							style: repositoryChecksError,
							children: error
						}),
						checks.map((check) => /* @__PURE__ */ jsxs("span", {
							style: repositoryChecksItem,
							children: [check.link === void 0 ? /* @__PURE__ */ jsx("span", {
								style: repositoryChecksName,
								children: check.name
							}) : /* @__PURE__ */ jsx("a", {
								href: check.link,
								target: "_blank",
								rel: "noopener noreferrer",
								style: repositoryChecksName,
								children: check.name
							}), check.description === void 0 ? null : /* @__PURE__ */ jsx("span", {
								style: repositoryChecksDesc,
								children: check.description
							})]
						}, check.name)),
						!loading && error === void 0 && checks.length === 0 ? /* @__PURE__ */ jsx("span", {
							style: repositoryChecksHint,
							children: t("checksCardEmpty")
						}) : null,
						submitPrompt !== void 0 && checks.length > 0 ? /* @__PURE__ */ jsx("button", {
							type: "button",
							style: repositoryChecksFix,
							onClick: () => {
								submitPrompt(`${linkedPreamble(repository, root, t)}${composeChecksPrompt(checks)}`);
								setOpen(false);
							},
							children: t("checksCardFix")
						}) : null
					]
				}) : null]
			});
		}
		/** The way out of a stopped merge or rebase. A rebase detaches HEAD, which
		*  hides every other control on this bar, and the update-branch dialog that
		*  started it takes its conflict list along when it closes -- so this one is
		*  mounted from repository state instead, and survives being dismissed. */
		function ConflictControl({ sessionId, repository, root, t, report, submitPrompt }) {
			const [dialog, setDialog] = useState();
			const operation = repository.operation;
			if (operation === void 0) return null;
			const conflicts = repository.conflicts ?? [];
			const operationName = t(`conflictOperation_${operation}`);
			const closeDialog = () => {
				if (dialog?.submitting !== true) setDialog(void 0);
			};
			const run = (action) => {
				if (dialog === void 0 || dialog.submitting) return;
				const { error: _error, ...pending } = dialog;
				setDialog({
					...pending,
					submitting: true
				});
				executeRepositoryAction(sessionId, {
					action,
					fingerprint: "",
					message: "",
					includeUnstaged: false,
					push: dialog.push
				}, root).then((result) => {
					if (result.conflicts !== void 0 && result.conflicts.length > 0) {
						setDialog({
							...pending,
							submitting: false,
							confirmAbort: false
						});
						return;
					}
					report(action === "resolve-abort" ? t("conflictAborted", { operation: operationName }) : t(result.pushed ? "conflictPushed" : "conflictContinued", { operation: operationName }));
					setDialog(void 0);
				}, (reason) => {
					setDialog({
						...pending,
						submitting: false,
						error: reason instanceof Error ? reason.message : t("diffActionFailed")
					});
				});
			};
			const openDialog = () => {
				setDialog({
					submitting: false,
					confirmAbort: false,
					push: repository.remote !== void 0 && repository.pullRequest?.state === "open"
				});
			};
			return /* @__PURE__ */ jsxs(Fragment$1, { children: [
				/* @__PURE__ */ jsx("button", {
					type: "button",
					style: repositoryConflictTrigger,
					title: t("conflictDescription", { operation: operationName }),
					onClick: openDialog,
					children: conflicts.length > 0 ? t("conflictBadge", {
						operation: operationName,
						count: conflicts.length
					}) : t("conflictBadgeReady", { operation: operationName })
				}),
				dialog === void 0 ? null : /* @__PURE__ */ jsx("style", {
					"data-dsh-claude-repository-modal-styles": true,
					children: diffModalCss
				}),
				/* @__PURE__ */ jsx(Modal, {
					className: "dshClaudeRepositoryActionModal dshClaudeUtilityDialog",
					contentClassName: "dshClaudeRepositoryActionModalContent dshClaudeUtilityContent",
					open: dialog !== void 0,
					onClose: closeDialog,
					title: t("conflictTitle"),
					closeLabel: t("diffCancel"),
					description: t("conflictDescription", { operation: operationName }),
					footer: /* @__PURE__ */ jsxs("div", {
						style: diffModalFooter,
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...button,
								...diffModalButton
							},
							disabled: dialog?.submitting === true,
							onClick: () => {
								if (dialog?.confirmAbort === true) run("resolve-abort");
								else setDialog((current) => current === void 0 ? current : {
									...current,
									confirmAbort: true
								});
							},
							children: t("conflictAbort", { operation: operationName })
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...primaryButton,
								...diffModalButton
							},
							disabled: dialog?.submitting === true || conflicts.length > 0,
							onClick: () => run("resolve-continue"),
							children: dialog?.submitting === true ? t("diffSubmitting") : t("conflictContinue", { operation: operationName })
						})]
					}),
					children: dialog === void 0 ? null : /* @__PURE__ */ jsxs("div", {
						style: diffModalBody,
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "dshClaudeUtilitySummary",
								style: diffModalMeta,
								children: [/* @__PURE__ */ jsxs("strong", {
									style: diffModalMetaText,
									children: [
										operationName,
										" · ",
										branchLabel(repository, t)
									]
								}), /* @__PURE__ */ jsx("span", {
									style: diffModalFileState,
									children: conflicts.length > 0 ? t("conflictFiles") : t("conflictReady")
								})]
							}),
							conflicts.length === 0 ? null : /* @__PURE__ */ jsx("ul", {
								style: diffModalConflicts,
								children: conflicts.map((file) => /* @__PURE__ */ jsx("li", { children: file }, file))
							}),
							conflicts.length === 0 || submitPrompt === void 0 ? null : /* @__PURE__ */ jsx("button", {
								type: "button",
								style: diffModalConflictResolve,
								onClick: () => {
									submitPrompt(`${linkedPreamble(repository, root, t)}${composeConflictsPrompt(conflicts, operation, repository.pullRequest?.baseBranch)}`);
									closeDialog();
								},
								children: t("conflictResolve")
							}),
							repository.remote === void 0 ? null : /* @__PURE__ */ jsxs("label", {
								className: "dshClaudeUtilityOption",
								style: diffModalCheckbox,
								children: [/* @__PURE__ */ jsx("input", {
									type: "checkbox",
									checked: dialog.push,
									disabled: dialog.submitting,
									onChange: (event) => {
										const { checked } = event.currentTarget;
										setDialog((current) => current === void 0 ? current : {
											...current,
											push: checked
										});
									}
								}), t("conflictPush")]
							}),
							!dialog.confirmAbort ? null : /* @__PURE__ */ jsx("p", {
								role: "alert",
								style: diffModalStatus,
								children: t("conflictAbortConfirm", { operation: operationName })
							}),
							dialog.error === void 0 ? null : /* @__PURE__ */ jsx("p", {
								role: "alert",
								style: diffModalError,
								children: dialog.error
							})
						]
					})
				})
			] });
		}
		/** The trigger only shows on a clean branch that is behind its base -- but a
		*  conflicted rebase leaves the tree dirty on a detached HEAD, so an open
		*  dialog (and its resolve button) has to outlive that. */
		function updateBranchMounted(repository, dialogOpen) {
			const pullRequest = repository.pullRequest;
			if (pullRequest?.baseBranch === void 0) return false;
			return dialogOpen || pullRequest.state === "open" && repository.detached !== true && repository.dirty !== true && (repository.baseBehind ?? 0) > 0;
		}
		function UpdateBranchControl({ sessionId, repository, root, t, report, submitPrompt }) {
			const [dialog, setDialog] = useState();
			const [method, setMethod] = useState("rebase");
			const controller = useRef();
			const pullRequest = repository.pullRequest;
			const base = pullRequest?.baseBranch;
			const behind = repository.baseBehind ?? 0;
			useEffect(() => () => controller.current?.abort(), []);
			if (pullRequest === void 0 || base === void 0) return null;
			if (!updateBranchMounted(repository, dialog !== void 0)) return null;
			const openDialog = () => {
				controller.current?.abort();
				setDialog({
					loading: true,
					submitting: false
				});
				const aborter = new AbortController();
				controller.current = aborter;
				loadRepositoryActionPreview(sessionId, aborter.signal, root).then((preview) => {
					setDialog({
						loading: false,
						submitting: false,
						fingerprint: preview.fingerprint
					});
				}, (reason) => {
					if (!aborter.signal.aborted) setDialog({
						loading: false,
						submitting: false,
						error: reason instanceof Error ? reason.message : t("diffActionFailed")
					});
				});
			};
			const closeDialog = () => {
				if (dialog?.submitting === true) return;
				controller.current?.abort();
				controller.current = void 0;
				setDialog(void 0);
			};
			const confirmUpdate = () => {
				if (dialog?.fingerprint === void 0 || dialog.submitting) return;
				const { error: _error, ...pending } = dialog;
				setDialog({
					...pending,
					submitting: true
				});
				executeRepositoryAction(sessionId, {
					action: "update-branch",
					fingerprint: dialog.fingerprint,
					message: "",
					includeUnstaged: false,
					baseBranch: base,
					mergeMethod: method
				}, root).then((result) => {
					if (result.conflicts !== void 0 && result.conflicts.length > 0) {
						setDialog({
							...pending,
							submitting: false,
							conflicts: result.conflicts
						});
						return;
					}
					report(t("diffUpdateBranchCompleted", { commit: result.commit.slice(0, 8) }));
					setDialog(void 0);
				}, (reason) => {
					setDialog({
						...pending,
						submitting: false,
						error: reason instanceof Error ? reason.message : t("diffActionFailed")
					});
				});
			};
			const settled = dialog?.conflicts !== void 0;
			return /* @__PURE__ */ jsxs(Fragment$1, { children: [
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					style: repositoryUpdateTrigger,
					"aria-label": t("repositoryUpdateBranch"),
					title: `${t("diffUpdateBranchBehind", {
						base,
						count: behind
					})} · ${t("repositoryUpdateBranch")}`,
					onClick: openDialog,
					children: ["↓", behind]
				}),
				dialog === void 0 ? null : /* @__PURE__ */ jsx("style", {
					"data-dsh-claude-repository-modal-styles": true,
					children: diffModalCss
				}),
				/* @__PURE__ */ jsx(Modal, {
					className: "dshClaudeRepositoryActionModal dshClaudeUtilityDialog",
					contentClassName: "dshClaudeRepositoryActionModalContent dshClaudeUtilityContent",
					open: dialog !== void 0,
					onClose: closeDialog,
					title: t("repositoryUpdateBranch"),
					closeLabel: t("diffCancel"),
					description: t("diffUpdateBranchDescription", { base }),
					footer: /* @__PURE__ */ jsxs("div", {
						style: diffModalFooter,
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...button,
								...diffModalButton
							},
							disabled: dialog?.submitting === true,
							onClick: closeDialog,
							children: settled ? t("diffDone") : t("diffCancel")
						}), !settled ? /* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...primaryButton,
								...diffModalButton
							},
							disabled: dialog?.loading === true || dialog?.submitting === true || dialog?.fingerprint === void 0,
							onClick: confirmUpdate,
							children: dialog?.submitting === true ? t("diffSubmitting") : t("diffConfirm")
						}) : null]
					}),
					children: dialog === void 0 ? null : /* @__PURE__ */ jsxs("div", {
						style: diffModalBody,
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "dshClaudeUtilitySummary",
								style: diffModalMeta,
								children: [/* @__PURE__ */ jsxs("strong", {
									style: diffModalMetaText,
									title: pullRequest.title,
									children: [
										repository.branch ?? t("repositoryUnknownBranch"),
										" ← origin/",
										base
									]
								}), /* @__PURE__ */ jsx("span", {
									style: diffModalFileState,
									children: t("diffUpdateBranchBehind", {
										base,
										count: behind
									})
								})]
							}),
							["rebase", "merge"].map((option) => /* @__PURE__ */ jsxs("label", {
								className: "dshClaudeUtilityOption",
								style: diffModalCheckbox,
								children: [/* @__PURE__ */ jsx("input", {
									type: "radio",
									name: "dsh-claude-update-branch-method",
									value: option,
									checked: method === option,
									disabled: settled || dialog.submitting,
									onChange: () => setMethod(option)
								}), t(`diffUpdateBranch_${option}`, { base })]
							}, option)),
							dialog.conflicts === void 0 ? null : /* @__PURE__ */ jsxs(Fragment$1, { children: [
								/* @__PURE__ */ jsx("p", {
									style: diffModalStatus,
									children: t("diffUpdateBranchConflicts")
								}),
								/* @__PURE__ */ jsx("ul", {
									style: diffModalConflicts,
									children: dialog.conflicts.map((file) => /* @__PURE__ */ jsx("li", { children: file }, file))
								}),
								submitPrompt === void 0 ? null : /* @__PURE__ */ jsx("button", {
									type: "button",
									style: diffModalConflictResolve,
									onClick: () => {
										submitPrompt(`${linkedPreamble(repository, root, t)}${composeConflictsPrompt(dialog.conflicts ?? [], method, base)}`);
										closeDialog();
									},
									children: t("diffUpdateBranchResolve")
								})
							] }),
							dialog.error === void 0 ? null : /* @__PURE__ */ jsx("p", {
								role: "alert",
								style: diffModalError,
								children: dialog.error
							})
						]
					})
				})
			] });
		}
		/** After a merge: remove the worktree (or switch a plain checkout back to
		*  base), delete the merged branch, and drop the DSH workspace along with the
		*  sessions it held. */
		function CleanupControl({ repository, t, report, deleteWorkspace }) {
			const [dialog, setDialog] = useState();
			const pullRequest = repository.pullRequest;
			const base = pullRequest?.baseBranch;
			const merged = pullRequest?.state === "merged" && base !== void 0;
			const unmerged = pullRequest === void 0 && repository.worktree === true && repository.dirty !== true;
			if (!merged && !unmerged || repository.root === void 0 || repository.detached === true) return null;
			const root = repository.root;
			const closeDialog = () => {
				if (dialog?.submitting !== true) setDialog(void 0);
			};
			const confirm = () => {
				setDialog({ submitting: true });
				const named = repository.pullRequestOnly === true || unmerged ? repository.branch : void 0;
				cleanupMergedRepository(root, base, named, unmerged).then(async (result) => {
					report(t("cleanupCompleted", { branch: result.branch }));
					setDialog(void 0);
					if (result.mode === "worktree" && deleteWorkspace !== void 0) await deleteWorkspace();
				}, (reason) => {
					setDialog({
						submitting: false,
						error: reason instanceof Error ? reason.message : t("diffActionFailed")
					});
				});
			};
			return /* @__PURE__ */ jsxs(Fragment$1, { children: [
				/* @__PURE__ */ jsx("button", {
					type: "button",
					style: repositoryUpdateTrigger,
					title: t("cleanupTitle"),
					onClick: () => {
						setDialog({ submitting: false });
					},
					children: t("cleanupButton")
				}),
				dialog === void 0 ? null : /* @__PURE__ */ jsx("style", {
					"data-dsh-claude-repository-modal-styles": true,
					children: diffModalCss
				}),
				/* @__PURE__ */ jsx(Modal, {
					className: "dshClaudeRepositoryActionModal dshClaudeUtilityDialog",
					contentClassName: "dshClaudeRepositoryActionModalContent dshClaudeUtilityContent",
					open: dialog !== void 0,
					onClose: closeDialog,
					title: t("cleanupTitle"),
					closeLabel: t("diffCancel"),
					description: t(unmerged ? "cleanupDescriptionUnmerged" : "cleanupDescription"),
					footer: /* @__PURE__ */ jsxs("div", {
						style: diffModalFooter,
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...button,
								...diffModalButton
							},
							disabled: dialog?.submitting === true,
							onClick: closeDialog,
							children: t("diffCancel")
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...primaryButton,
								...diffModalButton
							},
							disabled: dialog?.submitting === true,
							onClick: confirm,
							children: dialog?.submitting === true ? t("diffSubmitting") : t("diffConfirm")
						})]
					}),
					children: dialog === void 0 ? null : /* @__PURE__ */ jsxs("div", {
						style: diffModalBody,
						children: [/* @__PURE__ */ jsxs("div", {
							className: "dshClaudeUtilitySummary",
							style: diffModalMeta,
							children: [/* @__PURE__ */ jsxs("strong", {
								style: diffModalMetaText,
								children: [repository.branch ?? t("repositoryUnknownBranch"), base === void 0 ? "" : ` → ${base}`]
							}), /* @__PURE__ */ jsx("span", {
								style: diffModalFileState,
								children: repository.worktree === true ? t("repositoryWorktree") : t("repositoryLocal")
							})]
						}), dialog.error === void 0 ? null : /* @__PURE__ */ jsx("p", {
							role: "alert",
							style: diffModalError,
							children: dialog.error
						})]
					})
				})
			] });
		}
		const MERGE_METHODS = [
			"merge",
			"squash",
			"rebase"
		];
		function MergePullRequestControl({ sessionId, repository, root, t, report }) {
			const [menuOpen, setMenuOpen] = useState(false);
			const [dialog, setDialog] = useState();
			const controller = useRef();
			const pullRequest = repository.pullRequest;
			useEffect(() => () => controller.current?.abort(), []);
			if (pullRequest === void 0 || pullRequest.state !== "open" || pullRequest.draft || repository.detached === true) return null;
			const openMerge = (method) => {
				controller.current?.abort();
				setMenuOpen(false);
				setDialog({
					method,
					admin: false,
					loading: true,
					submitting: false
				});
				const aborter = new AbortController();
				controller.current = aborter;
				loadRepositoryActionPreview(sessionId, aborter.signal, root).then((preview) => {
					setDialog((current) => ({
						method,
						admin: current?.admin ?? false,
						loading: false,
						submitting: false,
						fingerprint: preview.fingerprint
					}));
				}, (error) => {
					if (!aborter.signal.aborted) setDialog((current) => ({
						method,
						admin: current?.admin ?? false,
						loading: false,
						submitting: false,
						error: error instanceof Error ? error.message : t("diffActionFailed")
					}));
				});
			};
			const closeDialog = () => {
				if (dialog?.submitting === true) return;
				controller.current?.abort();
				controller.current = void 0;
				setDialog(void 0);
			};
			const confirmMerge = () => {
				if (dialog?.fingerprint === void 0 || dialog.submitting) return;
				const { error: _error, ...pending } = dialog;
				setDialog({
					...pending,
					submitting: true
				});
				executeRepositoryAction(sessionId, {
					action: "merge-pr",
					fingerprint: dialog.fingerprint,
					message: "",
					includeUnstaged: false,
					mergeMethod: dialog.method,
					...dialog.admin ? { admin: true } : {},
					...root === void 0 ? {} : { pullNumber: pullRequest.number }
				}, root).then(() => {
					report(t("diffMergeCompleted", { number: pullRequest.number }));
					setDialog(void 0);
				}, (error) => {
					setDialog({
						...pending,
						submitting: false,
						error: error instanceof Error ? error.message : t("diffActionFailed")
					});
				});
			};
			return /* @__PURE__ */ jsxs(Fragment$1, { children: [
				/* @__PURE__ */ jsx(Menu, {
					open: menuOpen,
					items: MERGE_METHODS.map((method) => ({
						id: method,
						label: t(`diffMerge_${method}`)
					})),
					onSelect: (id) => openMerge(id),
					onClose: () => setMenuOpen(false),
					align: "end",
					portal: true,
					anchor: /* @__PURE__ */ jsxs("button", {
						type: "button",
						style: repositoryMergeTrigger,
						"aria-label": t("repositoryMergeMenu"),
						"aria-haspopup": "menu",
						"aria-expanded": menuOpen,
						onClick: () => setMenuOpen((value) => !value),
						children: [t("diffMergePr"), /* @__PURE__ */ jsx(IconChevronDownOutlineRegular, {})]
					})
				}),
				dialog === void 0 ? null : /* @__PURE__ */ jsx("style", {
					"data-dsh-claude-repository-modal-styles": true,
					children: diffModalCss
				}),
				/* @__PURE__ */ jsx(Modal, {
					className: "dshClaudeRepositoryActionModal dshClaudeUtilityDialog",
					contentClassName: "dshClaudeRepositoryActionModalContent dshClaudeUtilityContent",
					open: dialog !== void 0,
					onClose: closeDialog,
					title: t("diffMergePr"),
					closeLabel: t("diffCancel"),
					description: t("diffMergeDescription"),
					footer: /* @__PURE__ */ jsxs("div", {
						style: diffModalFooter,
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...button,
								...diffModalButton
							},
							disabled: dialog?.submitting === true,
							onClick: closeDialog,
							children: t("diffCancel")
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...primaryButton,
								...diffModalButton
							},
							disabled: dialog?.loading === true || dialog?.submitting === true || dialog?.fingerprint === void 0,
							onClick: confirmMerge,
							children: dialog?.submitting === true ? t("diffSubmitting") : t("diffConfirm")
						})]
					}),
					children: dialog === void 0 ? null : /* @__PURE__ */ jsxs("div", {
						style: diffModalBody,
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "dshClaudeUtilitySummary",
								style: diffModalMeta,
								children: [/* @__PURE__ */ jsxs("strong", {
									style: diffModalMetaText,
									title: pullRequest.title,
									children: [
										t("repositoryPr", { number: pullRequest.number }),
										" → ",
										pullRequest.baseBranch ?? t("diffPrBaseDefault")
									]
								}), /* @__PURE__ */ jsx("span", {
									style: diffModalFileState,
									children: t(`diffMerge_${dialog.method}`)
								})]
							}),
							/* @__PURE__ */ jsx("p", {
								style: diffModalStatus,
								children: pullRequest.title
							}),
							/* @__PURE__ */ jsxs("label", {
								className: "dshClaudeUtilityOption",
								style: diffModalCheckbox,
								children: [/* @__PURE__ */ jsx("input", {
									type: "checkbox",
									name: "dsh-claude-merge-admin",
									checked: dialog.admin,
									disabled: dialog.submitting,
									onChange: (event) => {
										const { checked } = event.currentTarget;
										setDialog((current) => current === void 0 ? current : {
											...current,
											admin: checked
										});
									}
								}), t("diffMergeAdmin")]
							}),
							dialog.error === void 0 ? null : /* @__PURE__ */ jsx("p", {
								role: "alert",
								style: diffModalError,
								children: dialog.error
							})
						]
					})
				})
			] });
		}
		function LinkIcon() {
			return /* @__PURE__ */ jsxs("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ jsx("path", { d: "M6.8 9.2a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1" }), /* @__PURE__ */ jsx("path", { d: "M9.2 6.8a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1" })]
			});
		}
		/** Everything to the right of the branch: the diff counts and the pull
		*  request's controls. One row for the session checkout and each linked one;
		*  `root` scopes the requests to a linked checkout. */
		function RepositoryControls({ sessionId, repository, root, running, t, report, openDiff, submitPrompt, deleteWorkspace }) {
			const pullRequest = repository.pullRequest;
			const merged = pullRequest?.state === "merged";
			const mergedAge = merged ? relativeAge(pullRequest.mergedAt) : void 0;
			const aheadCount = repository.ahead ?? 0;
			const pushable = repository.remote !== void 0 && repository.detached !== true && (aheadCount > 0 || repository.upstream === false);
			const hasDiff = repository.diff !== void 0 && (repository.diff.additions > 0 || repository.diff.deletions > 0);
			const actionable = repository.pullRequestOnly !== true || root !== void 0;
			const prompt = submitPrompt === void 0 ? {} : { submitPrompt };
			return /* @__PURE__ */ jsxs("span", {
				style: repositoryStatusItems,
				children: [
					/* @__PURE__ */ jsx(ConflictControl, {
						sessionId,
						repository,
						root,
						t,
						report,
						...prompt
					}),
					hasDiff || pushable ? /* @__PURE__ */ jsxs("button", {
						type: "button",
						style: {
							...diffTrigger,
							...merged ? diffTriggerMuted : {}
						},
						onClick: openDiff,
						"aria-label": t("diffOpen"),
						children: [hasDiff && repository.diff !== void 0 ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsxs("span", {
							style: merged ? diffAddMuted : diffAdd,
							children: ["+", repository.diff.additions]
						}), /* @__PURE__ */ jsxs("span", {
							style: merged ? diffDeleteMuted : diffDelete,
							children: ["−", repository.diff.deletions]
						})] }) : null, pushable ? /* @__PURE__ */ jsxs("span", {
							style: merged ? diffAheadMuted : diffAhead,
							children: ["↑", aheadCount > 0 ? aheadCount : ""]
						}) : null]
					}) : null,
					pullRequest === void 0 ? null : merged ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsxs("span", {
						style: repositoryMergedStatus,
						children: [
							/* @__PURE__ */ jsx("span", {
								style: repositoryMergedDot,
								"aria-hidden": "true"
							}),
							t("repositoryState_merged"),
							mergedAge === void 0 ? null : /* @__PURE__ */ jsxs("span", {
								style: repositoryMergedAge,
								children: ["· ", t("repositoryMergedAgo", { age: mergedAge })]
							})
						]
					}), /* @__PURE__ */ jsx(CleanupControl, {
						repository,
						t,
						report,
						...deleteWorkspace === void 0 ? {} : { deleteWorkspace }
					})] }) : /* @__PURE__ */ jsxs(Fragment$1, { children: [
						pullRequest.checks === "failing" && actionable ? /* @__PURE__ */ jsx(FailingChecksControl, {
							sessionId,
							repository: {
								...repository,
								pullRequest
							},
							root,
							t,
							...prompt
						}) : pullRequest.checks === "none" ? null : /* @__PURE__ */ jsx(StatusGlyph, {
							label: t(`repositoryChecks_${pullRequest.checks}`),
							tone: pullRequest.checks === "passing" ? "success" : pullRequest.checks === "failing" ? "error" : "warning",
							children: /* @__PURE__ */ jsx(ChecksGlyph, { state: pullRequest.checks })
						}),
						pullRequest.review === "none" ? null : /* @__PURE__ */ jsx(StatusGlyph, {
							label: t(`repositoryReview_${pullRequest.review}`),
							tone: pullRequest.review === "approved" ? "success" : pullRequest.review === "changes-requested" ? "error" : "neutral",
							children: /* @__PURE__ */ jsx(ReviewGlyph, {})
						}),
						actionable ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
							/* @__PURE__ */ jsx(AutoFixControl, {
								sessionId,
								repository,
								root,
								running,
								t,
								...prompt
							}),
							/* @__PURE__ */ jsx(UpdateBranchControl, {
								sessionId,
								repository,
								root,
								t,
								report,
								...prompt
							}),
							/* @__PURE__ */ jsx(MergePullRequestControl, {
								sessionId,
								repository,
								root,
								t,
								report
							})
						] }) : null
					] })
				]
			});
		}
		/** A checkout the session wrote into besides its own, stacked above the
		*  session bar so that one stays put next to the composer. The same readout
		*  and controls as the session bar, scoped to that checkout; only the
		*  workspace deletion after a clean-up stays with the session's own. */
		function LinkedRepositoryBar({ sessionId, repository, running, t, openDiff, report, submitPrompt }) {
			const key = repository.root ?? `${repository.remote ?? repository.cwd}#${repository.pullRequest?.number ?? ""}`;
			if (repository.status !== "ready") return /* @__PURE__ */ jsxs("div", {
				style: {
					...repositoryBar,
					...repositoryBarLinked
				},
				"data-dsh-claude-linked-repository": key,
				children: [/* @__PURE__ */ jsx(StatusGlyph, {
					label: t("repositoryLinked"),
					tone: "neutral",
					children: /* @__PURE__ */ jsx(LinkIcon, {})
				}), /* @__PURE__ */ jsxs("span", {
					style: repositoryPrimary,
					children: [
						repositoryLabel(repository),
						" · ",
						repository.status === "not-repository" ? t("repositoryNotGit") : t("repositoryUnavailable")
					]
				})]
			});
			const branch = branchLabel(repository, t);
			const merged = repository.pullRequest?.state === "merged";
			return /* @__PURE__ */ jsxs("div", {
				style: {
					...repositoryBar,
					...repositoryBarLinked,
					...merged ? repositoryBarMerged : {}
				},
				"data-dsh-claude-linked-repository": key,
				children: [
					/* @__PURE__ */ jsx(StatusGlyph, {
						label: t("repositoryLinked"),
						tone: "neutral",
						children: /* @__PURE__ */ jsx(LinkIcon, {})
					}),
					/* @__PURE__ */ jsx(PullRequestLink, {
						repository,
						t
					}),
					/* @__PURE__ */ jsx(Tooltip, {
						label: repository.remote ?? repositoryLabel(repository),
						side: "top",
						delayMs: 250,
						maxWidth: 420,
						children: /* @__PURE__ */ jsx("span", {
							style: repositoryRemote,
							children: repositoryLabel(repository)
						})
					}),
					/* @__PURE__ */ jsx(Tooltip, {
						label: branch,
						side: "top",
						delayMs: 250,
						maxWidth: 420,
						children: /* @__PURE__ */ jsx("span", {
							style: repositoryBranch,
							children: branch
						})
					}),
					repository.worktree === true ? /* @__PURE__ */ jsx("span", {
						style: repositoryWorktree,
						children: t("repositoryWorktree")
					}) : null,
					/* @__PURE__ */ jsx(RepositoryControls, {
						sessionId,
						repository,
						root: repository.root,
						running,
						t,
						report,
						openDiff: () => openDiff(repository.root),
						...submitPrompt === void 0 ? {} : { submitPrompt }
					})
				]
			});
		}
		function ClaudeRepositoryStatus({ sessionId, useSessions, useClaudeProjection, t, openDiff, submitPrompt, deleteWorkspace }) {
			const blank = useSessions((value) => value.byId[sessionId]?.blank === true);
			const running = useSessions((value) => value.byId[sessionId]?.running === true);
			const projection = useClaudeProjection((value) => value);
			const repository = projection.repository;
			const { toast, report } = useActionToast();
			if (blank || !projection.owned || repository === void 0) return null;
			const branch = branchLabel(repository, t);
			const merged = repository.pullRequest?.state === "merged";
			const linked = (projection.repositories ?? []).map((item) => /* @__PURE__ */ jsx(LinkedRepositoryBar, {
				sessionId,
				repository: item,
				running,
				t,
				openDiff,
				report,
				...submitPrompt === void 0 ? {} : { submitPrompt }
			}, item.root ?? `${item.remote ?? item.cwd}#${item.pullRequest?.number ?? ""}`));
			if (repository.status !== "ready") return /* @__PURE__ */ jsxs("div", {
				style: repositoryBarFrame,
				[CLAUDE_COMPOSER_BAR_ATTRIBUTE]: "",
				children: [linked, /* @__PURE__ */ jsxs("div", {
					style: repositoryBar,
					children: [/* @__PURE__ */ jsx("span", {
						style: repositoryPrIcon,
						children: /* @__PURE__ */ jsx(PullRequestIcon, {})
					}), /* @__PURE__ */ jsx("span", {
						style: repositoryPrimary,
						children: repository.status === "not-repository" ? t("repositoryNotGit") : t("repositoryUnavailable")
					})]
				})]
			});
			return /* @__PURE__ */ jsxs("div", {
				style: repositoryBarFrame,
				[CLAUDE_COMPOSER_BAR_ATTRIBUTE]: "",
				children: [
					/* @__PURE__ */ jsx("style", {
						"data-dsh-claude-repository-bar-styles": true,
						children: repositoryAutoFixCss
					}),
					toast,
					linked,
					/* @__PURE__ */ jsxs("div", {
						style: {
							...repositoryBar,
							...merged ? repositoryBarMerged : {}
						},
						children: [
							/* @__PURE__ */ jsx("span", {
								style: {
									...repositoryPrIcon,
									...merged ? repositoryPrIconMerged : {}
								},
								children: /* @__PURE__ */ jsx(PullRequestIcon, { merged })
							}),
							/* @__PURE__ */ jsx(PullRequestLink, {
								repository,
								t
							}),
							repository.remote === void 0 ? null : /* @__PURE__ */ jsx(Tooltip, {
								label: repository.remote,
								side: "top",
								delayMs: 250,
								maxWidth: 420,
								children: /* @__PURE__ */ jsx("span", {
									style: repositoryRemote,
									children: repositoryName(repository.remote)
								})
							}),
							/* @__PURE__ */ jsx(Tooltip, {
								label: branch,
								side: "top",
								delayMs: 250,
								maxWidth: 420,
								children: /* @__PURE__ */ jsx("span", {
									style: repositoryBranch,
									children: branch
								})
							}),
							repository.worktree === true ? /* @__PURE__ */ jsx("span", {
								style: repositoryWorktree,
								children: t("repositoryWorktree")
							}) : null,
							/* @__PURE__ */ jsx(RepositoryControls, {
								sessionId,
								repository,
								running,
								t,
								report,
								openDiff: () => openDiff(),
								...submitPrompt === void 0 ? {} : { submitPrompt },
								...deleteWorkspace === void 0 ? {} : { deleteWorkspace }
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/review-comment-api.ts
		function record$3(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
		}
		async function post(path, sessionId, body) {
			return await pluginWrite(`${CLAUDE_REVIEW_COMMENT_PATH}${path}`, "fast", void 0, {
				query: { sessionId },
				json: body
			});
		}
		async function addReviewComment(sessionId, comment) {
			const created = record$3(record$3(await post("", sessionId, comment))?.comment);
			if (created === void 0 || typeof created.id !== "string") throw new Error("Invalid review comment response.");
			return created;
		}
		async function removeReviewComment(sessionId, id) {
			await post("/remove", sessionId, { id });
		}
		async function clearReviewComments(sessionId) {
			await post("/clear", sessionId, {});
		}
		//#endregion
		//#region src/client/ClaudeReviewComments.tsx
		function reviewCommentChipLabel(comment) {
			return `${comment.path.split("/").at(-1) ?? comment.path}:${comment.startLine === void 0 ? comment.line : `${comment.startLine}-${comment.line}`}`;
		}
		/** "Line 12" / "Lines 10–12", with the old-side variant when the comment sits on removed code. */
		function commentLineLabel(comment, t) {
			if (comment.startLine !== void 0) return t(comment.side === "old" ? "reviewCommentOldRange" : "reviewCommentNewRange", {
				start: comment.startLine,
				end: comment.line
			});
			return t(comment.side === "old" ? "reviewCommentOldSide" : "reviewCommentNewSide", { line: comment.line });
		}
		function CommentIcon() {
			return /* @__PURE__ */ jsx("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx("path", { d: "M2.75 2.75h10.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H8.2l-3.2 2.9v-2.9H2.75a1 1 0 0 1-1-1v-6.5a1 1 0 0 1 1-1Z" })
			});
		}
		function SendIcon() {
			return /* @__PURE__ */ jsx("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx("path", { d: "M14 2 7.3 8.7M14 2 9.7 14l-2.4-5.3L2 6.3 14 2Z" })
			});
		}
		function TrashIcon() {
			return /* @__PURE__ */ jsx("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx("path", { d: "M2.5 4h11M6.3 2.5h3.4M4.2 4l.65 9.3a1 1 0 0 0 1 .93h4.3a1 1 0 0 0 1-.93L11.8 4M6.7 6.8v4.6M9.3 6.8v4.6" })
			});
		}
		function CommentChip({ comment, t, onRemove }) {
			return /* @__PURE__ */ jsx(HoverCard, {
				anchor: /* @__PURE__ */ jsxs("span", {
					style: reviewCommentChip,
					children: [/* @__PURE__ */ jsx("span", {
						style: reviewCommentChipLabel$1,
						children: reviewCommentChipLabel(comment)
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						style: reviewCommentChipRemove,
						"aria-label": t("reviewCommentRemove"),
						onClick: () => onRemove(comment.id),
						children: "×"
					})]
				}),
				content: /* @__PURE__ */ jsxs("span", {
					style: reviewCommentHoverCard,
					children: [/* @__PURE__ */ jsxs("span", {
						style: reviewCommentHoverPath,
						children: [
							comment.path,
							" · ",
							commentLineLabel(comment, t)
						]
					}), /* @__PURE__ */ jsx("p", {
						style: reviewCommentHoverText,
						children: comment.text
					})]
				}),
				openDelayMs: 250,
				copyLabel: t("markdownCopy"),
				copiedLabel: t("markdownCopied")
			});
		}
		/** Pending review comments docked above the composer; drained by the next user turn. */
		function ClaudeReviewComments({ useClaudeProjection, t, sessionId, submitWith }) {
			const projection = useClaudeProjection((value) => value);
			const [removedIds, setRemovedIds] = useState(() => /* @__PURE__ */ new Set());
			const comments = (projection.reviewComments ?? []).filter((comment) => !removedIds.has(comment.id));
			if (!projection.owned || comments.length === 0) return null;
			const remove = (id) => {
				setRemovedIds((previous) => /* @__PURE__ */ new Set([...previous, id]));
				removeReviewComment(sessionId, id).catch(() => {
					setRemovedIds((previous) => {
						const next = new Set(previous);
						next.delete(id);
						return next;
					});
				});
			};
			const clearAll = () => {
				const ids = comments.map((comment) => comment.id);
				setRemovedIds((previous) => /* @__PURE__ */ new Set([...previous, ...ids]));
				clearReviewComments(sessionId).catch(() => {
					setRemovedIds((previous) => {
						const next = new Set(previous);
						for (const id of ids) next.delete(id);
						return next;
					});
				});
			};
			return /* @__PURE__ */ jsxs("div", {
				style: reviewCommentBarFrame,
				children: [/* @__PURE__ */ jsx("style", {
					"data-dsh-claude-review-comment-styles": true,
					children: panelIconButtonCss
				}), /* @__PURE__ */ jsxs("div", {
					style: reviewCommentBar,
					children: [
						/* @__PURE__ */ jsx("span", {
							style: reviewCommentIcon,
							children: /* @__PURE__ */ jsx(CommentIcon, {})
						}),
						comments.map((comment) => /* @__PURE__ */ jsx(CommentChip, {
							comment,
							t,
							onRemove: remove
						}, comment.id)),
						/* @__PURE__ */ jsxs("span", {
							style: reviewCommentClearSeat,
							children: [submitWith === void 0 ? null : /* @__PURE__ */ jsx("button", {
								type: "button",
								className: panelIconButtonClass,
								"aria-label": t("reviewCommentsSend"),
								onClick: () => submitWith(t("reviewCommentsSendDraft")),
								children: /* @__PURE__ */ jsx(SendIcon, {})
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								className: panelIconButtonClass,
								"aria-label": t("reviewCommentsClear"),
								onClick: clearAll,
								children: /* @__PURE__ */ jsx(TrashIcon, {})
							})]
						})
					]
				})]
			});
		}
		//#endregion
		//#region node_modules/.pnpm/dompurify@3.4.14/node_modules/dompurify/dist/purify.es.mjs
		/*! @license DOMPurify 3.4.14 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.14/LICENSE */
		function _arrayLikeToArray(r, a) {
			(null == a || a > r.length) && (a = r.length);
			for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
			return n;
		}
		function _arrayWithHoles(r) {
			if (Array.isArray(r)) return r;
		}
		function _iterableToArrayLimit(r, l) {
			var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
			if (null != t) {
				var e, n, i, u, a = [], f = true, o = false;
				try {
					if (i = (t = t.call(r)).next, 0 === l);
					else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
				} catch (r) {
					o = true, n = r;
				} finally {
					try {
						if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
					} finally {
						if (o) throw n;
					}
				}
				return a;
			}
		}
		function _nonIterableRest() {
			throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
		}
		function _slicedToArray(r, e) {
			return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
		}
		function _unsupportedIterableToArray(r, a) {
			if (r) {
				if ("string" == typeof r) return _arrayLikeToArray(r, a);
				var t = {}.toString.call(r).slice(8, -1);
				return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
			}
		}
		const entries = Object.entries;
		const setPrototypeOf = Object.setPrototypeOf;
		const isFrozen = Object.isFrozen;
		const getPrototypeOf = Object.getPrototypeOf;
		const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
		let freeze = Object.freeze;
		let seal = Object.seal;
		let create = Object.create;
		let _ref = typeof Reflect !== "undefined" && Reflect;
		let apply$1 = _ref.apply;
		let construct = _ref.construct;
		if (!freeze) freeze = function freeze(x) {
			return x;
		};
		if (!seal) seal = function seal(x) {
			return x;
		};
		if (!apply$1) apply$1 = function apply(func, thisArg) {
			for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
			return func.apply(thisArg, args);
		};
		if (!construct) construct = function construct(Func) {
			for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
			return new Func(...args);
		};
		const arrayForEach = unapply(Array.prototype.forEach);
		const arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
		const arrayPop = unapply(Array.prototype.pop);
		const arrayPush = unapply(Array.prototype.push);
		const arraySplice = unapply(Array.prototype.splice);
		const arrayIsArray = Array.isArray;
		const stringToLowerCase = unapply(String.prototype.toLowerCase);
		const stringToString = unapply(String.prototype.toString);
		const stringMatch = unapply(String.prototype.match);
		const stringReplace = unapply(String.prototype.replace);
		const stringIndexOf = unapply(String.prototype.indexOf);
		const stringTrim = unapply(String.prototype.trim);
		const numberToString = unapply(Number.prototype.toString);
		const booleanToString = unapply(Boolean.prototype.toString);
		const bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
		const symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
		const objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
		const objectToString = unapply(Object.prototype.toString);
		const regExpTest = unapply(RegExp.prototype.test);
		const typeErrorCreate = unconstruct(TypeError);
		/**
		* Creates a new function that calls the given function with a specified thisArg and arguments.
		*
		* @param func - The function to be wrapped and called.
		* @returns A new function that calls the given function with a specified thisArg and arguments.
		*/
		function unapply(func) {
			return function(thisArg) {
				if (thisArg instanceof RegExp) thisArg.lastIndex = 0;
				for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) args[_key3 - 1] = arguments[_key3];
				return apply$1(func, thisArg, args);
			};
		}
		/**
		* Creates a new function that constructs an instance of the given constructor function with the provided arguments.
		*
		* @param func - The constructor function to be wrapped and called.
		* @returns A new function that constructs an instance of the given constructor function with the provided arguments.
		*/
		function unconstruct(Func) {
			return function() {
				for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) args[_key4] = arguments[_key4];
				return construct(Func, args);
			};
		}
		/**
		* Add properties to a lookup table
		*
		* @param set - The set to which elements will be added.
		* @param array - The array containing elements to be added to the set.
		* @param transformCaseFunc - An optional function to transform the case of each element before adding to the set.
		* @returns The modified set with added elements.
		*/
		function addToSet(set, array) {
			let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
			if (setPrototypeOf) setPrototypeOf(set, null);
			if (!arrayIsArray(array)) return set;
			let l = array.length;
			while (l--) {
				let element = array[l];
				if (typeof element === "string") {
					const lcElement = transformCaseFunc(element);
					if (lcElement !== element) {
						if (!isFrozen(array)) array[l] = lcElement;
						element = lcElement;
					}
				}
				set[element] = true;
			}
			return set;
		}
		/**
		* Clean up an array to harden against CSPP
		*
		* @param array - The array to be cleaned.
		* @returns The cleaned version of the array
		*/
		function cleanArray(array) {
			for (let index = 0; index < array.length; index++) if (!objectHasOwnProperty(array, index)) array[index] = null;
			return array;
		}
		/**
		* Shallow clone an object
		*
		* @param object - The object to be cloned.
		* @returns A new object that copies the original.
		*/
		function clone(object) {
			const newObject = create(null);
			for (const _ref2 of entries(object)) {
				var _ref3 = _slicedToArray(_ref2, 2);
				const property = _ref3[0];
				const value = _ref3[1];
				if (objectHasOwnProperty(object, property)) {
					if (arrayIsArray(value)) newObject[property] = cleanArray(value);
					else if (value && typeof value === "object" && value.constructor === Object) newObject[property] = clone(value);
					else newObject[property] = value;
				}
			}
			return newObject;
		}
		/**
		* Convert non-node values into strings without depending on direct property access.
		*
		* @param value - The value to stringify.
		* @returns A string representation of the provided value.
		*/
		function stringifyValue(value) {
			switch (typeof value) {
				case "string": return value;
				case "number": return numberToString(value);
				case "boolean": return booleanToString(value);
				case "bigint": return bigintToString ? bigintToString(value) : "0";
				case "symbol": return symbolToString ? symbolToString(value) : "Symbol()";
				case "undefined": return objectToString(value);
				case "function":
				case "object": {
					if (value === null) return objectToString(value);
					const valueAsRecord = value;
					const valueToString = lookupGetter(valueAsRecord, "toString");
					if (typeof valueToString === "function") {
						const stringified = valueToString(valueAsRecord);
						return typeof stringified === "string" ? stringified : objectToString(stringified);
					}
					return objectToString(value);
				}
				default: return objectToString(value);
			}
		}
		/**
		* This method automatically checks if the prop is function or getter and behaves accordingly.
		*
		* @param object - The object to look up the getter function in its prototype chain.
		* @param prop - The property name for which to find the getter function.
		* @returns The getter function found in the prototype chain or a fallback function.
		*/
		function lookupGetter(object, prop) {
			while (object !== null) {
				const desc = getOwnPropertyDescriptor(object, prop);
				if (desc) {
					if (desc.get) return unapply(desc.get);
					if (typeof desc.value === "function") return unapply(desc.value);
				}
				object = getPrototypeOf(object);
			}
			function fallbackValue() {
				return null;
			}
			return fallbackValue;
		}
		function isRegex(value) {
			try {
				regExpTest(value, "");
				return true;
			} catch (_unused) {
				return false;
			}
		}
		const html$1 = freeze([
			"a",
			"abbr",
			"acronym",
			"address",
			"area",
			"article",
			"aside",
			"audio",
			"b",
			"bdi",
			"bdo",
			"big",
			"blink",
			"blockquote",
			"body",
			"br",
			"button",
			"canvas",
			"caption",
			"center",
			"cite",
			"code",
			"col",
			"colgroup",
			"content",
			"data",
			"datalist",
			"dd",
			"decorator",
			"del",
			"details",
			"dfn",
			"dialog",
			"dir",
			"div",
			"dl",
			"dt",
			"element",
			"em",
			"fieldset",
			"figcaption",
			"figure",
			"font",
			"footer",
			"form",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"head",
			"header",
			"hgroup",
			"hr",
			"html",
			"i",
			"img",
			"input",
			"ins",
			"kbd",
			"label",
			"legend",
			"li",
			"main",
			"map",
			"mark",
			"marquee",
			"menu",
			"menuitem",
			"meter",
			"nav",
			"nobr",
			"ol",
			"optgroup",
			"option",
			"output",
			"p",
			"picture",
			"pre",
			"progress",
			"q",
			"rp",
			"rt",
			"ruby",
			"s",
			"samp",
			"search",
			"section",
			"select",
			"shadow",
			"slot",
			"small",
			"source",
			"spacer",
			"span",
			"strike",
			"strong",
			"style",
			"sub",
			"summary",
			"sup",
			"table",
			"tbody",
			"td",
			"template",
			"textarea",
			"tfoot",
			"th",
			"thead",
			"time",
			"tr",
			"track",
			"tt",
			"u",
			"ul",
			"var",
			"video",
			"wbr"
		]);
		const svg$1 = freeze([
			"svg",
			"a",
			"altglyph",
			"altglyphdef",
			"altglyphitem",
			"animatecolor",
			"animatemotion",
			"animatetransform",
			"circle",
			"clippath",
			"defs",
			"desc",
			"ellipse",
			"enterkeyhint",
			"exportparts",
			"filter",
			"font",
			"g",
			"glyph",
			"glyphref",
			"hkern",
			"image",
			"inputmode",
			"line",
			"lineargradient",
			"marker",
			"mask",
			"metadata",
			"mpath",
			"part",
			"path",
			"pattern",
			"polygon",
			"polyline",
			"radialgradient",
			"rect",
			"stop",
			"style",
			"switch",
			"symbol",
			"text",
			"textpath",
			"title",
			"tref",
			"tspan",
			"view",
			"vkern"
		]);
		const svgFilters = freeze([
			"feBlend",
			"feColorMatrix",
			"feComponentTransfer",
			"feComposite",
			"feConvolveMatrix",
			"feDiffuseLighting",
			"feDisplacementMap",
			"feDistantLight",
			"feDropShadow",
			"feFlood",
			"feFuncA",
			"feFuncB",
			"feFuncG",
			"feFuncR",
			"feGaussianBlur",
			"feImage",
			"feMerge",
			"feMergeNode",
			"feMorphology",
			"feOffset",
			"fePointLight",
			"feSpecularLighting",
			"feSpotLight",
			"feTile",
			"feTurbulence"
		]);
		const svgDisallowed = freeze([
			"animate",
			"color-profile",
			"cursor",
			"discard",
			"font-face",
			"font-face-format",
			"font-face-name",
			"font-face-src",
			"font-face-uri",
			"foreignobject",
			"hatch",
			"hatchpath",
			"mesh",
			"meshgradient",
			"meshpatch",
			"meshrow",
			"missing-glyph",
			"script",
			"set",
			"solidcolor",
			"unknown",
			"use"
		]);
		const mathMl$1 = freeze([
			"math",
			"menclose",
			"merror",
			"mfenced",
			"mfrac",
			"mglyph",
			"mi",
			"mlabeledtr",
			"mmultiscripts",
			"mn",
			"mo",
			"mover",
			"mpadded",
			"mphantom",
			"mroot",
			"mrow",
			"ms",
			"mspace",
			"msqrt",
			"mstyle",
			"msub",
			"msup",
			"msubsup",
			"mtable",
			"mtd",
			"mtext",
			"mtr",
			"munder",
			"munderover",
			"mprescripts"
		]);
		const mathMlDisallowed = freeze([
			"maction",
			"maligngroup",
			"malignmark",
			"mlongdiv",
			"mscarries",
			"mscarry",
			"msgroup",
			"mstack",
			"msline",
			"msrow",
			"semantics",
			"annotation",
			"annotation-xml",
			"mprescripts",
			"none"
		]);
		const text$1 = freeze(["#text"]);
		const html = freeze([
			"accept",
			"action",
			"align",
			"alt",
			"autocapitalize",
			"autocomplete",
			"autopictureinpicture",
			"autoplay",
			"background",
			"bgcolor",
			"border",
			"capture",
			"cellpadding",
			"cellspacing",
			"checked",
			"cite",
			"class",
			"clear",
			"color",
			"cols",
			"colspan",
			"command",
			"commandfor",
			"controls",
			"controlslist",
			"coords",
			"crossorigin",
			"datetime",
			"decoding",
			"default",
			"dir",
			"disabled",
			"disablepictureinpicture",
			"disableremoteplayback",
			"download",
			"draggable",
			"enctype",
			"enterkeyhint",
			"exportparts",
			"face",
			"for",
			"headers",
			"height",
			"hidden",
			"high",
			"href",
			"hreflang",
			"id",
			"inert",
			"inputmode",
			"integrity",
			"ismap",
			"kind",
			"label",
			"lang",
			"list",
			"loading",
			"loop",
			"low",
			"max",
			"maxlength",
			"media",
			"method",
			"min",
			"minlength",
			"multiple",
			"muted",
			"name",
			"nonce",
			"noshade",
			"novalidate",
			"nowrap",
			"open",
			"optimum",
			"part",
			"pattern",
			"placeholder",
			"playsinline",
			"popover",
			"popovertarget",
			"popovertargetaction",
			"poster",
			"preload",
			"pubdate",
			"radiogroup",
			"readonly",
			"rel",
			"required",
			"rev",
			"reversed",
			"role",
			"rows",
			"rowspan",
			"spellcheck",
			"scope",
			"selected",
			"shape",
			"size",
			"sizes",
			"slot",
			"span",
			"srclang",
			"start",
			"src",
			"srcset",
			"step",
			"style",
			"summary",
			"tabindex",
			"title",
			"translate",
			"type",
			"usemap",
			"valign",
			"value",
			"width",
			"wrap",
			"xmlns"
		]);
		const svg = freeze([
			"accent-height",
			"accumulate",
			"additive",
			"alignment-baseline",
			"amplitude",
			"ascent",
			"attributename",
			"attributetype",
			"azimuth",
			"basefrequency",
			"baseline-shift",
			"begin",
			"bias",
			"by",
			"class",
			"clip",
			"clippathunits",
			"clip-path",
			"clip-rule",
			"color",
			"color-interpolation",
			"color-interpolation-filters",
			"color-profile",
			"color-rendering",
			"cx",
			"cy",
			"d",
			"dx",
			"dy",
			"diffuseconstant",
			"direction",
			"display",
			"divisor",
			"dominant-baseline",
			"dur",
			"edgemode",
			"elevation",
			"end",
			"exponent",
			"fill",
			"fill-opacity",
			"fill-rule",
			"filter",
			"filterunits",
			"flood-color",
			"flood-opacity",
			"font-family",
			"font-size",
			"font-size-adjust",
			"font-stretch",
			"font-style",
			"font-variant",
			"font-weight",
			"fx",
			"fy",
			"g1",
			"g2",
			"glyph-name",
			"glyphref",
			"gradientunits",
			"gradienttransform",
			"height",
			"href",
			"id",
			"image-rendering",
			"in",
			"in2",
			"intercept",
			"k",
			"k1",
			"k2",
			"k3",
			"k4",
			"kerning",
			"keypoints",
			"keysplines",
			"keytimes",
			"lang",
			"lengthadjust",
			"letter-spacing",
			"kernelmatrix",
			"kernelunitlength",
			"lighting-color",
			"local",
			"marker-end",
			"marker-mid",
			"marker-start",
			"markerheight",
			"markerunits",
			"markerwidth",
			"maskcontentunits",
			"maskunits",
			"max",
			"mask",
			"mask-type",
			"media",
			"method",
			"mode",
			"min",
			"name",
			"numoctaves",
			"offset",
			"operator",
			"opacity",
			"order",
			"orient",
			"orientation",
			"origin",
			"overflow",
			"paint-order",
			"path",
			"pathlength",
			"patterncontentunits",
			"patterntransform",
			"patternunits",
			"pointer-events",
			"points",
			"preservealpha",
			"preserveaspectratio",
			"primitiveunits",
			"r",
			"rx",
			"ry",
			"radius",
			"refx",
			"refy",
			"repeatcount",
			"repeatdur",
			"restart",
			"result",
			"rotate",
			"scale",
			"seed",
			"shape-rendering",
			"slope",
			"specularconstant",
			"specularexponent",
			"spreadmethod",
			"startoffset",
			"stddeviation",
			"stitchtiles",
			"stop-color",
			"stop-opacity",
			"stroke-dasharray",
			"stroke-dashoffset",
			"stroke-linecap",
			"stroke-linejoin",
			"stroke-miterlimit",
			"stroke-opacity",
			"stroke",
			"stroke-width",
			"style",
			"surfacescale",
			"systemlanguage",
			"tabindex",
			"tablevalues",
			"targetx",
			"targety",
			"transform",
			"transform-origin",
			"text-anchor",
			"text-decoration",
			"text-orientation",
			"text-rendering",
			"textlength",
			"type",
			"u1",
			"u2",
			"unicode",
			"values",
			"vector-effect",
			"viewbox",
			"visibility",
			"version",
			"vert-adv-y",
			"vert-origin-x",
			"vert-origin-y",
			"width",
			"word-spacing",
			"wrap",
			"writing-mode",
			"xchannelselector",
			"ychannelselector",
			"x",
			"x1",
			"x2",
			"xmlns",
			"y",
			"y1",
			"y2",
			"z",
			"zoomandpan"
		]);
		const mathMl = freeze([
			"accent",
			"accentunder",
			"align",
			"bevelled",
			"close",
			"columnalign",
			"columnlines",
			"columnspacing",
			"columnspan",
			"denomalign",
			"depth",
			"dir",
			"display",
			"displaystyle",
			"encoding",
			"fence",
			"frame",
			"height",
			"href",
			"id",
			"largeop",
			"length",
			"linethickness",
			"lquote",
			"lspace",
			"mathbackground",
			"mathcolor",
			"mathsize",
			"mathvariant",
			"maxsize",
			"minsize",
			"movablelimits",
			"notation",
			"numalign",
			"open",
			"rowalign",
			"rowlines",
			"rowspacing",
			"rowspan",
			"rspace",
			"rquote",
			"scriptlevel",
			"scriptminsize",
			"scriptsizemultiplier",
			"selection",
			"separator",
			"separators",
			"stretchy",
			"subscriptshift",
			"supscriptshift",
			"symmetric",
			"voffset",
			"width",
			"xmlns"
		]);
		const xml = freeze([
			"xlink:href",
			"xml:id",
			"xlink:title",
			"xml:space",
			"xmlns:xlink"
		]);
		const MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
		const ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
		const TMPLIT_EXPR = seal(/\${[\w\W]*/g);
		const DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
		const ARIA_ATTR = seal(/^aria-[\-\w]+$/);
		const IS_ALLOWED_URI = seal(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i);
		const IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
		const ATTR_WHITESPACE = seal(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g);
		const DOCTYPE_NAME = seal(/^html$/i);
		const CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
		const ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
		const COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
		const FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
		const SELF_CLOSING_TAG = seal(/\/>/i);
		const NODE_TYPE = {
			element: 1,
			attribute: 2,
			text: 3,
			cdataSection: 4,
			entityReference: 5,
			entityNode: 6,
			processingInstruction: 7,
			comment: 8,
			document: 9,
			documentType: 10,
			documentFragment: 11,
			notation: 12
		};
		const LITERAL_TEXT_ELEMENT_NAMES = [
			"style",
			"script",
			"xmp",
			"iframe",
			"noembed",
			"noframes",
			"plaintext",
			"noscript"
		];
		const LITERAL_TEXT_ELEMENTS = freeze(addToSet({}, LITERAL_TEXT_ELEMENT_NAMES));
		const LITERAL_TEXT_CLOSE = function() {
			const map = {};
			arrayForEach(LITERAL_TEXT_ELEMENT_NAMES, (name) => {
				map[name] = seal(new RegExp("</" + name + "(?=[\\t\\n\\f\\r />])", "i"));
			});
			return freeze(map);
		}();
		const getGlobal = function getGlobal() {
			return typeof window === "undefined" ? null : window;
		};
		/**
		* Creates a no-op policy for internal use only.
		* Don't export this function outside this module!
		* @param trustedTypes The policy factory.
		* @param purifyHostElement The Script element used to load DOMPurify (to determine policy name suffix).
		* @return The policy created (or null, if Trusted Types
		* are not supported or creating the policy failed).
		*/
		const _createTrustedTypesPolicy = function _createTrustedTypesPolicy(trustedTypes, purifyHostElement) {
			if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") return null;
			let suffix = null;
			const ATTR_NAME = "data-tt-policy-suffix";
			if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) suffix = purifyHostElement.getAttribute(ATTR_NAME);
			const policyName = "dompurify" + (suffix ? "#" + suffix : "");
			try {
				return trustedTypes.createPolicy(policyName, {
					createHTML(html) {
						return html;
					},
					createScriptURL(scriptUrl) {
						return scriptUrl;
					}
				});
			} catch (_) {
				console.warn("TrustedTypes policy " + policyName + " could not be created.");
				return null;
			}
		};
		const _createHooksMap = function _createHooksMap() {
			return {
				afterSanitizeAttributes: [],
				afterSanitizeElements: [],
				afterSanitizeShadowDOM: [],
				beforeSanitizeAttributes: [],
				beforeSanitizeElements: [],
				beforeSanitizeShadowDOM: [],
				uponSanitizeAttribute: [],
				uponSanitizeElement: [],
				uponSanitizeShadowNode: []
			};
		};
		/**
		* Resolve a set-valued configuration option: a fresh set built from
		* cfg[key] when it is an own array property (seeded with a clone of
		* options.base when given, case-normalized via options.transform),
		* the fallback set otherwise.
		*
		* @param cfg the cloned, prototype-free configuration object
		* @param key the configuration property to read
		* @param fallback the set to use when the option is absent or not an array
		* @param options transform and optional base set to merge into
		* @returns the resolved set
		*/
		const _resolveSetOption = function _resolveSetOption(cfg, key, fallback, options) {
			return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options.base ? clone(options.base) : {}, cfg[key], options.transform) : fallback;
		};
		/**
		* Resolve an object-valued configuration option: a prototype-free clone
		* of cfg[key] when it is an own, truthy object property, else a fresh
		* fallback built by makeFallback (fresh on every parse, so a previous
		* parse can never leak state into the next one).
		*
		* @param cfg the cloned, prototype-free configuration object
		* @param key the configuration property to read
		* @param makeFallback builds the fallback value when the option is absent
		* @returns the resolved object
		*/
		const _resolveObjectOption = function _resolveObjectOption(cfg, key, makeFallback) {
			const value = objectHasOwnProperty(cfg, key) ? cfg[key] : void 0;
			return value && typeof value === "object" ? clone(value) : makeFallback();
		};
		function createDOMPurify() {
			let window = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
			const DOMPurify = (root) => createDOMPurify(root);
			DOMPurify.version = "3.4.14";
			DOMPurify.removed = [];
			if (!window || !window.document || window.document.nodeType !== NODE_TYPE.document || !window.Element) {
				DOMPurify.isSupported = false;
				return DOMPurify;
			}
			let document = window.document;
			const originalDocument = document;
			const currentScript = originalDocument.currentScript;
			window.DocumentFragment;
			const HTMLTemplateElement = window.HTMLTemplateElement, Node = window.Node, Element = window.Element, NodeFilter = window.NodeFilter;
			window.NamedNodeMap === void 0 && (window.NamedNodeMap || window.MozNamedAttrMap);
			window.HTMLFormElement;
			const DOMParser = window.DOMParser, trustedTypes = window.trustedTypes;
			const ElementPrototype = Element.prototype;
			const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
			const remove = lookupGetter(ElementPrototype, "remove");
			const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
			const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
			const getParentNode = lookupGetter(ElementPrototype, "parentNode");
			const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
			const getAttributes = lookupGetter(ElementPrototype, "attributes");
			const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
			const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
			const getOwnerDocument = Node && Node.prototype ? lookupGetter(Node.prototype, "ownerDocument") : null;
			const _readNodeType = function _readNodeType(node) {
				return getNodeType ? getNodeType(node) : node.nodeType;
			};
			const _readNodeName = function _readNodeName(node) {
				return getNodeName ? getNodeName(node) : node.nodeName;
			};
			if (typeof HTMLTemplateElement === "function") {
				const template = document.createElement("template");
				if (template.content && template.content.ownerDocument) document = template.content.ownerDocument;
			}
			let trustedTypesPolicy;
			let emptyHTML = "";
			let defaultTrustedTypesPolicy;
			let defaultTrustedTypesPolicyResolved = false;
			let IN_TRUSTED_TYPES_POLICY = 0;
			const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy() {
				if (IN_TRUSTED_TYPES_POLICY > 0) throw typeErrorCreate("A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the \"DOMPurify and Trusted Types\" section of the README.");
			};
			const _createTrustedHTML = function _createTrustedHTML(html) {
				_assertNotInTrustedTypesPolicy();
				IN_TRUSTED_TYPES_POLICY++;
				try {
					return trustedTypesPolicy.createHTML(html);
				} finally {
					IN_TRUSTED_TYPES_POLICY--;
				}
			};
			const _createTrustedScriptURL = function _createTrustedScriptURL(scriptUrl) {
				_assertNotInTrustedTypesPolicy();
				IN_TRUSTED_TYPES_POLICY++;
				try {
					return trustedTypesPolicy.createScriptURL(scriptUrl);
				} finally {
					IN_TRUSTED_TYPES_POLICY--;
				}
			};
			const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy() {
				if (!defaultTrustedTypesPolicyResolved) {
					defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
					defaultTrustedTypesPolicyResolved = true;
				}
				return defaultTrustedTypesPolicy;
			};
			const _document = document, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
			const importNode = originalDocument.importNode;
			let hooks = _createHooksMap();
			/**
			* Expose whether this browser supports running the full DOMPurify.
			*/
			DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
			const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
			let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
			/**
			* We consider the elements and attributes below to be safe. Ideally
			* don't add any new ones but feel free to remove unwanted ones.
			*/
			let ALLOWED_TAGS = null;
			const DEFAULT_ALLOWED_TAGS = addToSet({}, [
				...html$1,
				...svg$1,
				...svgFilters,
				...mathMl$1,
				...text$1
			]);
			let ALLOWED_ATTR = null;
			const DEFAULT_ALLOWED_ATTR = addToSet({}, [
				...html,
				...svg,
				...mathMl,
				...xml
			]);
			let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
				tagNameCheck: {
					writable: true,
					configurable: false,
					enumerable: true,
					value: null
				},
				attributeNameCheck: {
					writable: true,
					configurable: false,
					enumerable: true,
					value: null
				},
				allowCustomizedBuiltInElements: {
					writable: true,
					configurable: false,
					enumerable: true,
					value: false
				}
			}));
			let FORBID_TAGS = null;
			let FORBID_ATTR = null;
			const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
				tagCheck: {
					writable: true,
					configurable: false,
					enumerable: true,
					value: null
				},
				attributeCheck: {
					writable: true,
					configurable: false,
					enumerable: true,
					value: null
				}
			}));
			let ALLOW_ARIA_ATTR = true;
			let ALLOW_DATA_ATTR = true;
			let ALLOW_UNKNOWN_PROTOCOLS = false;
			let ALLOW_SELF_CLOSE_IN_ATTR = true;
			let SAFE_FOR_TEMPLATES = false;
			let SAFE_FOR_XML = true;
			let WHOLE_DOCUMENT = false;
			let SET_CONFIG = false;
			let SET_CONFIG_ALLOWED_TAGS = null;
			let SET_CONFIG_ALLOWED_ATTR = null;
			let FORCE_BODY = false;
			let RETURN_DOM = false;
			let RETURN_DOM_FRAGMENT = false;
			let RETURN_TRUSTED_TYPE = false;
			let SANITIZE_DOM = true;
			let SANITIZE_NAMED_PROPS = false;
			const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
			let KEEP_CONTENT = true;
			let IN_PLACE = false;
			let USE_PROFILES = {};
			let FORBID_CONTENTS = null;
			const DEFAULT_FORBID_CONTENTS = addToSet({}, [
				"annotation-xml",
				"audio",
				"colgroup",
				"desc",
				"foreignobject",
				"head",
				"iframe",
				"math",
				"mi",
				"mn",
				"mo",
				"ms",
				"mtext",
				"noembed",
				"noframes",
				"noscript",
				"plaintext",
				"script",
				"selectedcontent",
				"style",
				"svg",
				"template",
				"thead",
				"title",
				"video",
				"xmp"
			]);
			let DATA_URI_TAGS = null;
			const DEFAULT_DATA_URI_TAGS = addToSet({}, [
				"audio",
				"video",
				"img",
				"source",
				"image",
				"track"
			]);
			let URI_SAFE_ATTRIBUTES = null;
			const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, [
				"alt",
				"class",
				"for",
				"id",
				"label",
				"name",
				"pattern",
				"placeholder",
				"role",
				"summary",
				"title",
				"value",
				"style",
				"xmlns"
			]);
			const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
			const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
			const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
			let NAMESPACE = HTML_NAMESPACE;
			let IS_EMPTY_INPUT = false;
			let ALLOWED_NAMESPACES = null;
			const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [
				MATHML_NAMESPACE,
				SVG_NAMESPACE,
				HTML_NAMESPACE
			], stringToString);
			const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze([
				"mi",
				"mo",
				"mn",
				"ms",
				"mtext"
			]);
			let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
			const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
			let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
			const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, [
				"title",
				"style",
				"font",
				"a",
				"script"
			]);
			let PARSER_MEDIA_TYPE = null;
			const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
			const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
			let transformCaseFunc = null;
			let CONFIG = null;
			const formElement = document.createElement("form");
			const isRegexOrFunction = function isRegexOrFunction(testValue) {
				return testValue instanceof RegExp || testValue instanceof Function;
			};
			/**
			* _parseConfig
			*
			* @param cfg optional config literal
			*/
			const _parseConfig = function _parseConfig() {
				let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
				if (CONFIG && CONFIG === cfg) return;
				if (!cfg || typeof cfg !== "object") cfg = {};
				cfg = clone(cfg);
				PARSER_MEDIA_TYPE = SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
				transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
				ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, { transform: transformCaseFunc });
				ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, { transform: transformCaseFunc });
				ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, { transform: stringToString });
				URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
					transform: transformCaseFunc,
					base: DEFAULT_URI_SAFE_ATTRIBUTES
				});
				DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
					transform: transformCaseFunc,
					base: DEFAULT_DATA_URI_TAGS
				});
				FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, { transform: transformCaseFunc });
				FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), { transform: transformCaseFunc });
				FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), { transform: transformCaseFunc });
				USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
				ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
				ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
				ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
				ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
				SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
				SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
				WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
				RETURN_DOM = cfg.RETURN_DOM || false;
				RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
				RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
				FORCE_BODY = cfg.FORCE_BODY || false;
				SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
				SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
				KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
				IN_PLACE = cfg.IN_PLACE || false;
				IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
				NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
				MATHML_TEXT_INTEGRATION_POINTS = _resolveObjectOption(cfg, "MATHML_TEXT_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS));
				HTML_INTEGRATION_POINTS = _resolveObjectOption(cfg, "HTML_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS));
				const customElementHandling = _resolveObjectOption(cfg, "CUSTOM_ELEMENT_HANDLING", () => create(null));
				CUSTOM_ELEMENT_HANDLING = create(null);
				if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
				if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
				if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
				seal(CUSTOM_ELEMENT_HANDLING);
				if (SAFE_FOR_TEMPLATES) ALLOW_DATA_ATTR = false;
				if (RETURN_DOM_FRAGMENT) RETURN_DOM = true;
				if (USE_PROFILES) {
					ALLOWED_TAGS = addToSet({}, text$1);
					ALLOWED_ATTR = create(null);
					if (USE_PROFILES.html === true) {
						addToSet(ALLOWED_TAGS, html$1);
						addToSet(ALLOWED_ATTR, html);
					}
					if (USE_PROFILES.svg === true) {
						addToSet(ALLOWED_TAGS, svg$1);
						addToSet(ALLOWED_ATTR, svg);
						addToSet(ALLOWED_ATTR, xml);
					}
					if (USE_PROFILES.svgFilters === true) {
						addToSet(ALLOWED_TAGS, svgFilters);
						addToSet(ALLOWED_ATTR, svg);
						addToSet(ALLOWED_ATTR, xml);
					}
					if (USE_PROFILES.mathMl === true) {
						addToSet(ALLOWED_TAGS, mathMl$1);
						addToSet(ALLOWED_ATTR, mathMl);
						addToSet(ALLOWED_ATTR, xml);
					}
				}
				EXTRA_ELEMENT_HANDLING.tagCheck = null;
				EXTRA_ELEMENT_HANDLING.attributeCheck = null;
				if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
					if (typeof cfg.ADD_TAGS === "function") EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
					else if (arrayIsArray(cfg.ADD_TAGS)) {
						if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) ALLOWED_TAGS = clone(ALLOWED_TAGS);
						addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
					}
				}
				if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
					if (typeof cfg.ADD_ATTR === "function") EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
					else if (arrayIsArray(cfg.ADD_ATTR)) {
						if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) ALLOWED_ATTR = clone(ALLOWED_ATTR);
						addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
					}
				}
				if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
					if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) FORBID_CONTENTS = clone(FORBID_CONTENTS);
					addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
				}
				if (KEEP_CONTENT) ALLOWED_TAGS["#text"] = true;
				if (WHOLE_DOCUMENT) addToSet(ALLOWED_TAGS, [
					"html",
					"head",
					"body"
				]);
				if (ALLOWED_TAGS.table) {
					addToSet(ALLOWED_TAGS, ["tbody"]);
					delete FORBID_TAGS.tbody;
				}
				if (cfg.TRUSTED_TYPES_POLICY) {
					if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") throw typeErrorCreate("TRUSTED_TYPES_POLICY configuration option must provide a \"createHTML\" hook.");
					if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") throw typeErrorCreate("TRUSTED_TYPES_POLICY configuration option must provide a \"createScriptURL\" hook.");
					const previousTrustedTypesPolicy = trustedTypesPolicy;
					trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
					try {
						emptyHTML = _createTrustedHTML("");
					} catch (error) {
						trustedTypesPolicy = previousTrustedTypesPolicy;
						throw error;
					}
				} else if (cfg.TRUSTED_TYPES_POLICY === null) {
					trustedTypesPolicy = void 0;
					emptyHTML = "";
				} else {
					if (trustedTypesPolicy === void 0) trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
					if (trustedTypesPolicy && typeof emptyHTML === "string") emptyHTML = _createTrustedHTML("");
				}
				if (freeze) freeze(cfg);
				CONFIG = cfg;
			};
			const ALL_SVG_TAGS = addToSet({}, [
				...svg$1,
				...svgFilters,
				...svgDisallowed
			]);
			const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
			/**
			* Namespace rules for an element in the SVG namespace.
			*
			* @param tagName the element's lowercase tag name
			* @param parent the (possibly simulated) parent node
			* @param parentTagName the parent's lowercase tag name
			* @returns true if a spec-compliant parser could produce this element
			*/
			const _checkSvgNamespace = function _checkSvgNamespace(tagName, parent, parentTagName) {
				if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "svg";
				if (parent.namespaceURI === MATHML_NAMESPACE) return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
				return Boolean(ALL_SVG_TAGS[tagName]);
			};
			/**
			* Namespace rules for an element in the MathML namespace.
			*
			* @param tagName the element's lowercase tag name
			* @param parent the (possibly simulated) parent node
			* @param parentTagName the parent's lowercase tag name
			* @returns true if a spec-compliant parser could produce this element
			*/
			const _checkMathMlNamespace = function _checkMathMlNamespace(tagName, parent, parentTagName) {
				if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "math";
				if (parent.namespaceURI === SVG_NAMESPACE) return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
				return Boolean(ALL_MATHML_TAGS[tagName]);
			};
			/**
			* Namespace rules for an element in the HTML namespace.
			*
			* @param tagName the element's lowercase tag name
			* @param parent the (possibly simulated) parent node
			* @param parentTagName the parent's lowercase tag name
			* @returns true if a spec-compliant parser could produce this element
			*/
			const _checkHtmlNamespace = function _checkHtmlNamespace(tagName, parent, parentTagName) {
				if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) return false;
				if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) return false;
				return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
			};
			/**
			* @param element a DOM element whose namespace is being checked
			* @returns Return false if the element has a
			*  namespace that a spec-compliant parser would never
			*  return. Return true otherwise.
			*/
			const _checkValidNamespace = function _checkValidNamespace(element) {
				let parent = getParentNode(element);
				if (!parent || !parent.tagName) parent = {
					namespaceURI: NAMESPACE,
					tagName: "template"
				};
				const tagName = stringToLowerCase(element.tagName);
				const parentTagName = stringToLowerCase(parent.tagName);
				if (!ALLOWED_NAMESPACES[element.namespaceURI]) return false;
				if (element.namespaceURI === SVG_NAMESPACE) return _checkSvgNamespace(tagName, parent, parentTagName);
				if (element.namespaceURI === MATHML_NAMESPACE) return _checkMathMlNamespace(tagName, parent, parentTagName);
				if (element.namespaceURI === HTML_NAMESPACE) return _checkHtmlNamespace(tagName, parent, parentTagName);
				if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) return true;
				return false;
			};
			/**
			* _forceRemove
			*
			* @param node a DOM node
			*/
			const _forceRemove = function _forceRemove(node) {
				arrayPush(DOMPurify.removed, { element: node });
				try {
					getParentNode(node).removeChild(node);
				} catch (_) {
					remove(node);
					if (!getParentNode(node)) throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
				}
			};
			/**
			* _stripAttributeNode
			*
			* Remove a single Attr node case/namespace-exactly on an attribute-teardown
			* path. Name-based removeAttribute() ASCII-lowercases its lookup key for an
			* HTML element in an HTML document and so silently misses a case-preserved
			* handler (e.g. `ONERROR` off an XML/XHTML import) - the same defect
			* _removeAttribute() was fixed for, which a name-based call would reintroduce
			* on these IN_PLACE teardown paths. Unlike _removeAttribute this does not
			* record into DOMPurify.removed: the neutralize passes intentionally do not
			* book-keep. A clobbered/detached node falls back to best-effort name-based
			* removal.
			*
			* @param element the element to strip the attribute from
			* @param attribute the Attr node to remove
			* @param name the attribute's name, for the fallback path
			*/
			const _stripAttributeNode = function _stripAttributeNode(element, attribute, name) {
				try {
					element.removeAttributeNode(attribute);
				} catch (_) {
					try {
						element.removeAttribute(name);
					} catch (_) {}
				}
			};
			/**
			* _neutralizeRoot
			*
			* Fail-closed teardown of an in-place root after the sanitize walk aborts
			* (campaign-3 F2). An internal throw mid-walk — e.g. a page-registered
			* custom element's reaction detaches a node so `_forceRemove`'s deliberate
			* parentless guard throws, or any other re-entrant engine mutation — would
			* otherwise leave the caller's *live* tree half-sanitized, with everything
			* after the abort point still carrying its handlers. There is no safe way
			* to resume the walk (the tree mutated under us), so we strip the root bare:
			* remove every child and every attribute, then let the caller's catch see
			* the original error. Clobber-safe (cached `remove`/`childNodes`/`attributes`
			* getters; the root was already clobber-pre-flighted at the IN_PLACE entry).
			*
			* @param root the in-place root to empty
			*/
			const _neutralizeRoot = function _neutralizeRoot(root) {
				_neutralizeSubtree(root);
				const childNodes = getChildNodes(root);
				if (childNodes) {
					const snapshot = [];
					arrayForEach(childNodes, (child) => {
						arrayPush(snapshot, child);
					});
					arrayForEach(snapshot, (child) => {
						try {
							remove(child);
						} catch (_) {}
					});
				}
				const attributes = getAttributes(root);
				if (attributes) for (let i = attributes.length - 1; i >= 0; --i) {
					const attribute = attributes[i];
					const name = attribute && attribute.name;
					if (typeof name === "string") _stripAttributeNode(root, attribute, name);
				}
			};
			/**
			* _removeAttribute
			*
			* Name-based getAttributeNode()/removeAttribute() ASCII-lowercase their
			* lookup key for HTML elements in an HTML document, so they silently miss an
			* attribute whose stored qualified name still contains uppercase ASCII
			* letters. That happens when the node came from a case-preserving source
			* (an XML/XHTML document imported via importNode(), or createAttributeNS()),
			* where e.g. `ONERROR` survives the walk: the policy check lowercases to
			* `onerror` and rejects it, but `removeAttribute('ONERROR')` looks up
			* `onerror` and finds nothing. Remove the exact Attr node instead, which is
			* case- and namespace-exact, and fall back to name-based removal only when
			* the caller could not supply the node.
			*
			* @param name an Attribute name
			* @param element a DOM node
			* @param attr the exact Attr node to remove, when the caller has it
			*/
			const _removeAttribute = function _removeAttribute(name, element, attr) {
				if (!attr) try {
					attr = element.getAttributeNode(name);
				} catch (_) {
					attr = null;
				}
				arrayPush(DOMPurify.removed, {
					attribute: attr || null,
					from: element
				});
				try {
					if (attr) element.removeAttributeNode(attr);
					else element.removeAttribute(name);
				} catch (_) {
					try {
						element.removeAttribute(name);
					} catch (_) {}
				}
				if (name === "is") {
					if (RETURN_DOM || RETURN_DOM_FRAGMENT) try {
						_forceRemove(element);
					} catch (_) {}
					else try {
						element.setAttribute(name, "");
					} catch (_) {}
				}
			};
			/**
			* _stripDisallowedAttributes
			*
			* Removes every attribute the active configuration does not allow from a
			* single element, using the same allowlist as the main attribute pass (so
			* `on*` handlers go, but no `/^on/` blocklist is introduced). Used only to
			* neutralise nodes that are being discarded from an in-place tree.
			*
			* @param element the element to strip
			*/
			const _stripDisallowedAttributes = function _stripDisallowedAttributes(element) {
				const attributes = getAttributes(element);
				if (!attributes) return;
				for (let i = attributes.length - 1; i >= 0; --i) {
					const attribute = attributes[i];
					const name = attribute && attribute.name;
					if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) continue;
					_stripAttributeNode(element, attribute, name);
				}
			};
			/**
			* _neutralizeSubtree
			*
			* Completes the audit-5 F1 fix across every removal path. The KEEP_CONTENT
			* move-hoist neutralises only disallowed-tag removals; clobber, mXSS-canary,
			* namespace, comment, processing-instruction and KEEP_CONTENT:false removals
			* all drop their subtree wholesale via `_forceRemove`. On the IN_PLACE path
			* those dropped nodes are detached from the caller's LIVE tree but a
			* handler-bearing original among them (an `<img onerror>`/`<video>` that was
			* loading) keeps its queued resource event, which fires in page scope after
			* sanitize returns. This walks a removed subtree and strips every attribute
			* the active configuration does not allow — so `on*` handlers are cancelled
			* through the SAME allowlist that governs kept nodes, not a separate `/^on/`
			* blocklist. Run synchronously before sanitize returns, i.e. before any
			* queued event can fire. Hook-free by design: these nodes leave the output,
			* so firing attribute hooks for them would be surprising. Clobber-safe reads;
			* a doomed clobbered node may shadow `removeAttribute` (its own attributes are
			* irrelevant — it is discarded — while its non-clobbered descendants, e.g.
			* the `<img>`, are reached and scrubbed).
			*
			* @param root the root of a removed subtree to neutralise
			*/
			const _neutralizeSubtree = function _neutralizeSubtree(root) {
				const stack = [root];
				while (stack.length > 0) {
					const node = stack.pop();
					if (_readNodeType(node) === NODE_TYPE.element) _stripDisallowedAttributes(node);
					const childNodes = getChildNodes(node);
					if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
				}
			};
			/**
			* _neutralizePatchLinkage
			*
			* IN_PLACE entry pre-pass (declarative-partial-updates / streaming
			* hardening, https://github.com/WICG/declarative-partial-updates).
			*
			* The main walk strips patch linkage (`for`/`patchsrc`) and removes range
			* markers (PIs / markup comments) node-by-node, in document order, AS it
			* reaches each node. On a live in-place root that leaves a window: from the
			* moment the root is connected until the walk arrives at a given node, that
			* node's linkage is live. A patch applied on connection/stream can fire as
			* a microtask during the walk and inject or teleport an unsanitized DOM
			* range into a region the iterator has already passed and will not revisit,
			* so the post-return "tree is sanitized" contract is violated. Sweep the
			* whole tree once up front and sever every linkage before the walk begins,
			* closing that window.
			*
			* This CANNOT undo a patch that already fired before sanitize ran — that is
			* the irreducible "do not IN_PLACE a live-connected attacker tree" caveat —
			* but it closes everything from sanitize-start onward. Gated on SAFE_FOR_XML
			* to group with the rest of the declarative-partial-updates handling and
			* stay overridable, consistent with the codebase.
			*
			* Clobber-safe traversal (cached childNodes getter); per-node try/catch so a
			* clobbered root cannot defeat the sweep of its non-clobbered descendants.
			*
			* NOTE (pending real-Chrome confirmation, see test/declarative-patch-probe
			* .html Q1): this mirrors the existing policy of keeping `for` on
			* <label>/<output>. If the shipping feature can drive a patch through a
			* surviving `for`-on-label/output + `id` pair, this pre-pass and the
			* attribute check at _isBasicCustomElement's caller must additionally drop
			* that pair on the IN_PLACE path. Left as-is until the taxonomy is verified.
			*
			* @param root the in-place root to sweep
			*/
			/**
			* Central policy for declarative-partial-updates patch-linkage attributes,
			* shared by the _neutralizePatchLinkage pre-pass and _isValidAttribute so
			* the two sites cannot drift: `patchsrc` always links, `for` links
			* everywhere except on <label>/<output>, and the whole policy is gated on
			* SAFE_FOR_XML (see the rationale block in _isValidAttribute).
			*
			* @param lcName the transformCaseFunc'd attribute name
			* @param lcTag the transformCaseFunc'd tag name of the carrying element
			* @return true if the attribute is patch linkage and must be dropped
			*/
			const _isPatchLinkageAttribute = function _isPatchLinkageAttribute(lcName, lcTag) {
				if (!SAFE_FOR_XML) return false;
				if (lcName === "patchsrc") return true;
				return lcName === "for" && lcTag !== "label" && lcTag !== "output";
			};
			const _neutralizePatchLinkage = function _neutralizePatchLinkage(root) {
				if (!SAFE_FOR_XML) return;
				const stack = [root];
				while (stack.length > 0) {
					const node = stack.pop();
					const nodeType = _readNodeType(node);
					if (nodeType === NODE_TYPE.processingInstruction || nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, node.data)) {
						try {
							remove(node);
						} catch (_) {}
						continue;
					}
					if (nodeType === NODE_TYPE.element) {
						const element = node;
						const lcTag = transformCaseFunc(_readNodeName(node));
						try {
							if (element.hasAttribute && element.hasAttribute("patchsrc")) element.removeAttribute("patchsrc");
							if (element.hasAttribute && element.hasAttribute("for") && _isPatchLinkageAttribute("for", lcTag)) element.removeAttribute("for");
						} catch (_) {}
					}
					const childNodes = getChildNodes(node);
					if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
				}
			};
			/**
			* _initDocument
			*
			* @param dirty - a string of dirty markup
			* @return a DOM, filled with the dirty markup
			*/
			const _initDocument = function _initDocument(dirty) {
				let doc = null;
				let leadingWhitespace = null;
				if (FORCE_BODY) dirty = "<remove></remove>" + dirty;
				else {
					const matches = stringMatch(dirty, /^[\r\n\t ]+/);
					leadingWhitespace = matches && matches[0];
				}
				if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) dirty = "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head></head><body>" + dirty + "</body></html>";
				const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
				if (NAMESPACE === HTML_NAMESPACE) try {
					doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
				} catch (_) {}
				if (!doc || !doc.documentElement) {
					doc = implementation.createDocument(NAMESPACE, "template", null);
					try {
						doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
					} catch (_) {}
				}
				const body = doc.body || doc.documentElement;
				if (dirty && leadingWhitespace) body.insertBefore(document.createTextNode(leadingWhitespace), body.childNodes[0] || null);
				if (NAMESPACE === HTML_NAMESPACE) return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
				return WHOLE_DOCUMENT ? doc.documentElement : body;
			};
			/**
			* Creates a NodeIterator object that you can use to traverse filtered lists of nodes or elements in a document.
			*
			* @param root The root element or node to start traversing on.
			* @return The created NodeIterator
			*/
			const _createNodeIterator = function _createNodeIterator(root) {
				const doc = getOwnerDocument ? getOwnerDocument(root) : root.ownerDocument;
				return createNodeIterator.call(doc || root, root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION, null);
			};
			/**
			* Replace template expression syntax (mustache, ERB, template
			* literal) with a space; shared by all SAFE_FOR_TEMPLATES scrub
			* sites. Order matters: mustache, then ERB, then template literal.
			*
			* @param value the string to scrub
			* @returns the scrubbed string
			*/
			const _stripTemplateExpressions = function _stripTemplateExpressions(value) {
				value = stringReplace(value, MUSTACHE_EXPR$1, " ");
				value = stringReplace(value, ERB_EXPR$1, " ");
				value = stringReplace(value, TMPLIT_EXPR$1, " ");
				return value;
			};
			/**
			* Strip template-engine expressions ({{...}}, ${...}, <%...%>) from the
			* character data of an element subtree. Used as the final safety net for
			* SAFE_FOR_TEMPLATES on every DOM-returning code path so that expressions
			* which only form after text-node normalization (e.g. fragments split across
			* stripped elements) cannot survive into a template-evaluating framework.
			*
			* Walks text/comment/CDATA/processing-instruction nodes and mutates `.data`
			* in place rather than round-tripping through innerHTML. This preserves
			* descendant node references (important for IN_PLACE callers), avoids a
			* serialize/reparse cycle, and reads literal character data — which means
			* `<%...%>` in text content matches the ERB regex against its real bytes
			* instead of the HTML-entity-escaped form innerHTML would produce.
			*
			* Attribute values are not visited here; SAFE_FOR_TEMPLATES handling for
			* attributes is performed during the per-node `_sanitizeAttributes` pass.
			*
			* @param node The root element whose character data should be scrubbed.
			*/
			const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
				var _node$querySelectorAl;
				node.normalize();
				const doc = getOwnerDocument ? getOwnerDocument(node) : node.ownerDocument;
				const walker = createNodeIterator.call(doc || node, node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION, null);
				let currentNode = walker.nextNode();
				while (currentNode) {
					currentNode.data = _stripTemplateExpressions(currentNode.data);
					currentNode = walker.nextNode();
				}
				const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === void 0 ? void 0 : _node$querySelectorAl.call(node, "template");
				if (templates) arrayForEach(templates, (tmpl) => {
					if (_isDocumentFragment(tmpl.content)) _scrubTemplateExpressions2(tmpl.content);
				});
			};
			/**
			* _isClobbered
			*
			* Detect DOM-clobbering on HTMLFormElement nodes. Form is the only HTML
			* interface with [LegacyOverrideBuiltIns]; a descendant element with a
			* `name` attribute matching a prototype property shadows that property
			* on direct reads. We use this check at the IN_PLACE entry-point and
			* during attribute sanitization to refuse clobbered forms.
			*
			* @param element element to check for clobbering attacks
			* @return true if clobbered, false if safe
			*/
			const _isClobbered = function _isClobbered(element) {
				const realTagName = getNodeName ? getNodeName(element) : null;
				if (typeof realTagName !== "string") return false;
				if (transformCaseFunc(realTagName) !== "form") return false;
				return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || element.nodeType !== getNodeType(element) || element.childNodes !== getChildNodes(element);
			};
			/**
			* Checks whether the given value is a DocumentFragment from any realm.
			*
			* The realm-independent replacement reads `nodeType` through the cached
			* Node.prototype getter and compares to the DOCUMENT_FRAGMENT_NODE
			* constant (11). nodeType is a numeric value resolved from the node's
			* internal slot, identical across realms for the same kind of node.
			*
			* @param value object to check
			* @return true if value is a DocumentFragment-shaped node from any realm
			*/
			const _isDocumentFragment = function _isDocumentFragment(value) {
				if (!getNodeType || typeof value !== "object" || value === null) return false;
				try {
					return getNodeType(value) === NODE_TYPE.documentFragment;
				} catch (_) {
					return false;
				}
			};
			/**
			* Checks whether the given object is a DOM node, including nodes that
			* originate from a different window/realm (e.g. an iframe's
			* contentDocument). The previous `value instanceof Node` check was
			* realm-bound: nodes from a different window failed it, causing
			* sanitize() to silently stringify them and reset IN_PLACE to false,
			* returning the original node unsanitized. See GHSA-4w3q-35jp-p934.
			*
			* @param value object to check whether it's a DOM node
			* @return true if value is a DOM node from any realm
			*/
			const _isNode = function _isNode(value) {
				if (!getNodeType || typeof value !== "object" || value === null) return false;
				try {
					return typeof getNodeType(value) === "number";
				} catch (_) {
					return false;
				}
			};
			function _executeHooks(hooks, currentNode, data) {
				if (hooks.length === 0) return;
				arrayForEach(hooks, (hook) => {
					hook.call(DOMPurify, currentNode, data, CONFIG);
				});
			}
			/**
			* Structural-threat checks that condemn a node regardless of the
			* allowlists: mXSS via namespace confusion, risky CSS construction,
			* processing instructions, markup-bearing comments. Pure predicate;
			* the caller removes. Check order is load-bearing.
			*
			* @param currentNode the node to inspect
			* @param tagName the node's transformCaseFunc'd tag name
			* @return true if the node must be removed
			*/
			const _isUnsafeNode = function _isUnsafeNode(currentNode, tagName) {
				if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) return true;
				if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && LITERAL_TEXT_ELEMENTS[tagName] && (_isNode(currentNode.firstElementChild) || typeof currentNode.textContent === "string" && regExpTest(LITERAL_TEXT_CLOSE[tagName], currentNode.textContent))) return true;
				if (currentNode.nodeType === NODE_TYPE.processingInstruction) return true;
				if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) return true;
				return false;
			};
			/**
			* Evaluate a CUSTOM_ELEMENT_HANDLING check (a RegExp or a predicate
			* function, per the validation in _parseConfig) against a name.
			* Additional arguments are forwarded to predicate functions - the
			* attributeNameCheck predicate receives the tag name as its second
			* argument. A null/absent check never matches.
			*
			* @param check the configured tagNameCheck / attributeNameCheck value
			* @param name the name to test
			* @param args extra arguments forwarded to a predicate function
			* @return true if the check matches the name
			*/
			const _matchesNameCheck = function _matchesNameCheck(check, name) {
				if (check instanceof RegExp) return regExpTest(check, name);
				if (check instanceof Function) {
					for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
					return Boolean(check(name, ...args));
				}
				return false;
			};
			/**
			* Handle a node whose tag is forbidden or not allowlisted: keep
			* allowed custom elements (false return exits _sanitizeElements
			* early - the namespace and fallback-tag removal checks are
			* intentionally skipped for kept custom elements), else hoist
			* content per KEEP_CONTENT and remove.
			*
			* A kept custom element is the ONLY case in which this function
			* returns false, so the caller uses that return value to run the
			* afterSanitizeElements hook on the kept element and keep the
			* element-hook lifecycle consistent with normal allowlisted
			* elements (GHSA-c2j3-45gr-mqc4).
			*
			* @param currentNode the disallowed node
			* @param tagName the node's transformCaseFunc'd tag name
			* @return true if the node was removed, false if kept
			*/
			const _sanitizeDisallowedNode = function _sanitizeDisallowedNode(currentNode, tagName, root) {
				if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) return false;
				if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
					const parentNode = getParentNode(currentNode);
					const childNodes = getChildNodes(currentNode);
					if (childNodes && parentNode) {
						const childCount = childNodes.length;
						for (let i = childCount - 1; i >= 0; --i) {
							const hoisted = currentNode === root ? cloneNode(childNodes[i], true) : childNodes[i];
							parentNode.insertBefore(hoisted, getNextSibling(currentNode));
						}
					}
				}
				_forceRemove(currentNode);
				return true;
			};
			/**
			* Fork a hook-mutable allowlist off its shared binding the first time a
			* (possibly lazily-installed) uponSanitize* hook is about to see it, so the
			* hook cannot widen the per-instance default or the setConfig binding by
			* reference and leak past the call. Returns the set unchanged once it is
			* already call-local, so repeated calls across elements are idempotent.
			*
			* @param hookList the uponSanitize* hook array for this event
			* @param set the current ALLOWED_TAGS / ALLOWED_ATTR binding
			* @param defaultSet the per-instance DEFAULT_ALLOWED_* constant
			* @param setConfigSet the captured setConfig() binding, or null
			* @return a call-local clone if a hook is present and set is still shared,
			*   else set unchanged
			*/
			const _forkSharedAllowlist = function _forkSharedAllowlist(hookList, set, defaultSet, setConfigSet) {
				if (hookList.length === 0) return set;
				return set === defaultSet || set === setConfigSet ? clone(set) : set;
			};
			/**
			* Shared guard for a node that a hook has detached from the walk tree,
			* used after each element-hook site in _sanitizeElements. Detaching is a
			* long-standing user pattern (issue #469; draw.io-style foreignObject
			* filtering). Per the cached, unclobberable parentNode getter the node is
			* genuinely out of the tree, so it can reach neither the serialized
			* output nor an IN_PLACE live tree; treat it as removed and stop
			* processing it. Without this guard, the unsafe-node / namespace checks
			* would call _forceRemove on a parentless node and hit the REPORT-3
			* fail-closed throw — which exists for nodes DOMPurify wants gone but
			* *cannot* detach (clobbered / parentless roots), the opposite of a node
			* that is already safely gone. The walk root is exempt: a detached
			* IN_PLACE root is legitimate input and must still be fully sanitized,
			* and a kill-decision on it must keep hitting the REPORT-3 throw.
			*
			* Nodes detached by hooks stay the hook's responsibility for placement:
			* they are not recorded in DOMPurify.removed, so the post-walk IN_PLACE
			* pass (which iterates DOMPurify.removed) does not reach them. But a
			* hook-detached subtree can still hold a queued resource-event handler -
			* e.g. an <img onload> that began loading when the caller built the live
			* tree - which fires in page scope after sanitize returns even though the
			* handler never reached the returned tree. That is the audit-5 F1 hazard,
			* and the documented node.remove() hook pattern walks straight into it.
			* So on the IN_PLACE path we neutralize the detached subtree inline,
			* stripping its non-allow-listed attributes before returning, exactly as
			* the post-walk pass does for _forceRemove'd subtrees.
			*
			* @param currentNode the node a hook may have detached
			* @param root the current walk root
			* @return true if the node is detached and now handled, false otherwise
			*/
			const _handleHookDetachedNode = function _handleHookDetachedNode(currentNode, root) {
				if (currentNode === root || getParentNode(currentNode) !== null) return false;
				if (IN_PLACE) _neutralizeSubtree(currentNode);
				return true;
			};
			/**
			* _sanitizeElements
			*
			* @protect nodeName
			* @protect textContent
			* @protect removeChild
			* @param currentNode to check for permission to exist
			* @return true if node was killed, false if left alive
			*/
			const _sanitizeElements = function _sanitizeElements(currentNode, root) {
				_executeHooks(hooks.beforeSanitizeElements, currentNode, null);
				if (_handleHookDetachedNode(currentNode, root)) return true;
				if (_isClobbered(currentNode)) {
					_forceRemove(currentNode);
					return true;
				}
				const tagName = transformCaseFunc(_readNodeName(currentNode));
				ALLOWED_TAGS = _forkSharedAllowlist(hooks.uponSanitizeElement, ALLOWED_TAGS, DEFAULT_ALLOWED_TAGS, SET_CONFIG_ALLOWED_TAGS);
				_executeHooks(hooks.uponSanitizeElement, currentNode, {
					tagName,
					allowedTags: ALLOWED_TAGS
				});
				if (_handleHookDetachedNode(currentNode, root)) return true;
				if (_isUnsafeNode(currentNode, tagName)) {
					_forceRemove(currentNode);
					return true;
				}
				if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
					const removed = _sanitizeDisallowedNode(currentNode, tagName, root);
					if (removed === false) _executeHooks(hooks.afterSanitizeElements, currentNode, null);
					return removed;
				}
				if (_readNodeType(currentNode) === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
					_forceRemove(currentNode);
					return true;
				}
				if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
					_forceRemove(currentNode);
					return true;
				}
				if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
					const content = _stripTemplateExpressions(currentNode.textContent);
					if (currentNode.textContent !== content) {
						arrayPush(DOMPurify.removed, { element: currentNode.cloneNode() });
						currentNode.textContent = content;
					}
				}
				_executeHooks(hooks.afterSanitizeElements, currentNode, null);
				return false;
			};
			/**
			* _isValidAttribute
			*
			* @param lcTag Lowercase tag name of containing element.
			* @param lcName Lowercase attribute name.
			* @param value Attribute value.
			* @return Returns true if `value` is valid, otherwise false.
			*/
			const _isValidAttribute = function _isValidAttribute(lcTag, lcName, value) {
				if (FORBID_ATTR[lcName]) return false;
				if (_isPatchLinkageAttribute(lcName, lcTag)) return false;
				if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document || value in formElement)) return false;
				const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
				if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) return true;
				if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) return true;
				if (!nameIsPermitted) return _isBasicCustomElement(lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName, lcTag) || lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value);
				if (URI_SAFE_ATTRIBUTES[lcName]) return true;
				if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
				if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) return true;
				if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
				return !value;
			};
			const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, [
				"annotation-xml",
				"color-profile",
				"font-face",
				"font-face-format",
				"font-face-name",
				"font-face-src",
				"font-face-uri",
				"missing-glyph"
			]);
			/**
			* _isBasicCustomElement
			* checks if at least one dash is included in tagName, and it's not the first char
			* for more sophisticated checking see https://github.com/sindresorhus/validate-element-name
			*
			* @param tagName name of the tag of the node to sanitize
			* @returns Returns true if the tag name meets the basic criteria for a custom element, otherwise false.
			*/
			const _isBasicCustomElement = function _isBasicCustomElement(tagName) {
				return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
			};
			/**
			* Wrap an attribute value in the matching Trusted Types object when
			* the active policy requires it. Namespaced attributes pass through
			* unchanged (no TT support yet, see
			* https://bugs.chromium.org/p/chromium/issues/detail?id=1305293).
			*
			* @param lcTag lowercase tag name of the containing element
			* @param lcName lowercase attribute name
			* @param namespaceURI the attribute's namespace, if any
			* @param value the attribute value to wrap
			* @return the value, wrapped when Trusted Types demand it
			*/
			const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value) {
				if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) switch (trustedTypes.getAttributeType(lcTag, lcName)) {
					case "TrustedHTML": return _createTrustedHTML(value);
					case "TrustedScriptURL": return _createTrustedScriptURL(value);
				}
				return value;
			};
			/**
			* Write a modified attribute value back onto the element. On
			* success, re-probe for clobbering introduced by the new value and
			* remove the element when found; otherwise pop the removal entry
			* recorded by the earlier _removeAttribute (long-standing pairing
			* with the SANITIZE_NAMED_PROPS path - do not "fix" casually). On
			* failure, remove the attribute instead.
			*
			* @param currentNode the element carrying the attribute
			* @param name the attribute name as present on the element
			* @param namespaceURI the attribute's namespace, if any
			* @param value the new attribute value
			*/
			const _setAttributeValue = function _setAttributeValue(currentNode, name, namespaceURI, value) {
				try {
					if (namespaceURI) currentNode.setAttributeNS(namespaceURI, name, value);
					else currentNode.setAttribute(name, value);
					if (_isClobbered(currentNode)) _forceRemove(currentNode);
					else arrayPop(DOMPurify.removed);
				} catch (_) {
					_removeAttribute(name, currentNode);
				}
			};
			/**
			* _sanitizeAttributes
			*
			* @protect attributes
			* @protect nodeName
			* @protect removeAttribute
			* @protect setAttribute
			*
			* @param currentNode to sanitize
			*/
			const _sanitizeAttributes = function _sanitizeAttributes(currentNode) {
				_executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
				const attributes = currentNode.attributes;
				if (!attributes || _isClobbered(currentNode)) return;
				ALLOWED_ATTR = _forkSharedAllowlist(hooks.uponSanitizeAttribute, ALLOWED_ATTR, DEFAULT_ALLOWED_ATTR, SET_CONFIG_ALLOWED_ATTR);
				const hookEvent = {
					attrName: "",
					attrValue: "",
					keepAttr: true,
					allowedAttributes: ALLOWED_ATTR,
					forceKeepAttr: void 0
				};
				let l = attributes.length;
				const lcTag = transformCaseFunc(currentNode.nodeName);
				while (l--) {
					const attr = attributes[l];
					const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
					const lcName = transformCaseFunc(name);
					const initValue = attrValue;
					let value = name === "value" ? initValue : stringTrim(initValue);
					hookEvent.attrName = lcName;
					hookEvent.attrValue = value;
					hookEvent.keepAttr = true;
					hookEvent.forceKeepAttr = void 0;
					_executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
					value = hookEvent.attrValue;
					if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
						_removeAttribute(name, currentNode, attr);
						value = SANITIZE_NAMED_PROPS_PREFIX + value;
					}
					if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
						_removeAttribute(name, currentNode, attr);
						continue;
					}
					if (lcName === "attributename" && stringMatch(value, "href")) {
						_removeAttribute(name, currentNode, attr);
						continue;
					}
					if (hookEvent.forceKeepAttr) continue;
					if (!hookEvent.keepAttr) {
						_removeAttribute(name, currentNode, attr);
						continue;
					}
					if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
						_removeAttribute(name, currentNode, attr);
						continue;
					}
					if (SAFE_FOR_TEMPLATES) value = _stripTemplateExpressions(value);
					if (!_isValidAttribute(lcTag, lcName, value)) {
						_removeAttribute(name, currentNode, attr);
						continue;
					}
					value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
					if (value !== initValue) _setAttributeValue(currentNode, name, namespaceURI, value);
				}
				_executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
			};
			/**
			* _sanitizeShadowDOM
			*
			* @param fragment to iterate over recursively
			*/
			const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
				let shadowNode = null;
				const shadowIterator = _createNodeIterator(fragment);
				_executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
				while (shadowNode = shadowIterator.nextNode()) {
					_executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
					_sanitizeElements(shadowNode, fragment);
					_sanitizeAttributes(shadowNode);
					if (_isDocumentFragment(shadowNode.content)) _sanitizeShadowDOM2(shadowNode.content);
					if (_readNodeType(shadowNode) === NODE_TYPE.element) {
						const innerSr = getShadowRoot(shadowNode);
						if (_isDocumentFragment(innerSr)) {
							_sanitizeAttachedShadowRoots(innerSr);
							_sanitizeShadowDOM2(innerSr);
						}
					}
				}
				_executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
			};
			/**
			* _sanitizeAttachedShadowRoots
			*
			* Walks `root` and feeds every attached shadow root we encounter into
			* the existing _sanitizeShadowDOM pipeline. The default node iterator
			* does not descend into shadow trees, so nodes inside an attached
			* shadow root would otherwise be skipped entirely.
			*
			* Two real input paths put attached shadow roots in front of us:
			*   1. IN_PLACE on a DOM node that already has shadow roots attached.
			*   2. DOM-node input where importNode(dirty, true) deep-clones the
			*      shadow root because it was created with `clonable: true`.
			*
			* This pass runs once, up front, so the main iteration loop (and the
			* existing _sanitizeShadowDOM template-content recursion) stay
			* untouched — string-input paths are not affected.
			*
			* @param root the subtree root to walk for attached shadow roots
			*/
			const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots(root) {
				const stack = [{
					node: root,
					shadow: null
				}];
				while (stack.length > 0) {
					const item = stack.pop();
					if (item.shadow) {
						_sanitizeShadowDOM2(item.shadow);
						continue;
					}
					const node = item.node;
					const isElement = _readNodeType(node) === NODE_TYPE.element;
					const childNodes = getChildNodes(node);
					if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push({
						node: childNodes[i],
						shadow: null
					});
					if (isElement) {
						const rootName = getNodeName ? getNodeName(node) : null;
						if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
							const content = node.content;
							if (_isDocumentFragment(content)) stack.push({
								node: content,
								shadow: null
							});
						}
					}
					if (isElement) {
						const sr = getShadowRoot(node);
						if (_isDocumentFragment(sr)) stack.push({
							node: null,
							shadow: sr
						}, {
							node: sr,
							shadow: null
						});
					}
				}
			};
			DOMPurify.sanitize = function(dirty) {
				let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
				let body = null;
				let importedNode = null;
				let currentNode = null;
				let returnNode = null;
				IS_EMPTY_INPUT = !dirty;
				if (IS_EMPTY_INPUT) dirty = "<!-->";
				if (typeof dirty !== "string" && !_isNode(dirty)) {
					dirty = stringifyValue(dirty);
					if (typeof dirty !== "string") throw typeErrorCreate("dirty is not a string, aborting");
				}
				if (!DOMPurify.isSupported) return dirty;
				if (SET_CONFIG) {
					ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
					ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
				} else _parseConfig(cfg);
				if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) ALLOWED_TAGS = clone(ALLOWED_TAGS);
				if (hooks.uponSanitizeAttribute.length > 0) ALLOWED_ATTR = clone(ALLOWED_ATTR);
				DOMPurify.removed = [];
				const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
				if (inPlace) {
					_neutralizePatchLinkage(dirty);
					const nn = _readNodeName(dirty);
					if (typeof nn === "string") {
						const tagName = transformCaseFunc(nn);
						if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
							_neutralizeRoot(dirty);
							throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
						}
					}
					if (_isClobbered(dirty)) {
						_neutralizeRoot(dirty);
						throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
					}
					try {
						_sanitizeAttachedShadowRoots(dirty);
					} catch (error) {
						_neutralizeRoot(dirty);
						throw error;
					}
				} else if (_isNode(dirty)) {
					body = _initDocument("<!---->");
					importedNode = body.ownerDocument.importNode(dirty, true);
					if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") body = importedNode;
					else if (importedNode.nodeName === "HTML") body = importedNode;
					else body.appendChild(importedNode);
					_sanitizeAttachedShadowRoots(importedNode);
				} else {
					if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
					body = _initDocument(dirty);
					if (!body) return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
				}
				if (body && FORCE_BODY) _forceRemove(body.firstChild);
				const walkRoot = inPlace ? dirty : body;
				try {
					const nodeIterator = _createNodeIterator(walkRoot);
					while (currentNode = nodeIterator.nextNode()) {
						_sanitizeElements(currentNode, walkRoot);
						_sanitizeAttributes(currentNode);
						if (_isDocumentFragment(currentNode.content)) _sanitizeShadowDOM2(currentNode.content);
					}
				} catch (error) {
					if (inPlace) {
						_neutralizeRoot(dirty);
						arrayForEach(DOMPurify.removed, (entry) => {
							if (entry.element) _neutralizeSubtree(entry.element);
						});
					}
					throw error;
				}
				if (inPlace) {
					arrayForEach(DOMPurify.removed, (entry) => {
						if (entry.element) _neutralizeSubtree(entry.element);
					});
					if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(dirty);
					return dirty;
				}
				if (RETURN_DOM) {
					if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(body);
					if (RETURN_DOM_FRAGMENT) {
						returnNode = createDocumentFragment.call(body.ownerDocument);
						while (body.firstChild) returnNode.appendChild(body.firstChild);
					} else returnNode = body;
					if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) returnNode = importNode.call(originalDocument, returnNode, true);
					return returnNode;
				}
				let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
				if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
				if (SAFE_FOR_TEMPLATES) serializedHTML = _stripTemplateExpressions(serializedHTML);
				return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
			};
			DOMPurify.setConfig = function() {
				let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
				_parseConfig(cfg);
				SET_CONFIG = true;
				SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
				SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
			};
			DOMPurify.clearConfig = function() {
				CONFIG = null;
				SET_CONFIG = false;
				SET_CONFIG_ALLOWED_TAGS = null;
				SET_CONFIG_ALLOWED_ATTR = null;
				trustedTypesPolicy = defaultTrustedTypesPolicy;
				emptyHTML = "";
			};
			DOMPurify.isValidAttribute = function(tag, attr, value) {
				if (!CONFIG) _parseConfig({});
				const lcTag = transformCaseFunc(tag);
				const lcName = transformCaseFunc(attr);
				return _isValidAttribute(lcTag, lcName, value);
			};
			DOMPurify.addHook = function(entryPoint, hookFunction) {
				if (typeof hookFunction !== "function") return;
				if (!objectHasOwnProperty(hooks, entryPoint)) return;
				arrayPush(hooks[entryPoint], hookFunction);
			};
			DOMPurify.removeHook = function(entryPoint, hookFunction) {
				if (!objectHasOwnProperty(hooks, entryPoint)) return;
				if (hookFunction !== void 0) {
					const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
					return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
				}
				return arrayPop(hooks[entryPoint]);
			};
			DOMPurify.removeHooks = function(entryPoint) {
				if (!objectHasOwnProperty(hooks, entryPoint)) return;
				hooks[entryPoint] = [];
			};
			DOMPurify.removeAllHooks = function() {
				hooks = _createHooksMap();
			};
			return DOMPurify;
		}
		var purify = createDOMPurify();
		//#endregion
		//#region node_modules/.pnpm/marked@18.0.11/node_modules/marked/lib/marked.esm.js
		/**
		* marked v18.0.11 - a markdown parser
		* Copyright (c) 2018-2026, MarkedJS. (MIT License)
		* Copyright (c) 2011-2018, Christopher Jeffrey. (MIT License)
		* https://github.com/markedjs/marked
		*/
		/**
		* DO NOT EDIT THIS FILE
		* The code in this file is generated from files in ./src/
		*/
		function A() {
			return {
				async: !1,
				breaks: !1,
				extensions: null,
				gfm: !0,
				hooks: null,
				pedantic: !1,
				renderer: null,
				silent: !1,
				tokenizer: null,
				walkTokens: null
			};
		}
		var R = A();
		function j(l) {
			R = l;
		}
		var z = { exec: () => null };
		function I(l) {
			let e = [];
			return (t) => {
				let n = Math.max(0, Math.min(3, t - 1)), s = e[n];
				return s || (s = l(n), e[n] = s), s;
			};
		}
		function k(l, e = "") {
			let t = typeof l == "string" ? l : l.source, n = {
				replace: (s, r) => {
					let i = typeof r == "string" ? r : r.source;
					return i = i.replace(m.caret, "$1"), t = t.replace(s, i), n;
				},
				getRegex: () => new RegExp(t, e)
			};
			return n;
		}
		var Oe = ((l = "") => {
			try {
				return !!new RegExp("(?<=1)(?<!1)" + l);
			} catch {
				return !1;
			}
		})();
		var m = {
			codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
			outputLinkReplace: /\\([\[\]])/g,
			indentCodeCompensation: /^(\s+)(?:```)/,
			beginningSpace: /^\s+/,
			endingHash: /#$/,
			startingSpaceChar: /^ /,
			endingSpaceChar: / $/,
			nonSpaceChar: /[^ ]/,
			newLineCharGlobal: /\n/g,
			tabCharGlobal: /\t/g,
			multipleSpaceGlobal: /\s+/g,
			blankLine: /^[ \t]*$/,
			doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
			blockquoteStart: /^ {0,3}>/,
			blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
			blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
			listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
			listIsTask: /^\[[ xX]\] +\S/,
			listReplaceTask: /^\[[ xX]\] +/,
			listTaskCheckbox: /\[[ xX]\]/,
			anyLine: /\n.*\n/,
			hrefBrackets: /^<(.*)>$/,
			tableDelimiter: /[:|]/,
			tableAlignChars: /^\||\| *$/g,
			tableRowBlankLine: /\n[ \t]*$/,
			tableAlignRight: /^ *-+: *$/,
			tableAlignCenter: /^ *:-+: *$/,
			tableAlignLeft: /^ *:-+ *$/,
			startATag: /^<a /i,
			endATag: /^<\/a>/i,
			startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
			endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
			startAngleBracket: /^</,
			endAngleBracket: />$/,
			pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
			unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
			escapeTest: /[&<>"']/,
			escapeReplace: /[&<>"']/g,
			escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
			escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
			caret: /(^|[^\[])\^/g,
			percentDecode: /%25/g,
			findPipe: /\|/g,
			splitPipe: / \|/,
			slashPipe: /\\\|/g,
			carriageReturn: /\r\n|\r/g,
			spaceLine: /^ +$/gm,
			notSpaceStart: /^\S*/,
			endingNewline: /\n$/,
			listItemRegex: (l) => new RegExp(`^( {0,3}${l})((?:[	 ][^\\n]*)?(?:\\n|$))`),
			nextBulletRegex: I((l) => new RegExp(`^ {0,${l}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)),
			hrRegex: I((l) => new RegExp(`^ {0,${l}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)),
			fencesBeginRegex: I((l) => new RegExp(`^ {0,${l}}(?:\`\`\`|~~~)`)),
			headingBeginRegex: I((l) => new RegExp(`^ {0,${l}}#`)),
			htmlBeginRegex: I((l) => new RegExp(`^ {0,${l}}<(?:[a-z].*>|!--)`, "i")),
			blockquoteBeginRegex: I((l) => new RegExp(`^ {0,${l}}>`))
		};
		var Te = /^(?:[ \t]*(?:\n|$))+/;
		var we = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
		var ye = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
		var q = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
		var Pe = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
		var U = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
		var oe = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
		var ae = k(oe).replace(/bull/g, U).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
		var Se = k(oe).replace(/bull/g, U).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
		var K = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/;
		var _e = /^[^\n]+/;
		var W = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
		var $e = k(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", W).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
		var Le = k(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, U).getRegex();
		var Q = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
		var X = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
		var Ee = k("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", X).replace("tag", Q).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
		var le = (l) => k(K).replace("hr", q).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", l).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Q).getRegex();
		var ze = le(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/);
		var Me = le(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/);
		var J = {
			blockquote: k(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Me).getRegex(),
			code: we,
			def: $e,
			fences: ye,
			heading: Pe,
			hr: q,
			html: Ee,
			lheading: ae,
			list: Le,
			newline: Te,
			paragraph: ze,
			table: z,
			text: _e
		};
		var se = k("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", q).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Q).getRegex();
		var Ie = {
			...J,
			lheading: Se,
			table: se,
			paragraph: k(K).replace("hr", q).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", se).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Q).getRegex()
		};
		var Ce = {
			...J,
			html: k(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", X).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
			def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
			heading: /^(#{1,6})(.*)(?:\n+|$)/,
			fences: z,
			lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
			paragraph: k(K).replace("hr", q).replace("heading", ` *#{1,6} *[^
		]`).replace("lheading", ae).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
		};
		var Be = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
		var De = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
		var ue = /^( {2,}|\\)\n(?!\s*$)/;
		var qe = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
		var _ = /[\p{P}\p{S}]/u;
		var C = /[\s\p{P}\p{S}]/u;
		var v = /[^\s\p{P}\p{S}]/u;
		var ve = k(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, C).getRegex();
		var He = /[\p{Pi}\p{Ps}"']/u;
		var pe = /(?!~)[\p{P}\p{S}]/u;
		var Ze = /(?!~)[\s\p{P}\p{S}]/u;
		var Ge = /(?:[^\s\p{P}\p{S}]|~)/u;
		var Qe = k(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Oe ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
		var ce = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
		var Ne = k(ce, "u").replace(/punct/g, _).getRegex();
		var je = k(ce, "u").replace(/punct/g, pe).getRegex();
		var Ue = k(/^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/, "u").replace(/openQuote/g, He).replace(/punct/g, _).getRegex();
		var he = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
		var Ke = k(he, "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, C).replace(/punct/g, _).getRegex();
		var We = k(he, "gu").replace(/notPunctSpace/g, Ge).replace(/punctSpace/g, Ze).replace(/punct/g, pe).getRegex();
		var Je = k("^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)", "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, C).replace(/punct/g, _).getRegex();
		var Ve = k("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, C).replace(/punct/g, _).getRegex();
		var et = k("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)", "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, C).replace(/punct/g, _).getRegex();
		var tt = k(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, _).getRegex();
		var rt = k("^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, C).replace(/punct/g, _).getRegex();
		var st = k(/\\(punct)/, "gu").replace(/punct/g, _).getRegex();
		var it = k(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
		var ot = k(X).replace("(?:-->|$)", "-->").getRegex();
		var at = k("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", ot).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
		var G = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/;
		var lt = k(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", G).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
		var ke = k(/^!?\[(label)\]\[(ref)\]/).replace("label", G).replace("ref", W).getRegex();
		var de = k(/^!?\[(ref)\](?:\[\])?/).replace("ref", W).getRegex();
		var ut = k("reflink|nolink(?!\\()", "g").replace("reflink", ke).replace("nolink", de).getRegex();
		var ie = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
		var V = {
			_backpedal: z,
			anyPunctuation: st,
			autolink: it,
			blockSkip: Qe,
			br: ue,
			code: De,
			del: z,
			delLDelim: z,
			delRDelim: z,
			emStrongLDelim: Ne,
			emStrongRDelimAst: Ke,
			emStrongRDelimUnd: Ve,
			escape: Be,
			link: lt,
			nolink: de,
			punctuation: ve,
			reflink: ke,
			reflinkSearch: ut,
			tag: at,
			text: qe,
			url: z
		};
		var pt = {
			...V,
			emStrongLDelim: Ue,
			emStrongRDelimAst: Je,
			emStrongRDelimUnd: et,
			link: k(/^!?\[(label)\]\((.*?)\)/).replace("label", G).getRegex(),
			reflink: k(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", G).getRegex()
		};
		var F = {
			...V,
			emStrongRDelimAst: We,
			emStrongLDelim: je,
			delLDelim: tt,
			delRDelim: rt,
			url: k(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", ie).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
			_backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
			del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,
			text: k(/^(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", ie).getRegex()
		};
		var ct = {
			...F,
			br: k(ue).replace("{2,}", "*").getRegex(),
			text: k(F.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
		};
		var H = {
			normal: J,
			gfm: Ie,
			pedantic: Ce
		};
		var B = {
			normal: V,
			gfm: F,
			breaks: ct,
			pedantic: pt
		};
		var ht = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&#39;"
		};
		var ge = (l) => ht[l];
		function T(l, e) {
			if (e) {
				if (m.escapeTest.test(l)) return l.replace(m.escapeReplace, ge);
			} else if (m.escapeTestNoEncode.test(l)) return l.replace(m.escapeReplaceNoEncode, ge);
			return l;
		}
		function Y(l) {
			try {
				l = encodeURI(l).replace(m.percentDecode, "%");
			} catch {
				return null;
			}
			return l;
		}
		function ee(l, e) {
			let n = l.replace(m.findPipe, (r, i, o) => {
				let u = !1, a = i;
				for (; --a >= 0 && o[a] === "\\";) u = !u;
				return u ? "|" : " |";
			}).split(m.splitPipe), s = 0;
			if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e) if (n.length > e) n.splice(e);
			else for (; n.length < e;) n.push("");
			for (; s < n.length; s++) n[s] = n[s].trim().replace(m.slashPipe, "|");
			return n;
		}
		function $(l, e, t) {
			let n = l.length;
			if (n === 0) return "";
			let s = 0;
			for (; s < n;) {
				let r = l.charAt(n - s - 1);
				if (r === e && !t) s++;
				else if (r !== e && t) s++;
				else break;
			}
			return l.slice(0, n - s);
		}
		function te(l) {
			let e = l.split(`
		`), t = e.length - 1;
			for (; t >= 0 && m.blankLine.test(e[t]);) t--;
			return e.length - t <= 2 ? l : e.slice(0, t + 1).join(`
		`);
		}
		function fe(l, e) {
			if (l.indexOf(e[1]) === -1) return -1;
			let t = 0;
			for (let n = 0; n < l.length; n++) if (l[n] === "\\") n++;
			else if (l[n] === e[0]) t++;
			else if (l[n] === e[1] && (t--, t < 0)) return n;
			return t > 0 ? -2 : -1;
		}
		function me(l, e = 0) {
			let t = e, n = "";
			for (let s of l) if (s === "	") {
				let r = 4 - t % 4;
				n += " ".repeat(r), t += r;
			} else n += s, t++;
			return n;
		}
		function xe(l, e, t, n, s) {
			let r = e.href, i = e.title || null, o = l[1].replace(s.other.outputLinkReplace, "$1"), u = l[0].charAt(0) === "!";
			n.state.inLink = !0;
			let a = n.state.linkEmitted, p = n.state.inRawBlock;
			n.state.linkEmitted = !1;
			let c = n.inlineTokens(o), h = n.state.linkEmitted;
			if (n.state.linkEmitted = a, n.state.inLink = !1, !u) {
				if (h) {
					n.state.inRawBlock = p;
					return;
				}
				n.state.linkEmitted = !0;
			}
			return {
				type: u ? "image" : "link",
				raw: t,
				href: r,
				title: i,
				text: o,
				tokens: c
			};
		}
		function kt(l, e, t) {
			let n = l.match(t.other.indentCodeCompensation);
			if (n === null) return e;
			let s = n[1];
			return e.split(`
		`).map((r) => {
				let i = r.match(t.other.beginningSpace);
				if (i === null) return r;
				let [o] = i;
				return o.length >= s.length ? r.slice(s.length) : r;
			}).join(`
		`);
		}
		var y = class {
			options;
			rules;
			lexer;
			constructor(e) {
				this.options = e || R;
			}
			space(e) {
				let t = this.rules.block.newline.exec(e);
				if (t && t[0].length > 0) return {
					type: "space",
					raw: t[0]
				};
			}
			code(e) {
				let t = this.rules.block.code.exec(e);
				if (t) {
					let n = this.options.pedantic ? t[0] : te(t[0]);
					return {
						type: "code",
						raw: n,
						codeBlockStyle: "indented",
						text: n.replace(this.rules.other.codeRemoveIndent, "")
					};
				}
			}
			fences(e) {
				let t = this.rules.block.fences.exec(e);
				if (t) {
					let n = t[0], s = kt(n, t[3] || "", this.rules);
					return {
						type: "code",
						raw: n,
						lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2],
						text: s
					};
				}
			}
			heading(e) {
				let t = this.rules.block.heading.exec(e);
				if (t) {
					let n = t[2].trim();
					if (this.rules.other.endingHash.test(n)) {
						let s = $(n, "#");
						(this.options.pedantic || !s || this.rules.other.endingSpaceChar.test(s)) && (n = s.trim());
					}
					return {
						type: "heading",
						raw: $(t[0], `
		`),
						depth: t[1].length,
						text: n,
						tokens: this.lexer.inline(n)
					};
				}
			}
			hr(e) {
				let t = this.rules.block.hr.exec(e);
				if (t) return {
					type: "hr",
					raw: $(t[0], `
		`)
				};
			}
			blockquote(e) {
				let t = this.rules.block.blockquote.exec(e);
				if (t) {
					let n = $(t[0], `
		`).split(`
		`), s = "", r = "", i = [];
					for (; n.length > 0;) {
						let o = !1, u = [], a;
						for (a = 0; a < n.length; a++) if (this.rules.other.blockquoteStart.test(n[a])) u.push(n[a]), o = !0;
						else if (!o) u.push(n[a]);
						else break;
						n = n.slice(a);
						let p = u.join(`
		`), c = p.replace(this.rules.other.blockquoteSetextReplace, `
		    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
						s = s ? `${s}
		${p}` : p, r = r ? `${r}
		${c}` : c;
						let h = this.lexer.state.top;
						if (this.lexer.state.top = !0, this.lexer.blockTokens(c, i, !0), this.lexer.state.top = h, n.length === 0) break;
						let d = i.at(-1);
						if (d?.type === "code") break;
						if (d?.type === "blockquote") {
							let O = d, g = n.join(`
		`), w = O.raw + `
		` + g.replace(this.rules.other.blockquoteSetextReplace2, ""), E = this.blockquote(w);
							i[i.length - 1] = E, s = `${s}
		${g}`, r = r.substring(0, r.length - O.text.length) + E.text;
							break;
						} else if (d?.type === "list") {
							let O = d, g = O.raw + `
		` + n.join(`
		`), w = this.list(g);
							i[i.length - 1] = w, s = s.substring(0, s.length - d.raw.length) + w.raw, r = r.substring(0, r.length - O.raw.length) + w.raw, n = g.substring(i.at(-1).raw.length).split(`
		`);
							continue;
						}
					}
					return {
						type: "blockquote",
						raw: s,
						tokens: i,
						text: r
					};
				}
			}
			list(e) {
				let t = this.rules.block.list.exec(e);
				if (t) {
					let n = t[1].trim(), s = n.length > 1, r = {
						type: "list",
						raw: "",
						ordered: s,
						start: s ? +n.slice(0, -1) : "",
						loose: !1,
						items: []
					};
					n = s ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = s ? n : "[*+-]");
					let i = this.rules.other.listItemRegex(n), o = !1;
					for (; e;) {
						let a = !1, p = "", c = "";
						if (!(t = i.exec(e)) || this.rules.block.hr.test(e)) break;
						p = t[0], e = e.substring(p.length);
						let h = me(t[2].split(`
		`, 1)[0], t[1].length), d = e.split(`
		`, 1)[0], O = !h.trim(), g = 0;
						if (this.options.pedantic ? (g = 2, c = h.trimStart()) : O ? g = t[1].length + 1 : (g = h.search(this.rules.other.nonSpaceChar), g = g > 4 ? 1 : g, c = h.slice(g), g += t[1].length), O && this.rules.other.blankLine.test(d) && (p += d + `
		`, e = e.substring(d.length + 1), a = !0), !a) {
							let w = this.rules.other.nextBulletRegex(g), E = this.rules.other.hrRegex(g), ne = this.rules.other.fencesBeginRegex(g), re = this.rules.other.headingBeginRegex(g), be = this.rules.other.htmlBeginRegex(g), Re = this.rules.other.blockquoteBeginRegex(g);
							for (; e;) {
								let N = e.split(`
		`, 1)[0], D;
								if (d = N, this.options.pedantic ? (d = d.replace(this.rules.other.listReplaceNesting, "  "), D = d) : D = d.replace(this.rules.other.tabCharGlobal, "    "), ne.test(d) || re.test(d) || be.test(d) || Re.test(d) || w.test(d) || E.test(d)) break;
								if (D.search(this.rules.other.nonSpaceChar) >= g || !d.trim()) c += `
		` + D.slice(g);
								else {
									if (O || h.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || ne.test(h) || re.test(h) || E.test(h)) break;
									c += `
		` + d;
								}
								O = !d.trim(), p += N + `
		`, e = e.substring(N.length + 1), h = D.slice(g);
							}
						}
						r.loose || (o ? r.loose = !0 : this.rules.other.doubleBlankLine.test(p) && (o = !0)), r.items.push({
							type: "list_item",
							raw: p,
							task: !!this.options.gfm && this.rules.other.listIsTask.test(c),
							loose: !1,
							text: c,
							tokens: []
						}), r.raw += p;
					}
					let u = r.items.at(-1);
					if (u) u.raw = u.raw.trimEnd(), u.text = u.text.trimEnd();
					else return;
					r.raw = r.raw.trimEnd();
					for (let a of r.items) if (this.lexer.state.top = !1, a.tokens = this.lexer.blockTokens(a.text, []), !r.loose) {
						let p = a.tokens.filter((h) => h.type === "space");
						r.loose = p.length > 0 && p.some((h) => this.rules.other.anyLine.test(h.raw));
					}
					for (let a of r.items) {
						let p = a.tokens[0];
						if (a.task && (p?.type === "text" || p?.type === "paragraph")) {
							a.text = a.text.replace(this.rules.other.listReplaceTask, ""), p.raw = p.raw.replace(this.rules.other.listReplaceTask, ""), p.text = p.text.replace(this.rules.other.listReplaceTask, "");
							for (let h = this.lexer.inlineQueue.length - 1; h >= 0; h--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[h].src)) {
								this.lexer.inlineQueue[h].src = this.lexer.inlineQueue[h].src.replace(this.rules.other.listReplaceTask, "");
								break;
							}
							let c = this.rules.other.listTaskCheckbox.exec(a.raw);
							if (c) {
								let h = {
									type: "checkbox",
									raw: c[0] + " ",
									checked: c[0] !== "[ ]"
								};
								a.checked = h.checked, r.loose ? a.tokens[0] && ["paragraph", "text"].includes(a.tokens[0].type) && "tokens" in a.tokens[0] && a.tokens[0].tokens ? (a.tokens[0].raw = h.raw + a.tokens[0].raw, a.tokens[0].text = h.raw + a.tokens[0].text, a.tokens[0].tokens.unshift(h)) : a.tokens.unshift({
									type: "paragraph",
									raw: h.raw,
									text: h.raw,
									tokens: [h]
								}) : a.tokens.unshift(h);
							}
						} else a.task && (a.task = !1);
					}
					if (r.loose) for (let a of r.items) {
						a.loose = !0;
						for (let p of a.tokens) p.type === "text" && (p.type = "paragraph");
					}
					return r;
				}
			}
			html(e) {
				let t = this.rules.block.html.exec(e);
				if (t) {
					let n = te(t[0]);
					return {
						type: "html",
						block: !0,
						raw: n,
						pre: t[1] === "pre" || t[1] === "script" || t[1] === "style",
						text: n
					};
				}
			}
			def(e) {
				let t = this.rules.block.def.exec(e);
				if (t) {
					let n = t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), s = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
					return {
						type: "def",
						tag: n,
						raw: $(t[0], `
		`),
						href: s,
						title: r
					};
				}
			}
			table(e) {
				let t = this.rules.block.table.exec(e);
				if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
				let n = ee(t[1]), s = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), r = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
		`) : [], i = {
					type: "table",
					raw: $(t[0], `
		`),
					header: [],
					align: [],
					rows: []
				};
				if (n.length === s.length) {
					for (let o of s) this.rules.other.tableAlignRight.test(o) ? i.align.push("right") : this.rules.other.tableAlignCenter.test(o) ? i.align.push("center") : this.rules.other.tableAlignLeft.test(o) ? i.align.push("left") : i.align.push(null);
					for (let o = 0; o < n.length; o++) i.header.push({
						text: n[o],
						tokens: this.lexer.inline(n[o]),
						header: !0,
						align: i.align[o]
					});
					for (let o of r) i.rows.push(ee(o, i.header.length).map((u, a) => ({
						text: u,
						tokens: this.lexer.inline(u),
						header: !1,
						align: i.align[a]
					})));
					return i;
				}
			}
			lheading(e) {
				let t = this.rules.block.lheading.exec(e);
				if (t) {
					let n = t[1].trim();
					return {
						type: "heading",
						raw: $(t[0], `
		`),
						depth: t[2].charAt(0) === "=" ? 1 : 2,
						text: n,
						tokens: this.lexer.inline(n)
					};
				}
			}
			paragraph(e) {
				let t = this.rules.block.paragraph.exec(e);
				if (t) {
					let n = t[1].charAt(t[1].length - 1) === `
		` ? t[1].slice(0, -1) : t[1];
					return {
						type: "paragraph",
						raw: t[0],
						text: n,
						tokens: this.lexer.inline(n)
					};
				}
			}
			text(e) {
				let t = this.rules.block.text.exec(e);
				if (t) return {
					type: "text",
					raw: t[0],
					text: t[0],
					tokens: this.lexer.inline(t[0])
				};
			}
			escape(e) {
				let t = this.rules.inline.escape.exec(e);
				if (t) return {
					type: "escape",
					raw: t[0],
					text: t[1]
				};
			}
			tag(e) {
				let t = this.rules.inline.tag.exec(e);
				if (t) return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = !0 : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = !1), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = !0 : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = !1), {
					type: "html",
					raw: t[0],
					inLink: this.lexer.state.inLink,
					inRawBlock: this.lexer.state.inRawBlock,
					block: !1,
					text: t[0]
				};
			}
			link(e) {
				let t = this.rules.inline.link.exec(e);
				if (t) {
					let n = t[2].trim();
					if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n)) {
						if (!this.rules.other.endAngleBracket.test(n)) return;
						let i = $(n.slice(0, -1), "\\");
						if ((n.length - i.length) % 2 === 0) return;
					} else {
						let i = fe(t[2], "()");
						if (i === -2) return;
						if (i > -1) {
							let u = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + i;
							t[2] = t[2].substring(0, i), t[0] = t[0].substring(0, u).trim(), t[3] = "";
						}
					}
					let s = t[2], r = "";
					if (this.options.pedantic) {
						let i = this.rules.other.pedanticHrefTitle.exec(s);
						i && (s = i[1], r = i[3]);
					} else r = t[3] ? t[3].slice(1, -1) : "";
					return s = s.trim(), this.rules.other.startAngleBracket.test(s) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n) ? s = s.slice(1) : s = s.slice(1, -1)), xe(t, {
						href: s && s.replace(this.rules.inline.anyPunctuation, "$1"),
						title: r && r.replace(this.rules.inline.anyPunctuation, "$1")
					}, t[0], this.lexer, this.rules);
				}
			}
			reflink(e, t) {
				let n;
				if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
					let r = t[(n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " ").toLowerCase()];
					if (!r) {
						let i = n[0].charAt(0);
						return {
							type: "text",
							raw: i,
							text: i
						};
					}
					return xe(n, r, n[0], this.lexer, this.rules);
				}
			}
			emStrong(e, t, n = "") {
				let s = this.rules.inline.emStrongLDelim.exec(e);
				if (!s || !s[1] && !s[2] && !s[3] && !s[4] || s[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
				if (!(s[1] || s[3] || "") || !n || this.rules.inline.punctuation.exec(n)) {
					let i = [...s[0]].length - 1, o, u, a = i, p = 0, c = s[0][0], h = n === c, d = c === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
					for (d.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = d.exec(t)) !== null;) {
						if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o) continue;
						if (u = [...o].length, s[3] || s[4]) {
							a += u;
							continue;
						} else if (s[5] || s[6]) {
							if (i % 3 && !((i + u) % 3)) {
								p += u;
								continue;
							}
							if (h) break;
						}
						if (a -= u, a > 0) continue;
						u = Math.min(u, u + a + p);
						let O = [...s[0]][0].length, g = e.slice(0, i + s.index + O + u);
						if (Math.min(i, u) % 2) {
							let E = g.slice(1, -1);
							return {
								type: "em",
								raw: g,
								text: E,
								tokens: this.lexer.inlineTokens(E)
							};
						}
						let w = g.slice(2, -2);
						return {
							type: "strong",
							raw: g,
							text: w,
							tokens: this.lexer.inlineTokens(w)
						};
					}
				}
			}
			codespan(e) {
				let t = this.rules.inline.code.exec(e);
				if (t) {
					let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), s = this.rules.other.nonSpaceChar.test(n), r = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
					return s && r && (n = n.substring(1, n.length - 1)), {
						type: "codespan",
						raw: t[0],
						text: n
					};
				}
			}
			br(e) {
				let t = this.rules.inline.br.exec(e);
				if (t) return {
					type: "br",
					raw: t[0]
				};
			}
			del(e, t, n = "") {
				let s = this.rules.inline.delLDelim.exec(e);
				if (!s) return;
				if (!(s[1] || "") || !n || this.rules.inline.punctuation.exec(n)) {
					let i = [...s[0]].length - 1, o, u, a = i, p = this.rules.inline.delRDelim;
					for (p.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = p.exec(t)) !== null;) {
						if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o || (u = [...o].length, u !== i)) continue;
						if (s[3] || s[4]) {
							a += u;
							continue;
						}
						if (a -= u, a > 0) continue;
						u = Math.min(u, u + a);
						let c = [...s[0]][0].length, h = e.slice(0, i + s.index + c + u), d = h.slice(i, -i);
						return {
							type: "del",
							raw: h,
							text: d,
							tokens: this.lexer.inlineTokens(d)
						};
					}
				}
			}
			autolink(e) {
				let t = this.rules.inline.autolink.exec(e);
				if (t) {
					let n, s;
					return t[2] === "@" ? (n = t[1], s = "mailto:" + n) : (n = t[1], s = n), {
						type: "link",
						raw: t[0],
						text: n,
						href: s,
						tokens: [{
							type: "text",
							raw: n,
							text: n
						}]
					};
				}
			}
			url(e) {
				let t;
				if (t = this.rules.inline.url.exec(e)) {
					let n, s;
					if (t[2] === "@") n = t[0], s = "mailto:" + n;
					else {
						let r;
						do
							r = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
						while (r !== t[0]);
						n = t[0], t[1] === "www." ? s = "http://" + t[0] : s = t[0];
					}
					return {
						type: "link",
						raw: t[0],
						text: n,
						href: s,
						tokens: [{
							type: "text",
							raw: n,
							text: n
						}]
					};
				}
			}
			inlineText(e) {
				let t = this.rules.inline.text.exec(e);
				if (t) {
					let n = this.lexer.state.inRawBlock;
					return {
						type: "text",
						raw: t[0],
						text: t[0],
						escaped: n
					};
				}
			}
		};
		var x = class l {
			tokens;
			options;
			state;
			inlineQueue;
			tokenizer;
			constructor(e) {
				this.tokens = [], this.tokens.links = Object.create(null), this.options = e || R, this.options.tokenizer = this.options.tokenizer || new y(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = {
					inLink: !1,
					inRawBlock: !1,
					linkEmitted: !1,
					top: !0
				};
				let t = {
					other: m,
					block: H.normal,
					inline: B.normal
				};
				this.options.pedantic ? (t.block = H.pedantic, t.inline = B.pedantic) : this.options.gfm && (t.block = H.gfm, this.options.breaks ? t.inline = B.breaks : t.inline = B.gfm), this.tokenizer.rules = t;
			}
			static get rules() {
				return {
					block: H,
					inline: B
				};
			}
			static lex(e, t) {
				return new l(t).lex(e);
			}
			static lexInline(e, t) {
				return new l(t).inlineTokens(e);
			}
			lex(e) {
				e = e.replace(m.carriageReturn, `
		`), this.blockTokens(e, this.tokens);
				for (let t = 0; t < this.inlineQueue.length; t++) {
					let n = this.inlineQueue[t];
					this.inlineTokens(n.src, n.tokens);
				}
				return this.inlineQueue = [], this.tokens;
			}
			blockTokens(e, t = [], n = !1) {
				this.tokenizer.lexer = this, this.options.pedantic && (e = e.replace(m.tabCharGlobal, "    ").replace(m.spaceLine, ""));
				let s = 1 / 0;
				for (; e;) {
					if (e.length < s) s = e.length;
					else {
						this.infiniteLoopError(e.charCodeAt(0));
						break;
					}
					let r;
					if (this.options.extensions?.block?.some((o) => (r = o.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), !0) : !1)) continue;
					if (r = this.tokenizer.space(e)) {
						e = e.substring(r.raw.length);
						let o = t.at(-1);
						r.raw.length === 1 && o !== void 0 ? o.raw += `
		` : t.push(r);
						continue;
					}
					if (r = this.tokenizer.code(e)) {
						e = e.substring(r.raw.length);
						let o = t.at(-1);
						o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
		`) ? "" : `
		`) + r.raw, o.text += `
		` + r.text, this.inlineQueue.at(-1).src = o.text) : t.push(r);
						continue;
					}
					if (r = this.tokenizer.fences(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.heading(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.hr(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.blockquote(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.list(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.html(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.def(e)) {
						e = e.substring(r.raw.length);
						let o = t.at(-1);
						o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
		`) ? "" : `
		`) + r.raw, o.text += `
		` + r.raw, this.inlineQueue.at(-1).src = o.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = {
							href: r.href,
							title: r.title
						}, t.push(r));
						continue;
					}
					if (r = this.tokenizer.table(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.lheading(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					let i = e;
					if (this.options.extensions?.startBlock) {
						let o = 1 / 0, u = e.slice(1), a;
						this.options.extensions.startBlock.forEach((p) => {
							a = p.call({ lexer: this }, u), typeof a == "number" && a >= 0 && (o = Math.min(o, a));
						}), o < 1 / 0 && o >= 0 && (i = e.substring(0, o + 1));
					}
					if (this.state.top && (r = this.tokenizer.paragraph(i))) {
						let o = t.at(-1);
						n && o?.type === "paragraph" ? (o.raw += (o.raw.endsWith(`
		`) ? "" : `
		`) + r.raw, o.text += `
		` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r), n = i.length !== e.length, e = e.substring(r.raw.length);
						continue;
					}
					if (r = this.tokenizer.text(e)) {
						e = e.substring(r.raw.length);
						let o = t.at(-1);
						o?.type === "text" ? (o.raw += (o.raw.endsWith(`
		`) ? "" : `
		`) + r.raw, o.text += `
		` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r);
						continue;
					}
					if (e) {
						this.infiniteLoopError(e.charCodeAt(0));
						break;
					}
				}
				return this.state.top = !0, t;
			}
			inline(e, t = []) {
				return this.inlineQueue.push({
					src: e,
					tokens: t
				}), t;
			}
			linkInText(e) {
				if (!e.includes("[")) return !1;
				let t = this.tokenizer.rules.inline.link;
				for (let n of e.matchAll(this.tokenizer.rules.inline.blockSkip)) if (t.test(n[0]) && e.charAt(n.index - 1) !== "!") return !0;
				for (let n of e.matchAll(this.tokenizer.rules.inline.reflinkSearch)) {
					let s = n[0], r = s.lastIndexOf("[");
					if (!(s.charAt(0) === "!" || !Object.hasOwn(this.tokens.links, s.slice(r + 1, -1))) && !(r > 1 && this.linkInText(s.slice(1, r - 1)))) return !0;
				}
				return !1;
			}
			inlineTokens(e, t = []) {
				this.tokenizer.lexer = this;
				let n = e;
				if (this.tokens.links && e.includes("[")) {
					let o = this.tokenizer.rules.inline.reflinkSearch, u = (a) => {
						let p = a.lastIndexOf("[");
						if (!Object.hasOwn(this.tokens.links, a.slice(p + 1, -1))) return a;
						if (p > 1 && a.charAt(0) !== "!") {
							let c = a.slice(1, p - 1);
							if (this.linkInText(c)) return "[" + c.replace(o, u) + "][" + "a".repeat(a.length - p - 2) + "]";
						}
						return "[" + "a".repeat(a.length - 2) + "]";
					};
					n = n.replace(o, u);
				}
				n = n.replace(this.tokenizer.rules.inline.anyPunctuation, (o) => "+".repeat(o.length)), n = n.replace(this.tokenizer.rules.inline.blockSkip, (o, u, a) => {
					let p = a ? a.length : 0;
					return o.slice(0, p) + "[" + "a".repeat(o.length - p - 2) + "]";
				}), n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
				let s = !1, r = "", i = 1 / 0;
				for (; e;) {
					if (e.length < i) i = e.length;
					else {
						this.infiniteLoopError(e.charCodeAt(0));
						break;
					}
					s || (r = ""), s = !1;
					let o;
					if (this.options.extensions?.inline?.some((a) => (o = a.call({ lexer: this }, e, t)) ? (e = e.substring(o.raw.length), t.push(o), !0) : !1)) continue;
					if (o = this.tokenizer.escape(e)) {
						e = e.substring(o.raw.length), t.push(o);
						continue;
					}
					if (o = this.tokenizer.tag(e)) {
						e = e.substring(o.raw.length), t.push(o);
						continue;
					}
					if (o = this.tokenizer.link(e)) {
						e = e.substring(o.raw.length), t.push(o);
						continue;
					}
					if (o = this.tokenizer.reflink(e, this.tokens.links)) {
						e = e.substring(o.raw.length);
						let a = t.at(-1);
						o.type === "text" && a?.type === "text" ? (a.raw += o.raw, a.text += o.text) : t.push(o);
						continue;
					}
					if (o = this.tokenizer.emStrong(e, n, r)) {
						e = e.substring(o.raw.length), t.push(o);
						continue;
					}
					if (o = this.tokenizer.codespan(e)) {
						e = e.substring(o.raw.length), t.push(o);
						continue;
					}
					if (o = this.tokenizer.br(e)) {
						e = e.substring(o.raw.length), t.push(o);
						continue;
					}
					if (o = this.tokenizer.del(e, n, r)) {
						e = e.substring(o.raw.length), t.push(o);
						continue;
					}
					if (o = this.tokenizer.autolink(e)) {
						e = e.substring(o.raw.length), t.push(o);
						continue;
					}
					if (!this.state.inLink && (o = this.tokenizer.url(e))) {
						e = e.substring(o.raw.length), t.push(o);
						continue;
					}
					let u = e;
					if (this.options.extensions?.startInline) {
						let a = 1 / 0, p = e.slice(1), c;
						this.options.extensions.startInline.forEach((h) => {
							c = h.call({ lexer: this }, p), typeof c == "number" && c >= 0 && (a = Math.min(a, c));
						}), a < 1 / 0 && a >= 0 && (u = e.substring(0, a + 1));
					}
					if (o = this.tokenizer.inlineText(u)) {
						e = e.substring(o.raw.length), o.raw.slice(-1) !== "_" && (r = o.raw.slice(-1)), s = !0;
						let a = t.at(-1);
						a?.type === "text" ? (a.raw += o.raw, a.text += o.text) : t.push(o);
						continue;
					}
					if (e) {
						this.infiniteLoopError(e.charCodeAt(0));
						break;
					}
				}
				return t;
			}
			infiniteLoopError(e) {
				let t = "Infinite loop on byte: " + e;
				if (this.options.silent) console.error(t);
				else throw new Error(t);
			}
		};
		var P = class {
			options;
			parser;
			constructor(e) {
				this.options = e || R;
			}
			space(e) {
				return "";
			}
			code({ text: e, lang: t, escaped: n }) {
				let s = (t || "").match(m.notSpaceStart)?.[0], r = e.replace(m.endingNewline, "") + `
		`;
				return s ? "<pre><code class=\"language-" + T(s) + "\">" + (n ? r : T(r, !0)) + `</code></pre>
		` : "<pre><code>" + (n ? r : T(r, !0)) + `</code></pre>
		`;
			}
			blockquote({ tokens: e }) {
				return `<blockquote>
		${this.parser.parse(e)}</blockquote>
		`;
			}
			html({ text: e }) {
				return e;
			}
			def(e) {
				return "";
			}
			heading({ tokens: e, depth: t }) {
				return `<h${t}>${this.parser.parseInline(e)}</h${t}>
		`;
			}
			hr(e) {
				return `<hr>
		`;
			}
			list(e) {
				let t = e.ordered, n = e.start, s = "";
				for (let o = 0; o < e.items.length; o++) {
					let u = e.items[o];
					s += this.listitem(u);
				}
				let r = t ? "ol" : "ul", i = t && n !== 1 ? " start=\"" + n + "\"" : "";
				return "<" + r + i + `>
		` + s + "</" + r + `>
		`;
			}
			listitem(e) {
				return `<li>${this.parser.parse(e.tokens)}</li>
		`;
			}
			checkbox({ checked: e }) {
				return "<input " + (e ? "checked=\"\" " : "") + "disabled=\"\" type=\"checkbox\"> ";
			}
			paragraph({ tokens: e }) {
				return `<p>${this.parser.parseInline(e)}</p>
		`;
			}
			table(e) {
				let t = "", n = "";
				for (let r = 0; r < e.header.length; r++) n += this.tablecell(e.header[r]);
				t += this.tablerow({ text: n });
				let s = "";
				for (let r = 0; r < e.rows.length; r++) {
					let i = e.rows[r];
					n = "";
					for (let o = 0; o < i.length; o++) n += this.tablecell(i[o]);
					s += this.tablerow({ text: n });
				}
				return s && (s = `<tbody>${s}</tbody>`), `<table>
		<thead>
		` + t + `</thead>
		` + s + `</table>
		`;
			}
			tablerow({ text: e }) {
				return `<tr>
		${e}</tr>
		`;
			}
			tablecell(e) {
				let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
				return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
		`;
			}
			strong({ tokens: e }) {
				return `<strong>${this.parser.parseInline(e)}</strong>`;
			}
			em({ tokens: e }) {
				return `<em>${this.parser.parseInline(e)}</em>`;
			}
			codespan({ text: e }) {
				return `<code>${T(e, !0)}</code>`;
			}
			br(e) {
				return "<br>";
			}
			del({ tokens: e }) {
				return `<del>${this.parser.parseInline(e)}</del>`;
			}
			link({ href: e, title: t, tokens: n }) {
				let s = this.parser.parseInline(n), r = Y(e);
				if (r === null) return s;
				e = r;
				let i = "<a href=\"" + e + "\"";
				return t && (i += " title=\"" + T(t) + "\""), i += ">" + s + "</a>", i;
			}
			image({ href: e, title: t, text: n, tokens: s }) {
				s && (n = this.parser.parseInline(s, this.parser.textRenderer));
				let r = Y(e);
				if (r === null) return T(n);
				e = r;
				let i = `<img src="${e}" alt="${T(n)}"`;
				return t && (i += ` title="${T(t)}"`), i += ">", i;
			}
			text(e) {
				return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : T(e.text);
			}
		};
		var L = class {
			strong({ text: e }) {
				return e;
			}
			em({ text: e }) {
				return e;
			}
			codespan({ text: e }) {
				return e;
			}
			del({ text: e }) {
				return e;
			}
			html({ text: e }) {
				return e;
			}
			text({ text: e }) {
				return e;
			}
			link({ text: e }) {
				return "" + e;
			}
			image({ text: e }) {
				return "" + e;
			}
			br() {
				return "";
			}
			checkbox({ raw: e }) {
				return e;
			}
		};
		var b = class l {
			options;
			renderer;
			textRenderer;
			constructor(e) {
				this.options = e || R, this.options.renderer = this.options.renderer || new P(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new L();
			}
			static parse(e, t) {
				return new l(t).parse(e);
			}
			static parseInline(e, t) {
				return new l(t).parseInline(e);
			}
			parse(e) {
				this.renderer.parser = this;
				let t = "";
				for (let n = 0; n < e.length; n++) {
					let s = e[n];
					if (this.options.extensions?.renderers?.[s.type]) {
						let i = s, o = this.options.extensions.renderers[i.type].call({ parser: this }, i);
						if (o !== !1 || ![
							"space",
							"hr",
							"heading",
							"code",
							"table",
							"blockquote",
							"list",
							"checkbox",
							"html",
							"def",
							"paragraph",
							"text"
						].includes(i.type)) {
							t += o || "";
							continue;
						}
					}
					let r = s;
					switch (r.type) {
						case "space":
							t += this.renderer.space(r);
							break;
						case "hr":
							t += this.renderer.hr(r);
							break;
						case "heading":
							t += this.renderer.heading(r);
							break;
						case "code":
							t += this.renderer.code(r);
							break;
						case "table":
							t += this.renderer.table(r);
							break;
						case "blockquote":
							t += this.renderer.blockquote(r);
							break;
						case "list":
							t += this.renderer.list(r);
							break;
						case "checkbox":
							t += this.renderer.checkbox(r);
							break;
						case "html":
							t += this.renderer.html(r);
							break;
						case "def":
							t += this.renderer.def(r);
							break;
						case "paragraph":
							t += this.renderer.paragraph(r);
							break;
						case "text":
							t += this.renderer.text(r);
							break;
						default: {
							let i = "Token with \"" + r.type + "\" type was not found.";
							if (this.options.silent) return console.error(i), "";
							throw new Error(i);
						}
					}
				}
				return t;
			}
			parseInline(e, t = this.renderer) {
				this.renderer.parser = this;
				let n = "";
				for (let s = 0; s < e.length; s++) {
					let r = e[s];
					if (this.options.extensions?.renderers?.[r.type]) {
						let o = this.options.extensions.renderers[r.type].call({ parser: this }, r);
						if (o !== !1 || ![
							"escape",
							"html",
							"link",
							"image",
							"checkbox",
							"strong",
							"em",
							"codespan",
							"br",
							"del",
							"text"
						].includes(r.type)) {
							n += o || "";
							continue;
						}
					}
					let i = r;
					switch (i.type) {
						case "escape":
							n += t.text(i);
							break;
						case "html":
							n += t.html(i);
							break;
						case "link":
							n += t.link(i);
							break;
						case "image":
							n += t.image(i);
							break;
						case "checkbox":
							n += t.checkbox(i);
							break;
						case "strong":
							n += t.strong(i);
							break;
						case "em":
							n += t.em(i);
							break;
						case "codespan":
							n += t.codespan(i);
							break;
						case "br":
							n += t.br(i);
							break;
						case "del":
							n += t.del(i);
							break;
						case "text":
							n += t.text(i);
							break;
						default: {
							let o = "Token with \"" + i.type + "\" type was not found.";
							if (this.options.silent) return console.error(o), "";
							throw new Error(o);
						}
					}
				}
				return n;
			}
		};
		var S = class {
			options;
			block;
			constructor(e) {
				this.options = e || R;
			}
			static passThroughHooks = /* @__PURE__ */ new Set([
				"preprocess",
				"postprocess",
				"processAllTokens",
				"emStrongMask"
			]);
			static passThroughHooksRespectAsync = /* @__PURE__ */ new Set([
				"preprocess",
				"postprocess",
				"processAllTokens"
			]);
			preprocess(e) {
				return e;
			}
			postprocess(e) {
				return e;
			}
			processAllTokens(e) {
				return e;
			}
			emStrongMask(e) {
				return e;
			}
			provideLexer(e = this.block) {
				return e ? x.lex : x.lexInline;
			}
			provideParser(e = this.block) {
				return e ? b.parse : b.parseInline;
			}
		};
		var Z = class {
			defaults = A();
			options = this.setOptions;
			parse = this.parseMarkdown(!0);
			parseInline = this.parseMarkdown(!1);
			Parser = b;
			Renderer = P;
			TextRenderer = L;
			Lexer = x;
			Tokenizer = y;
			Hooks = S;
			constructor(...e) {
				this.use(...e);
			}
			walkTokens(e, t) {
				let n = [];
				for (let s of e) switch (n = n.concat(t.call(this, s)), s.type) {
					case "table": {
						let r = s;
						for (let i of r.header) n = n.concat(this.walkTokens(i.tokens, t));
						for (let i of r.rows) for (let o of i) n = n.concat(this.walkTokens(o.tokens, t));
						break;
					}
					case "list": {
						let r = s;
						n = n.concat(this.walkTokens(r.items, t));
						break;
					}
					default: {
						let r = s;
						this.defaults.extensions?.childTokens?.[r.type] ? this.defaults.extensions.childTokens[r.type].forEach((i) => {
							let o = r[i].flat(1 / 0);
							n = n.concat(this.walkTokens(o, t));
						}) : r.tokens && (n = n.concat(this.walkTokens(r.tokens, t)));
					}
				}
				return n;
			}
			use(...e) {
				let t = this.defaults.extensions || {
					renderers: {},
					childTokens: {}
				};
				return e.forEach((n) => {
					let s = { ...n };
					if (s.async = this.defaults.async || s.async || !1, n.extensions && (n.extensions.forEach((r) => {
						if (!r.name) throw new Error("extension name required");
						if ("renderer" in r) {
							let i = t.renderers[r.name];
							i ? t.renderers[r.name] = function(...o) {
								let u = r.renderer.apply(this, o);
								return u === !1 && (u = i.apply(this, o)), u;
							} : t.renderers[r.name] = r.renderer;
						}
						if ("tokenizer" in r) {
							if (!r.level || r.level !== "block" && r.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
							let i = t[r.level];
							i ? i.unshift(r.tokenizer) : t[r.level] = [r.tokenizer], r.start && (r.level === "block" ? t.startBlock ? t.startBlock.push(r.start) : t.startBlock = [r.start] : r.level === "inline" && (t.startInline ? t.startInline.push(r.start) : t.startInline = [r.start]));
						}
						"childTokens" in r && r.childTokens && (t.childTokens[r.name] = r.childTokens);
					}), s.extensions = t), n.renderer) {
						let r = this.defaults.renderer || new P(this.defaults);
						for (let i in n.renderer) {
							if (!(i in r)) throw new Error(`renderer '${i}' does not exist`);
							if (["options", "parser"].includes(i)) continue;
							let o = i, u = n.renderer[o], a = r[o];
							r[o] = (...p) => {
								let c = u.apply(r, p);
								return c === !1 && (c = a.apply(r, p)), c || "";
							};
						}
						s.renderer = r;
					}
					if (n.tokenizer) {
						let r = this.defaults.tokenizer || new y(this.defaults);
						for (let i in n.tokenizer) {
							if (!(i in r)) throw new Error(`tokenizer '${i}' does not exist`);
							if ([
								"options",
								"rules",
								"lexer"
							].includes(i)) continue;
							let o = i, u = n.tokenizer[o], a = r[o];
							r[o] = (...p) => {
								let c = u.apply(r, p);
								return c === !1 && (c = a.apply(r, p)), c;
							};
						}
						s.tokenizer = r;
					}
					if (n.hooks) {
						let r = this.defaults.hooks || new S();
						for (let i in n.hooks) {
							if (!(i in r)) throw new Error(`hook '${i}' does not exist`);
							if (["options", "block"].includes(i)) continue;
							let o = i, u = n.hooks[o], a = r[o];
							S.passThroughHooks.has(i) ? r[o] = (p) => {
								if (this.defaults.async && S.passThroughHooksRespectAsync.has(i)) return (async () => {
									let h = await u.call(r, p);
									return a.call(r, h);
								})();
								let c = u.call(r, p);
								return a.call(r, c);
							} : r[o] = (...p) => {
								if (this.defaults.async) return (async () => {
									let h = await u.apply(r, p);
									return h === !1 && (h = await a.apply(r, p)), h;
								})();
								let c = u.apply(r, p);
								return c === !1 && (c = a.apply(r, p)), c;
							};
						}
						s.hooks = r;
					}
					if (n.walkTokens) {
						let r = this.defaults.walkTokens, i = n.walkTokens;
						s.walkTokens = function(o) {
							let u = [];
							return u.push(i.call(this, o)), r && (u = u.concat(r.call(this, o))), u;
						};
					}
					this.defaults = {
						...this.defaults,
						...s
					};
				}), this;
			}
			setOptions(e) {
				return this.defaults = {
					...this.defaults,
					...e
				}, this;
			}
			lexer(e, t) {
				return x.lex(e, t ?? this.defaults);
			}
			parser(e, t) {
				return b.parse(e, t ?? this.defaults);
			}
			parseMarkdown(e) {
				return (n, s) => {
					let r = { ...s }, i = {
						...this.defaults,
						...r
					}, o = this.onError(!!i.silent, !!i.async);
					if (this.defaults.async === !0 && r.async === !1) return o(/* @__PURE__ */ new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
					if (typeof n > "u" || n === null) return o(/* @__PURE__ */ new Error("marked(): input parameter is undefined or null"));
					if (typeof n != "string") return o(/* @__PURE__ */ new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
					if (i.hooks && (i.hooks.options = i, i.hooks.block = e), i.async) return (async () => {
						let u = i.hooks ? await i.hooks.preprocess(n) : n, p = await (i.hooks ? await i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(u, i), c = i.hooks ? await i.hooks.processAllTokens(p) : p;
						i.walkTokens && await Promise.all(this.walkTokens(c, i.walkTokens));
						let d = await (i.hooks ? await i.hooks.provideParser(e) : e ? b.parse : b.parseInline)(c, i);
						return i.hooks ? await i.hooks.postprocess(d) : d;
					})().catch(o);
					try {
						i.hooks && (n = i.hooks.preprocess(n));
						let a = (i.hooks ? i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(n, i);
						i.hooks && (a = i.hooks.processAllTokens(a)), i.walkTokens && this.walkTokens(a, i.walkTokens);
						let c = (i.hooks ? i.hooks.provideParser(e) : e ? b.parse : b.parseInline)(a, i);
						return i.hooks && (c = i.hooks.postprocess(c)), c;
					} catch (u) {
						return o(u);
					}
				};
			}
			onError(e, t) {
				return (n) => {
					if (n.message += `
		Please report this to https://github.com/markedjs/marked.`, e) {
						let s = "<p>An error occurred:</p><pre>" + T(n.message + "", !0) + "</pre>";
						return t ? Promise.resolve(s) : s;
					}
					if (t) return Promise.reject(n);
					throw n;
				};
			}
		};
		var M = new Z();
		function f(l, e) {
			return M.parse(l, e);
		}
		f.options = f.setOptions = function(l) {
			return M.setOptions(l), f.defaults = M.defaults, j(f.defaults), f;
		};
		f.getDefaults = A;
		f.defaults = R;
		function dt(...l) {
			return M.use(...l), f.defaults = M.defaults, j(f.defaults), f;
		}
		f.use = dt;
		f.walkTokens = function(l, e) {
			return M.walkTokens(l, e);
		};
		f.parseInline = M.parseInline;
		f.Parser = b;
		f.parser = b.parse;
		f.Renderer = P;
		f.TextRenderer = L;
		f.Lexer = x;
		f.lexer = x.lex;
		f.Tokenizer = y;
		f.Hooks = S;
		f.parse = f;
		f.options;
		f.setOptions;
		f.walkTokens;
		f.parseInline;
		b.parse;
		x.lex;
		//#endregion
		//#region src/client/comment-markdown.ts
		/** GitHub review comments get their own renderer.
		*
		*  The Host's Markdown component renders untrusted model output, so it
		*  disables raw HTML by contract — and review bots write HTML: `<sup>`
		*  footers, `<details>` disclosures, `<img>` badges. Rendered through that
		*  component those tags arrive as literal text. A pull request comment is a
		*  different kind of document with a different threat model: it comes from
		*  GitHub, and rendering it the way GitHub does means parsing GFM and keeping
		*  a bounded set of HTML — which is what this module does, against an
		*  allowlist, with everything else dropped by the sanitizer. */
		/** Tags GitHub itself permits that carry meaning in a review comment.
		*  Everything outside this list — scripts, styles, iframes, forms, event
		*  handlers — is removed rather than escaped. */
		const ALLOWED_TAGS = [
			"p",
			"br",
			"hr",
			"div",
			"span",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"strong",
			"em",
			"b",
			"i",
			"del",
			"s",
			"ins",
			"mark",
			"small",
			"sup",
			"sub",
			"kbd",
			"a",
			"img",
			"ul",
			"ol",
			"li",
			"input",
			"blockquote",
			"pre",
			"code",
			"table",
			"thead",
			"tbody",
			"tr",
			"th",
			"td",
			"details",
			"summary"
		];
		const ALLOWED_ATTR = [
			"href",
			"src",
			"alt",
			"title",
			"align",
			"colspan",
			"rowspan",
			"start",
			"type",
			"checked",
			"disabled",
			"open",
			"class"
		];
		const marked = new Z({
			gfm: true,
			breaks: true,
			async: false
		});
		/** Parse one comment body into HTML. Bot machinery written as HTML comments
		*  disappears here: the sanitizer strips comment nodes, and this drops the
		*  blank runs they leave behind so the prose keeps its spacing. */
		function commentBodyHtml(body) {
			const source = body.replace(/<!--[\s\S]*?-->/gu, "").replace(/[^\S\n]+$/gmu, "").replace(/\n{3,}/gu, "\n\n").trim();
			return marked.parse(source);
		}
		/** Sanitize parsed comment HTML against the allowlist and make every link
		*  leave the app safely. Returns '' where no DOM exists (server rendering),
		*  because unsanitized HTML must never reach the caller. */
		function sanitizeCommentHtml(html, purify$1 = purify) {
			if (typeof purify$1.sanitize !== "function" || purify$1.isSupported !== true) return "";
			return purify$1.sanitize(html, {
				ALLOWED_TAGS,
				ALLOWED_ATTR,
				ALLOW_DATA_ATTR: false,
				FORBID_ATTR: [
					"style",
					"srcset",
					"formaction",
					"form"
				],
				ADD_ATTR: ["target", "rel"]
			});
		}
		/** One review comment body, ready for `dangerouslySetInnerHTML`. */
		function renderCommentBody(body, purify$2 = purify) {
			return sanitizeCommentHtml(commentBodyHtml(body), purify$2);
		}
		/** Open sanitized links in the browser instead of inside the app shell, and
		*  keep comment checkboxes inert. Installed once, on import, so no render
		*  path can reach the sanitizer before its hooks. */
		function installCommentSanitizerHooks(purify$3 = purify) {
			if (typeof purify$3.addHook !== "function" || purify$3.isSupported !== true) return;
			purify$3.addHook("afterSanitizeAttributes", (node) => {
				if (node.nodeName === "A") {
					node.setAttribute("target", "_blank");
					node.setAttribute("rel", "noopener noreferrer");
				}
				if (node.nodeName === "INPUT") node.setAttribute("disabled", "");
			});
		}
		installCommentSanitizerHooks();
		//#endregion
		//#region src/client/mention.ts
		/** `@` completion for the review reply composer.
		*
		*  GitHub resolves `@login` server-side, so completion is convenience only:
		*  every function here works on the draft text, never on the network. */
		/** GitHub logins are alphanumeric with dashes; app accounts add a `[bot]`
		*  suffix, which the user reaches by continuing to type rather than by us
		*  matching it here. */
		const HANDLE = /(?:^|[^\w@/-])@([\w-]*)$/u;
		const MAX_HANDLE_CHARS = 39;
		/** The handle the caret is currently inside, when it is inside one. */
		function mentionQueryAt(text, caret) {
			const before = text.slice(0, caret);
			const match = HANDLE.exec(before);
			const query = match?.[1];
			if (match === void 0 || match === null || query === void 0 || query.length > MAX_HANDLE_CHARS) return void 0;
			return {
				query,
				start: caret - query.length - 1
			};
		}
		/** Swap the typed handle for the chosen login, leaving a separating space. */
		function applyMention(text, caret, mention, login) {
			const completed = `@${login} `;
			return {
				text: `${text.slice(0, mention.start)}${completed}${text.slice(caret)}`,
				caret: mention.start + completed.length
			};
		}
		//#endregion
		//#region src/client/menu-navigation.ts
		/** Wrapping keyboard navigation shared by the plugin's popup lists. */
		function menuNavigationIndex(current, count, key) {
			if (count <= 0) return 0;
			if (key === "Home") return 0;
			if (key === "End") return count - 1;
			return (current + (key === "ArrowDown" ? 1 : -1) + count) % count;
		}
		//#endregion
		//#region src/client/MentionTextarea.tsx
		/** How long the draft must sit still before the repository is asked who `@al`
		*  might be; one request per keystroke would rate-limit the token. */
		const SUGGEST_DEBOUNCE_MS = 200;
		/** A comment composer that completes `@handles` from the repository's
		*  mentionable users. GitHub notifies on the text alone, so the popup is a
		*  convenience: typing a login by hand works exactly as well. */
		function MentionTextarea({ value, placeholder, suggestLabel, maxLength = 2e3, autoFocus = false, disabled = false, suggest, onChange, onSubmit }) {
			const areaRef = useRef(null);
			const [mention, setMention] = useState();
			const [users, setUsers] = useState([]);
			const [activeIndex, setActiveIndex] = useState(0);
			const [caretTarget, setCaretTarget] = useState();
			const open = mention !== void 0 && users.length > 0;
			useEffect(() => {
				if (mention === void 0) {
					setUsers([]);
					return;
				}
				let cancelled = false;
				const timer = setTimeout(() => {
					suggest(mention.query).then((found) => {
						if (cancelled) return;
						setUsers(found);
						setActiveIndex(0);
					}, () => {
						if (!cancelled) setUsers([]);
					});
				}, SUGGEST_DEBOUNCE_MS);
				return () => {
					cancelled = true;
					clearTimeout(timer);
				};
			}, [mention, suggest]);
			useLayoutEffect(() => {
				if (caretTarget === void 0 || areaRef.current === null) return;
				areaRef.current.setSelectionRange(caretTarget, caretTarget);
				setCaretTarget(void 0);
			}, [caretTarget, value]);
			const track = (area) => {
				setMention(mentionQueryAt(area.value, area.selectionStart ?? area.value.length));
			};
			const complete = (login) => {
				const area = areaRef.current;
				if (area === null || mention === void 0) return;
				const applied = applyMention(area.value, area.selectionStart ?? area.value.length, mention, login);
				setMention(void 0);
				setUsers([]);
				setCaretTarget(applied.caret);
				onChange(applied.text);
			};
			const handleKeyDown = (event) => {
				if (open) {
					if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
						event.preventDefault();
						setActiveIndex((current) => menuNavigationIndex(current, users.length, event.key));
						return;
					}
					if (event.key === "Enter" || event.key === "Tab") {
						const login = users[activeIndex]?.login;
						if (login !== void 0) {
							event.preventDefault();
							complete(login);
							return;
						}
					}
					if (event.key === "Escape") {
						event.preventDefault();
						setMention(void 0);
						setUsers([]);
						return;
					}
				}
				if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && onSubmit !== void 0) {
					event.preventDefault();
					onSubmit();
				}
			};
			return /* @__PURE__ */ jsxs("span", {
				style: mentionField,
				children: [/* @__PURE__ */ jsx("textarea", {
					ref: areaRef,
					className: diffCommentTextareaClass,
					style: diffCommentTextarea,
					value,
					maxLength,
					placeholder,
					disabled,
					autoFocus,
					"aria-autocomplete": "list",
					onChange: (event) => {
						onChange(event.currentTarget.value);
						track(event.currentTarget);
					},
					onKeyUp: (event) => {
						track(event.currentTarget);
					},
					onClick: (event) => {
						track(event.currentTarget);
					},
					onBlur: () => {
						setMention(void 0);
					},
					onKeyDown: handleKeyDown
				}), !open ? null : /* @__PURE__ */ jsx("span", {
					role: "listbox",
					"aria-label": suggestLabel,
					style: mentionList,
					children: users.map((user, index) => /* @__PURE__ */ jsxs("button", {
						type: "button",
						role: "option",
						"aria-selected": index === activeIndex,
						style: {
							...mentionItem,
							...index === activeIndex ? mentionItemActive : {}
						},
						onMouseEnter: () => {
							setActiveIndex(index);
						},
						onMouseDown: (event) => {
							event.preventDefault();
						},
						onClick: () => {
							complete(user.login);
						},
						children: [user.avatarUrl === void 0 ? null : /* @__PURE__ */ jsx("img", {
							src: user.avatarUrl,
							alt: "",
							width: 16,
							height: 16,
							loading: "lazy",
							referrerPolicy: "no-referrer",
							style: mentionAvatar
						}), user.login]
					}, user.login))
				})]
			});
		}
		//#endregion
		//#region src/client/ReviewThreadCard.tsx
		const BOT_SUFFIX = "[bot]";
		/** GitHub prints an app account as its name plus a Bot pill rather than as the
		*  raw `name[bot]` login. GraphQL already drops that suffix, so the flag from
		*  the API decides and the suffix is only stripped for display. */
		function identity(author) {
			return author.endsWith(BOT_SUFFIX) ? author.slice(0, -5) : author;
		}
		function CommentBody({ comment, t, now, first }) {
			const name = identity(comment.author);
			const age = relativeAge(comment.createdAt, now);
			return /* @__PURE__ */ jsxs("div", {
				style: {
					...diffGhComment,
					...first ? {} : diffGhCommentNext
				},
				children: [/* @__PURE__ */ jsxs("div", {
					style: diffCommentCardMeta,
					children: [/* @__PURE__ */ jsxs("span", {
						style: diffGhCommentIdentity,
						children: [
							comment.avatarUrl === void 0 ? null : /* @__PURE__ */ jsx("img", {
								src: comment.avatarUrl,
								alt: "",
								width: 16,
								height: 16,
								loading: "lazy",
								referrerPolicy: "no-referrer",
								style: diffGhCommentAvatar,
								onError: (event) => {
									event.currentTarget.style.display = "none";
								}
							}),
							/* @__PURE__ */ jsxs("span", {
								style: diffGhCommentAuthor,
								children: ["@", name]
							}),
							comment.bot !== true ? null : /* @__PURE__ */ jsx("span", {
								style: diffThreadBadge,
								children: t("reviewThreadBot")
							}),
							age === void 0 ? null : /* @__PURE__ */ jsx("span", {
								style: diffGhCommentAge,
								children: t("reviewThreadAgo", { age })
							})
						]
					}), /* @__PURE__ */ jsx(Tooltip, {
						label: t("reviewThreadOpenOnGitHub"),
						side: "bottom",
						delayMs: 250,
						children: /* @__PURE__ */ jsx("a", {
							href: comment.url,
							target: "_blank",
							rel: "noopener noreferrer",
							style: diffGhCommentLink,
							"aria-label": t("reviewThreadOpenOnGitHub"),
							children: /* @__PURE__ */ jsx(IconRightUpOutlineRegular, { size: 14 })
						})
					})]
				}), /* @__PURE__ */ jsx("div", {
					style: diffCommentCardText,
					className: "dshClaudeDiffCommentBody",
					dangerouslySetInnerHTML: { __html: renderCommentBody(comment.body) }
				})]
			});
		}
		/** One GitHub review conversation, anchored on its diff line: every comment in
		*  the thread, plus the two things a reviewer expects to do with it — answer it
		*  and close it. A resolved thread collapses, because the diff is about what
		*  still needs attention. */
		function ReviewThreadCard({ thread, t, now, anchorKey, active = false, suggest, onReply, onResolvedChange, onSendToAi }) {
			const [expanded, setExpanded] = useState(false);
			const [replying, setReplying] = useState(false);
			const [draft, setDraft] = useState("");
			const [busy, setBusy] = useState(false);
			const [error, setError] = useState();
			const first = thread.comments[0];
			if (first === void 0) return null;
			const collapsed = thread.resolved && !expanded;
			const send = () => {
				const body = draft.trim();
				if (body.length === 0 || busy) return;
				setBusy(true);
				setError(void 0);
				onReply(body).then(() => {
					setDraft("");
					setReplying(false);
				}, (reason) => {
					setError(reason instanceof Error ? reason.message : t("reviewThreadReplyFailed"));
				}).finally(() => {
					setBusy(false);
				});
			};
			const toggleResolved = () => {
				if (busy) return;
				setBusy(true);
				setError(void 0);
				onResolvedChange(!thread.resolved).catch((reason) => {
					setError(reason instanceof Error ? reason.message : t("reviewThreadResolveFailed"));
				}).finally(() => {
					setBusy(false);
				});
			};
			const frame = {
				...anchorKey === void 0 ? {} : { "data-review-target": anchorKey },
				...active ? { "data-review-active": "true" } : {},
				style: {
					...diffCommentBlock,
					...active ? diffCommentBlockActive : {}
				}
			};
			if (collapsed) return /* @__PURE__ */ jsx("div", {
				...frame,
				children: /* @__PURE__ */ jsxs("button", {
					type: "button",
					"aria-expanded": false,
					style: diffThreadSummary,
					onClick: () => {
						setExpanded(true);
					},
					children: [
						/* @__PURE__ */ jsx("span", {
							style: diffThreadBadge,
							children: t("reviewThreadResolved")
						}),
						/* @__PURE__ */ jsxs("span", {
							style: diffGhCommentAuthor,
							children: ["@", identity(first.author)]
						}),
						/* @__PURE__ */ jsx("span", {
							style: diffThreadExcerpt,
							children: first.body.split("\n")[0]
						})
					]
				})
			});
			return /* @__PURE__ */ jsxs("div", {
				...frame,
				children: [
					!thread.resolved && !thread.outdated ? null : /* @__PURE__ */ jsxs("div", {
						style: diffThreadBadges,
						children: [thread.resolved ? /* @__PURE__ */ jsx("span", {
							style: diffThreadBadge,
							children: t("reviewThreadResolved")
						}) : null, thread.outdated ? /* @__PURE__ */ jsx("span", {
							style: diffThreadBadge,
							children: t("reviewThreadOutdated")
						}) : null]
					}),
					thread.comments.map((comment, index) => /* @__PURE__ */ jsx(CommentBody, {
						comment,
						t,
						now,
						first: index === 0
					}, comment.id)),
					error === void 0 ? null : /* @__PURE__ */ jsx("p", {
						style: diffCommentError,
						children: error
					}),
					replying ? /* @__PURE__ */ jsxs("div", {
						"data-review-reply": "",
						style: diffThreadComposer,
						children: [
							/* @__PURE__ */ jsx("span", {
								style: diffThreadComposerCaption,
								children: t("reviewThreadReplyTo", { author: identity(thread.comments[thread.comments.length - 1]?.author ?? first.author) })
							}),
							/* @__PURE__ */ jsx(MentionTextarea, {
								value: draft,
								placeholder: t("reviewThreadReplyPlaceholder"),
								suggestLabel: t("reviewThreadMention"),
								disabled: busy,
								autoFocus: true,
								suggest,
								onChange: setDraft,
								onSubmit: send
							}),
							/* @__PURE__ */ jsxs("div", {
								style: diffCommentActions,
								children: [/* @__PURE__ */ jsx("button", {
									type: "button",
									style: diffCommentActionButton,
									disabled: busy,
									onClick: () => {
										setReplying(false);
										setError(void 0);
									},
									children: t("reviewCommentCancel")
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									style: {
										...diffCommentActionButton,
										...diffCommentSubmitButton
									},
									disabled: busy || draft.trim().length === 0,
									onClick: send,
									children: t("reviewThreadSend")
								})]
							})
						]
					}) : /* @__PURE__ */ jsxs("div", {
						style: diffCommentActions,
						children: [
							onSendToAi === void 0 || thread.resolved ? null : /* @__PURE__ */ jsx("button", {
								type: "button",
								style: diffCommentActionButton,
								disabled: busy,
								onClick: onSendToAi,
								children: t("reviewThreadSendToAi")
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								style: diffCommentActionButton,
								disabled: busy,
								onClick: () => {
									setReplying(true);
								},
								children: t("reviewThreadReply")
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								style: diffCommentActionButton,
								disabled: busy,
								onClick: toggleResolved,
								children: thread.resolved ? t("reviewThreadUnresolve") : t("reviewThreadResolve")
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/ClaudeDiffPanel.tsx
		function pathFromHeader(line) {
			return /^diff --git a\/(.+) b\/(.+)$/u.exec(line)?.[2];
		}
		function parseUnifiedDiff(patch) {
			const files = [];
			let path;
			let lines = [];
			const flush = () => {
				if (path === void 0) return;
				const content = lines.filter((line) => !line.startsWith("diff --git ") && !line.startsWith("index ") && !line.startsWith("--- ") && !line.startsWith("+++ "));
				files.push({
					path,
					additions: content.filter((line) => line.startsWith("+")).length,
					deletions: content.filter((line) => line.startsWith("-")).length,
					lines: content
				});
			};
			for (const line of patch.split(/\r?\n/u)) {
				const nextPath = pathFromHeader(line);
				if (nextPath !== void 0) {
					flush();
					path = nextPath;
					lines = [line];
				} else if (path !== void 0) lines.push(line);
			}
			flush();
			return files;
		}
		function numberDiffLines(lines) {
			const numbered = [];
			let oldLine = 0;
			let newLine = 0;
			let previousOldEnd;
			let previousNewEnd = 0;
			let expandable = false;
			for (const line of lines) {
				const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u.exec(line);
				if (hunk !== null) {
					const nextOld = Number(hunk[1]);
					const nextNew = Number(hunk[3]);
					const oldCount = Number(hunk[2] ?? 1);
					const newCount = Number(hunk[4] ?? 1);
					if (previousOldEnd === void 0) {
						expandable = oldCount > 0 && newCount > 0;
						if (expandable && nextOld > 1) numbered.push({
							line: "",
							kind: "collapsed",
							gap: {
								oldStart: 1,
								newStart: 1,
								count: nextOld - 1,
								position: "top"
							}
						});
					} else if (nextOld > previousOldEnd) numbered.push({
						line: "",
						kind: "collapsed",
						gap: {
							oldStart: previousOldEnd,
							newStart: previousNewEnd,
							count: nextOld - previousOldEnd,
							position: "middle"
						}
					});
					oldLine = nextOld;
					newLine = nextNew;
					previousOldEnd = nextOld + oldCount;
					previousNewEnd = nextNew + newCount;
					numbered.push({
						line,
						kind: "hunk"
					});
					continue;
				}
				if (line.startsWith("+")) {
					numbered.push({
						line,
						kind: "add",
						newLine
					});
					newLine += 1;
				} else if (line.startsWith("-")) {
					numbered.push({
						line,
						kind: "delete",
						oldLine
					});
					oldLine += 1;
				} else {
					numbered.push({
						line,
						kind: "context",
						oldLine,
						newLine
					});
					oldLine += 1;
					newLine += 1;
				}
			}
			if (expandable && previousOldEnd !== void 0) numbered.push({
				line: "",
				kind: "collapsed",
				gap: {
					oldStart: previousOldEnd,
					newStart: previousNewEnd,
					position: "bottom"
				}
			});
			return numbered;
		}
		/**
		* Splice revealed working-tree lines (keyed by new-side line number) into the
		* collapsed gaps. Expansion only ever grows a gap's edges, so each gap is a
		* top run + remaining gap + bottom run; `total` (file line count) turns the
		* open-ended tail gap into a bounded one.
		*/
		function expandDiffRows(rows, revealed, total) {
			const out = [];
			for (const row of rows) {
				const gap = row.gap;
				if (row.kind !== "collapsed" || gap === void 0) {
					out.push(row);
					continue;
				}
				const count = gap.count ?? (total === void 0 ? void 0 : Math.max(0, total - gap.newStart + 1));
				const context = (offset) => ({
					line: ` ${revealed.get(gap.newStart + offset) ?? ""}`,
					kind: "context",
					oldLine: gap.oldStart + offset,
					newLine: gap.newStart + offset
				});
				let top = 0;
				while ((count === void 0 || top < count) && revealed.has(gap.newStart + top)) top += 1;
				let bottom = 0;
				if (count !== void 0) while (bottom < count - top && revealed.has(gap.newStart + count - 1 - bottom)) bottom += 1;
				for (let offset = 0; offset < top; offset += 1) out.push(context(offset));
				const remaining = count === void 0 ? void 0 : count - top - bottom;
				if (remaining === void 0 || remaining > 0) out.push({
					...row,
					gap: {
						...gap,
						oldStart: gap.oldStart + top,
						newStart: gap.newStart + top,
						...remaining === void 0 ? {} : { count: remaining }
					}
				});
				if (count !== void 0) for (let offset = count - bottom; offset < count; offset += 1) out.push(context(offset));
			}
			return out;
		}
		/** Everything in this diff still waiting on the reader, in reading order:
		*  files as the panel lists them, lines as the file reads. Resolved threads are
		*  collapsed by design, and a comment on a file this diff does not render has
		*  nowhere to scroll to, so neither is a stop. */
		function reviewTargets(files, comments, threads) {
			const targets = [];
			for (const file of files) {
				const inFile = [...threads.filter((thread) => thread.path === file.path && !thread.resolved && thread.line !== void 0).map((thread) => ({
					key: `thread:${thread.id}`,
					path: thread.path,
					line: thread.line ?? 0,
					side: thread.side
				})), ...comments.filter((comment) => comment.path === file.path).map((comment) => ({
					key: `comment:${comment.id}`,
					path: comment.path,
					line: comment.line,
					side: comment.side
				}))];
				targets.push(...inFile.sort((left, right) => left.line - right.line || left.side.localeCompare(right.side)));
			}
			return targets;
		}
		/**
		* Anchor for a drag from row `from` to row `to`: every commentable row in
		* between on the same side as the first row, collapsed to its first/last line.
		*/
		function rangeCommentAnchor(anchors, from, to) {
			const side = anchors[from]?.side;
			if (side === void 0) return void 0;
			const lines = anchors.slice(Math.min(from, to), Math.max(from, to) + 1).flatMap((anchor) => anchor?.side === side ? [anchor.line] : []);
			const line = Math.max(...lines);
			const startLine = Math.min(...lines);
			return startLine < line ? {
				line,
				side,
				startLine
			} : {
				line,
				side
			};
		}
		/** Which working-tree line a comment on this rendered diff row refers to. */
		function commentAnchorForLine(entry) {
			if (entry.kind === "add" || entry.kind === "context") return entry.newLine === void 0 ? void 0 : {
				line: entry.newLine,
				side: "new"
			};
			if (entry.kind === "delete") return entry.oldLine === void 0 ? void 0 : {
				line: entry.oldLine,
				side: "old"
			};
		}
		function DiffLine({ entry, addLabel, selected, onComment, onDragStart, onDragEnter }) {
			const style = entry.kind === "add" ? diffLineAdd : entry.kind === "delete" ? diffLineDelete : entry.kind === "hunk" ? diffLineHunk : diffLineContext;
			const lineNumber = entry.oldLine === void 0 && entry.newLine === void 0 ? "" : entry.oldLine === void 0 ? String(entry.newLine) : entry.newLine === void 0 ? String(entry.oldLine) : String(entry.newLine);
			return /* @__PURE__ */ jsxs("div", {
				className: diffLineRowClass,
				style: {
					...diffLine,
					...style,
					...selected ? diffLineSelected : {}
				},
				onPointerEnter: onDragEnter,
				children: [
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: diffCommentButtonClass,
						disabled: onComment === void 0,
						"aria-label": addLabel,
						onPointerDown: (event) => {
							if (event.button !== 0 || onDragStart === void 0) return;
							event.preventDefault();
							if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
							onDragStart();
						},
						onClick: (event) => {
							if (event.detail === 0) onComment?.();
						},
						children: "+"
					}),
					/* @__PURE__ */ jsx("span", {
						style: diffLineNumber,
						children: lineNumber
					}),
					/* @__PURE__ */ jsx("span", {
						style: diffLineMarker,
						children: entry.kind === "add" ? "+" : entry.kind === "delete" ? "−" : " "
					}),
					/* @__PURE__ */ jsx("span", {
						style: diffLineText,
						children: entry.line.slice(entry.kind === "hunk" ? 0 : 1)
					})
				]
			});
		}
		function ChevronGlyph({ direction }) {
			return /* @__PURE__ */ jsx("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 14 14",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx("path", { d: direction === "up" ? "M3 8.5l4-4 4 4" : "M3 5.5l4 4 4-4" })
			});
		}
		/** "N unmodified lines" separator with GitHub-style expanders: ↑ above the first hunk, ↑↓ between hunks, ↓ after the last. */
		function DiffGapRow({ gap, t, busy, onExpand }) {
			const button = (direction) => /* @__PURE__ */ jsx("button", {
				type: "button",
				style: diffGapButton,
				disabled: busy || onExpand === void 0,
				"aria-label": t(direction === "up" ? "diffExpandUp" : "diffExpandDown"),
				title: t(direction === "up" ? "diffExpandUp" : "diffExpandDown"),
				onClick: () => onExpand?.(gap, direction),
				children: /* @__PURE__ */ jsx(ChevronGlyph, { direction })
			});
			return /* @__PURE__ */ jsxs("div", {
				style: {
					...diffLine,
					...diffLineHunk
				},
				children: [/* @__PURE__ */ jsxs("span", {
					style: diffGapControls,
					children: [gap.position === "bottom" ? null : button("up"), gap.position === "top" ? null : button("down")]
				}), /* @__PURE__ */ jsx("span", {
					style: diffLineText,
					children: gap.count === void 0 ? t("diffUnmodifiedTail") : t("diffUnmodifiedLines", { count: gap.count })
				})]
			});
		}
		function CommentGlyph() {
			return /* @__PURE__ */ jsx("svg", {
				width: "11",
				height: "11",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.6",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx("path", { d: "M14 9.5a2 2 0 0 1-2 2H6l-3.5 2.5V4a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2z" })
			});
		}
		/** The undo arrow: a hook bending back to the left. Drawn inline because the
		*  primitives icon set has no undo icon, and its refresh circle reads as
		*  "reload" rather than "discard these changes". */
		function RevertGlyph() {
			return /* @__PURE__ */ jsxs("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				focusable: "false",
				children: [/* @__PURE__ */ jsx("path", {
					d: "M5.5 3.5 2.5 6.5l3 3",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}), /* @__PURE__ */ jsx("path", {
					d: "M2.75 6.5h6.75a3.75 3.75 0 0 1 0 7.5H7",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
		}
		function DiffFileSection({ file, root, open, t, comments, ghThreads, editorAnchor, editorNode, now, activeTargetKey, suggestMention, onOpenEditor, onOpenChange, onRevert, onRemoveComment, onReplyToThread, onThreadResolvedChange, onSendThreadToAi }) {
			const [revealed, setRevealed] = useState(() => /* @__PURE__ */ new Map());
			const [total, setTotal] = useState();
			const [expanding, setExpanding] = useState(false);
			const [drag, setDrag] = useState();
			const rows = useMemo(() => expandDiffRows(numberDiffLines(file.lines), revealed, total), [
				file.lines,
				revealed,
				total
			]);
			const anchors = useMemo(() => rows.map(commentAnchorForLine), [rows]);
			const name = file.path.slice(file.path.lastIndexOf("/") + 1);
			const commentCount = comments.length + ghThreads.reduce((total, thread) => total + thread.comments.length, 0);
			const expand = (gap, direction) => {
				if (root === void 0 || expanding) return;
				const span = gap.count ?? 20;
				const size = Math.min(20, span);
				const from = direction === "down" ? gap.newStart : gap.newStart + span - size;
				setExpanding(true);
				loadRepositoryFileLines(root, file.path, from, from + size - 1).then((result) => {
					setRevealed((previous) => {
						const next = new Map(previous);
						result.lines.forEach((text, offset) => next.set(from + offset, text));
						return next;
					});
					setTotal(result.total);
				}, () => void 0).finally(() => setExpanding(false));
			};
			useEffect(() => {
				if (drag === void 0) return;
				const finish = () => {
					setDrag(void 0);
					const anchor = rangeCommentAnchor(anchors, drag.start, drag.end);
					if (anchor !== void 0) onOpenEditor(anchor);
				};
				window.addEventListener("pointerup", finish);
				window.addEventListener("pointercancel", finish);
				return () => {
					window.removeEventListener("pointerup", finish);
					window.removeEventListener("pointercancel", finish);
				};
			}, [
				anchors,
				drag,
				onOpenEditor
			]);
			const dragLow = drag === void 0 ? void 0 : Math.min(drag.start, drag.end);
			const dragHigh = drag === void 0 ? void 0 : Math.max(drag.start, drag.end);
			const dragSide = drag === void 0 ? void 0 : anchors[drag.start]?.side;
			return /* @__PURE__ */ jsxs("section", {
				style: diffFile,
				children: [/* @__PURE__ */ jsxs("div", {
					className: diffFileHeaderClass,
					style: diffFileHeaderRow,
					children: [/* @__PURE__ */ jsxs("button", {
						type: "button",
						style: diffFileHeaderToggle,
						"aria-expanded": open,
						onClick: () => onOpenChange(!open),
						children: [
							/* @__PURE__ */ jsx("span", {
								"data-diff-file-chevron": "",
								style: {
									...diffFileChevron,
									...open ? chevronOpen : {}
								},
								"aria-hidden": "true",
								children: /* @__PURE__ */ jsx(IconChevronRightOutlineRegular, { size: 14 })
							}),
							/* @__PURE__ */ jsx("span", {
								style: diffFilePath,
								children: /* @__PURE__ */ jsx(Tooltip, {
									label: file.path,
									side: "bottom",
									delayMs: 300,
									maxWidth: 520,
									children: /* @__PURE__ */ jsx("span", {
										style: diffFileName,
										"aria-label": file.path,
										children: name
									})
								})
							}),
							commentCount === 0 ? null : /* @__PURE__ */ jsxs("span", {
								style: diffFileComments,
								"aria-label": t("diffFileComments", { count: commentCount }),
								children: [/* @__PURE__ */ jsx(CommentGlyph, {}), commentCount]
							}),
							/* @__PURE__ */ jsxs("span", {
								style: diffFileStats,
								children: [/* @__PURE__ */ jsxs("span", {
									style: diffAdd,
									children: ["+", file.additions]
								}), /* @__PURE__ */ jsxs("span", {
									style: diffDelete,
									children: ["−", file.deletions]
								})]
							})
						]
					}), onRevert === void 0 ? null : /* @__PURE__ */ jsx(Tooltip, {
						label: t("diffRevertFile"),
						side: "bottom",
						delayMs: 300,
						children: /* @__PURE__ */ jsx("button", {
							type: "button",
							className: panelIconButtonClass,
							style: diffFileRevert,
							"aria-label": t("diffRevertFileNamed", { path: file.path }),
							onClick: onRevert,
							children: /* @__PURE__ */ jsx(RevertGlyph, {})
						})
					})]
				}), open ? /* @__PURE__ */ jsx("div", {
					style: diffCode,
					children: rows.map((entry, index) => {
						if (entry.kind === "collapsed" && entry.gap !== void 0) return /* @__PURE__ */ jsx(DiffGapRow, {
							gap: entry.gap,
							t,
							busy: expanding,
							onExpand: root === void 0 ? void 0 : expand
						}, `gap:${entry.gap.newStart}`);
						const anchor = anchors[index];
						const lineComments = anchor === void 0 ? [] : comments.filter((comment) => comment.line === anchor.line && comment.side === anchor.side);
						const lineThreads = anchor === void 0 ? [] : ghThreads.filter((thread) => thread.line === anchor.line && thread.side === anchor.side);
						const editorOpen = anchor !== void 0 && editorAnchor !== void 0 && editorAnchor.line === anchor.line && editorAnchor.side === anchor.side;
						const inDrag = dragLow !== void 0 && dragHigh !== void 0 && index >= dragLow && index <= dragHigh && anchor?.side === dragSide;
						const inEditorRange = anchor !== void 0 && editorAnchor !== void 0 && editorAnchor.side === anchor.side && anchor.line <= editorAnchor.line && anchor.line >= (editorAnchor.startLine ?? editorAnchor.line);
						return /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsx(DiffLine, {
								entry,
								addLabel: t("reviewCommentAdd"),
								selected: inDrag || inEditorRange,
								onComment: anchor === void 0 ? void 0 : () => onOpenEditor(anchor),
								onDragStart: anchor === void 0 ? void 0 : () => setDrag({
									start: index,
									end: index
								}),
								onDragEnter: drag === void 0 ? void 0 : () => setDrag((current) => current === void 0 ? current : {
									...current,
									end: index
								})
							}),
							lineComments.map((comment) => /* @__PURE__ */ jsxs("div", {
								"data-review-target": `comment:${comment.id}`,
								"data-review-active": activeTargetKey === `comment:${comment.id}` ? "true" : void 0,
								style: {
									...diffCommentBlock,
									...activeTargetKey === `comment:${comment.id}` ? diffCommentBlockActive : {}
								},
								children: [/* @__PURE__ */ jsxs("div", {
									style: diffCommentCardMeta,
									children: [/* @__PURE__ */ jsx("span", { children: commentLineLabel(comment, t) }), /* @__PURE__ */ jsx("button", {
										type: "button",
										style: reviewCommentChipRemove,
										"aria-label": t("reviewCommentRemove"),
										onClick: () => onRemoveComment(comment.id),
										children: "×"
									})]
								}), /* @__PURE__ */ jsx("p", {
									style: diffCommentCardText,
									children: comment.text
								})]
							}, comment.id)),
							lineThreads.map((thread) => /* @__PURE__ */ jsx(ReviewThreadCard, {
								thread,
								anchorKey: `thread:${thread.id}`,
								active: activeTargetKey === `thread:${thread.id}`,
								t,
								suggest: suggestMention,
								now,
								onReply: (body) => onReplyToThread(thread, body),
								onResolvedChange: (resolved) => onThreadResolvedChange(thread, resolved),
								onSendToAi: onSendThreadToAi === void 0 ? void 0 : () => {
									onSendThreadToAi(thread);
								}
							}, thread.id)),
							editorOpen ? editorNode : null
						] }, `${index}:${entry.line}`);
					})
				}) : null]
			});
		}
		function actionLabel(action, t) {
			return (action === "commit" ? t("diffCommit") : action === "commit-push" ? t("diffCommitPush") : action === "push" ? t("diffPush") : action === "merge-pr" ? t("diffMergePr") : action === "update-branch" ? t("diffUpdateBranch") : t("diffCreatePr")).replace(/[….]+$/u, "");
		}
		function repositoryActionAvailability(repository) {
			const ready = repository?.status === "ready" && repository.detached !== true && (repository.conflicts ?? []).length === 0;
			const committable = ready && repository.dirty === true;
			const hasRemote = repository?.remote !== void 0;
			const hasOpenPullRequest = repository?.pullRequest?.state === "open";
			const pushable = ready && hasRemote && (repository.upstream === false || (repository.ahead ?? 0) > 0);
			return {
				"commit": committable,
				"commit-push": committable && hasRemote,
				"push": pushable,
				"create-pr": (committable || pushable) && hasRemote && !hasOpenPullRequest,
				"merge-pr": ready && hasOpenPullRequest && repository?.pullRequest?.draft !== true,
				"update-branch": ready && hasOpenPullRequest && repository?.dirty !== true && (repository?.baseBehind ?? 0) > 0
			};
		}
		function hasChanges(repository) {
			return (repository?.diff?.additions ?? 0) > 0 || (repository?.diff?.deletions ?? 0) > 0;
		}
		/** The checkouts a session can show: its own first, then the ones it wrote
		*  into. A linked pull request with no local checkout has no diff to show. */
		function panelRepositories(projection) {
			return [projection.repository, ...(projection.repositories ?? []).filter((item) => item.diff !== void 0)].filter((item) => item !== void 0);
		}
		function ClaudeDiffPanel({ useClaudeProjection, t, sessionId, closeDetails, submitPrompt, initialRoot }) {
			const projection = useClaudeProjection((value) => value);
			const repositories = useMemo(() => panelRepositories(projection), [projection]);
			const [selectedRoot, setSelectedRoot] = useState(() => initialRoot ?? (hasChanges(projection.repository) ? void 0 : repositories.find(hasChanges)?.root));
			const repository = repositories.find((item) => item.root === selectedRoot) ?? projection.repository;
			const root = repository === projection.repository ? void 0 : repository?.root;
			const diff = repository?.diff;
			const files = useMemo(() => parseUnifiedDiff(diff?.patch ?? ""), [diff?.patch]);
			const [menuOpen, setMenuOpen] = useState(false);
			const [repositoryMenuOpen, setRepositoryMenuOpen] = useState(false);
			const repositoryItems = useMemo(() => repositories.map((item) => ({
				id: item.root ?? item.cwd,
				label: /* @__PURE__ */ jsxs("span", {
					style: diffRepositoryRow,
					children: [
						/* @__PURE__ */ jsx("span", {
							style: diffRepositoryRowName,
							children: repositoryLabel(item)
						}),
						" ",
						/* @__PURE__ */ jsxs("span", {
							style: diffRepositoryRowCounts,
							children: [
								/* @__PURE__ */ jsxs("span", {
									style: diffAdd,
									children: ["+", item.diff?.additions ?? 0]
								}),
								" ",
								/* @__PURE__ */ jsxs("span", {
									style: diffDelete,
									children: ["−", item.diff?.deletions ?? 0]
								})
							]
						})
					]
				})
			})), [repositories]);
			const { toast, report } = useActionToast();
			const [dialog, setDialog] = useState();
			const [message, setMessage] = useState("");
			const [includeUnstaged, setIncludeUnstaged] = useState(true);
			const [prTitle, setPrTitle] = useState("");
			const [prBody, setPrBody] = useState("");
			const [baseBranch, setBaseBranch] = useState("");
			const [draft, setDraft] = useState(true);
			const [commentEditor, setCommentEditor] = useState();
			const [commentDraft, setCommentDraft] = useState("");
			const [commentBusy, setCommentBusy] = useState(false);
			const [commentError, setCommentError] = useState();
			const [localComments, setLocalComments] = useState([]);
			const [removedCommentIds, setRemovedCommentIds] = useState(() => /* @__PURE__ */ new Set());
			const actionController = useRef();
			const [ghThreads, setGhThreads] = useState([]);
			const [threadsLoadedAt, setThreadsLoadedAt] = useState(() => Date.now());
			const pullNumber = repository?.pullRequest?.state === "open" ? repository.pullRequest.number : void 0;
			useEffect(() => {
				setGhThreads([]);
				if (pullNumber === void 0) return;
				const controller = new AbortController();
				loadPullRequestThreads(sessionId, pullNumber, controller.signal, root).then((threads) => {
					setGhThreads(threads);
					setThreadsLoadedAt(Date.now());
				}, () => void 0);
				return () => {
					controller.abort();
				};
			}, [
				pullNumber,
				root,
				sessionId
			]);
			const openThreadCount = ghThreads.filter((thread) => !thread.resolved).length;
			const bodyRef = useRef(null);
			const [targetIndex, setTargetIndex] = useState(0);
			const [activeTargetKey, setActiveTargetKey] = useState();
			const [pendingScrollKey, setPendingScrollKey] = useState();
			const [openFiles, setOpenFiles] = useState(() => /* @__PURE__ */ new Map());
			const fileOpen = useCallback((path, index) => openFiles.get(path) ?? index === 0, [openFiles]);
			const setFileOpen = useCallback((path, open) => {
				setOpenFiles((current) => new Map(current).set(path, open));
			}, []);
			const suggestMention = useCallback(async (query) => pullNumber === void 0 ? [] : loadMentionableUsers(sessionId, pullNumber, query, void 0, root).catch(() => []), [
				pullNumber,
				root,
				sessionId
			]);
			const replyToThread = useCallback(async (thread, body) => {
				if (pullNumber === void 0) return;
				const anchor = thread.comments[0];
				if (anchor === void 0) return;
				const posted = await replyToReviewThread(sessionId, pullNumber, anchor.id, body, root);
				setGhThreads((list) => list.map((item) => item.id === thread.id ? {
					...item,
					comments: [...item.comments, posted]
				} : item));
			}, [
				pullNumber,
				root,
				sessionId
			]);
			const changeThreadResolved = useCallback(async (thread, resolved) => {
				if (pullNumber === void 0) return;
				const state = await setReviewThreadResolved(sessionId, pullNumber, thread.id, resolved, root);
				setGhThreads((list) => list.map((item) => item.id === thread.id ? {
					...item,
					resolved: state
				} : item));
			}, [
				pullNumber,
				root,
				sessionId
			]);
			const diffViewportObserver = useRef();
			const diffBodyRef = useCallback((element) => {
				diffViewportObserver.current?.disconnect();
				diffViewportObserver.current = void 0;
				bodyRef.current = element;
				if (element === null || typeof ResizeObserver === "undefined") return;
				const update = () => element.style.setProperty("--dsh-claude-diff-viewport", `${element.clientWidth}px`);
				update();
				const observer = new ResizeObserver(update);
				observer.observe(element);
				diffViewportObserver.current = observer;
			}, []);
			useEffect(() => () => diffViewportObserver.current?.disconnect(), []);
			const closeDialog = useCallback(() => {
				if (dialog?.submitting === true) return;
				actionController.current?.abort();
				actionController.current = void 0;
				setDialog(void 0);
			}, [dialog?.submitting]);
			const openAction = useCallback((action) => {
				actionController.current?.abort();
				setMenuOpen(false);
				setDialog({
					action,
					loading: true,
					submitting: false
				});
				setMessage("");
				setPrTitle("");
				setPrBody("");
				setBaseBranch("");
				setDraft(true);
				const controller = new AbortController();
				actionController.current = controller;
				loadRepositoryActionPreview(sessionId, controller.signal, root).then(async (preview) => {
					setIncludeUnstaged(preview.hasUnstaged || preview.hasUntracked);
					if (action === "push") {
						setDialog({
							action,
							preview,
							loading: false,
							submitting: false
						});
						return;
					}
					setDialog({
						action,
						preview,
						loading: true,
						submitting: false
					});
					if (action === "create-pr") {
						const [pullRequest, generated] = await Promise.all([generatePullRequestText(sessionId, preview.fingerprint, void 0, controller.signal, root), preview.files.length > 0 ? generateCommitMessage(sessionId, preview.fingerprint, controller.signal, root) : Promise.resolve(void 0)]);
						setMessage((current) => current.trim() === "" ? generated ?? pullRequest.title : current);
						setPrTitle((current) => current.trim() === "" ? pullRequest.title : current);
						setPrBody((current) => current.trim() === "" ? pullRequest.body : current);
					} else {
						const generated = await generateCommitMessage(sessionId, preview.fingerprint, controller.signal, root);
						setMessage((current) => current.trim() === "" ? generated : current);
					}
					setDialog((current) => current === void 0 ? current : {
						...current,
						loading: false
					});
				}).catch((error) => {
					if (!controller.signal.aborted) setDialog({
						action,
						loading: false,
						submitting: false,
						error: error instanceof Error ? error.message : t("diffActionFailed")
					});
				});
			}, [
				root,
				sessionId,
				t
			]);
			const confirm = useCallback(async () => {
				if (dialog?.preview === void 0 || dialog.action !== "push" && message.trim().length === 0) return;
				const { error: _error, ...pending } = dialog;
				setDialog({
					...pending,
					submitting: true
				});
				try {
					const result = await executeRepositoryAction(sessionId, {
						action: dialog.action,
						fingerprint: dialog.preview.fingerprint,
						message,
						includeUnstaged,
						...dialog.action === "create-pr" ? {
							prTitle,
							prBody,
							...baseBranch.trim() === "" ? {} : { baseBranch },
							draft
						} : {}
					}, root);
					report(result.pullRequestUrl === void 0 ? t(dialog.action === "push" ? "diffPushCompleted" : "diffCommitCompleted", { commit: result.commit.slice(0, 8) }) : t("diffPrCompleted"));
					setDialog(void 0);
				} catch (error) {
					const completedCommit = typeof error === "object" && error !== null && "commit" in error && typeof error.commit === "string" ? error.commit : void 0;
					setDialog({
						...dialog,
						submitting: false,
						error: error instanceof Error ? error.message : t("diffActionFailed"),
						...completedCommit === void 0 ? {} : { commit: completedCommit }
					});
				}
			}, [
				baseBranch,
				dialog,
				draft,
				includeUnstaged,
				message,
				prBody,
				prTitle,
				report,
				root,
				sessionId,
				t
			]);
			const [revertDialog, setRevertDialog] = useState();
			const requestRevert = useCallback((paths) => {
				setRevertDialog({
					...paths === void 0 ? {} : { paths },
					count: 0,
					submitting: false
				});
				loadRepositoryActionPreview(sessionId, void 0, root).then((preview) => {
					const count = paths === void 0 ? preview.files.length : preview.files.filter((file) => paths.includes(file.path)).length;
					if (count === 0) {
						setRevertDialog(void 0);
						report(t("diffRevertNothing"));
						return;
					}
					setRevertDialog((current) => current === void 0 ? current : {
						...current,
						preview,
						count
					});
				}, (error) => {
					setRevertDialog((current) => current === void 0 ? current : {
						...current,
						error: error instanceof Error ? error.message : t("diffActionFailed")
					});
				});
			}, [
				report,
				root,
				sessionId,
				t
			]);
			const confirmRevert = useCallback(async () => {
				if (revertDialog?.preview === void 0 || revertDialog.submitting) return;
				const { error: _error, ...pending } = revertDialog;
				setRevertDialog({
					...pending,
					submitting: true
				});
				try {
					const result = await executeRepositoryAction(sessionId, {
						action: "revert",
						fingerprint: revertDialog.preview.fingerprint,
						message: "",
						includeUnstaged: true,
						...revertDialog.paths === void 0 ? {} : { paths: revertDialog.paths }
					}, root);
					setRevertDialog(void 0);
					report(t("diffRevertCompleted", { count: result.reverted ?? revertDialog.count }));
				} catch (error) {
					setRevertDialog({
						...pending,
						submitting: false,
						error: error instanceof Error ? error.message : t("diffActionFailed")
					});
				}
			}, [
				report,
				revertDialog,
				root,
				sessionId,
				t
			]);
			const reverting = revertDialog !== void 0;
			const openCommentEditor = useCallback((path, anchor) => {
				setCommentEditor({
					path,
					...anchor
				});
				setCommentDraft("");
				setCommentError(void 0);
			}, []);
			const closeCommentEditor = useCallback(() => {
				setCommentEditor(void 0);
				setCommentDraft("");
				setCommentError(void 0);
			}, []);
			const submitComment = useCallback(async () => {
				if (commentEditor === void 0 || commentDraft.trim().length === 0 || commentBusy) return;
				setCommentBusy(true);
				setCommentError(void 0);
				try {
					const created = await addReviewComment(sessionId, {
						path: commentEditor.path,
						line: commentEditor.line,
						...commentEditor.startLine === void 0 ? {} : { startLine: commentEditor.startLine },
						side: commentEditor.side,
						text: commentDraft.trim()
					});
					setLocalComments((list) => [...list, created]);
					closeCommentEditor();
				} catch (error) {
					setCommentError(error instanceof Error ? error.message : t("reviewCommentFailed"));
				} finally {
					setCommentBusy(false);
				}
			}, [
				closeCommentEditor,
				commentBusy,
				commentDraft,
				commentEditor,
				sessionId,
				t
			]);
			const removeComment = useCallback((id) => {
				setRemovedCommentIds((previous) => /* @__PURE__ */ new Set([...previous, id]));
				removeReviewComment(sessionId, id).catch(() => {
					setRemovedCommentIds((previous) => {
						const next = new Set(previous);
						next.delete(id);
						return next;
					});
				});
			}, [sessionId]);
			useEffect(() => {
				const projected = new Set((projection.reviewComments ?? []).map((comment) => comment.id));
				setLocalComments((list) => list.some((comment) => projected.has(comment.id)) ? list.filter((comment) => !projected.has(comment.id)) : list);
				setRemovedCommentIds((previous) => {
					const kept = [...previous].filter((id) => projected.has(id));
					return kept.length === previous.size ? previous : new Set(kept);
				});
			}, [projection.reviewComments]);
			const reviewComments = useMemo(() => {
				const merged = /* @__PURE__ */ new Map();
				for (const comment of projection.reviewComments ?? []) merged.set(comment.id, comment);
				for (const comment of localComments) merged.set(comment.id, comment);
				for (const id of removedCommentIds) merged.delete(id);
				return [...merged.values()];
			}, [
				localComments,
				projection.reviewComments,
				removedCommentIds
			]);
			const targets = useMemo(() => reviewTargets(files, reviewComments, ghThreads), [
				files,
				ghThreads,
				reviewComments
			]);
			useEffect(() => {
				setTargetIndex((index) => index < targets.length ? index : 0);
			}, [targets.length]);
			const goToComment = useCallback((direction) => {
				setTargetIndex((current) => {
					if (targets.length === 0) return current;
					const next = menuNavigationIndex(current, targets.length, direction);
					const target = targets[next];
					if (target !== void 0) {
						setActiveTargetKey(target.key);
						setPendingScrollKey(target.key);
						setFileOpen(target.path, true);
					}
					return next;
				});
			}, [setFileOpen, targets]);
			useEffect(() => {
				if (pendingScrollKey === void 0) return;
				bodyRef.current?.querySelector(`[data-review-target="${pendingScrollKey}"]`)?.scrollIntoView({ block: "center" });
				setPendingScrollKey(void 0);
			}, [pendingScrollKey]);
			useEffect(() => {
				if (targets.length === 0) return;
				const shortcut = (event) => {
					if (event.ctrlKey || event.metaKey || event.altKey) return;
					const origin = event.target;
					if (origin instanceof HTMLElement && (origin.isContentEditable || origin.tagName === "INPUT" || origin.tagName === "TEXTAREA" || origin.tagName === "SELECT")) return;
					if (event.key !== "n" && event.key !== "p") return;
					event.preventDefault();
					goToComment(event.key === "n" ? "ArrowDown" : "ArrowUp");
				};
				document.addEventListener("keydown", shortcut);
				return () => {
					document.removeEventListener("keydown", shortcut);
				};
			}, [goToComment, targets.length]);
			useEffect(() => () => actionController.current?.abort(), []);
			useEffect(() => {
				if (!projection.owned || repository?.status !== "ready" || diff === void 0) closeDetails();
			}, [
				closeDetails,
				diff,
				projection.owned,
				repository?.status
			]);
			if (!projection.owned || repository?.status !== "ready" || diff === void 0) return null;
			const branch = branchLabel(repository, t);
			const availability = repositoryActionAvailability(repository);
			const anyActionAvailable = availability["commit"] || availability["commit-push"] || availability["push"] || availability["create-pr"];
			const menuItems = [
				{
					id: "commit",
					label: t("diffCommit"),
					disabled: !availability["commit"]
				},
				{
					id: "commit-push",
					label: t("diffCommitPush"),
					disabled: !availability["commit-push"]
				},
				{
					id: "push",
					label: t("diffPush"),
					disabled: !availability["push"]
				},
				{
					id: "create-pr",
					label: t("diffCreatePr"),
					disabled: !availability["create-pr"]
				}
			];
			const allFilesOpen = files.every((file, index) => fileOpen(file.path, index));
			const commentEditorNode = commentEditor === void 0 ? null : /* @__PURE__ */ jsxs("div", {
				style: diffCommentBlock,
				children: [
					/* @__PURE__ */ jsx("div", {
						style: diffCommentRange,
						children: commentLineLabel(commentEditor, t)
					}),
					/* @__PURE__ */ jsx("textarea", {
						className: diffCommentTextareaClass,
						style: diffCommentTextarea,
						value: commentDraft,
						maxLength: 2e3,
						placeholder: t("reviewCommentPlaceholder"),
						autoFocus: true,
						onChange: (event) => setCommentDraft(event.currentTarget.value)
					}),
					commentError !== void 0 ? /* @__PURE__ */ jsx("p", {
						style: diffCommentError,
						children: commentError
					}) : null,
					/* @__PURE__ */ jsxs("div", {
						style: diffCommentActions,
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							style: diffCommentActionButton,
							onClick: closeCommentEditor,
							children: t("reviewCommentCancel")
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...diffCommentActionButton,
								...diffCommentSubmitButton
							},
							disabled: commentBusy || commentDraft.trim().length === 0,
							onClick: () => void submitComment(),
							children: t("reviewCommentSubmit")
						})]
					})
				]
			});
			return /* @__PURE__ */ jsxs(Fragment$1, { children: [
				toast,
				/* @__PURE__ */ jsxs("style", {
					"data-dsh-claude-repository-modal-styles": true,
					children: [
						detailsCardCss,
						diffModalCss,
						panelIconButtonCss,
						diffCommentCss,
						diffCommentMarkdownCss,
						diffRepositoryCss
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: detailsCardClass,
					style: diffPanel,
					children: [
						/* @__PURE__ */ jsxs("header", {
							style: diffHeader,
							children: [/* @__PURE__ */ jsxs("div", {
								style: diffHeaderTitle,
								children: [repositories.length < 2 ? null : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx(Menu, {
									open: repositoryMenuOpen,
									items: repositoryItems,
									selectedId: repository.root ?? repository.cwd,
									onSelect: (id) => {
										setSelectedRoot(id);
										setRepositoryMenuOpen(false);
									},
									onClose: () => setRepositoryMenuOpen(false),
									portal: true,
									compact: true,
									anchor: /* @__PURE__ */ jsxs("button", {
										type: "button",
										className: diffRepositoryTriggerClass,
										"aria-label": t("diffRepository"),
										"aria-haspopup": "menu",
										"aria-expanded": repositoryMenuOpen,
										onClick: () => setRepositoryMenuOpen((value) => !value),
										children: [/* @__PURE__ */ jsx("span", { children: repositoryLabel(repository) }), /* @__PURE__ */ jsx(IconChevronDownOutlineRegular, {})]
									})
								}), /* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									children: "›"
								})] }), /* @__PURE__ */ jsx("span", {
									style: diffHeaderBranch,
									title: branch,
									children: branch
								})]
							}), /* @__PURE__ */ jsxs("div", {
								style: diffHeaderActions,
								children: [
									files.length === 0 || !availability["commit"] ? null : /* @__PURE__ */ jsx("button", {
										type: "button",
										style: {
											...button,
											...diffRevertAllButton
										},
										disabled: reverting,
										onClick: () => requestRevert(),
										children: t("diffRevertAll")
									}),
									/* @__PURE__ */ jsxs("div", {
										style: diffSplitButton,
										children: [/* @__PURE__ */ jsx("button", {
											type: "button",
											style: {
												...diffCommitButton,
												...availability["commit"] ? {} : diffActionDisabled
											},
											disabled: !availability["commit"],
											onClick: () => openAction("commit"),
											children: t("diffCommit")
										}), /* @__PURE__ */ jsx(Menu, {
											open: menuOpen,
											items: menuItems,
											onSelect: (id) => {
												if (availability[id]) openAction(id);
											},
											onClose: () => setMenuOpen(false),
											align: "end",
											portal: true,
											anchor: /* @__PURE__ */ jsx("button", {
												type: "button",
												style: {
													...diffCommitMenuButton,
													...anyActionAvailable ? {} : diffActionDisabled
												},
												disabled: !anyActionAvailable,
												"aria-label": t("diffCommitMenu"),
												"aria-expanded": menuOpen,
												onClick: () => setMenuOpen((value) => !value),
												children: /* @__PURE__ */ jsx(IconChevronDownOutlineRegular, {})
											})
										})]
									}),
									targets.length === 0 ? null : /* @__PURE__ */ jsxs("div", {
										style: diffCommentNav,
										children: [
											/* @__PURE__ */ jsx("button", {
												type: "button",
												className: panelIconButtonClass,
												"aria-label": t("diffCommentPrevious"),
												title: t("diffCommentPosition", {
													index: targetIndex + 1,
													total: targets.length
												}),
												onClick: () => goToComment("ArrowUp"),
												children: /* @__PURE__ */ jsx(IconChevronUpOutlineRegular, {})
											}),
											/* @__PURE__ */ jsx("span", {
												style: diffCommentNavCount,
												children: t("diffCommentCounter", {
													index: targetIndex + 1,
													total: targets.length
												})
											}),
											/* @__PURE__ */ jsx("button", {
												type: "button",
												className: panelIconButtonClass,
												"aria-label": t("diffCommentNext"),
												title: t("diffCommentPosition", {
													index: targetIndex + 1,
													total: targets.length
												}),
												onClick: () => goToComment("ArrowDown"),
												children: /* @__PURE__ */ jsx(IconChevronDownOutlineRegular, {})
											})
										]
									}),
									openThreadCount > 0 && submitPrompt !== void 0 ? /* @__PURE__ */ jsxs("button", {
										type: "button",
										style: diffPrCommentsButton,
										title: t("prCommentsSend"),
										"aria-label": t("prCommentsButton", { count: openThreadCount }),
										onClick: () => submitPrompt(composeCommentsPrompt(ghThreads)),
										children: [/* @__PURE__ */ jsx("svg", {
											width: "14",
											height: "14",
											viewBox: "0 0 16 16",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "1.5",
											strokeLinecap: "round",
											strokeLinejoin: "round",
											"aria-hidden": "true",
											children: /* @__PURE__ */ jsx("path", { d: "M2.75 2.75h10.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H8.2l-3.2 2.9v-2.9H2.75a1 1 0 0 1-1-1v-6.5a1 1 0 0 1 1-1Z" })
										}), openThreadCount]
									}) : null,
									/* @__PURE__ */ jsx("button", {
										type: "button",
										className: panelIconButtonClass,
										"aria-label": t("diffClose"),
										onClick: closeDetails,
										children: /* @__PURE__ */ jsx(IconCloseOutlineRegular, {})
									})
								]
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							style: diffSummary,
							children: [
								/* @__PURE__ */ jsx("span", { children: t("diffFiles", { count: diff.files }) }),
								/* @__PURE__ */ jsxs("span", {
									style: diffAdd,
									children: ["+", diff.additions]
								}),
								/* @__PURE__ */ jsxs("span", {
									style: diffDelete,
									children: ["−", diff.deletions]
								}),
								files.length === 0 ? null : /* @__PURE__ */ jsx(Tooltip, {
									label: allFilesOpen ? t("diffCollapseAll") : t("diffExpandAll"),
									side: "bottom",
									delayMs: 250,
									children: /* @__PURE__ */ jsx("button", {
										type: "button",
										className: panelIconButtonClass,
										style: diffSummaryAction,
										"aria-label": allFilesOpen ? t("diffCollapseAll") : t("diffExpandAll"),
										onClick: () => {
											setOpenFiles(new Map(files.map((file) => [file.path, !allFilesOpen])));
										},
										children: allFilesOpen ? /* @__PURE__ */ jsx(IconChevronDownOutlineRegular, {}) : /* @__PURE__ */ jsx(IconChevronRightOutlineRegular, {})
									})
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							ref: diffBodyRef,
							style: diffBody,
							children: [
								diff.truncated ? /* @__PURE__ */ jsx("p", {
									style: diffNotice,
									children: t("diffTruncated")
								}) : null,
								diff.elided !== void 0 && diff.elided.length > 0 ? /* @__PURE__ */ jsx("p", {
									style: diffNotice,
									children: t("diffElided", {
										count: diff.elided.length,
										files: diff.elided.join(", ")
									})
								}) : null,
								files.length === 0 ? /* @__PURE__ */ jsx("p", {
									style: diffEmpty,
									children: t("diffEmpty")
								}) : files.map((file, index) => /* @__PURE__ */ jsx(DiffFileSection, {
									file,
									root: repository.pullRequestOnly === true ? void 0 : repository.root,
									open: fileOpen(file.path, index),
									onOpenChange: (open) => {
										setFileOpen(file.path, open);
									},
									onRevert: availability["commit"] ? () => {
										if (!reverting) requestRevert([file.path]);
									} : void 0,
									t,
									comments: reviewComments.filter((comment) => comment.path === file.path),
									ghThreads: ghThreads.filter((thread) => thread.path === file.path),
									suggestMention,
									now: threadsLoadedAt,
									activeTargetKey,
									onReplyToThread: replyToThread,
									onThreadResolvedChange: changeThreadResolved,
									onSendThreadToAi: submitPrompt === void 0 ? void 0 : (thread) => {
										submitPrompt(composeCommentsPrompt([thread]));
									},
									editorAnchor: commentEditor !== void 0 && commentEditor.path === file.path ? commentEditor : void 0,
									editorNode: commentEditorNode,
									onOpenEditor: (anchor) => openCommentEditor(file.path, anchor),
									onRemoveComment: removeComment
								}, file.path))
							]
						})
					]
				}),
				/* @__PURE__ */ jsx(Modal, {
					className: "dshClaudeRepositoryActionModal",
					contentClassName: "dshClaudeRepositoryActionModalContent",
					open: revertDialog !== void 0,
					onClose: () => {
						if (revertDialog?.submitting !== true) setRevertDialog(void 0);
					},
					title: revertDialog?.paths?.length === 1 ? t("diffRevertFile") : t("diffRevertAll"),
					closeLabel: t("diffCancel"),
					footer: /* @__PURE__ */ jsxs("div", {
						style: diffModalFooter,
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...button,
								...diffModalButton
							},
							disabled: revertDialog?.submitting === true,
							onClick: () => setRevertDialog(void 0),
							children: t("diffCancel")
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...primaryButton,
								...diffModalButton,
								...diffDangerButton
							},
							disabled: revertDialog?.preview === void 0 || revertDialog.submitting,
							onClick: () => void confirmRevert(),
							children: revertDialog?.submitting === true ? t("diffSubmitting") : t("diffRevertConfirmAction")
						})]
					}),
					children: /* @__PURE__ */ jsxs("div", {
						style: diffModalBody,
						children: [revertDialog?.preview === void 0 && revertDialog?.error === void 0 ? /* @__PURE__ */ jsx("p", {
							className: "dshClaudeCommitProgress",
							role: "status",
							children: t("diffLoadingPreview")
						}) : revertDialog?.preview === void 0 ? null : /* @__PURE__ */ jsx("p", {
							style: diffRevertQuestion,
							children: revertDialog.paths?.length === 1 ? t("diffRevertFileConfirm", { path: revertDialog.paths[0] ?? "" }) : t("diffRevertAllConfirm", { count: revertDialog.count })
						}), revertDialog?.error === void 0 ? null : /* @__PURE__ */ jsx("p", {
							style: diffModalError,
							role: "alert",
							children: revertDialog.error
						})]
					})
				}),
				/* @__PURE__ */ jsxs(Modal, {
					className: "dshClaudeRepositoryActionModal dshClaudeCommitDialog",
					contentClassName: "dshClaudeRepositoryActionModalContent dshClaudeCommitContent",
					open: dialog !== void 0,
					onClose: closeDialog,
					title: dialog === void 0 ? t("diffCommit") : actionLabel(dialog.action, t),
					closeLabel: t("diffCancel"),
					footer: /* @__PURE__ */ jsxs("div", {
						style: diffModalFooter,
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...button,
								...diffModalButton
							},
							disabled: dialog?.submitting === true,
							onClick: closeDialog,
							children: t("diffCancel")
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...primaryButton,
								...diffModalButton
							},
							disabled: dialog?.submitting === true || dialog?.preview === void 0 || dialog.action !== "push" && message.trim() === "",
							onClick: () => void confirm(),
							children: dialog?.submitting === true ? t("diffSubmitting") : dialog === void 0 ? t("diffCommit") : actionLabel(dialog.action, t)
						})]
					}),
					children: [
						dialog?.loading === true ? /* @__PURE__ */ jsx("p", {
							className: "dshClaudeCommitProgress",
							role: "status",
							children: t(dialog.preview === void 0 ? "diffLoadingPreview" : "diffGeneratingMessage")
						}) : null,
						dialog?.preview !== void 0 ? /* @__PURE__ */ jsxs("div", {
							style: diffModalBody,
							children: [/* @__PURE__ */ jsxs("div", {
								className: "dshClaudeCommitContext",
								children: [
									/* @__PURE__ */ jsx("strong", {
										title: dialog.preview.root,
										children: repositoryLabel({
											root: dialog.preview.root,
											cwd: dialog.preview.root
										})
									}),
									/* @__PURE__ */ jsx("span", {
										className: "dshClaudeCommitBranch",
										children: dialog.preview.branch
									}),
									dialog.action === "push" || dialog.action === "commit-push" ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", {
										"aria-hidden": "true",
										children: "→"
									}), /* @__PURE__ */ jsx("span", {
										className: "dshClaudeCommitBranch",
										children: dialog.preview.upstream ?? `origin/${dialog.preview.branch}`
									})] }) : null
								]
							}), dialog.action === "push" ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsxs("section", {
								className: "dshClaudeCommitSection",
								children: [/* @__PURE__ */ jsx("h3", { children: t("diffPushAhead", { count: dialog.preview.unpushedTruncated ? `${dialog.preview.unpushedCommits.length}+` : dialog.preview.unpushedCommits.length }) }), /* @__PURE__ */ jsx("div", {
									className: "dshClaudeCommitFiles",
									children: dialog.preview.unpushedCommits.map((commit) => /* @__PURE__ */ jsxs("div", {
										className: "dshClaudeCommitFile",
										children: [/* @__PURE__ */ jsx("code", {
											className: "dshClaudeCommitHash",
											children: commit.hash.slice(0, 8)
										}), /* @__PURE__ */ jsx("span", {
											className: "dshClaudeCommitPath",
											title: commit.subject,
											children: commit.subject
										})]
									}, commit.hash))
								})]
							}), /* @__PURE__ */ jsx("p", {
								style: diffModalStatus,
								children: t("diffPushDescription")
							})] }) : /* @__PURE__ */ jsxs("div", {
								className: "dshClaudeCommitGrid",
								children: [/* @__PURE__ */ jsxs("section", {
									className: "dshClaudeCommitSection dshClaudeCommitChanges",
									children: [
										/* @__PURE__ */ jsx("h3", { children: t("diffFilesShort", { count: dialog.preview.files.length }) }),
										/* @__PURE__ */ jsx("div", {
											className: "dshClaudeCommitFiles",
											children: dialog.preview.files.map((file) => /* @__PURE__ */ jsxs("div", {
												className: "dshClaudeCommitFile",
												children: [/* @__PURE__ */ jsx("span", {
													className: "dshClaudeCommitPath",
													title: file.path,
													children: file.path
												}), /* @__PURE__ */ jsx("span", {
													className: "dshClaudeCommitState",
													"data-staged": file.staged && !file.unstaged && !file.untracked,
													children: file.untracked ? t("diffUntracked") : file.staged && file.unstaged ? t("diffStagedUnstaged") : file.staged ? t("diffStaged") : t("diffUnstaged")
												})]
											}, file.path))
										}),
										/* @__PURE__ */ jsxs("label", {
											style: diffModalCheckbox,
											children: [/* @__PURE__ */ jsx("input", {
												type: "checkbox",
												checked: includeUnstaged,
												disabled: !dialog.preview.hasUnstaged && !dialog.preview.hasUntracked,
												onChange: (event) => setIncludeUnstaged(event.currentTarget.checked)
											}), t("diffIncludeUnstaged")]
										})
									]
								}), /* @__PURE__ */ jsxs("div", {
									className: "dshClaudeCommitEditor",
									children: [
										dialog.action === "create-pr" ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
											/* @__PURE__ */ jsxs("label", {
												style: diffModalField,
												children: [t("diffPrTitle"), /* @__PURE__ */ jsx("input", {
													style: {
														...diffModalTextInput,
														fontWeight: 400
													},
													value: prTitle,
													maxLength: 256,
													onChange: (event) => setPrTitle(event.currentTarget.value)
												})]
											}),
											/* @__PURE__ */ jsxs("label", {
												style: diffModalField,
												children: [t("diffPrBase"), /* @__PURE__ */ jsx("input", {
													style: {
														...diffModalTextInput,
														fontWeight: 400
													},
													value: baseBranch,
													maxLength: 512,
													placeholder: t("diffPrBaseDefault"),
													onChange: (event) => setBaseBranch(event.currentTarget.value)
												})]
											}),
											/* @__PURE__ */ jsxs("label", {
												style: diffModalField,
												children: [t("diffPrDescription"), /* @__PURE__ */ jsx("textarea", {
													style: {
														...diffModalTextarea,
														fontWeight: 400,
														minHeight: 180
													},
													value: prBody,
													maxLength: 8192,
													onChange: (event) => setPrBody(event.currentTarget.value)
												})]
											}),
											/* @__PURE__ */ jsxs("label", {
												style: diffModalCheckbox,
												children: [/* @__PURE__ */ jsx("input", {
													type: "checkbox",
													checked: draft,
													onChange: (event) => setDraft(event.currentTarget.checked)
												}), t("diffPrDraft")]
											})
										] }) : null,
										/* @__PURE__ */ jsxs("label", {
											style: diffModalField,
											children: [t("diffCommitMessage"), /* @__PURE__ */ jsx("textarea", {
												style: {
													...diffModalTextarea,
													fontWeight: 400,
													minHeight: dialog.action === "create-pr" ? 100 : 220
												},
												value: message,
												maxLength: 2048,
												placeholder: t("diffCommitMessagePlaceholder"),
												onChange: (event) => setMessage(event.currentTarget.value)
											})]
										}),
										/* @__PURE__ */ jsx("p", {
											className: "dshClaudeCommitHint",
											children: t("diffCommitMessageHint")
										})
									]
								})]
							})]
						}) : null,
						dialog?.error !== void 0 ? /* @__PURE__ */ jsxs("p", {
							role: "alert",
							style: diffModalError,
							children: [dialog.error, dialog.commit === void 0 ? "" : ` ${t("diffCommitPreserved", { commit: dialog.commit.slice(0, 8) })}`]
						}) : null
					]
				})
			] });
		}
		//#endregion
		//#region src/todo-bridge.ts
		function record$2(value) {
			if (typeof value === "string") try {
				return record$2(JSON.parse(value));
			} catch {
				return;
			}
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		/** The id a TaskCreate result names: a structured `id`, else `#N` in its prose. */
		function createdTaskId(output) {
			const structured = record$2(output);
			const id = structured?.id ?? record$2(structured?.task)?.id;
			if (typeof id === "string" || typeof id === "number") return String(id);
			const prose = typeof output === "string" ? output : JSON.stringify(output ?? "");
			return (/#(\d+)/u.exec(prose) ?? /\btask\s+(?:id\s*)?[:#]?\s*(\d+)\b/iu.exec(prose))?.[1];
		}
		const LEAD_NAME = "lead";
		const EMPTY_TEAM = {
			members: [],
			tasks: [],
			messages: []
		};
		function parseRecord(detail) {
			if (detail === void 0) return void 0;
			try {
				const value = JSON.parse(detail);
				return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
			} catch {
				return;
			}
		}
		function text(value) {
			return typeof value === "string" && value.trim().length > 0 ? value : void 0;
		}
		function strings(value) {
			return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
		}
		function taskStatus(value) {
			return value === "pending" || value === "in_progress" || value === "completed" ? value : void 0;
		}
		/** Fold the sidecar into the team: teammates from the task board, the shared
		*  task list and mail from the tool calls that wrote them. */
		function deriveTeam(activities, tasks) {
			const ordered = [...activities].sort((left, right) => left.ordinal - right.ordinal);
			const spawnInputs = /* @__PURE__ */ new Map();
			for (const activity of ordered) if (activity.toolUseId !== void 0 && activity.toolName !== void 0 && activity.phase === "started") {
				const input = parseRecord(activity.detail);
				if (input !== void 0) spawnInputs.set(activity.toolUseId, input);
			}
			const teammates = tasks.filter((task) => task.taskType === "in_process_teammate" || task.taskType === "local_agent");
			if (teammates.length === 0 && !ordered.some((activity) => activity.toolName === "TaskCreate" || activity.toolName === "SendMessage")) return EMPTY_TEAM;
			const members = teammates.map((task) => {
				const spawn = task.toolUseId === void 0 ? void 0 : spawnInputs.get(task.toolUseId);
				const prompt = text(spawn?.prompt);
				return {
					taskId: task.taskId,
					name: text(spawn?.name) ?? task.description,
					role: "teammate",
					status: task.status,
					description: text(spawn?.description) ?? task.description,
					...task.toolUseId === void 0 ? {} : { toolUseId: task.toolUseId },
					...prompt === void 0 ? {} : { prompt },
					...task.summary === void 0 ? {} : { summary: task.summary },
					...task.lastToolName === void 0 ? {} : { lastToolName: task.lastToolName },
					...task.usage === void 0 ? {} : { usage: task.usage }
				};
			});
			const nameOfParent = new Map(members.flatMap((member) => member.toolUseId === void 0 ? [] : [[member.toolUseId, member.name]]));
			const senderOf = (activity) => activity.parentToolUseId === void 0 ? LEAD_NAME : nameOfParent.get(activity.parentToolUseId) ?? "lead";
			const board = /* @__PURE__ */ new Map();
			const pendingCreates = /* @__PURE__ */ new Map();
			const messages = [];
			const upsert = (id, patch) => {
				const previous = board.get(id) ?? {
					id,
					subject: `#${id}`,
					status: "pending",
					blockedBy: []
				};
				board.set(id, {
					...previous,
					...patch
				});
			};
			for (const activity of ordered) {
				const toolUseId = activity.toolUseId;
				if (toolUseId === void 0) continue;
				if (activity.toolName === void 0) {
					const created = pendingCreates.get(toolUseId);
					if (created === void 0) continue;
					pendingCreates.delete(toolUseId);
					if (activity.isError === true || activity.phase === "failed") continue;
					const id = createdTaskId(activity.detail) ?? toolUseId;
					upsert(id, {
						...created,
						id
					});
					continue;
				}
				if (activity.phase !== "started") continue;
				const input = parseRecord(activity.detail) ?? {};
				if (activity.toolName === "TaskCreate") {
					const subject = text(input.subject);
					if (subject === void 0) continue;
					const description = text(input.description);
					pendingCreates.set(toolUseId, {
						id: toolUseId,
						subject,
						status: "pending",
						blockedBy: [],
						...description === void 0 ? {} : { description }
					});
				} else if (activity.toolName === "TaskUpdate") {
					const id = text(input.taskId) ?? (typeof input.taskId === "number" ? String(input.taskId) : void 0);
					if (id === void 0) continue;
					const status = taskStatus(input.status);
					const owner = text(input.owner);
					const subject = text(input.subject);
					const description = text(input.description);
					const blockedBy = strings(input.addBlockedBy);
					const previous = board.get(id);
					upsert(id, {
						...status === void 0 ? {} : { status },
						...owner === void 0 ? {} : { owner },
						...subject === void 0 ? {} : { subject },
						...description === void 0 ? {} : { description },
						...blockedBy.length === 0 ? {} : { blockedBy: [.../* @__PURE__ */ new Set([...previous?.blockedBy ?? [], ...blockedBy])] }
					});
				} else if (activity.toolName === "SendMessage") {
					const message = text(input.message) ?? text(input.content);
					if (message === void 0) continue;
					const to = text(input.to) ?? strings(input.to).join(", ");
					const summary = text(input.summary);
					messages.push({
						ordinal: activity.ordinal,
						from: senderOf(activity),
						to: to.length === 0 ? LEAD_NAME : to,
						message,
						...summary === void 0 ? {} : { summary }
					});
				}
			}
			for (const created of pendingCreates.values()) upsert(created.id, created);
			return {
				members,
				tasks: [...board.values()],
				messages
			};
		}
		/** A member row's status word, from the task board's vocabulary. */
		function memberStatusKey(status) {
			switch (status) {
				case "running": return "teamStatusRunning";
				case "completed": return "teamStatusCompleted";
				case "failed": return "teamStatusFailed";
				case "stopped": return "teamStatusStopped";
				case "killed": return "teamStatusKilled";
			}
		}
		function taskStatusKey(status) {
			return status === "pending" ? "teamTaskPending" : status === "in_progress" ? "teamTaskInProgress" : "teamTaskCompleted";
		}
		//#endregion
		//#region src/client/ClaudeTeammatePanel.tsx
		const EMPTY_TASKS$1 = [];
		/** The Lead's brief reads as the user turn of this conversation, the report
		*  as its closing answer; between them the flow is the chat's own. */
		const PANEL_CSS = [
			".dsh-claude-teammate-meta{display:flex;flex-wrap:wrap;gap:6px 12px;padding:0 0 10px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}",
			".dsh-claude-teammate-brief{align-self:flex-end;max-width:85%;margin:0 0 12px auto;padding:8px 12px;border-radius:14px 14px 4px 14px;",
			"background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-size:13px;line-height:19px;white-space:pre-wrap;overflow-wrap:anywhere}",
			".dsh-claude-teammate-brief-label{display:block;margin-bottom:2px;color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dsh-claude-teammate-report{margin-top:12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 16%, transparent))}",
			".dsh-claude-teammate-report-label{display:block;margin-bottom:4px;color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dsh-claude-teammate-empty{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:4px 0}"
		].join("");
		/** One teammate's conversation: what the Lead asked, what it said and ran, and
		*  what it reported back, drawn with the chat's own transcript renderer. */
		function ClaudeTeammatePanel({ t, closeDetails, taskId, useClaudeProjection }) {
			const owned = useClaudeProjection((projection) => projection.owned);
			const activities = useClaudeProjection((projection) => projection.activities);
			const tasks = useClaudeProjection((projection) => projection.tasks?.tasks ?? EMPTY_TASKS$1);
			const member = useMemo(() => deriveTeam(activities, tasks), [activities, tasks]).members.find((candidate) => candidate.taskId === taskId);
			const items = useMemo(() => member === void 0 ? [] : teammateTranscript(activities, member.taskId, member.toolUseId), [activities, member]);
			const markdownLabels = useClaudeMarkdownLabels(t);
			if (!owned) return null;
			return /* @__PURE__ */ jsxs("div", {
				className: detailsCardClass,
				style: tasksPanel,
				children: [
					/* @__PURE__ */ jsxs("style", {
						"data-dsh-claude-teammate-styles": true,
						children: [
							detailsCardCss,
							panelIconButtonCss,
							PANEL_CSS
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						style: tasksHeader,
						children: [/* @__PURE__ */ jsx("span", {
							style: tasksHeading,
							children: member?.name ?? t("teammatePanelTitle")
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: panelIconButtonClass,
							"aria-label": t("teammateClose"),
							onClick: closeDetails,
							children: /* @__PURE__ */ jsx(IconCloseOutlineRegular, {})
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						style: tasksBody,
						children: member === void 0 ? /* @__PURE__ */ jsx("div", {
							className: "dsh-claude-teammate-empty",
							children: t("teammateGone")
						}) : /* @__PURE__ */ jsxs(Fragment$1, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "dsh-claude-teammate-meta",
								children: [
									/* @__PURE__ */ jsx("span", { children: t(memberStatusKey(member.status)) }),
									member.usage?.toolUses === void 0 ? null : /* @__PURE__ */ jsx("span", { children: t("teammateToolUses", { count: member.usage.toolUses }) }),
									member.lastToolName === void 0 ? null : /* @__PURE__ */ jsx("span", { children: member.lastToolName })
								]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "dsh-claude-teammate-brief",
								children: [/* @__PURE__ */ jsx("span", {
									className: "dsh-claude-teammate-brief-label",
									children: t("teammateBrief")
								}), member.prompt ?? member.description]
							}),
							items.length > 0 ? /* @__PURE__ */ jsx(ClaudeTranscriptFlow, {
								items,
								t
							}) : member.status === "running" ? /* @__PURE__ */ jsx("div", {
								className: "dsh-claude-teammate-empty",
								children: t("teammateWorking")
							}) : null,
							member.summary === void 0 ? null : /* @__PURE__ */ jsxs("div", {
								className: "dsh-claude-teammate-report",
								children: [/* @__PURE__ */ jsx("span", {
									className: "dsh-claude-teammate-report-label",
									children: t("teammateResult")
								}), /* @__PURE__ */ jsx("div", {
									className: "dsh-claude-transcript-text",
									children: /* @__PURE__ */ jsx(ClaudeMarkdown, {
										text: member.summary,
										labels: markdownLabels
									})
								})]
							})
						] })
					})
				]
			});
		}
		//#endregion
		//#region src/client/sidebar-tabs.tsx
		/**
		* The plugin's panels as tabs of the Host's right sidebar.
		*
		* Host 0.1.5 removed the `details` column this package used to register a
		* single panel into, and replaced it with a tabbed, splittable, floatable right
		* sidebar (`@deepseek-ai/dsh-client-ui-sidebar-right`). A panel there is a
		* tab *type*: declared once in `ctx.sidebarRightTabs`, with its body registered
		* into `sidebar.right.pane.tab` under the type's id, and opened per session
		* through `ctx.sidebarRight.openTabIn`. Reopening a type that is already open
		* focuses that tab and re-delivers the navigation params, so a second "show
		* diff" press for another root lands in the same tab.
		*
		* The Host owns fullscreen and closing now: the sidebar chrome carries its
		* own fullscreen toggle, so the panels draw none, and a panel's close button
		* closes its tab.
		*/
		const CLAUDE_TAB_KINDS = {
			diff: "claude-diff",
			plan: "claude-plan",
			teammate: "claude-teammate"
		};
		/** Which tab (if any) each kind currently occupies, per session. */
		var TabOccupancy = class TabOccupancy {
			#byKey = /* @__PURE__ */ new Map();
			#listeners = /* @__PURE__ */ new Map();
			static key(kind, sessionId) {
				return `${kind}\0${sessionId}`;
			}
			tabId(kind, sessionId) {
				return this.#byKey.get(TabOccupancy.key(kind, sessionId));
			}
			note(kind, sessionId, tabId) {
				const key = TabOccupancy.key(kind, sessionId);
				const previous = this.#byKey.get(key);
				if (tabId === void 0) this.#byKey.delete(key);
				else this.#byKey.set(key, tabId);
				if (previous === tabId) return;
				for (const listener of this.#listeners.get(key) ?? []) listener();
			}
			source(kind, sessionId) {
				const key = TabOccupancy.key(kind, sessionId);
				return {
					subscribe: (listener) => {
						let set = this.#listeners.get(key);
						if (set === void 0) {
							set = /* @__PURE__ */ new Set();
							this.#listeners.set(key, set);
						}
						set.add(listener);
						return () => {
							set.delete(listener);
						};
					},
					getSnapshot: () => this.#byKey.has(key)
				};
			}
		};
		/** Bind a panel body to the tab it lives in: report occupancy, and map the
		*  tab surface onto the panel's close / maximize props. */
		function useClaudeTab(useTabInfo, noteTab) {
			const info = useTabInfo();
			const tabId = info.tab.id;
			useEffect(() => {
				noteTab(tabId);
				return () => {
					noteTab(void 0);
				};
			}, [noteTab, tabId]);
			const actions = info.tab.actions;
			return {
				closeDetails: useCallback(() => {
					actions.close();
				}, [actions]),
				params: info.tab.navigation.params ?? {}
			};
		}
		function ClaudeDiffTab({ useTabInfo, noteTab, ...panel }) {
			const { closeDetails, params } = useClaudeTab(useTabInfo, noteTab);
			return /* @__PURE__ */ jsx(ClaudeDiffPanel, {
				...panel,
				closeDetails,
				...params.initialRoot === void 0 ? {} : { initialRoot: params.initialRoot }
			});
		}
		function ClaudePlanTab({ useTabInfo, noteTab, ...panel }) {
			const { closeDetails } = useClaudeTab(useTabInfo, noteTab);
			return /* @__PURE__ */ jsx(ClaudePlanPanel, {
				...panel,
				closeDetails
			});
		}
		function ClaudeTeammateTab({ useTabInfo, noteTab, ...panel }) {
			const { closeDetails, params } = useClaudeTab(useTabInfo, noteTab);
			return /* @__PURE__ */ jsx(ClaudeTeammatePanel, {
				...panel,
				closeDetails,
				taskId: params.teammate ?? ""
			});
		}
		/** Declare the three tab types and their bodies; returns the per-session
		*  open / close / toggle face the rest of the client drives them through. */
		function registerClaudeSidebarTabs(ctx, options) {
			const { t, namespace } = options;
			const occupancy = new TabOccupancy();
			const faceFor = (kind, sessionId) => ({ noteTab: (tabId) => {
				occupancy.note(kind, sessionId, tabId);
			} });
			const titles = {
				[CLAUDE_TAB_KINDS.diff]: () => t("diffTabTitle"),
				[CLAUDE_TAB_KINDS.plan]: () => t("planPanelTitle"),
				[CLAUDE_TAB_KINDS.teammate]: () => t("teammatePanelTitle")
			};
			for (const kind of Object.values(CLAUDE_TAB_KINDS)) ctx.effect(() => ctx.sidebarRightTabs.register({
				id: kind,
				kind,
				priority: "extension",
				title: titles[kind]
			}), `dsh-claude: ${kind} tab type`);
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: CLAUDE_TAB_KINDS.diff,
				locale: namespace,
				inject: (sessionId) => ({
					t,
					sessionId,
					...faceFor(CLAUDE_TAB_KINDS.diff, sessionId),
					...options.diffFace(sessionId)
				})
			}, ClaudeDiffTab));
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: CLAUDE_TAB_KINDS.plan,
				locale: namespace,
				inject: (sessionId) => ({
					t,
					sessionId,
					...faceFor(CLAUDE_TAB_KINDS.plan, sessionId)
				})
			}, ClaudePlanTab));
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: CLAUDE_TAB_KINDS.teammate,
				locale: namespace,
				inject: (sessionId) => ({
					t,
					...faceFor(CLAUDE_TAB_KINDS.teammate, sessionId)
				})
			}, ClaudeTeammateTab));
			const open = (kind, sessionId, params) => {
				ctx.sidebarRight.openTabIn(sessionId, kind, { params });
			};
			const close = (kind, sessionId) => {
				const tabId = occupancy.tabId(kind, sessionId);
				if (tabId !== void 0) ctx.sidebarRight.closeIn(sessionId, tabId);
			};
			return {
				open,
				close,
				toggle: (kind, sessionId, params) => {
					if (occupancy.tabId(kind, sessionId) === void 0) open(kind, sessionId, params);
					else close(kind, sessionId);
				},
				isOpen: (kind, sessionId) => occupancy.tabId(kind, sessionId) !== void 0,
				sourceFor: (kind, sessionId) => occupancy.source(kind, sessionId)
			};
		}
		//#endregion
		//#region src/client/ask-api.ts
		function record$1(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
		}
		function parseAskEvent(line) {
			const event = record$1(JSON.parse(line));
			if (event?.type === "delta" && typeof event.text === "string") return {
				type: "delta",
				text: event.text
			};
			if (event?.type === "thinking" && typeof event.text === "string") return {
				type: "thinking",
				text: event.text
			};
			if (event?.type === "status" && typeof event.text === "string") return {
				type: "status",
				text: event.text
			};
			if (event?.type === "tool" && typeof event.id === "string" && (event.phase === "start" || event.phase === "input" || event.phase === "done")) return {
				type: "tool",
				id: event.id,
				phase: event.phase,
				...typeof event.name === "string" ? { name: event.name } : {},
				...typeof event.summary === "string" ? { summary: event.summary } : {},
				...event.error === true ? { error: true } : {}
			};
			if (event?.type === "done") return { type: "done" };
			if (event?.type === "error") return {
				type: "error",
				message: typeof event.message === "string" ? event.message : "The question could not be answered."
			};
			throw new Error("Invalid ask stream event.");
		}
		async function openAnswer(sessionId, request, cancel) {
			try {
				return await pluginNdjson(CLAUDE_ASK_PATH, cancel, {
					method: "POST",
					query: { sessionId },
					json: request
				});
			} catch (error) {
				if (error instanceof PluginRequestError && error.reason === "http") throw new Error("The question could not be sent.");
				throw error;
			}
		}
		/** Stream an answer about selected reply text; resolves when the answer completes. */
		async function askAboutSelection(sessionId, request, onProgress, signal) {
			const carrier = new AbortController();
			const stop = () => {
				carrier.abort();
			};
			signal?.addEventListener("abort", stop, { once: true });
			if (signal?.aborted === true) carrier.abort();
			try {
				const reader = await openAnswer(sessionId, request, carrier.signal);
				const decoder = new TextDecoder();
				let buffer = "";
				let finished = false;
				const handle = (line) => {
					if (line.trim().length === 0) return;
					const event = parseAskEvent(line);
					if (event.type === "delta") onProgress({
						type: "text",
						text: event.text
					});
					else if (event.type === "thinking") onProgress({
						type: "thinking",
						text: event.text
					});
					else if (event.type === "status") onProgress({
						type: "status",
						text: event.text
					});
					else if (event.type === "tool") onProgress(event);
					else if (event.type === "done") finished = true;
					else throw new Error(event.message);
				};
				while (true) {
					const chunk = await reader.read();
					buffer += decoder.decode(chunk.value, { stream: !chunk.done });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) handle(line);
					if (chunk.done) break;
				}
				handle(buffer);
				if (!finished) throw new Error("The answer ended unexpectedly.");
			} finally {
				signal?.removeEventListener("abort", stop);
				carrier.abort();
			}
		}
		//#endregion
		//#region src/client/ClaudeSelectionAsk.tsx
		const CHAT_NODE = "[data-chat-flow-kind]";
		const USER_KIND = "user";
		const MAX_SELECTION_CHARS = 8e3;
		const MAX_CONTEXT_CHARS = 16e3;
		const POPUP_WIDTH = 560;
		const POPUP_ESTIMATED_HEIGHT = 320;
		const TOOLBAR_WIDTH = 64;
		const HIGHLIGHT_NAME = "dsh-claude-ask";
		function appendAnswerBlock(blocks, progress) {
			if (progress.type === "text") {
				const last = blocks.at(-1);
				if (last?.kind === "text") return [...blocks.slice(0, -1), {
					kind: "text",
					text: last.text + progress.text
				}];
				return [...blocks, {
					kind: "text",
					text: progress.text
				}];
			}
			if (progress.type !== "tool") return blocks;
			const index = blocks.findIndex((block) => block.kind === "tool" && block.id === progress.id);
			if (index < 0) {
				if (progress.phase === "done") return blocks;
				return [...blocks, {
					kind: "tool",
					id: progress.id,
					name: progress.name ?? "tool",
					state: "running",
					...progress.summary === void 0 ? {} : { summary: progress.summary }
				}];
			}
			const current = blocks[index];
			const next = {
				...current,
				...progress.name === void 0 ? {} : { name: progress.name },
				...progress.summary === void 0 ? {} : { summary: progress.summary },
				state: progress.phase === "done" ? progress.error === true ? "error" : "done" : current.state
			};
			return [
				...blocks.slice(0, index),
				next,
				...blocks.slice(index + 1)
			];
		}
		function answerText(blocks) {
			return blocks.filter((block) => block.kind === "text").map((block) => block.text.trim()).filter((text) => text.length > 0).join("\n\n");
		}
		function rectOf(range) {
			const rect = range.getBoundingClientRect();
			return {
				top: rect.top,
				left: rect.left,
				width: rect.width,
				bottom: rect.bottom
			};
		}
		/** Read the current selection when it sits inside an assistant reply. */
		function selectionInfoOf(selection, sessionId) {
			if (sessionId === void 0 || selection === null || selection.isCollapsed || selection.rangeCount === 0) return void 0;
			const range = selection.getRangeAt(0);
			const hostOf = (node) => {
				return (node instanceof Element ? node : node?.parentElement ?? null)?.closest(CHAT_NODE) ?? null;
			};
			const host = hostOf(range.startContainer) ?? hostOf(range.endContainer);
			if (host === null || host.dataset.chatFlowKind === USER_KIND) return void 0;
			const text = selection.toString().trim();
			if (text.length === 0) return void 0;
			return {
				text: text.slice(0, MAX_SELECTION_CHARS),
				context: (host.textContent ?? "").trim().slice(0, MAX_CONTEXT_CHARS),
				rect: rectOf(range),
				range: range.cloneRange()
			};
		}
		function toolbarPosition(rect, viewportWidth) {
			return {
				top: Math.max(8, rect.top - 40),
				left: Math.min(Math.max(8, rect.left + rect.width / 2 - TOOLBAR_WIDTH / 2), Math.max(8, viewportWidth - TOOLBAR_WIDTH - 8))
			};
		}
		/** Pick the side with room once, when the popup opens: below the selection
		*  unless the space there is short and above is roomier. */
		function popupSide(rect, viewportHeight) {
			const roomBelow = viewportHeight - rect.bottom - 16;
			const roomAbove = rect.top - 16;
			return roomBelow >= POPUP_ESTIMATED_HEIGHT || roomBelow >= roomAbove ? "below" : "above";
		}
		/** Anchor on the chosen side so streamed content grows away from the text and
		*  scrolls inside the popup instead of running off screen. */
		function popupPlacement(rect, side, viewportWidth, viewportHeight) {
			const width = Math.min(POPUP_WIDTH, viewportWidth - 16);
			const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - width - 8));
			const cap = Math.round(viewportHeight * .7);
			if (side === "below") {
				const top = Math.max(8, rect.bottom + 8);
				return {
					top,
					left,
					width,
					maxHeight: Math.max(120, Math.min(cap, viewportHeight - top - 8))
				};
			}
			const bottom = Math.max(8, viewportHeight - rect.top + 8);
			return {
				bottom,
				left,
				width,
				maxHeight: Math.max(120, Math.min(cap, viewportHeight - bottom - 8))
			};
		}
		function CopyIcon() {
			return /* @__PURE__ */ jsxs("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ jsx("rect", {
					x: "5.5",
					y: "5.5",
					width: "8",
					height: "8",
					rx: "1.5"
				}), /* @__PURE__ */ jsx("path", { d: "M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" })]
			});
		}
		function AskIcon() {
			return /* @__PURE__ */ jsxs("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ jsx("path", { d: "M2.75 2.75h10.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H8.2l-3.2 2.9v-2.9H2.75a1 1 0 0 1-1-1v-6.5a1 1 0 0 1 1-1Z" }), /* @__PURE__ */ jsx("path", { d: "M6.4 6.3a1.6 1.6 0 1 1 2.3 1.5c-.5.3-.7.6-.7 1.1M8 10.6h.01" })]
			});
		}
		function CheckIcon() {
			return /* @__PURE__ */ jsx("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx("path", { d: "m3.5 8.5 3 3 6-7" })
			});
		}
		/** Selection toolbar over assistant replies: copy, or ask a follow-up whose
		*  answer streams into a popup rendered with the Host Markdown renderer. */
		function ClaudeSelectionAsk({ t, currentSessionId, ownsSession, insertIntoChat }) {
			const markdownLabels = useClaudeMarkdownLabels(t);
			const [selection, setSelection] = useState();
			const [open, setOpen] = useState(false);
			const [question, setQuestion] = useState("");
			const [blocks, setBlocks] = useState([]);
			const answer = answerText(blocks);
			const [thinking, setThinking] = useState("");
			const [thinkingOpen, setThinkingOpen] = useState(false);
			const [started, setStarted] = useState(false);
			const [phase, setPhase] = useState("idle");
			const [error, setError] = useState();
			const [copied, setCopied] = useState();
			const [rect, setRect] = useState();
			const [side, setSide] = useState("below");
			const popupRef = useRef(null);
			const toolbarRef = useRef(null);
			const controller = useRef();
			const openRef = useRef(false);
			openRef.current = open;
			const close = useCallback(() => {
				controller.current?.abort();
				controller.current = void 0;
				setOpen(false);
				setSelection(void 0);
				setQuestion("");
				setBlocks([]);
				setThinking("");
				setThinkingOpen(false);
				setStarted(false);
				setPhase("idle");
				setError(void 0);
				setCopied(void 0);
			}, []);
			useEffect(() => {
				if (typeof document === "undefined") return;
				let timer;
				const update = () => {
					if (openRef.current) return;
					const sessionId = currentSessionId();
					if (sessionId === void 0 || !ownsSession(sessionId)) {
						setSelection(void 0);
						return;
					}
					const info = selectionInfoOf(document.getSelection(), sessionId);
					setSelection(info === void 0 ? void 0 : {
						sessionId,
						...info
					});
				};
				const schedule = () => {
					if (timer !== void 0) clearTimeout(timer);
					timer = setTimeout(update, 120);
				};
				const onKey = (event) => {
					if (event.key === "Escape") close();
				};
				const onPointerDown = (event) => {
					if (!(event.target instanceof Node)) return;
					if (popupRef.current?.contains(event.target) === true || toolbarRef.current?.contains(event.target) === true) return;
					if (openRef.current) close();
				};
				document.addEventListener("selectionchange", schedule);
				document.addEventListener("mouseup", schedule);
				document.addEventListener("keydown", onKey);
				document.addEventListener("pointerdown", onPointerDown);
				return () => {
					if (timer !== void 0) clearTimeout(timer);
					document.removeEventListener("selectionchange", schedule);
					document.removeEventListener("mouseup", schedule);
					document.removeEventListener("keydown", onKey);
					document.removeEventListener("pointerdown", onPointerDown);
				};
			}, [
				close,
				currentSessionId,
				ownsSession
			]);
			useEffect(() => () => controller.current?.abort(), []);
			useEffect(() => {
				setRect(selection?.rect);
				if (selection === void 0) return;
				let frame;
				const reposition = () => {
					if (frame !== void 0) return;
					frame = requestAnimationFrame(() => {
						frame = void 0;
						const next = rectOf(selection.range);
						if (next.width === 0 && next.bottom === next.top) return;
						setRect(next);
					});
				};
				document.addEventListener("scroll", reposition, true);
				window.addEventListener("resize", reposition);
				return () => {
					if (frame !== void 0) cancelAnimationFrame(frame);
					document.removeEventListener("scroll", reposition, true);
					window.removeEventListener("resize", reposition);
				};
			}, [selection]);
			useEffect(() => {
				if (!open || selection === void 0) return;
				const runtime = globalThis;
				const registry = runtime.CSS?.highlights;
				if (registry === void 0 || runtime.Highlight === void 0) return;
				registry.set(HIGHLIGHT_NAME, new runtime.Highlight(selection.range));
				return () => {
					registry.delete(HIGHLIGHT_NAME);
				};
			}, [open, selection]);
			useEffect(() => {
				if (copied === void 0) return;
				const timer = setTimeout(() => setCopied(void 0), 1200);
				return () => clearTimeout(timer);
			}, [copied]);
			if (selection === void 0 || rect === void 0) return /* @__PURE__ */ jsx("span", {
				"data-dsh-claude-selection-ask": "armed",
				hidden: true
			});
			const copy = (text, what) => {
				navigator.clipboard.writeText(text).then(() => {
					setCopied(what);
				}, () => void 0);
			};
			const submit = () => {
				if (question.trim().length === 0 || phase === "answering") return;
				controller.current?.abort();
				const aborter = new AbortController();
				controller.current = aborter;
				setBlocks([]);
				setThinking("");
				setThinkingOpen(false);
				setStarted(false);
				setError(void 0);
				setPhase("answering");
				askAboutSelection(selection.sessionId, {
					selection: selection.text,
					context: selection.context,
					question
				}, (progress) => {
					if (progress.type === "status") setStarted(true);
					else if (progress.type === "thinking") setThinking((current) => current + progress.text);
					else setBlocks((current) => appendAnswerBlock(current, progress));
				}, aborter.signal).then(() => {
					if (!aborter.signal.aborted) setPhase("done");
				}, (reason) => {
					if (aborter.signal.aborted) return;
					setError(reason instanceof Error ? reason.message : t("askFailed"));
					setPhase("done");
				});
			};
			const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
			const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
			if (!open) {
				const position = toolbarPosition(rect, viewportWidth);
				return /* @__PURE__ */ jsxs("div", {
					ref: toolbarRef,
					role: "toolbar",
					"aria-label": t("askToolbar"),
					style: {
						...askToolbar,
						top: position.top,
						left: position.left
					},
					children: [
						/* @__PURE__ */ jsx("style", {
							"data-dsh-claude-ask-styles": true,
							children: panelIconButtonCss
						}),
						/* @__PURE__ */ jsx(Tooltip, {
							label: copied === "selection" ? t("askCopied") : t("copyTooltip"),
							side: "top",
							delayMs: 300,
							children: /* @__PURE__ */ jsx("button", {
								type: "button",
								className: panelIconButtonClass,
								"aria-label": t("copyTooltip"),
								onMouseDown: (event) => {
									event.preventDefault();
								},
								onClick: () => {
									copy(selection.text, "selection");
								},
								children: copied === "selection" ? /* @__PURE__ */ jsx(CheckIcon, {}) : /* @__PURE__ */ jsx(CopyIcon, {})
							})
						}),
						/* @__PURE__ */ jsx(Tooltip, {
							label: t("askTooltip"),
							side: "top",
							delayMs: 300,
							children: /* @__PURE__ */ jsx("button", {
								type: "button",
								className: panelIconButtonClass,
								"aria-label": t("askTooltip"),
								onMouseDown: (event) => {
									event.preventDefault();
								},
								onClick: () => {
									setSide(popupSide(rect, viewportHeight));
									setOpen(true);
								},
								children: /* @__PURE__ */ jsx(AskIcon, {})
							})
						})
					]
				});
			}
			const placement = popupPlacement(rect, side, viewportWidth, viewportHeight);
			return /* @__PURE__ */ jsxs("div", {
				ref: popupRef,
				role: "dialog",
				"aria-label": t("askTooltip"),
				style: {
					...askPopup,
					...placement
				},
				children: [
					/* @__PURE__ */ jsxs("style", {
						"data-dsh-claude-ask-styles": true,
						children: [panelIconButtonCss, askHighlightCss]
					}),
					/* @__PURE__ */ jsx("strong", {
						style: promptSaveHeading,
						children: t("askTooltip")
					}),
					/* @__PURE__ */ jsx("p", {
						style: askQuote,
						children: selection.text
					}),
					phase === "idle" ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("textarea", {
						autoFocus: true,
						value: question,
						placeholder: t("askPlaceholder"),
						style: askTextarea,
						onChange: (event) => {
							setQuestion(event.currentTarget.value);
						},
						onKeyDown: (event) => {
							if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
								event.preventDefault();
								submit();
							}
						}
					}), /* @__PURE__ */ jsxs("div", {
						style: askActions,
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							style: askButton,
							onClick: close,
							children: t("askClose")
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...askButton,
								...askPrimaryButton
							},
							disabled: question.trim().length === 0,
							onClick: submit,
							children: t("askSubmit")
						})]
					})] }) : /* @__PURE__ */ jsxs(Fragment$1, { children: [
						/* @__PURE__ */ jsx("p", {
							style: askQuestion,
							children: question
						}),
						/* @__PURE__ */ jsxs("div", {
							style: askAnswer,
							children: [
								thinking.length === 0 ? null : /* @__PURE__ */ jsxs("button", {
									type: "button",
									style: askThinkingRow,
									"aria-expanded": thinkingOpen,
									onClick: () => {
										setThinkingOpen((value) => !value);
									},
									children: [/* @__PURE__ */ jsx("span", {
										style: askThinkingLabel,
										children: phase === "answering" && answer.length === 0 ? t("askThinkingLive") : t("askThinkingLabel")
									}), /* @__PURE__ */ jsx("span", {
										style: thinkingOpen ? askThinkingFull : askThinkingPreview,
										children: thinkingOpen ? thinking : thinking.trimEnd().split("\n").filter((line) => line.trim().length > 0).at(-1)
									})]
								}),
								blocks.length === 0 && thinking.length === 0 && error === void 0 ? /* @__PURE__ */ jsx("span", {
									style: askStatus,
									children: started ? t("askThinking") : t("askStarting")
								}) : null,
								blocks.map((block, index) => block.kind === "text" ? /* @__PURE__ */ jsx(ClaudeMarkdown, {
									text: block.text,
									labels: markdownLabels,
									streaming: phase === "answering" && index === blocks.length - 1
								}, `text-${index}`) : /* @__PURE__ */ jsxs("div", {
									style: askToolRow,
									children: [
										/* @__PURE__ */ jsx("span", {
											style: {
												...askToolGlyph,
												...block.state === "error" ? askToolGlyphError : block.state === "done" ? askToolGlyphDone : {}
											},
											"aria-hidden": "true",
											children: block.state === "running" ? "…" : block.state === "done" ? "✓" : "×"
										}),
										/* @__PURE__ */ jsx("span", {
											style: askToolName,
											children: block.name
										}),
										block.summary === void 0 ? null : /* @__PURE__ */ jsx("span", {
											style: askToolSummary,
											children: block.summary
										})
									]
								}, block.id)),
								error === void 0 ? null : /* @__PURE__ */ jsx("p", {
									role: "alert",
									style: askError,
									children: error
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							style: askActions,
							children: [
								answer.length === 0 ? null : /* @__PURE__ */ jsx("button", {
									type: "button",
									style: askButton,
									onClick: () => {
										copy(answer, "answer");
									},
									children: copied === "answer" ? t("askCopied") : t("askCopyAnswer")
								}),
								answer.length === 0 || insertIntoChat === void 0 ? null : /* @__PURE__ */ jsx("button", {
									type: "button",
									style: askButton,
									onClick: () => {
										insertIntoChat(selection.sessionId, `> ${selection.text.replaceAll("\n", "\n> ")}\n\n**${question}**\n\n${answer}`);
										close();
									},
									children: t("askSendToChat")
								}),
								/* @__PURE__ */ jsx("button", {
									type: "button",
									style: {
										...askButton,
										...askPrimaryButton
									},
									onClick: close,
									children: t("askClose")
								})
							]
						})
					] })
				]
			});
		}
		//#endregion
		//#region src/client/composer-style-probe.ts
		/** Watch for the plugin's composer bar and check it once for style drift.
		*
		*  The Host publishes the composer layout properties onto the composer subtree,
		*  not onto `:root`. Custom properties inherit, so only an element inside that
		*  subtree can read one — probing the document root reports every one of them
		*  missing whether or not the Host still defines it, which is exactly the
		*  false alarm this replaced.
		*
		*  The bar exists only while a Session is on screen, so this waits rather than
		*  sampling once at boot, and stops after the first successful read: the answer
		*  cannot change without a Host reload.
		*
		*  @param report - receives one line per property the bar cannot see.
		*  @returns disposer; safe to call more than once.
		*/
		function watchClaudeComposerBar(report) {
			if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
			let observer;
			const stop = () => {
				observer?.disconnect();
				observer = void 0;
			};
			const probe = () => {
				const bar = document.querySelector(`[${CLAUDE_COMPOSER_BAR_ATTRIBUTE}]`);
				if (bar === null) return false;
				const style = getComputedStyle(bar);
				for (const finding of claudeScopedCssFindings((name) => style.getPropertyValue(name))) report(finding);
				return true;
			};
			if (probe()) return stop;
			observer = new MutationObserver(() => {
				if (probe()) stop();
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			return stop;
		}
		/** A beacon rather than a request: a finding is dropped when the connection
		*  budget is spent, because the channel that reports the plugin's own failures
		*  must never be the traffic that causes them — and must never queue behind
		*  them either. */
		function postToHost(report) {
			pluginBeacon(CLAUDE_CLIENT_DIAGNOSTICS_PATH, report);
		}
		/** Renderer-side findings reach the Host log through here.
		*
		*  Nothing the renderer throws — a crashed Slot entry included — reaches the
		*  Host log on its own, and the shipped Desktop build opens no DevTools, so a
		*  plugin whose entries all died looks exactly like a healthy one from the
		*  outside. Every Desktop 2.0 breakage in this package was found only by
		*  attaching a debugger to the renderer by hand. */
		function createClaudeDiagnosticsReporter(post = postToHost) {
			const sent = /* @__PURE__ */ new Set();
			return { report(kind, detail) {
				if (sent.size >= 40) return;
				const key = `${kind} ${detail}`;
				if (sent.has(key)) return;
				sent.add(key);
				try {
					post({
						kind,
						detail
					});
				} catch {}
			} };
		}
		//#endregion
		//#region src/client/rewind-dom.ts
		/** Seats for the rewind control inside the Host's own message action rows.
		*
		*  The chat exposes an additive slot for assistant actions only, so a control
		*  on a USER message has to reach into markup this package does not own. Every
		*  lookup here fails open: a Host rename makes the selector miss and the row
		*  keeps its stock copy/branch actions instead of breaking. */
		const PORTAL_ATTRIBUTE$1 = "data-dsh-claude-rewind";
		/** The chat row wrapper carries the node kind and its stable node key. */
		const USER_ROW = "[data-chat-flow-kind=\"user\"][data-chat-flow-key]";
		/** MessageIconActions composes its own CSS-module class onto the row; only the
		*  build-hash prefix changes across Host releases. */
		const ACTIONS_ROW = "[class*=\"actions\"]";
		/** Reuse an existing seat rather than minting a fresh element: a new node would
		*  change React's portal identity and restart every effect keyed on it. */
		function ensureSeat(row) {
			const actions = row.querySelector(ACTIONS_ROW);
			if (actions === null) return void 0;
			const existing = actions.querySelector(`:scope > [${PORTAL_ATTRIBUTE$1}]`);
			const copy = actions.querySelector(":scope > button");
			if (existing !== null) {
				if (copy !== null && existing.nextElementSibling !== copy) actions.insertBefore(existing, copy);
				return existing;
			}
			const seat = document.createElement("span");
			seat.setAttribute(PORTAL_ATTRIBUTE$1, "");
			seat.style.display = "inline-flex";
			if (copy === null) actions.appendChild(seat);
			else actions.insertBefore(seat, copy);
			return seat;
		}
		/** Every visible user message row, paired with its portal host. */
		function locateClaudeRewindSeats(root = document) {
			const seats = [];
			for (const row of root.querySelectorAll(USER_ROW)) {
				const key = row.getAttribute("data-chat-flow-key");
				if (key === null || key.length === 0) continue;
				const host = ensureSeat(row);
				if (host !== void 0) seats.push({
					key,
					host
				});
			}
			return seats;
		}
		function removeClaudeRewindSeats(root = document) {
			for (const seat of root.querySelectorAll(`[${PORTAL_ATTRIBUTE$1}]`)) seat.remove();
		}
		function sameClaudeRewindSeats(left, right) {
			return left.length === right.length && left.every((seat, index) => seat.key === right[index]?.key && seat.host === right[index]?.host);
		}
		/** Hide every rewound row: the DSH session log is append-only, so the rows the
		*  rewind dropped stay in the transcript and are suppressed here. A turn's
		*  steps also sit in a process group seat whose key is synthetic, not any
		*  node's; a rewind drops whole turns, so those seats are hidden by turn. */
		function rewindHiddenCss(keys, turns = []) {
			const selectors = [...keys.filter((key) => !key.includes("\"") && !key.includes("\\")).map((key) => `[data-chat-flow-key="${key}"]`), ...turns.filter(Number.isSafeInteger).map((turn) => `[data-chat-group-key][data-chat-turn="${turn}"]`)];
			return selectors.length === 0 ? "" : `${selectors.join(",")}{display:none}`;
		}
		/** The log seq a chat node stands for. The Host seats a turn's process row
		*  ("Analysis completed") a tenth before its turn/start, so by its raw anchor
		*  it would escape a rewind range that begins at that turn/start. */
		function rewindNodeSeq(kind, anchorSeq) {
			return kind === "turn-process" ? Math.ceil(anchorSeq) : anchorSeq;
		}
		//#endregion
		//#region src/client/rewind-api.ts
		/** Drop one user message and everything after it: the rows are hidden from
		*  this session's transcript and Claude resumes before that turn.
		*
		*  With `restoreFiles`, the checkout is put back to the tree that turn was
		*  admitted against. The answer reports whether that half actually landed:
		*  a turn from before this session captured trees, or a tree git has since
		*  collected, still rewinds the conversation and leaves the files alone. */
		async function rewindSession(sessionId, seq, restoreFiles = false) {
			try {
				return { filesRestored: (await pluginWrite(CLAUDE_REWIND_PATH, "fast", void 0, { json: {
					sessionId,
					seq,
					restoreFiles
				} }))?.filesRestored === true };
			} catch (error) {
				if (!(error instanceof PluginRequestError)) throw error;
				throw new Error(error.code ?? error.reason);
			}
		}
		//#endregion
		//#region src/client/ClaudeRewind.tsx
		const EMPTY_RANGES = [];
		const EMPTY_CHAT_VIEW = {
			chat: {
				order: [],
				nodes: { get: () => void 0 }
			},
			running: false
		};
		const NO_SUBSCRIBE = () => () => {};
		const EMPTY_CHAT_SNAPSHOT = () => EMPTY_CHAT_VIEW;
		const EMPTY_PROJECTION_SNAPSHOT = () => EMPTY_CLAUDE_PROJECTION;
		/** Plain text of one user message node, matching what the copy action yields. */
		function rewindMessageText(data) {
			const content = data?.content;
			if (typeof content === "string") return content;
			if (!Array.isArray(content)) return "";
			return content.map((block) => {
				const item = block;
				return item?.type === "text" && typeof item.text === "string" ? item.text : "";
			}).join("");
		}
		function RewindIcon() {
			return /* @__PURE__ */ jsxs("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ jsx("path", { d: "M3 12a9 9 0 1 0 3-6.7L3 8" }), /* @__PURE__ */ jsx("path", { d: "M3 3v5h5" })]
			});
		}
		/** "Rewind to here" on every user message of a Claude session: drops that
		*  message and everything below it, and rewinds Claude's own context with it. */
		function ClaudeRewind({ t, currentSessionId, subscribeSessions, chatOf, projectionOf, setDraft }) {
			const sessionId = useSyncExternalStore(subscribeSessions, currentSessionId, currentSessionId);
			const chat = sessionId === void 0 ? void 0 : chatOf(sessionId);
			const chatStore = useMemo(() => chat === void 0 ? {
				subscribe: NO_SUBSCRIBE,
				getSnapshot: EMPTY_CHAT_SNAPSHOT
			} : {
				subscribe: (listener) => chat.subscribe(listener),
				getSnapshot: () => chat.getSnapshot()
			}, [chat]);
			const snapshot = useSyncExternalStore(chatStore.subscribe, chatStore.getSnapshot, EMPTY_CHAT_SNAPSHOT);
			const source = sessionId === void 0 ? void 0 : projectionOf(sessionId);
			const projectionStore = useMemo(() => source === void 0 ? {
				subscribe: NO_SUBSCRIBE,
				getSnapshot: EMPTY_PROJECTION_SNAPSHOT
			} : {
				subscribe: (listener) => source.subscribe(listener),
				getSnapshot: () => source.getSnapshot()
			}, [source]);
			const projection = useSyncExternalStore(projectionStore.subscribe, projectionStore.getSnapshot, EMPTY_PROJECTION_SNAPSHOT);
			const [seats, setSeats] = useState([]);
			const [target, setTarget] = useState();
			const [submitting, setSubmitting] = useState(false);
			const [error, setError] = useState();
			const [restoreFiles, setRestoreFiles] = useState(true);
			const { toast, report } = useActionToast();
			const ranges = projection.rewind?.ranges ?? EMPTY_RANGES;
			const owned = projection.owned;
			const unavailable = snapshot.running;
			const armed = sessionId !== void 0 && owned;
			const { hiddenKeys, hiddenTurns, targets } = useMemo(() => {
				const hidden = [];
				const turns = [];
				const visible = /* @__PURE__ */ new Map();
				const users = [];
				let position = 0;
				for (const key of snapshot.chat.order) {
					const node = snapshot.chat.nodes.get(key);
					if (node === void 0) continue;
					if (isRewound(ranges, rewindNodeSeq(node.kind, node.anchorSeq))) {
						hidden.push(key);
						if (node.kind === "turn-process") turns.push(node.data.turn);
						continue;
					}
					position += 1;
					if (node.kind === "user") users.push({
						key,
						seq: node.anchorSeq,
						text: rewindMessageText(node.data),
						index: position
					});
				}
				const total = position;
				for (const user of users) visible.set(user.key, {
					seq: user.seq,
					text: user.text,
					rows: total - user.index
				});
				return {
					hiddenKeys: hidden,
					hiddenTurns: turns,
					targets: visible
				};
			}, [snapshot, ranges]);
			useEffect(() => {
				if (!armed || typeof document === "undefined" || typeof MutationObserver === "undefined") {
					removeClaudeRewindSeats();
					setSeats([]);
					return;
				}
				let scheduled = false;
				const reconcile = () => {
					scheduled = false;
					const found = locateClaudeRewindSeats();
					setSeats((current) => sameClaudeRewindSeats(current, found) ? current : found);
				};
				const schedule = () => {
					if (scheduled) return;
					scheduled = true;
					queueMicrotask(reconcile);
				};
				reconcile();
				const observer = new MutationObserver(schedule);
				observer.observe(document.body, {
					childList: true,
					subtree: true
				});
				return () => {
					observer.disconnect();
					removeClaudeRewindSeats();
				};
			}, [armed, sessionId]);
			useEffect(() => {
				setTarget(void 0);
				setSubmitting(false);
				setError(void 0);
				setRestoreFiles(true);
			}, [sessionId]);
			if (sessionId === void 0 || !owned) return /* @__PURE__ */ jsx("span", {
				"data-dsh-claude-rewind-armed": "armed",
				hidden: true
			});
			const close = () => {
				if (submitting) return;
				setTarget(void 0);
				setError(void 0);
			};
			const confirm = () => {
				if (target === void 0 || submitting) return;
				setSubmitting(true);
				setError(void 0);
				rewindSession(sessionId, target.seq, restoreFiles).then(({ filesRestored }) => {
					setSubmitting(false);
					setTarget(void 0);
					if (target.text !== "") setDraft?.(sessionId, target.text);
					if (restoreFiles && !filesRestored) report(t("rewindFilesUnavailable"));
				}, (reason) => {
					setSubmitting(false);
					const code = reason instanceof Error && reason.message !== "" ? reason.message : "unknown";
					setError(code === "session-busy" ? t("rewindBusy") : code === "route-missing" ? t("rewindStale") : t("rewindFailed", { code }));
				});
			};
			return /* @__PURE__ */ jsxs(Fragment$1, { children: [
				toast,
				/* @__PURE__ */ jsx("style", {
					"data-dsh-claude-rewind-styles": true,
					children: `${rewindActionCss}${rewindHiddenCss(hiddenKeys, hiddenTurns)}`
				}),
				seats.map((seat) => {
					const entry = targets.get(seat.key);
					if (entry === void 0) return null;
					return createPortal(/* @__PURE__ */ jsx(Tooltip, {
						label: unavailable ? t("rewindBusy") : t("rewindTooltip"),
						side: "bottom",
						delayMs: 300,
						children: /* @__PURE__ */ jsx("button", {
							type: "button",
							"aria-label": t("rewindTooltip"),
							"aria-disabled": unavailable || void 0,
							"data-unavailable": unavailable || void 0,
							...unavailable ? {} : { onClick: () => {
								setTarget(entry);
							} },
							children: /* @__PURE__ */ jsx(RewindIcon, {})
						})
					}), seat.host, seat.key);
				}),
				target === void 0 ? null : /* @__PURE__ */ jsx("style", {
					"data-dsh-claude-rewind-modal-styles": true,
					children: diffModalCss
				}),
				/* @__PURE__ */ jsx(Modal, {
					className: "dshClaudeRepositoryActionModal dshClaudeUtilityDialog",
					contentClassName: "dshClaudeRepositoryActionModalContent dshClaudeUtilityContent",
					open: target !== void 0,
					onClose: close,
					title: t("rewindTitle"),
					closeLabel: t("diffCancel"),
					description: t("rewindDescription", { count: target?.rows ?? 0 }),
					footer: /* @__PURE__ */ jsxs("div", {
						style: diffModalFooter,
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...button,
								...diffModalButton
							},
							disabled: submitting,
							onClick: close,
							children: t("diffCancel")
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...rewindDangerButton,
								...diffModalButton
							},
							disabled: submitting,
							onClick: confirm,
							children: submitting ? t("rewindSubmitting") : t("rewindConfirm")
						})]
					}),
					children: target === void 0 ? null : /* @__PURE__ */ jsxs("div", {
						style: diffModalBody,
						children: [
							target.text === "" ? null : /* @__PURE__ */ jsx("p", {
								style: rewindModalMessage,
								children: target.text.slice(0, 2e3)
							}),
							/* @__PURE__ */ jsxs("label", {
								className: "dshClaudeUtilityOption",
								style: diffModalCheckbox,
								children: [/* @__PURE__ */ jsx("input", {
									type: "checkbox",
									checked: restoreFiles,
									disabled: submitting,
									onChange: (event) => {
										setRestoreFiles(event.currentTarget.checked);
									}
								}), t("rewindRestoreFiles")]
							}),
							/* @__PURE__ */ jsx("p", {
								style: diffModalStatus,
								children: restoreFiles ? t("rewindRestoreFilesHint") : t("rewindHint")
							}),
							error === void 0 ? null : /* @__PURE__ */ jsx("p", {
								style: diffModalError,
								children: error
							})
						]
					})
				})
			] });
		}
		//#endregion
		//#region src/client/hero-dom-bridge.ts
		const PORTAL_ATTRIBUTE = "data-dsh-claude-hero-controls";
		const HERO_SELECTOR = "[data-phase=\"hero\"]";
		function normalizedText(element) {
			return (element.textContent ?? "").replace(/\s+/gu, " ").trim();
		}
		function isClaudePresetText(value) {
			return /^claude(?: code)?$/iu.test(value.replace(/\s+/gu, " ").trim());
		}
		function directChildContaining(parent, descendant) {
			return Array.from(parent.children).find((child) => child === descendant || child.contains(descendant));
		}
		/** The hero's preset buttons: menu buttons without an `aria-label`, which is
		*  what separates the preset seat from the labelled workspace picker. The
		*  portal's own branch trigger answers that description too, so it is excluded
		*  -- counting it made the row look like it held two staged presets from the
		*  moment these controls mounted. */
		function heroPresetButtons(root) {
			const heroes = Array.from(root.querySelectorAll(HERO_SELECTOR));
			if (heroes.length !== 1) return void 0;
			const hero = heroes[0];
			if (hero === void 0) return void 0;
			return {
				hero,
				presets: Array.from(hero.querySelectorAll("button[aria-haspopup=\"menu\"]")).filter((button) => button.getAttribute("aria-label") === null && button.closest(`[${PORTAL_ATTRIBUTE}]`) === null)
			};
		}
		/** True once the hero has settled on a preset that is not Claude.
		*  `locateClaudePresetSeat` reports that the same way it reports a hero
		*  mid-render -- by missing -- so without this the retention rule below reads a
		*  deliberate switch away from Claude as a re-render and leaves the controls up. */
		function showsOtherPresetSeat(root = document) {
			const found = heroPresetButtons(root);
			if (found === void 0 || found.presets.length !== 1) return false;
			const preset = found.presets[0];
			return preset !== void 0 && !isClaudePresetText(normalizedText(preset));
		}
		/** Locate rc.8's hero preset seat without relying on hashed CSS module names. */
		function locateClaudePresetSeat(root = document) {
			const found = heroPresetButtons(root);
			if (found === void 0) return void 0;
			const { hero } = found;
			const presetButtons = found.presets.filter((button) => isClaudePresetText(normalizedText(button)));
			if (presetButtons.length !== 1) return void 0;
			const preset = presetButtons[0];
			if (preset === void 0) return void 0;
			let row = preset.parentElement;
			while (row !== null && row !== hero) {
				if (Array.from(row.querySelectorAll("button[aria-haspopup=\"menu\"][aria-label]")).length === 1) {
					const seat = directChildContaining(row, preset);
					if (seat !== void 0) return {
						hero,
						seat
					};
				}
				row = row.parentElement;
			}
		}
		/** Keep a portal the host has not torn down. `locateClaudePresetSeat` also
		*  misses while a hero re-renders -- a second hero mid session switch, a preset
		*  label swap -- and dropping the portal there recreates it a beat later with a
		*  fresh identity, which restarts every effect keyed on it and strands the
		*  branch picker on "Loading branches". A portal whose hero flipped phase or
		*  unmounted has left the DOM (or left the hero) and is not retained. */
		function retainsClaudeHeroPortal(portal) {
			const hero = portal?.closest(HERO_SELECTOR);
			return hero !== null && hero !== void 0;
		}
		/** Reuse the row's existing portal even when the host moved a node between it
		*  and the seat: a fresh element would change React's portal identity and
		*  restart (and abort) every effect keyed on it. */
		function ensureClaudeHeroPortal(seat) {
			const existing = seat.parentElement?.querySelector(`:scope > [${PORTAL_ATTRIBUTE}]`) ?? null;
			if (existing !== null) {
				if (existing.previousElementSibling !== seat) seat.insertAdjacentElement("afterend", existing);
				return existing;
			}
			const portal = document.createElement("span");
			portal.setAttribute(PORTAL_ATTRIBUTE, "");
			seat.insertAdjacentElement("afterend", portal);
			return portal;
		}
		function removeClaudeHeroPortals(root = document) {
			for (const portal of root.querySelectorAll(`[${PORTAL_ATTRIBUTE}]`)) portal.remove();
		}
		//#endregion
		//#region src/client/ClaudeHeroRepositoryControls.tsx
		/** The host composer was a textarea through rc.8 and is a Lexical
		*  contenteditable from 0.1.2 on, so match the composer seat rather than the
		*  element type: an element-type check silently stops intercepting Enter, and
		*  the capsule's branch and Worktree choices go nowhere. */
		function shouldInterceptKey(event) {
			if (event.key !== "Enter" || event.shiftKey || event.repeat || event.isComposing) return false;
			const target = event.target;
			if (!(target instanceof Element)) return false;
			return target.closest("textarea, [data-composer-input]") !== null && target.closest("[data-phase=\"hero\"]") !== null;
		}
		function shouldInterceptClick(event) {
			const target = event.target;
			if (!(target instanceof Element)) return false;
			const button = target.closest("[data-phase=\"hero\"] [data-composer-card] button");
			if (button === null || button.disabled) return false;
			const card = button.closest("[data-composer-card]");
			return (card === null ? [] : Array.from(card.querySelectorAll("button:not(:disabled)"))).at(-1) === button;
		}
		function repositoryBranchOptions(branches) {
			const local = new Set(branches.branches);
			return [...branches.branches, ...branches.remoteBranches.filter((branch) => !local.has(branch))];
		}
		/** A prune can retire the selected remote branch; fall back rather than leave
		*  the capsule pointing at a ref the next submission would fail on. */
		function refreshedBranchSelection(branches, selected) {
			const options = repositoryBranchOptions(branches);
			return options.includes(selected) ? selected : branches.current ?? options[0] ?? "";
		}
		function selectedBranchFirst(branches, selected) {
			return branches.includes(selected) ? [selected, ...branches.filter((branch) => branch !== selected)] : branches;
		}
		function filterRepositoryBranches(branches, query) {
			const normalized = query.trim().toLocaleLowerCase();
			return normalized.length === 0 ? branches : branches.filter((branch) => branch.toLocaleLowerCase().includes(normalized));
		}
		/** Toggle a ticket's membership in the multi-select, keyed by ticket key. */
		function toggleTicketSelection(tickets, ticket) {
			return tickets.some((item) => item.key === ticket.key) ? tickets.filter((item) => item.key !== ticket.key) : [...tickets, ticket];
		}
		const BRANCH_LOAD_RETRIES = 2;
		const BRANCH_LOAD_RETRY_MS = 1e3;
		const WORKTREE_PROGRESS_STAGES = [
			"inspecting",
			"fetching",
			"summarizing",
			"creating-worktree",
			"saving-worktree",
			"creating-workspace",
			"starting-session",
			"transferring-draft",
			"submitting"
		];
		const PROGRESS_LABEL_KEYS = {
			inspecting: "repositoryProgress_inspecting",
			fetching: "repositoryProgress_fetching",
			summarizing: "repositoryProgress_summarizing",
			"creating-worktree": "repositoryProgress_creating-worktree",
			"saving-worktree": "repositoryProgress_saving-worktree",
			"switching-branch": "repositoryProgress_switching-branch",
			"creating-workspace": "repositoryProgress_creating-workspace",
			"starting-session": "repositoryProgress_starting-session",
			"transferring-draft": "repositoryProgress_transferring-draft",
			submitting: "repositoryProgress_submitting"
		};
		function progressLabelKey(stage) {
			return PROGRESS_LABEL_KEYS[stage];
		}
		function WorktreeProgressCard({ stage, error, context, t, onDismiss }) {
			const current = WORKTREE_PROGRESS_STAGES.indexOf(stage);
			const visible = WORKTREE_PROGRESS_STAGES.slice(0, Math.max(0, current) + 1);
			return /* @__PURE__ */ jsxs("div", {
				role: error === void 0 ? "status" : "alert",
				"aria-live": "polite",
				style: heroWorktreeProgressCard,
				children: [/* @__PURE__ */ jsxs("div", {
					style: heroWorktreeProgressHeader,
					children: [
						error === void 0 ? /* @__PURE__ */ jsxs("svg", {
							"aria-hidden": "true",
							viewBox: "0 0 20 20",
							style: heroWorktreeProgressSpinner,
							children: [/* @__PURE__ */ jsx("circle", {
								cx: "10",
								cy: "10",
								r: "8",
								fill: "none",
								stroke: "currentColor",
								strokeOpacity: "0.2",
								strokeWidth: "2"
							}), /* @__PURE__ */ jsx("path", {
								d: "M10 2a8 8 0 0 1 8 8",
								fill: "none",
								stroke: "currentColor",
								strokeLinecap: "round",
								strokeWidth: "2",
								children: /* @__PURE__ */ jsx("animateTransform", {
									attributeName: "transform",
									type: "rotate",
									from: "0 10 10",
									to: "360 10 10",
									dur: "0.8s",
									repeatCount: "indefinite"
								})
							})]
						}) : /* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							style: heroWorktreeProgressError,
							children: "×"
						}),
						/* @__PURE__ */ jsxs("div", {
							style: heroWorktreeProgressCopy,
							children: [/* @__PURE__ */ jsxs("strong", {
								style: heroWorktreeProgressTitle,
								children: [error === void 0 ? t("repositoryProgressTitle") : t("repositoryProgressFailed"), context === void 0 ? null : /* @__PURE__ */ jsxs("span", {
									style: heroWorktreeProgressContext,
									children: [" ", context]
								})]
							}), /* @__PURE__ */ jsx("span", {
								style: heroWorktreeProgressCurrent,
								children: error ?? t(progressLabelKey(stage))
							})]
						}),
						error === void 0 ? null : /* @__PURE__ */ jsx("button", {
							type: "button",
							style: heroWorktreeProgressDismiss,
							onClick: onDismiss,
							"aria-label": t("repositoryProgressDismiss"),
							children: "×"
						})
					]
				}), /* @__PURE__ */ jsx("div", {
					style: heroWorktreeProgressSteps,
					children: visible.map((item, index) => /* @__PURE__ */ jsxs("span", {
						style: heroWorktreeProgressStep,
						children: [/* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							style: {
								...heroWorktreeProgressDot,
								...index < visible.length - 1 ? heroWorktreeProgressDotDone : heroWorktreeProgressDotActive
							},
							children: index < visible.length - 1 ? "✓" : ""
						}), t(progressLabelKey(item))]
					}, item))
				})]
			});
		}
		function TicketIcon() {
			return /* @__PURE__ */ jsxs("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ jsx("path", { d: "M2.5 5.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1.2a1.3 1.3 0 0 0 0 2.6v1.2a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V9.3a1.3 1.3 0 0 0 0-2.6V5.5Z" }), /* @__PURE__ */ jsx("path", {
					d: "M6.5 4.5v7",
					strokeDasharray: "1.5 1.5"
				})]
			});
		}
		function ClaudeHeroRepositoryCapsule({ branches, selected, worktree, busy, menuOpen, worktreeLabel, searchPlaceholder, emptySearchLabel, refreshLabel, refreshing, refreshNotice, worktreeLocked = false, onMenuOpenChange, onRefresh, onSelect, onWorktreeChange }) {
			const pickerRef = useRef(null);
			const searchRef = useRef(null);
			const optionRefs = useRef([]);
			const [query, setQuery] = useState("");
			const [activeIndex, setActiveIndex] = useState(0);
			const [refreshHovered, setRefreshHovered] = useState(false);
			const [worktreeHovered, setWorktreeHovered] = useState(false);
			const [worktreeFocused, setWorktreeFocused] = useState(false);
			const ordered = useMemo(() => selectedBranchFirst(branches, selected), [branches, selected]);
			const filtered = useMemo(() => filterRepositoryBranches(ordered, query), [ordered, query]);
			useEffect(() => {
				if (!menuOpen) {
					setQuery("");
					setActiveIndex(0);
					return;
				}
				setActiveIndex(0);
				searchRef.current?.focus();
				const closeOnOutsidePointer = (event) => {
					if (event.target instanceof Node && pickerRef.current?.contains(event.target) !== true) onMenuOpenChange(false);
				};
				document.addEventListener("pointerdown", closeOnOutsidePointer);
				return () => {
					document.removeEventListener("pointerdown", closeOnOutsidePointer);
				};
			}, [menuOpen, onMenuOpenChange]);
			useEffect(() => {
				setActiveIndex(0);
			}, [query]);
			useEffect(() => {
				if (menuOpen) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
			}, [activeIndex, menuOpen]);
			const chooseActive = () => {
				const branch = filtered[activeIndex];
				if (branch !== void 0) onSelect(branch);
			};
			const handleMenuKeyDown = (event) => {
				if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
					event.preventDefault();
					const key = event.key;
					setActiveIndex((current) => menuNavigationIndex(current, filtered.length, key));
				} else if (event.key === "Enter") {
					event.preventDefault();
					chooseActive();
				} else if (event.key === "Escape") {
					event.preventDefault();
					onMenuOpenChange(false);
				}
			};
			return /* @__PURE__ */ jsxs("span", {
				style: heroRepositoryCapsule,
				children: [
					/* @__PURE__ */ jsxs("span", {
						ref: pickerRef,
						style: heroBranchPicker,
						children: [/* @__PURE__ */ jsxs("button", {
							type: "button",
							style: heroBranchTrigger,
							"aria-haspopup": "menu",
							"aria-expanded": menuOpen,
							disabled: busy,
							onClick: () => {
								onMenuOpenChange(!menuOpen);
							},
							children: [
								/* @__PURE__ */ jsx(IconBranchOutlineRegular, {}),
								/* @__PURE__ */ jsx("span", {
									style: heroBranchName,
									children: selected
								}),
								/* @__PURE__ */ jsx(IconChevronDownOutlineRegular, {})
							]
						}), menuOpen ? /* @__PURE__ */ jsxs("span", {
							role: "menu",
							"aria-activedescendant": filtered[activeIndex] === void 0 ? void 0 : `claude-branch-option-${activeIndex}`,
							style: heroBranchMenu,
							onKeyDown: handleMenuKeyDown,
							children: [
								/* @__PURE__ */ jsxs("span", {
									style: heroBranchSearchRow,
									children: [/* @__PURE__ */ jsxs("label", {
										style: {
											...heroBranchSearch,
											...heroBranchSearchGrow
										},
										children: [/* @__PURE__ */ jsx(IconSearchOutlineRegular, {}), /* @__PURE__ */ jsx("input", {
											ref: searchRef,
											type: "search",
											value: query,
											placeholder: searchPlaceholder,
											"aria-label": searchPlaceholder,
											style: heroBranchSearchInput,
											onChange: (event) => {
												setQuery(event.currentTarget.value);
											}
										})]
									}), /* @__PURE__ */ jsx(Tooltip, {
										label: refreshLabel,
										side: "bottom",
										delayMs: 250,
										children: /* @__PURE__ */ jsx("button", {
											type: "button",
											"aria-label": refreshLabel,
											"aria-busy": refreshing,
											disabled: refreshing,
											style: {
												...heroBranchRefresh,
												...refreshHovered && !refreshing ? heroBranchRefreshHover : {},
												...refreshing ? heroBranchRefreshBusy : {}
											},
											onMouseEnter: () => {
												setRefreshHovered(true);
											},
											onMouseLeave: () => {
												setRefreshHovered(false);
											},
											onClick: onRefresh,
											children: /* @__PURE__ */ jsx(IconRefreshOutlineRegular, { size: 14 })
										})
									})]
								}),
								refreshNotice === void 0 ? null : /* @__PURE__ */ jsx("span", {
									role: refreshNotice.tone === "error" ? "alert" : "status",
									style: {
										...heroBranchNotice,
										...refreshNotice.tone === "error" ? heroBranchNoticeError : {}
									},
									children: refreshNotice.text
								}),
								/* @__PURE__ */ jsx("span", {
									style: heroBranchList,
									children: filtered.length === 0 ? /* @__PURE__ */ jsx("span", {
										style: heroBranchEmpty,
										children: emptySearchLabel
									}) : filtered.map((branch, index) => /* @__PURE__ */ jsxs("button", {
										ref: (element) => {
											optionRefs.current[index] = element;
										},
										id: `claude-branch-option-${index}`,
										type: "button",
										role: "menuitem",
										"aria-current": branch === selected ? "true" : void 0,
										"data-active": index === activeIndex ? "true" : void 0,
										style: {
											...heroBranchItem,
											...index === activeIndex ? heroBranchItemActive : {}
										},
										onMouseEnter: () => {
											setActiveIndex(index);
										},
										onClick: () => {
											onSelect(branch);
										},
										children: [/* @__PURE__ */ jsx("span", {
											style: heroBranchItemName,
											children: branch
										}), branch === selected ? /* @__PURE__ */ jsx(IconCheckOutlineRegular, { size: 14 }) : null]
									}, branch))
								})
							]
						}) : null]
					}),
					/* @__PURE__ */ jsx("span", {
						"aria-hidden": "true",
						style: heroRepositoryDivider
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						role: "checkbox",
						"aria-checked": worktreeLocked || worktree,
						disabled: busy || worktreeLocked,
						style: {
							...heroWorktreeToggle,
							...worktreeLocked || worktree || worktreeHovered ? heroWorktreeToggleActive : {},
							...worktreeFocused ? heroWorktreeToggleFocused : {}
						},
						onMouseEnter: () => {
							setWorktreeHovered(true);
						},
						onMouseLeave: () => {
							setWorktreeHovered(false);
						},
						onFocus: (event) => {
							setWorktreeFocused(event.currentTarget.matches(":focus-visible"));
						},
						onBlur: () => {
							setWorktreeFocused(false);
						},
						onClick: () => {
							onWorktreeChange(!worktree);
						},
						children: [/* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							style: {
								...heroWorktreeCheckbox,
								...worktreeLocked || worktree ? heroWorktreeCheckboxChecked : {}
							},
							children: worktreeLocked || worktree ? /* @__PURE__ */ jsx("svg", {
								viewBox: "0 0 12 12",
								style: heroWorktreeCheckboxIcon,
								children: /* @__PURE__ */ jsx("path", {
									d: "m2.5 6.2 2.1 2.1 4.9-5",
									fill: "none",
									stroke: "currentColor",
									strokeLinecap: "round",
									strokeLinejoin: "round",
									strokeWidth: "1.8"
								})
							}) : null
						}), worktreeLabel]
					})
				]
			});
		}
		function ClaudeHeroRepositoryControls({ sessionId, useSessions, useWorkspaces, input, t, prepare, prepareMany }) {
			const cwd = useSessions((state) => state.byId[sessionId]?.cwd);
			const workspacePath = useWorkspaces((state) => state.items.find((item) => item.sessionIds.includes(sessionId))?.path);
			const [portal, setPortal] = useState();
			const hasPortal = portal !== void 0;
			const [branches, setBranches] = useState();
			const [selected, setSelected] = useState("");
			const [worktree, setWorktree] = useState(false);
			const [menuOpen, setMenuOpen] = useState(false);
			const [refreshing, setRefreshing] = useState(false);
			const [refreshNotice, setRefreshNotice] = useState();
			const [busy, setBusy] = useState(false);
			const [progressStage, setProgressStage] = useState();
			const [progressError, setProgressError] = useState();
			const [error, setError] = useState();
			const [jiraConnected, setJiraConnected] = useState(false);
			const [tickets, setTickets] = useState([]);
			const [batchProgress, setBatchProgress] = useState();
			const [batchDone, setBatchDone] = useState();
			const [ticketMenuOpen, setTicketMenuOpen] = useState(false);
			const [ticketQuery, setTicketQuery] = useState("");
			const [ticketResults, setTicketResults] = useState();
			const [ticketError, setTicketError] = useState();
			const ticketPickerRef = useRef(null);
			const ticketSearchRef = useRef(null);
			const pendingRef = useRef(false);
			const refreshRef = useRef();
			const path = workspacePath ?? cwd;
			useEffect(() => {
				if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
				let scheduled = false;
				let current;
				const reconcile = () => {
					scheduled = false;
					const target = locateClaudePresetSeat();
					if (target === void 0) {
						if (retainsClaudeHeroPortal(current) && !showsOtherPresetSeat()) return;
						current = void 0;
						removeClaudeHeroPortals();
						setPortal(void 0);
						return;
					}
					current = ensureClaudeHeroPortal(target.seat);
					setPortal(current);
				};
				const schedule = () => {
					if (scheduled) return;
					scheduled = true;
					queueMicrotask(reconcile);
				};
				reconcile();
				const observer = new MutationObserver(schedule);
				observer.observe(document.body, {
					childList: true,
					subtree: true,
					characterData: true,
					attributes: true,
					attributeFilter: ["data-phase"]
				});
				return () => {
					observer.disconnect();
					removeClaudeHeroPortals();
				};
			}, [sessionId]);
			useEffect(() => {
				setBranches(void 0);
				setSelected("");
				setWorktree(false);
				setMenuOpen(false);
				refreshRef.current?.abort();
				setRefreshing(false);
				setRefreshNotice(void 0);
				setProgressStage(void 0);
				setProgressError(void 0);
				setError(void 0);
				setTickets([]);
				setBatchProgress(void 0);
				setBatchDone(void 0);
				setTicketMenuOpen(false);
				setTicketQuery("");
				setTicketResults(void 0);
				setTicketError(void 0);
				if (!hasPortal || path === void 0) return;
				const controller = new AbortController();
				let timer;
				const load = (remaining) => {
					loadRepositoryBranches(path, controller.signal).then((value) => {
						setBranches(value);
						setSelected(value.current ?? value.branches[0] ?? "");
					}, (reason) => {
						if (controller.signal.aborted) return;
						if (remaining > 0) {
							timer = setTimeout(() => {
								load(remaining - 1);
							}, BRANCH_LOAD_RETRY_MS);
							return;
						}
						setError(reason instanceof Error ? reason.message : String(reason));
					});
				};
				load(BRANCH_LOAD_RETRIES);
				return () => {
					controller.abort();
					if (timer !== void 0) clearTimeout(timer);
				};
			}, [
				hasPortal,
				path,
				sessionId
			]);
			const availableBranches = branches === void 0 ? [] : repositoryBranchOptions(branches);
			const changed = branches !== void 0 && selected.length > 0 && (worktree || tickets.length > 0 || selected !== branches.current);
			useEffect(() => {
				if (!changed || portal === void 0 || busy) return;
				const submit = (event) => {
					if (pendingRef.current || input.draft.trim().length === 0 && tickets.length === 0) return;
					if (!(event instanceof KeyboardEvent ? shouldInterceptKey(event) : shouldInterceptClick(event))) return;
					event.preventDefault();
					event.stopPropagation();
					pendingRef.current = true;
					setBusy(true);
					setProgressError(void 0);
					setError(void 0);
					setBatchDone(void 0);
					if (tickets.length > 1) {
						const total = tickets.length;
						setBatchProgress({
							ticketKey: tickets[0]?.key ?? "",
							index: 0,
							total,
							stage: "inspecting"
						});
						setProgressStage("inspecting");
						prepareMany(branches.root, selected, tickets, (progress) => {
							setBatchProgress(progress);
							setProgressStage(progress.stage);
						}).then(() => {
							setBatchDone(total);
							setBatchProgress(void 0);
							setProgressStage(void 0);
							setTickets([]);
						}, (reason) => {
							setProgressError(reason instanceof Error ? reason.message : String(reason));
						}).finally(() => {
							pendingRef.current = false;
							setBusy(false);
						});
						return;
					}
					const ticket = tickets[0];
					setProgressStage(worktree ? "inspecting" : void 0);
					prepare(branches.root, selected, worktree, (stage) => {
						if (worktree) setProgressStage(stage);
					}, ticket).catch((reason) => {
						const message = reason instanceof Error ? reason.message : String(reason);
						if (worktree) setProgressError(message);
						else setError(message);
					}).finally(() => {
						pendingRef.current = false;
						setBusy(false);
					});
				};
				document.addEventListener("keydown", submit, true);
				document.addEventListener("click", submit, true);
				return () => {
					document.removeEventListener("keydown", submit, true);
					document.removeEventListener("click", submit, true);
				};
			}, [
				branches,
				busy,
				changed,
				input.draft,
				portal,
				prepare,
				prepareMany,
				selected,
				tickets,
				worktree
			]);
			useEffect(() => {
				const controller = new AbortController();
				loadJiraStatus(controller.signal).then((status) => {
					setJiraConnected(status.connected);
				}, () => {
					if (!controller.signal.aborted) setJiraConnected(false);
				});
				return () => {
					controller.abort();
				};
			}, [sessionId]);
			useEffect(() => {
				if (!ticketMenuOpen) return;
				const controller = new AbortController();
				const timer = setTimeout(() => {
					setTicketError(void 0);
					searchJiraTickets(ticketQuery, controller.signal).then(setTicketResults, (reason) => {
						if (controller.signal.aborted) return;
						setTicketResults([]);
						setTicketError(reason instanceof JiraClientError && reason.code === "not-connected" ? t("heroTicketNotConnected") : reason instanceof Error ? reason.message : t("heroTicketFailed"));
					});
				}, ticketQuery.length === 0 ? 0 : 300);
				return () => {
					clearTimeout(timer);
					controller.abort();
				};
			}, [
				t,
				ticketMenuOpen,
				ticketQuery
			]);
			useEffect(() => {
				if (!ticketMenuOpen) {
					setTicketQuery("");
					setTicketResults(void 0);
					return;
				}
				ticketSearchRef.current?.focus();
				const closeOnOutsidePointer = (event) => {
					if (event.target instanceof Node && ticketPickerRef.current?.contains(event.target) !== true) setTicketMenuOpen(false);
				};
				document.addEventListener("pointerdown", closeOnOutsidePointer);
				return () => {
					document.removeEventListener("pointerdown", closeOnOutsidePointer);
				};
			}, [ticketMenuOpen]);
			const toggleTicket = (next) => {
				setTickets((current) => toggleTicketSelection(current, next));
				setError(void 0);
				setBatchDone(void 0);
			};
			const refreshBranches = () => {
				if (refreshing || path === void 0) return;
				const controller = new AbortController();
				refreshRef.current = controller;
				setRefreshing(true);
				setRefreshNotice({
					tone: "busy",
					text: t("repositoryBranchRefreshing")
				});
				refreshRepositoryBranches(path, controller.signal).then((value) => {
					setBranches(value);
					setSelected((current) => refreshedBranchSelection(value, current));
					setRefreshNotice({
						tone: "done",
						text: t("repositoryBranchRefreshed", { count: repositoryBranchOptions(value).length })
					});
				}, (reason) => {
					if (controller.signal.aborted) return;
					const message = reason instanceof Error ? reason.message : void 0;
					setRefreshNotice({
						tone: "error",
						text: message === "route-missing" ? t("repositoryBranchRefreshStale") : message ?? t("repositoryBranchRefreshFailed")
					});
				}).finally(() => {
					if (!controller.signal.aborted) setRefreshing(false);
				});
			};
			const clearTickets = () => {
				setTickets([]);
				setError(void 0);
				setTicketMenuOpen(false);
			};
			if (portal === void 0 || path === void 0) return null;
			return createPortal(/* @__PURE__ */ jsxs("span", {
				style: heroRepositoryControls,
				children: [branches === void 0 ? /* @__PURE__ */ jsx("span", {
					style: heroRepositoryStatus,
					children: error ?? t("repositoryBranchesLoading")
				}) : /* @__PURE__ */ jsxs(Fragment$1, { children: [
					/* @__PURE__ */ jsx(ClaudeHeroRepositoryCapsule, {
						branches: availableBranches,
						selected,
						worktree,
						busy,
						menuOpen,
						worktreeLabel: t("repositoryWorktree"),
						searchPlaceholder: t("repositoryBranchSearch"),
						emptySearchLabel: t("repositoryBranchSearchEmpty"),
						refreshLabel: t("repositoryBranchRefresh"),
						refreshing,
						...refreshNotice === void 0 ? {} : { refreshNotice },
						worktreeLocked: tickets.length > 1,
						onMenuOpenChange: (open) => {
							setMenuOpen(open);
							if (!open) setRefreshNotice(void 0);
						},
						onRefresh: refreshBranches,
						onSelect: (branch) => {
							setSelected(branch);
							setMenuOpen(false);
							setError(void 0);
						},
						onWorktreeChange: (checked) => {
							setWorktree(checked);
							setError(void 0);
						}
					}),
					!jiraConnected ? null : /* @__PURE__ */ jsx("span", {
						style: heroRepositoryCapsule,
						children: /* @__PURE__ */ jsxs("span", {
							ref: ticketPickerRef,
							style: heroBranchPicker,
							children: [/* @__PURE__ */ jsx(Tooltip, {
								label: t("heroTicketMenu"),
								side: "bottom",
								delayMs: 250,
								children: /* @__PURE__ */ jsxs("button", {
									type: "button",
									style: heroBranchTrigger,
									"aria-expanded": ticketMenuOpen,
									"aria-label": t("heroTicketMenu"),
									disabled: busy,
									onClick: () => {
										setTicketMenuOpen(!ticketMenuOpen);
									},
									children: [
										/* @__PURE__ */ jsx(TicketIcon, {}),
										/* @__PURE__ */ jsx("span", {
											style: heroBranchName,
											children: tickets.length === 0 ? t("heroTicket") : tickets.length === 1 ? tickets[0]?.key : t("heroTicketCount", { count: tickets.length })
										}),
										/* @__PURE__ */ jsx(IconChevronDownOutlineRegular, {})
									]
								})
							}), ticketMenuOpen ? /* @__PURE__ */ jsxs("span", {
								role: "menu",
								style: {
									...heroBranchMenu,
									...heroTicketMenu
								},
								onKeyDown: (event) => {
									if (event.key === "Escape") {
										event.preventDefault();
										setTicketMenuOpen(false);
									}
								},
								children: [
									/* @__PURE__ */ jsxs("label", {
										style: heroBranchSearch,
										children: [/* @__PURE__ */ jsx(IconSearchOutlineRegular, {}), /* @__PURE__ */ jsx("input", {
											ref: ticketSearchRef,
											type: "search",
											value: ticketQuery,
											placeholder: t("heroTicketSearch"),
											"aria-label": t("heroTicketSearch"),
											style: heroBranchSearchInput,
											onChange: (event) => {
												setTicketQuery(event.currentTarget.value);
											}
										})]
									}),
									tickets.length === 0 ? null : /* @__PURE__ */ jsxs("span", {
										style: heroTicketChips,
										children: [tickets.map((item) => /* @__PURE__ */ jsxs("span", {
											style: heroTicketChip,
											children: [item.key, /* @__PURE__ */ jsx("button", {
												type: "button",
												style: heroTicketChipRemove,
												"aria-label": t("heroTicketRemove", { key: item.key }),
												onClick: () => {
													toggleTicket(item);
												},
												children: "×"
											})]
										}, item.key)), tickets.length > 1 ? /* @__PURE__ */ jsx("button", {
											type: "button",
											style: heroTicketChipsClear,
											onClick: clearTickets,
											children: t("heroTicketNone")
										}) : null]
									}),
									/* @__PURE__ */ jsx("span", {
										style: heroBranchList,
										children: ticketError !== void 0 ? /* @__PURE__ */ jsx("span", {
											style: heroBranchEmpty,
											children: ticketError
										}) : ticketResults === void 0 ? /* @__PURE__ */ jsx("span", {
											style: heroBranchEmpty,
											children: t("heroTicketLoading")
										}) : ticketResults.length === 0 ? /* @__PURE__ */ jsx("span", {
											style: heroBranchEmpty,
											children: t("heroTicketEmpty")
										}) : ticketResults.map((item) => {
											const picked = tickets.some((entry) => entry.key === item.key);
											return /* @__PURE__ */ jsxs("button", {
												type: "button",
												role: "menuitemcheckbox",
												"aria-checked": picked,
												style: heroBranchItem,
												onClick: () => {
													toggleTicket(item);
												},
												children: [
													/* @__PURE__ */ jsx("span", {
														"aria-hidden": "true",
														style: {
															...heroTicketCheckbox,
															...picked ? heroWorktreeCheckboxChecked : {}
														},
														children: picked ? /* @__PURE__ */ jsx("svg", {
															viewBox: "0 0 12 12",
															style: heroWorktreeCheckboxIcon,
															children: /* @__PURE__ */ jsx("path", {
																d: "m2.5 6.2 2.1 2.1 4.9-5",
																fill: "none",
																stroke: "currentColor",
																strokeLinecap: "round",
																strokeLinejoin: "round",
																strokeWidth: "1.8"
															})
														}) : null
													}),
													/* @__PURE__ */ jsx("span", {
														style: heroTicketKey,
														children: item.key
													}),
													/* @__PURE__ */ jsx("span", {
														style: heroBranchItemName,
														children: item.summary
													}),
													item.status === void 0 ? null : /* @__PURE__ */ jsx("span", {
														style: heroTicketStatus,
														children: item.status
													})
												]
											}, item.key);
										})
									})
								]
							}) : null]
						})
					}),
					error === void 0 ? null : /* @__PURE__ */ jsx("span", {
						role: "alert",
						style: heroRepositoryError,
						children: error
					}),
					batchDone === void 0 ? null : /* @__PURE__ */ jsx("span", {
						role: "status",
						style: heroRepositoryStatus,
						children: t("heroBatchStarted", { count: batchDone })
					})
				] }), progressStage === void 0 || !busy && progressError === void 0 ? null : /* @__PURE__ */ jsx(WorktreeProgressCard, {
					stage: progressStage,
					...progressError === void 0 ? {} : { error: progressError },
					...batchProgress === void 0 ? {} : { context: `${batchProgress.ticketKey} · ${batchProgress.index + 1}/${batchProgress.total}` },
					t,
					onDismiss: () => {
						setProgressStage(void 0);
						setProgressError(void 0);
						setBatchProgress(void 0);
					}
				})]
			}), portal);
		}
		//#endregion
		//#region src/client/ClaudeDiffHeaderAction.tsx
		/** Quiet by default, lit on hover, press, keyboard focus, and for as long as
		*  the panel it opened is on screen. The header action row sits on the app
		*  background, so a resting background would read as a filled control. */
		const ACTION_CSS = [
			".dsh-claude-header-diff{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;",
			"min-width:32px;height:32px;padding:0;border:0;border-radius:9px;background:transparent;",
			"color:var(--dsw-alias-label-secondary);cursor:pointer;",
			"font-family:var(--dsw-font-family);font-size:12px;line-height:20px;font-weight:650;",
			"transition:background .12s ease,color .12s ease}",
			".dsh-claude-header-diff[data-counts]{padding:0 10px 0 8px}",
			".dsh-claude-header-diff:hover,.dsh-claude-header-diff:focus-visible,.dsh-claude-header-diff[aria-pressed=\"true\"]{",
			"background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dsh-claude-header-diff:active{background:var(--dsw-alias-interactive-bg-active)}",
			".dsh-claude-header-diff:focus-visible{outline:none}",
			".dsh-claude-header-diff>*{flex:none}",
			".dsh-claude-header-diff>svg.dsh-claude-header-diff-glyph{",
			"width:18px;height:18px;display:block;overflow:visible;opacity:1;",
			"fill:none;stroke:currentColor;stroke-width:2.1;stroke-linecap:round}",
			".dsh-claude-header-diff-add,.dsh-claude-header-diff-del{line-height:1}",
			".dsh-claude-header-diff-add{color:var(--dsw-alias-state-success-primary)}",
			".dsh-claude-header-diff-del{color:var(--dsw-alias-state-error-primary)}"
		].join("");
		let cssInjected$2 = false;
		function ensureCss$2() {
			if (cssInjected$2 || typeof document === "undefined") return;
			cssInjected$2 = true;
			const element = document.createElement("style");
			element.dataset.dshClaudeHeaderDiff = "";
			element.textContent = ACTION_CSS;
			document.head.appendChild(element);
		}
		/** Plus over minus: the diff glyph. Drawn inline because the primitives icon
		*  set ships no diff icon.
		*
		*  The ink spans y 3.5 to 14.5 — symmetric about the box's own centre line, so
		*  `align-items:center` lands the drawn shape on the centre rather than the
		*  bounding box that happens to contain it. */
		function DiffGlyph() {
			return /* @__PURE__ */ jsx("svg", {
				className: "dsh-claude-header-diff-glyph",
				width: "18",
				height: "18",
				viewBox: "0 0 18 18",
				fill: "none",
				"aria-hidden": "true",
				focusable: "false",
				children: /* @__PURE__ */ jsx("path", {
					d: "M9 3.5v5.5M6.25 6.25h5.5M6.25 14.5h5.5",
					stroke: "currentColor",
					strokeWidth: "2.1",
					strokeLinecap: "round"
				})
			});
		}
		function diffTotal(projection, key) {
			return [projection.repository, ...projection.repositories ?? []].reduce((sum, repository) => sum + (repository?.diff?.[key] ?? 0), 0);
		}
		function ClaudeDiffHeaderAction({ t, sessionId, toggleDiff, diffOpen, useClaudeProjection }) {
			const owned = useClaudeProjection((projection) => projection.owned);
			const additions = useClaudeProjection((projection) => diffTotal(projection, "additions"));
			const deletions = useClaudeProjection((projection) => diffTotal(projection, "deletions"));
			const open = useSyncExternalStore(diffOpen.subscribe, diffOpen.getSnapshot, diffOpen.getSnapshot);
			if (!owned) return null;
			ensureCss$2();
			const hasCounts = additions > 0 || deletions > 0;
			const label = t(open ? "diffClose" : "diffOpen");
			return /* @__PURE__ */ jsx(Tooltip, {
				label,
				side: "bottom",
				delayMs: 250,
				children: /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: "dsh-claude-header-diff",
					"aria-label": label,
					"aria-pressed": open,
					"data-counts": hasCounts || void 0,
					"data-session": sessionId,
					onClick: toggleDiff,
					children: [/* @__PURE__ */ jsx(DiffGlyph, {}), hasCounts ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsxs("span", {
						className: "dsh-claude-header-diff-add",
						children: ["+", additions]
					}), /* @__PURE__ */ jsxs("span", {
						className: "dsh-claude-header-diff-del",
						children: ["−", deletions]
					})] }) : null]
				})
			});
		}
		//#endregion
		//#region src/client/ClaudeTeamHeaderAction.tsx
		const EMPTY_TASKS = [];
		/** The Host's own team roster, seat for seat: the same trigger in the action
		*  row next to the title and the same fixed panel with member cards and task
		*  cards, so a Claude session's team reads exactly like a native one. The
		*  Host's entry is hidden for Claude sessions in host-chrome.ts. */
		const TEAM_CSS = [
			".dsh-claude-team-root{position:relative;display:inline-flex}",
			".dsh-claude-team-trigger{min-height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:6px;",
			"align-items:center;gap:5px;padding:3px 7px;font-size:12px;font-family:inherit;display:inline-flex}",
			".dsh-claude-team-trigger:hover,.dsh-claude-team-trigger:focus-visible,.dsh-claude-team-trigger[aria-expanded=\"true\"]{color:var(--dsw-alias-label-primary);outline:none}",
			"@container (width<=480px){.dsh-claude-team-trigger-label{display:none}}",
			".dsh-claude-team-count{color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;font-size:12px;font-weight:400;line-height:16px}",
			".dsh-claude-team-panel{z-index:100;box-sizing:border-box;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);width:min(500px,100vw - 32px);",
			"max-height:min(680px,100vh - 32px);box-shadow:var(--dsw-elevation-prominent);border:0;border-radius:12px;flex-direction:column;padding:8px 2px 0;display:flex;position:fixed;overflow:hidden;",
			"color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:12px;line-height:17px}",
			".dsh-claude-team-panel:before{content:\"\";z-index:-1;background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);border-radius:12px;position:absolute;inset:0}",
			".dsh-claude-team-panel[data-compact]{width:min(320px,100vw - 32px)}",
			".dsh-claude-team-panel[data-compact] .dsh-claude-team-roster{grid-template-columns:minmax(0,1fr)}",
			".dsh-claude-team-body{flex:auto;min-height:0;padding:0 9px 16px 14px;overflow-y:auto;scrollbar-gutter:stable}",
			".dsh-claude-team-panel h3{color:var(--dsw-alias-label-primary);align-items:center;gap:8px;margin:16px 0 8px 4px;font-size:13px;font-weight:500;display:flex}",
			".dsh-claude-team-body section:first-of-type h3{margin-top:8px}",
			".dsh-claude-team-roster{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;display:grid}",
			".dsh-claude-team-member{--dsw-elevation-stroke-color:var(--dsw-alias-border-l2);min-width:0;box-shadow:var(--dsw-elevation-stroke);background:var(--dsw-alias-bg-layer-2);",
			"color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;border:0;border-radius:8px;align-items:flex-start;gap:8px;padding:10px 12px;display:flex;font:inherit}",
			".dsh-claude-team-member:disabled{cursor:default}",
			".dsh-claude-team-member[data-current]{--dsw-elevation-stroke-color:color-mix(in srgb, var(--dsw-alias-state-business-primary) 40%, transparent);",
			"box-shadow:var(--dsw-elevation-stroke), inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-state-business-primary) 40%, transparent)}",
			".dsh-claude-team-member:not(:disabled):hover,.dsh-claude-team-member:not(:disabled):focus-visible{--dsw-elevation-stroke-color:var(--dsw-alias-border-l3);box-shadow:var(--dsw-elevation-panel);outline:none}",
			".dsh-claude-team-member-dot{flex:none;align-items:center;height:1lh;display:inline-flex;color:var(--dsw-alias-label-tertiary)}",
			".dsh-claude-team-member-text{flex-direction:column;min-width:0;display:flex}",
			".dsh-claude-team-member-name{align-items:center;gap:5px;min-width:0;display:inline-flex}",
			".dsh-claude-team-member-name-text,.dsh-claude-team-member-text small{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}",
			".dsh-claude-team-member-text small,.dsh-claude-team-meta{color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dsh-claude-team-tag{flex:0 999 auto;min-width:0;padding:0 4px;border-radius:4px;font-size:10px;line-height:15px;display:inline-block;overflow:hidden;text-overflow:ellipsis;",
			"background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 16%, transparent);color:var(--dsw-alias-state-business-primary)}",
			".dsh-claude-team-tasks{flex-direction:column;gap:7px;display:flex}",
			".dsh-claude-team-empty{color:var(--dsw-alias-label-tertiary);margin:16px 0 0 4px;font-size:12px}",
			".dsh-claude-team-task{border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:9px;padding:11px 13px}",
			".dsh-claude-team-task-title{align-items:center;gap:8px;display:flex}",
			".dsh-claude-team-task-title strong{font-size:13px;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-claude-team-task-state{color:var(--dsw-alias-label-tertiary);align-items:center;gap:6px;margin-left:auto;font-size:11px;display:inline-flex;flex:none}",
			".dsh-claude-team-task p{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;margin:5px 0;font-size:12px;line-height:18px;overflow-wrap:anywhere}",
			".dsh-claude-team-meta{line-height:20px}.dsh-claude-team-meta>span{margin-right:10px}"
		].join("");
		let cssInjected$1 = false;
		function ensureCss$1() {
			if (cssInjected$1 || typeof document === "undefined") return;
			cssInjected$1 = true;
			const element = document.createElement("style");
			element.dataset.dshClaudeTeam = "";
			element.textContent = TEAM_CSS;
			document.head.appendChild(element);
		}
		function memberDot(status) {
			switch (status) {
				case "running": return "ongoing";
				case "completed": return "done";
				case "failed": return "error";
				case "stopped":
				case "killed": return "warning";
			}
		}
		function taskDot(status) {
			return status === "in_progress" ? "ongoing" : status === "completed" ? "done" : "idle";
		}
		/** Under the trigger, kept inside the viewport with the Host's 16px margin. */
		function panelPosition(trigger) {
			if (trigger === null || typeof window === "undefined") return void 0;
			const rect = trigger.getBoundingClientRect();
			const width = Math.min(500, window.innerWidth - 32);
			return {
				left: Math.max(16, Math.min(rect.left, window.innerWidth - 16 - width)),
				top: rect.bottom + 6
			};
		}
		function ClaudeTeamHeaderAction({ t, sessionId, openTeammate, useClaudeProjection }) {
			const owned = useClaudeProjection((projection) => projection.owned);
			const activities = useClaudeProjection((projection) => projection.activities);
			const tasks = useClaudeProjection((projection) => projection.tasks?.tasks ?? EMPTY_TASKS);
			const team = useMemo(() => deriveTeam(activities, tasks), [activities, tasks]);
			const [open, setOpen] = useState(false);
			const [position, setPosition] = useState(void 0);
			const rootRef = useRef(null);
			const triggerRef = useRef(null);
			const panelRef = useRef(null);
			useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef);
			useLayoutEffect(() => {
				if (open) setPosition(panelPosition(triggerRef.current));
			}, [open]);
			if (!owned || team.members.length === 0 && team.tasks.length === 0) return null;
			ensureCss$1();
			const running = team.members.some((member) => member.status === "running");
			const memberCount = team.members.length + 1;
			const label = t("teamTrigger");
			return /* @__PURE__ */ jsxs("div", {
				className: "dsh-claude-team-root",
				ref: rootRef,
				"data-session": sessionId,
				children: [/* @__PURE__ */ jsxs("button", {
					type: "button",
					ref: triggerRef,
					className: "dsh-claude-team-trigger",
					"aria-label": label,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					onClick: () => {
						setOpen((value) => !value);
					},
					children: [
						/* @__PURE__ */ jsx(IconUsersOutlineRegular, { size: 14 }),
						/* @__PURE__ */ jsx("span", {
							className: "dsh-claude-team-trigger-label",
							children: label
						}),
						/* @__PURE__ */ jsx("span", {
							className: "dsh-claude-team-count",
							children: memberCount
						}),
						running ? /* @__PURE__ */ jsx(StateDot, { state: "ongoing" }) : null
					]
				}), !open || typeof document === "undefined" ? null : createPortal(/* @__PURE__ */ jsx("div", {
					ref: panelRef,
					className: "dsh-claude-team-panel",
					"data-compact": memberCount <= 2 || void 0,
					style: position ?? {
						visibility: "hidden",
						left: 0,
						top: 0
					},
					role: "dialog",
					tabIndex: -1,
					"aria-label": label,
					children: /* @__PURE__ */ jsxs("div", {
						className: "dsh-claude-team-body",
						children: [
							/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsxs("h3", { children: [t("teamMembers"), /* @__PURE__ */ jsx("span", {
								className: "dsh-claude-team-count",
								children: memberCount
							})] }), /* @__PURE__ */ jsxs("div", {
								className: "dsh-claude-team-roster",
								children: [/* @__PURE__ */ jsxs("button", {
									type: "button",
									className: "dsh-claude-team-member",
									"data-current": true,
									disabled: true,
									children: [/* @__PURE__ */ jsx("span", {
										className: "dsh-claude-team-member-dot",
										children: /* @__PURE__ */ jsx(IconUserOutlineRegular, { size: 14 })
									}), /* @__PURE__ */ jsxs("span", {
										className: "dsh-claude-team-member-text",
										children: [/* @__PURE__ */ jsxs("span", {
											className: "dsh-claude-team-member-name",
											children: [/* @__PURE__ */ jsx("span", {
												className: "dsh-claude-team-member-name-text",
												children: LEAD_NAME
											}), /* @__PURE__ */ jsx("span", {
												className: "dsh-claude-team-tag",
												children: t("teamLead")
											})]
										}), /* @__PURE__ */ jsx("small", { children: t(running ? "teamStatusRunning" : "teamLeadIdle") })]
									})]
								}), team.members.map((member) => /* @__PURE__ */ jsxs("button", {
									type: "button",
									className: "dsh-claude-team-member",
									"aria-label": t("teammateOpen", { name: member.name }),
									title: member.description,
									onClick: () => {
										setOpen(false);
										openTeammate(member.taskId);
									},
									children: [/* @__PURE__ */ jsx("span", {
										className: "dsh-claude-team-member-dot",
										children: /* @__PURE__ */ jsx(StateDot, { state: memberDot(member.status) })
									}), /* @__PURE__ */ jsxs("span", {
										className: "dsh-claude-team-member-text",
										children: [/* @__PURE__ */ jsx("span", {
											className: "dsh-claude-team-member-name",
											children: /* @__PURE__ */ jsx("span", {
												className: "dsh-claude-team-member-name-text",
												children: member.name
											})
										}), /* @__PURE__ */ jsxs("small", { children: [t(memberStatusKey(member.status)), member.lastToolName === void 0 ? "" : ` · ${member.lastToolName}`] })]
									})]
								}, member.taskId))]
							})] }),
							/* @__PURE__ */ jsx("section", { children: team.tasks.length === 0 ? /* @__PURE__ */ jsx("p", {
								className: "dsh-claude-team-empty",
								children: t("teamNoTasks")
							}) : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsxs("h3", { children: [t("teamTasks"), /* @__PURE__ */ jsx("span", {
								className: "dsh-claude-team-count",
								children: team.tasks.length
							})] }), /* @__PURE__ */ jsx("div", {
								className: "dsh-claude-team-tasks",
								children: team.tasks.map((task) => /* @__PURE__ */ jsxs("div", {
									className: "dsh-claude-team-task",
									children: [
										/* @__PURE__ */ jsxs("div", {
											className: "dsh-claude-team-task-title",
											children: [/* @__PURE__ */ jsx("strong", { children: task.subject }), /* @__PURE__ */ jsxs("span", {
												className: "dsh-claude-team-task-state",
												children: [/* @__PURE__ */ jsx(StateDot, { state: taskDot(task.status) }), t(taskStatusKey(task.status))]
											})]
										}),
										task.description === void 0 ? null : /* @__PURE__ */ jsx("p", { children: task.description }),
										/* @__PURE__ */ jsxs("div", {
											className: "dsh-claude-team-meta",
											children: [/* @__PURE__ */ jsx("span", { children: task.owner === void 0 ? t("teamTaskUnowned") : t("teamTaskOwner", { owner: task.owner }) }), task.blockedBy.length === 0 ? null : /* @__PURE__ */ jsx("span", { children: t("teamTaskBlockedBy", { tasks: task.blockedBy.map((id) => `#${id}`).join(", ") }) })]
										})
									]
								}, task.id))
							})] }) }),
							team.messages.length === 0 ? null : /* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsxs("h3", { children: [t("teamMessages"), /* @__PURE__ */ jsx("span", {
								className: "dsh-claude-team-count",
								children: team.messages.length
							})] }), /* @__PURE__ */ jsx("div", {
								className: "dsh-claude-team-tasks",
								children: team.messages.slice(-8).map((message) => /* @__PURE__ */ jsxs("div", {
									className: "dsh-claude-team-task",
									children: [/* @__PURE__ */ jsx("div", {
										className: "dsh-claude-team-task-title",
										children: /* @__PURE__ */ jsxs("strong", { children: [
											message.from,
											" → ",
											message.to
										] })
									}), /* @__PURE__ */ jsx("p", { children: message.summary ?? message.message })]
								}, message.ordinal))
							})] })
						]
					})
				}), document.body)]
			});
		}
		//#endregion
		//#region src/client/claude-mark.ts
		/** The Claude wordmark glyph, lifted verbatim from the brand SVG.
		*
		*  Kept as raw geometry rather than a component because its only consumer
		*  paints it through a CSS `background-image`: the Host draws the agent-preset
		*  icon itself, so the swap has to happen in CSS, not in JSX. */
		const MARK_PATH = "M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z";
		const MARK_COLOR = "#d97757";
		/** The mark as a CSS `url()` value.
		*  @returns a percent-encoded `data:` URI, safe to inline in a stylesheet. */
		function claudeMarkUrl() {
			return `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200"><path fill="${MARK_COLOR}" d="${MARK_PATH}"/></svg>`)}")`;
		}
		//#endregion
		//#region src/client/agent-preset-roster.ts
		/** Locale keys the Host uses for the presets it ships, mirrored so a shadowed
		*  label still shows their translated copy instead of a bare id. Every entry is
		*  a lookup into the Host's own `settings.agentPreset` namespace; an id absent
		*  here (this plugin's preset included) falls through to file metadata, which
		*  is what the Host does too. */
		const BUILT_IN_KEYS = {
			standard: {
				name: "presetStandardName",
				description: "presetStandardDescription"
			},
			code: {
				name: "presetCodeName",
				description: "presetCodeDescription"
			},
			minimal: {
				name: "presetMinimalName",
				description: "presetMinimalDescription"
			},
			cordis: {
				name: "presetCordisName",
				description: "presetCordisDescription"
			}
		};
		/**
		* Resolve one preset's display copy the way the Host does: translated copy for
		* a preset it ships, file metadata otherwise.
		* @param row - the roster row, or undefined when the roster has not arrived.
		* @param presetId - the id recorded on the session.
		* @param hostT - lookup bound to the Host's preset namespace.
		* @returns the name to render and the description to put in the tooltip.
		*/
		function presetDisplayText(row, presetId, hostT) {
			const keys = row?.trust === "system" ? BUILT_IN_KEYS[row.id] : void 0;
			if (keys !== void 0) {
				const name = hostT(keys.name);
				const description = hostT(keys.description);
				if (name !== keys.name) return {
					name,
					...description === keys.description ? {} : { description }
				};
			}
			return {
				name: row?.name ?? presetId,
				...row?.description === void 0 ? {} : { description: row.description }
			};
		}
		var AgentPresetRoster = class {
			#api;
			#listeners = /* @__PURE__ */ new Set();
			#rows = [];
			#inflight;
			constructor(api) {
				this.#api = api;
			}
			/** Read the roster once. Concurrent calls share the in-flight read, and a
			*  failed read leaves the previous rows in place — the label falls back to
			*  the session's preset id, never to an empty header. */
			load() {
				if (this.#inflight !== void 0) return;
				this.#inflight = (async () => {
					try {
						const response = await this.#api.list();
						if (!response.ok) return;
						this.#rows = response.value.presets;
						for (const listener of this.#listeners) listener();
					} catch {} finally {
						this.#inflight = void 0;
					}
				})();
			}
			subscribe = (listener) => {
				this.#listeners.add(listener);
				return () => {
					this.#listeners.delete(listener);
				};
			};
			getSnapshot = () => this.#rows;
		};
		//#endregion
		//#region src/client/session-preset.ts
		/**
		* Resolve one row's preset id, newest seat first.
		* @param row - a session-list row, or undefined when the id is not listed.
		* @returns the preset id, or undefined when neither source carries one.
		*/
		function sessionRowPreset(row) {
			return row?.agentPreset ?? row?.projectionValues?.agentPreset ?? void 0;
		}
		//#endregion
		//#region src/client/ClaudeAgentPresetLabel.tsx
		/** Reproduces the Host label's own metrics — it sits in the same action row
		*  beside the title, so it has to read as the same piece of chrome. */
		const LABEL_CSS = [
			".dsh-claude-preset-label{display:inline-flex;align-items:center;gap:4px;max-width:220px;height:22px;",
			"padding:0 2px 0 0;border-radius:6px;overflow:hidden;white-space:nowrap;",
			"color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font-family);font-size:12px;line-height:22px}",
			".dsh-claude-preset-label>*{flex:none}",
			".dsh-claude-preset-name{min-width:0;overflow:hidden;text-overflow:ellipsis}",
			".dsh-claude-preset-icon{opacity:.7}",
			`.dsh-claude-preset-mark{width:14px;height:14px;background:${claudeMarkUrl()} center/contain no-repeat}`
		].join("");
		let cssInjected = false;
		function ensureCss() {
			if (cssInjected || typeof document === "undefined") return;
			cssInjected = true;
			const element = document.createElement("style");
			element.dataset.dshClaudePresetLabel = "";
			element.textContent = LABEL_CSS;
			document.head.appendChild(element);
		}
		function ClaudeAgentPresetLabel({ t, hostT, roster, sessionId, useSessions }) {
			const preset = useSessions((state) => sessionRowPreset(state.byId[sessionId]));
			const rows = useSyncExternalStore(roster.subscribe, roster.getSnapshot, roster.getSnapshot);
			const { load } = roster;
			useEffect(() => {
				if (preset !== void 0) load();
			}, [preset, load]);
			if (preset === void 0) return null;
			ensureCss();
			const text = presetDisplayText(rows.find((row) => row.id === preset), preset, hostT);
			return /* @__PURE__ */ jsx(Tooltip, {
				label: preset === "claude" ? t("presetClaudeDescription") : text.description ?? t("presetHeaderHint"),
				side: "bottom",
				delayMs: 250,
				maxWidth: 280,
				children: /* @__PURE__ */ jsxs("span", {
					className: "dsh-claude-preset-label",
					children: [preset === "claude" ? /* @__PURE__ */ jsx("span", {
						className: "dsh-claude-preset-mark",
						"aria-hidden": "true"
					}) : /* @__PURE__ */ jsx(IconAgentPresetOutlineRegular, {
						size: 14,
						className: "dsh-claude-preset-icon"
					}), /* @__PURE__ */ jsx("span", {
						className: "dsh-claude-preset-name",
						children: text.name
					})]
				})
			});
		}
		//#endregion
		//#region src/client/claude-command-source.ts
		const SOURCE_NAME = "Claude Code";
		function commandsFor(store, session) {
			const projection = store.source(session.sessionId).getSnapshot();
			return projection.owned ? projection.commands : [];
		}
		function findCommand(store, session, publicName) {
			return commandsFor(store, session).find((command) => command.publicName === publicName);
		}
		function claimFor(ctx, session, command) {
			return {
				name: command.publicName,
				token: `/${command.publicName} `,
				...command.hint === void 0 ? {} : { hint: command.hint },
				async submit(args) {
					return await submitClaudeCommand(ctx, session, command, args);
				}
			};
		}
		function pickCommand(ctx, store, pick) {
			const command = findCommand(store, pick.session, pick.candidate.name);
			if (command === void 0) return void 0;
			return { claim: claimFor(ctx, pick.session, command) };
		}
		/** Build a client-owned slash source. It never calls command.execute, so
		* Claude Skill submission creates only the ordinary user-message turn. */
		function createClaudeCommandSource(ctx, store) {
			return {
				trigger: "/",
				name: SOURCE_NAME,
				order: 10,
				async candidates(session, request) {
					if (request.position !== "leading") return [];
					const query = request.query.toLocaleLowerCase();
					return commandsFor(store, session).filter((command) => command.publicName.toLocaleLowerCase().includes(query)).map((command) => ({
						name: command.publicName,
						description: command.description,
						...command.hint === void 0 ? {} : { hint: command.hint }
					}));
				},
				onPick(pick) {
					return pickCommand(ctx, store, pick);
				},
				matchSpace(session, token) {
					if (!token.startsWith("/")) return void 0;
					const command = findCommand(store, session, token.slice(1));
					return command === void 0 ? void 0 : { claim: claimFor(ctx, session, command) };
				},
				async matchEnter(session, line) {
					if (!line.startsWith("/")) return void 0;
					const separator = line.indexOf(" ");
					const command = findCommand(store, session, line.slice(1, separator === -1 ? void 0 : separator));
					return command === void 0 ? void 0 : { claim: claimFor(ctx, session, command) };
				},
				lexicon(session) {
					return commandsFor(store, session).map((command) => command.publicName);
				},
				subscribeLexicon(session, listener) {
					return store.source(session.sessionId).subscribe(listener);
				}
			};
		}
		/** Execute through this plugin's injected services rebound to the target
		* session scope; the input-trigger action context does not inject them. */
		async function submitClaudeCommand(ctx, session, command, args) {
			const sessionCtx = ctx.sessions.scope(session.sessionId);
			if (sessionCtx === void 0) return {
				kind: "error",
				text: "Claude session is unavailable"
			};
			const scoped = ctx.extend(sessionCtx);
			const line = `/${command.claudeName}${args.length === 0 ? "" : ` ${args}`}`;
			try {
				await scoped.conversation.send(line);
				return { kind: "success" };
			} catch (error) {
				return {
					kind: "error",
					text: error instanceof Error ? error.message : String(error)
				};
			}
		}
		//#endregion
		//#region src/client/prompt-api.ts
		/** Prompt files live in one global directory, so one module-level cache serves
		*  every session. The TTL is what lets a file added outside DSH appear without
		*  a reload, while a burst of keystrokes through the menu still costs one
		*  directory scan. */
		const TTL_MS = 5e3;
		let cached;
		function invalidateClaudePrompts() {
			cached = void 0;
		}
		/** The user's prompt snippets, at most one read per TTL window. */
		async function claudePrompts() {
			const at = Date.now();
			if (cached !== void 0 && at - cached.at < TTL_MS) return await cached.prompts;
			const prompts = pluginRead(CLAUDE_PROMPTS_PATH, "fast").then((payload) => payload.prompts).catch(() => {
				invalidateClaudePrompts();
				return [];
			});
			cached = {
				at,
				prompts
			};
			return await prompts;
		}
		/** Save one snippet, answering where it landed. Rejects with a
		*  `PluginRequestError` whose `code` is `name-taken` when the file already
		*  exists; nothing is overwritten. */
		async function saveClaudePrompt(name, body) {
			const saved = await pluginWrite(CLAUDE_PROMPTS_PATH, "fast", void 0, { json: {
				name,
				body
			} });
			invalidateClaudePrompts();
			return saved.prompt;
		}
		/** Delete one snippet by name. A name already gone answers `not-found`. */
		async function deleteClaudePrompt(name) {
			try {
				await pluginWrite(CLAUDE_PROMPTS_PATH, "fast", void 0, {
					method: "DELETE",
					query: { name }
				});
			} finally {
				invalidateClaudePrompts();
			}
		}
		/** Ask the host to name a draft with Claude's cheapest model. Answers
		*  undefined whenever no name could be had — the caller already holds the
		*  locally derived one, so a failure here is never worth reporting. */
		async function suggestClaudePromptName(draft, cancel) {
			try {
				return (await pluginWrite(CLAUDE_PROMPT_NAME_PATH, "git", cancel, { json: { draft } })).name;
			} catch {
				return;
			}
		}
		/** Rewrite a draft into something an agent can act on. Unlike the name
		*  suggestion this one throws: the user asked for it and is waiting, so a
		*  failure is theirs to see rather than ours to swallow. */
		async function refineClaudePrompt(draft, cancel) {
			return (await pluginWrite(CLAUDE_PROMPT_REFINE_PATH, "git", cancel, { json: { draft } })).text;
		}
		/** Characters the host's `PROMPT_NAME` guard rejects; scrubbed rather than
		*  re-implemented here, so a drift in the guard cannot let a bad name through
		*  (the host still validates, and answers `invalid-name`). */
		const FOREIGN_NAME_CHARS = /[^\p{L}\p{M}\p{N} ._()\[\]-]/gu;
		const MAX_NAME_CHARS = 40;
		function stamp(now) {
			const pad = (value) => String(value).padStart(2, "0");
			return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
		}
		/** The file name to offer for a draft: its opening line, scrubbed to what a
		*  file name may hold. A draft that opens with punctuation or an emoji leaves
		*  nothing usable, so those fall back to a timestamp the user can rename. */
		function defaultPromptName(draft, now = /* @__PURE__ */ new Date()) {
			const collapsed = (draft.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "").replace(FOREIGN_NAME_CHARS, " ").replace(/\s+/gu, " ").trim();
			const cut = collapsed.slice(0, MAX_NAME_CHARS);
			const boundary = collapsed.length > MAX_NAME_CHARS ? cut.search(/[\s\-_][^\s\-_]*$/u) : -1;
			const scrubbed = (boundary > 0 ? cut.slice(0, boundary) : cut).trim();
			return /^[\p{L}\p{N}]/u.test(scrubbed) ? scrubbed : `prompt-${stamp(now)}`;
		}
		//#endregion
		//#region src/client/ClaudePromptSaveAction.tsx
		function freshPrompts() {
			invalidateClaudePrompts();
			return claudePrompts();
		}
		const CARD_GAP = 8;
		const CARD_MARGIN = 12;
		/**
		* Place the card above its trigger, clamped into the viewport, and dismiss it
		* on a pointer that lands outside both.
		*
		* The primitives ship `useAnchoredPosition` and `useDismissOnOutsidePointer`
		* for exactly this, and both are used here through their published types —
		* but the Host's build of that package predates the `side` option of one and
		* the portal argument of the other. Neither omission is visible to `tsc`,
		* which reads this checkout's newer copy, and both are silent at runtime: the
		* card hangs below a composer pinned to the bottom of the window, and every
		* pointer landing in the naming field counts as outside and closes it. Owning
		* twenty lines beats behaviour that depends on which Desktop the plugin was
		* installed into.
		*/
		function useAnchoredCard(open, anchor, card, onDismiss) {
			const [position, setPosition] = useState();
			useLayoutEffect(() => {
				if (!open) {
					setPosition(void 0);
					return;
				}
				const place = () => {
					const trigger = anchor.current?.getBoundingClientRect();
					const panel = card.current?.getBoundingClientRect();
					if (trigger === void 0 || panel === void 0) return;
					const above = trigger.top - CARD_GAP - panel.height;
					setPosition({
						left: Math.max(CARD_MARGIN, Math.min(trigger.left, window.innerWidth - panel.width - CARD_MARGIN)),
						top: above >= CARD_MARGIN ? above : Math.min(trigger.bottom + CARD_GAP, window.innerHeight - panel.height - CARD_MARGIN)
					});
				};
				place();
				const resize = typeof ResizeObserver === "undefined" ? void 0 : new ResizeObserver(place);
				if (card.current !== null) resize?.observe(card.current);
				window.addEventListener("resize", place);
				window.addEventListener("scroll", place, true);
				return () => {
					resize?.disconnect();
					window.removeEventListener("resize", place);
					window.removeEventListener("scroll", place, true);
				};
			}, [
				open,
				anchor,
				card
			]);
			useEffect(() => {
				if (!open) return void 0;
				const dismiss = (event) => {
					const target = event.target;
					if (!(target instanceof Node)) return;
					if (anchor.current?.contains(target) === true || card.current?.contains(target) === true) return;
					onDismiss();
				};
				document.addEventListener("pointerdown", dismiss);
				return () => {
					document.removeEventListener("pointerdown", dismiss);
				};
			}, [
				open,
				anchor,
				card,
				onDismiss
			]);
			return position;
		}
		/**
		* Keep the draft you just wrote, from the composer's own tool row.
		*
		* It sits beside the attach and access controls rather than in a row of its
		* own: a band above the composer moves the repository bar and the composer
		* itself every time a draft appears, and this is a once-in-a-while action that
		* has not earned that. The naming card is portaled and anchored, so opening it
		* displaces nothing either.
		*
		* The field opens on a name derived from the draft's first line, which costs
		* nothing and is there instantly, and a Claude-written name replaces it when
		* one arrives. That ordering is the whole naming design: the suggestion is an
		* improvement on a working answer, never something the user waits for.
		*
		* With no draft there is nothing to keep, so the same control opens the list
		* of saved prompts instead, where each can be deleted.
		*/
		function ClaudePromptSaveAction({ t, useClaudeProjection, useInput, savePrompt = saveClaudePrompt, suggestName = suggestClaudePromptName, loadPrompts = freshPrompts, deletePrompt = deleteClaudePrompt }) {
			const owned = useClaudeProjection((projection) => projection.owned);
			const anchor = useRef(null);
			const panelRef = useRef(null);
			const suggestion = useRef(void 0);
			const [panel, setPanel] = useState();
			const [saving, setSaving] = useState(false);
			const close = useCallback(() => {
				suggestion.current?.abort();
				suggestion.current = void 0;
				setPanel(void 0);
			}, []);
			const position = useAnchoredCard(panel !== void 0, anchor, panelRef, close);
			useEffect(() => () => {
				suggestion.current?.abort();
			}, []);
			const draft = useInput((state) => state.draft);
			if (!owned) return null;
			const managing = draft.trim() === "";
			const label = managing ? t("promptManage") : t("promptSave");
			const openManage = () => {
				setPanel({ kind: "manage" });
				loadPrompts().then((prompts) => {
					setPanel((current) => current?.kind === "manage" ? {
						...current,
						prompts
					} : current);
				});
			};
			const remove = (name) => {
				if (saving) return;
				setSaving(true);
				deletePrompt(name).then(() => {
					setPanel((current) => current?.kind !== "manage" ? current : {
						kind: "manage",
						prompts: current.prompts?.filter((prompt) => prompt.name !== name)
					});
				}, (error) => {
					setPanel((current) => current?.kind !== "manage" ? current : {
						...current,
						confirming: void 0,
						failure: t("promptDeleteFailed", { message: error instanceof Error ? error.message : String(error) })
					});
				}).finally(() => {
					setSaving(false);
				});
			};
			const open = () => {
				setPanel({
					kind: "naming",
					name: defaultPromptName(draft),
					touched: false,
					suggesting: true
				});
				const attempt = new AbortController();
				suggestion.current = attempt;
				suggestName(draft, attempt.signal).then((suggested) => {
					if (attempt.signal.aborted) return;
					setPanel((current) => current?.kind !== "naming" ? current : {
						...current,
						suggesting: false,
						...suggested === void 0 || current.touched ? {} : { name: suggested }
					});
				});
			};
			const save = () => {
				const name = panel?.kind === "naming" ? panel.name.trim() : "";
				if (saving || name === "" || draft.trim() === "") return;
				setSaving(true);
				savePrompt(name, draft).then((prompt) => {
					setPanel({
						kind: "saved",
						prompt
					});
				}, (error) => {
					setPanel({
						kind: "naming",
						name,
						touched: true,
						suggesting: false,
						failure: error instanceof PluginRequestError && error.code === "name-taken" ? t("promptSaveExists") : t("promptSaveFailed", { message: error instanceof Error ? error.message : String(error) })
					});
				}).finally(() => {
					setSaving(false);
				});
			};
			return /* @__PURE__ */ jsxs("span", {
				ref: anchor,
				style: {
					position: "relative",
					display: "inline-flex"
				},
				children: [
					/* @__PURE__ */ jsx("style", {
						"data-dsh-claude-prompt-save-styles": true,
						children: promptSaveTriggerCss
					}),
					/* @__PURE__ */ jsx(Tooltip, {
						label,
						side: "top",
						delayMs: 250,
						disabled: panel !== void 0,
						children: /* @__PURE__ */ jsx("button", {
							type: "button",
							className: promptSaveTriggerClass,
							"aria-label": label,
							"aria-haspopup": "dialog",
							"aria-expanded": panel !== void 0,
							onClick: () => {
								if (panel !== void 0) close();
								else if (managing) openManage();
								else open();
							},
							children: /* @__PURE__ */ jsx(IconListPenOutlineRegular, { size: 14 })
						})
					}),
					panel === void 0 || typeof document === "undefined" ? null : createPortal(/* @__PURE__ */ jsx("div", {
						ref: panelRef,
						style: {
							...promptSaveCard,
							...panel.kind === "manage" ? promptManageCard : {},
							...position
						},
						role: "dialog",
						"aria-label": label,
						children: panel.kind === "manage" ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
							/* @__PURE__ */ jsx("span", {
								style: promptSaveHeading,
								children: label
							}),
							panel.prompts === void 0 ? /* @__PURE__ */ jsx("span", {
								role: "status",
								style: repositoryChecksHint,
								children: t("promptManageLoading")
							}) : panel.prompts.length === 0 ? /* @__PURE__ */ jsx("span", {
								style: repositoryChecksHint,
								children: t("promptManageEmpty")
							}) : /* @__PURE__ */ jsx("ul", {
								style: promptManageList,
								children: panel.prompts.map((prompt) => /* @__PURE__ */ jsx("li", {
									style: promptManageRow,
									children: panel.confirming === prompt.name ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
										/* @__PURE__ */ jsx("span", {
											style: promptManageName,
											children: t("promptDeleteConfirm", { name: prompt.name })
										}),
										/* @__PURE__ */ jsx(Button, {
											variant: "ghost",
											size: "sm",
											disabled: saving,
											onClick: () => setPanel({
												...panel,
												confirming: void 0
											}),
											children: t("promptSaveCancel")
										}),
										/* @__PURE__ */ jsx(Button, {
											variant: "primary",
											size: "sm",
											disabled: saving,
											onClick: () => remove(prompt.name),
											children: t("promptDelete")
										})
									] }) : /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsxs("span", {
										style: promptManageText,
										title: prompt.body,
										children: [/* @__PURE__ */ jsx("span", {
											style: promptManageName,
											children: prompt.name
										}), /* @__PURE__ */ jsx("span", {
											style: promptManageDescription,
											children: prompt.description
										})]
									}), /* @__PURE__ */ jsx("button", {
										type: "button",
										className: promptSaveTriggerClass,
										"aria-label": t("promptDeleteNamed", { name: prompt.name }),
										disabled: saving,
										onClick: () => setPanel({
											...panel,
											confirming: prompt.name,
											failure: void 0
										}),
										children: /* @__PURE__ */ jsx(IconTrashOutlineRegular, { size: 14 })
									})] })
								}, prompt.name))
							}),
							panel.failure === void 0 ? null : /* @__PURE__ */ jsx("span", {
								style: promptSaveError,
								children: panel.failure
							}),
							/* @__PURE__ */ jsx("span", {
								style: promptSaveActions,
								children: /* @__PURE__ */ jsx(Button, {
									variant: "primary",
									size: "sm",
									onClick: close,
									children: t("promptSaveDone")
								})
							})
						] }) : panel.kind === "saved" ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
							/* @__PURE__ */ jsx("span", {
								style: promptSaveHeading,
								children: t("promptSaved", { name: panel.prompt.name })
							}),
							/* @__PURE__ */ jsx("span", {
								style: promptSaveLocation,
								children: panel.prompt.location
							}),
							/* @__PURE__ */ jsx("span", {
								style: promptSaveActions,
								children: /* @__PURE__ */ jsx(Button, {
									variant: "primary",
									size: "sm",
									onClick: close,
									children: t("promptSaveDone")
								})
							})
						] }) : /* @__PURE__ */ jsxs("form", {
							style: { display: "contents" },
							onSubmit: (event) => {
								event.preventDefault();
								save();
							},
							children: [
								/* @__PURE__ */ jsx("span", {
									style: promptSaveHeading,
									children: label
								}),
								panel.suggesting ? /* @__PURE__ */ jsx("span", {
									role: "status",
									style: repositoryChecksHint,
									children: t("promptSaveNaming")
								}) : null,
								/* @__PURE__ */ jsx("input", {
									className: promptSaveFieldClass,
									"aria-label": t("promptSaveName"),
									placeholder: t("promptSaveName"),
									value: panel.name,
									maxLength: 128,
									autoFocus: true,
									disabled: saving,
									onChange: (event) => setPanel({
										...panel,
										name: event.currentTarget.value,
										touched: true
									}),
									onKeyDown: (event) => {
										if (event.key === "Escape") close();
									}
								}),
								panel.failure === void 0 ? null : /* @__PURE__ */ jsx("span", {
									style: promptSaveError,
									children: panel.failure
								}),
								/* @__PURE__ */ jsxs("span", {
									style: promptSaveActions,
									children: [/* @__PURE__ */ jsx(Button, {
										variant: "ghost",
										size: "sm",
										type: "button",
										disabled: saving,
										onClick: close,
										children: t("promptSaveCancel")
									}), /* @__PURE__ */ jsx(Button, {
										variant: "primary",
										size: "sm",
										type: "submit",
										disabled: saving,
										children: t("promptSaveConfirm")
									})]
								})
							]
						})
					}), document.body)
				]
			});
		}
		//#endregion
		//#region src/client/ClaudePermissionSelect.tsx
		const NAME_KEY = {
			plan: "permissionModePlan",
			default: "permissionModeDefault",
			acceptEdits: "permissionModeAcceptEdits",
			dontAsk: "permissionModeDontAsk",
			auto: "permissionModeAuto",
			bypassPermissions: "permissionModeBypass"
		};
		const HINT_KEY = {
			plan: "permissionModePlanHint",
			default: "permissionModeDefaultHint",
			acceptEdits: "permissionModeAcceptEditsHint",
			dontAsk: "permissionModeDontAskHint",
			auto: "permissionModeAutoHint",
			bypassPermissions: "permissionModeBypassHint"
		};
		/** One 16px outline glyph per mode, drawn to the Host's own icon grammar
		*  (1.5px round strokes on currentColor) so the row reads as one set with
		*  the attach and plan controls beside it. */
		function ClaudePermissionModeGlyph({ mode }) {
			return /* @__PURE__ */ jsx("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				children: {
					plan: [
						"M6 2.75h4",
						"M4.5 3.75h7a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1z",
						"M6 8h4",
						"M6 10.5h2.5"
					],
					default: [
						"M8 2.25l5 1.9v3.6c0 3.05-2.15 5.15-5 6.25-2.85-1.1-5-3.2-5-6.25v-3.6l5-1.9z",
						"M8 6v3",
						"M8 11h.01"
					],
					acceptEdits: [
						"M10.4 3.1l2.5 2.5L6.5 12H4v-2.5l6.4-6.4z",
						"M9 4.5l2.5 2.5",
						"M9.5 13.25l1.5 1.5 3-3"
					],
					dontAsk: [
						"M5.25 9.5V7.25a2.75 2.75 0 0 1 5.5 0V9.5l1 1.75h-7.5l1-1.75z",
						"M6.75 12.75a1.25 1.25 0 0 0 2.5 0",
						"M3 3l10 10"
					],
					auto: ["M8 2.5l1.4 3.6 3.6 1.4-3.6 1.4L8 12.5 6.6 8.9 3 7.5l3.6-1.4L8 2.5z", "M12.5 11.5l.5 1.25 1.25.5-1.25.5-.5 1.25-.5-1.25-1.25-.5 1.25-.5.5-1.25z"],
					bypassPermissions: [
						"M5 8V6.25a3 3 0 0 1 5.85-.95",
						"M4.25 8h7.5v5.5h-7.5z",
						"M8 10.25v1.5"
					]
				}[mode].map((d) => /* @__PURE__ */ jsx("path", {
					d,
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}, d))
			});
		}
		/**
		* Claude Code's own permission modes as the session's access control, in the
		* composer's tool row where the Host's three-mode selector sits for other
		* agent presets. That selector is hidden for Claude sessions (host-chrome.ts)
		* rather than replaced: it is not a slot. This one drives the same Host
		* knobs through the plugin's route, so approvals and the sandbox follow.
		*
		* The pick is shown the moment it is made and held until the projection
		* confirms it; a refused pick drops back to what the projection says.
		*/
		function ClaudePermissionSelect({ t, setMode, notify, useClaudeProjection, useSession }) {
			const owned = useClaudeProjection((projection) => projection.owned);
			const selector = useClaudeProjection((projection) => projection.permissionSelector);
			const view = useClaudeProjection((projection) => projection.permissionMode);
			const running = useSession === void 0 ? false : useSession((session) => session.running);
			const [pick, setPick] = useState(null);
			const [open, setOpen] = useState(false);
			const [confirming, setConfirming] = useState(null);
			const [acknowledged, setAcknowledged] = useState(false);
			const [busy, setBusy] = useState(false);
			const reported = view?.mode;
			useEffect(() => {
				if (pick !== null && reported === pick) setPick(null);
			}, [pick, reported]);
			if (!owned || selector !== "plugin") return null;
			const current = pick ?? reported;
			const locked = running || view?.locked === true;
			const label = current === void 0 ? t("permissionMode") : t(NAME_KEY[current]);
			const hint = locked ? t("permissionModeLocked") : current === void 0 ? t("permissionMode") : t(HINT_KEY[current]);
			const autoUnsupported = view?.autoSupported === false;
			const hintOf = (mode) => mode === "auto" && autoUnsupported ? t("permissionModeAutoUnsupported") : t(HINT_KEY[mode]);
			const submit = (mode) => {
				setPick(mode);
				setBusy(true);
				setMode(mode).then((outcome) => {
					if (!outcome.hostSynced) notify?.("info", t("permissionModeHostKept"));
				}, (error) => {
					setPick(null);
					notify?.("error", t("permissionModeFailed", { message: error instanceof Error ? error.message : String(error) }));
				}).finally(() => {
					setBusy(false);
				});
			};
			const choose = (id) => {
				setOpen(false);
				if (id === current || !CLAUDE_PERMISSION_MODES.includes(id)) return;
				const mode = id;
				if (mode === "bypassPermissions") {
					setAcknowledged(false);
					setConfirming(mode);
					return;
				}
				submit(mode);
			};
			const closeConfirmation = () => {
				setAcknowledged(false);
				setConfirming(null);
			};
			return /* @__PURE__ */ jsxs("span", {
				className: permissionSelectClass,
				children: [
					/* @__PURE__ */ jsxs("style", {
						"data-dsh-claude-permission-select-styles": true,
						children: [permissionSelectCss, permissionSelectRowCss]
					}),
					/* @__PURE__ */ jsx(Menu, {
						open,
						items: CLAUDE_PERMISSION_MODES.map((mode) => ({
							id: mode,
							label: /* @__PURE__ */ jsxs("span", {
								className: permissionSelectRowClass,
								children: [/* @__PURE__ */ jsx("span", {
									className: permissionSelectRowNameClass,
									children: t(NAME_KEY[mode])
								}), /* @__PURE__ */ jsx("span", {
									className: permissionSelectRowHintClass,
									children: hintOf(mode)
								})]
							}),
							icon: /* @__PURE__ */ jsx(ClaudePermissionModeGlyph, { mode }),
							...mode === "auto" && autoUnsupported ? { disabled: true } : {},
							...mode === "bypassPermissions" ? { danger: true } : {}
						})),
						selectedId: current,
						onSelect: choose,
						onClose: () => {
							setOpen(false);
						},
						side: "top",
						anchor: /* @__PURE__ */ jsx(Tooltip, {
							label: hint,
							side: "top",
							delayMs: 250,
							disabled: open,
							children: /* @__PURE__ */ jsxs("button", {
								type: "button",
								className: permissionSelectTriggerClass,
								"aria-label": t("permissionModeAria", { name: label }),
								"aria-haspopup": "menu",
								"aria-expanded": open,
								disabled: locked || busy,
								onClick: () => {
									setOpen(!open);
								},
								children: [
									current === void 0 ? null : /* @__PURE__ */ jsx("span", {
										className: permissionSelectIconClass,
										children: /* @__PURE__ */ jsx(ClaudePermissionModeGlyph, { mode: current })
									}),
									/* @__PURE__ */ jsx("span", {
										className: permissionSelectLabelClass,
										children: label
									}),
									/* @__PURE__ */ jsx("svg", {
										className: permissionSelectChevronClass,
										width: "12",
										height: "12",
										viewBox: "0 0 12 12",
										fill: "none",
										"aria-hidden": "true",
										"data-open": open ? "" : void 0,
										children: /* @__PURE__ */ jsx("path", {
											d: "M3 4.5L6 7.5L9 4.5",
											stroke: "currentColor",
											strokeWidth: "1.5",
											strokeLinecap: "round",
											strokeLinejoin: "round"
										})
									})
								]
							})
						})
					}),
					/* @__PURE__ */ jsx(RiskConfirmation, {
						open: confirming !== null,
						title: t("permissionBypassTitle"),
						description: t("permissionBypassDescription"),
						acknowledgeLabel: t("permissionBypassAcknowledge"),
						cancelLabel: t("permissionBypassCancel"),
						closeLabel: t("permissionBypassClose"),
						confirmLabel: t("permissionBypassConfirm"),
						acknowledged,
						disabled: locked,
						onAcknowledgedChange: setAcknowledged,
						onCancel: closeConfirmation,
						onConfirm: () => {
							if (locked || !acknowledged || confirming === null) return;
							const mode = confirming;
							closeConfirmation();
							submit(mode);
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/permission-mode-api.ts
		function record(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
		}
		/** Make `mode` the session's Claude permission mode from its next turn. */
		async function setClaudePermissionMode(sessionId, mode, signal) {
			const value = record(await pluginWrite(CLAUDE_PERMISSION_MODE_PATH, "fast", signal, { json: {
				sessionId,
				mode
			} }));
			if (value === void 0 || !isClaudePermissionMode(value.mode) || typeof value.sandbox !== "string" || typeof value.hostSynced !== "boolean") throw new Error("Invalid permission mode result.");
			return {
				mode: value.mode,
				sandbox: value.sandbox,
				hostSynced: value.hostSynced
			};
		}
		//#endregion
		//#region src/client/ClaudePromptRefineAction.tsx
		/**
		* Rewrite the draft in place, from the composer's own tool row.
		*
		* The rewrite replaces the draft outright, which is what makes the undo state
		* load-bearing rather than a nicety: `SessionInput.setDraft` documents itself
		* as "merged into history so a seed is not an undoable step of its own", so
		* Ctrl/Cmd+Z does NOT bring the original back. Without somewhere to put it,
		* one press of this button would silently destroy a draft the user may have
		* spent minutes on. So the original is held for exactly as long as it is still
		* recoverable — until the rewrite is edited or sent — and the same button
		* offers it back over that window.
		*/
		function ClaudePromptRefineAction({ t, useClaudeProjection, useInput, replaceDraft, notify, refine = refineClaudePrompt }) {
			const owned = useClaudeProjection((projection) => projection.owned);
			const attempt = useRef(void 0);
			const [busy, setBusy] = useState(false);
			const [applied, setApplied] = useState();
			useEffect(() => () => {
				attempt.current?.abort();
			}, []);
			const draft = useInput((state) => state.draft);
			if (!owned || replaceDraft === void 0) return null;
			const undoable = applied !== void 0 && draft === applied.refined;
			const label = busy ? t("promptRefineBusy") : undoable ? t("promptRefineUndo") : t("promptRefine");
			const run = () => {
				if (busy || draft.trim() === "") return;
				setBusy(true);
				const running = new AbortController();
				attempt.current = running;
				refine(draft, running.signal).then((text) => {
					if (running.signal.aborted) return;
					setApplied({
						original: draft,
						refined: text
					});
					replaceDraft(text);
				}, (error) => {
					if (running.signal.aborted) return;
					notify?.("error", t("promptRefineFailed", { message: error instanceof Error ? error.message : String(error) }));
				}).finally(() => {
					setBusy(false);
				});
			};
			const undo = () => {
				if (applied === void 0) return;
				replaceDraft(applied.original);
				setApplied(void 0);
			};
			return /* @__PURE__ */ jsx(Tooltip, {
				label,
				side: "top",
				delayMs: 250,
				children: /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: promptSaveTriggerClass,
					"aria-label": label,
					disabled: busy || !undoable && draft.trim() === "",
					onClick: undoable ? undo : run,
					children: [/* @__PURE__ */ jsx("style", {
						"data-dsh-claude-prompt-refine-styles": true,
						children: promptSaveTriggerCss
					}), busy ? /* @__PURE__ */ jsx(IconLoadingOutlineRegular, {
						size: 14,
						className: promptSpinClass
					}) : undoable ? /* @__PURE__ */ jsx(IconRefreshOutlineRegular, {
						size: 14,
						className: promptUndoClass
					}) : /* @__PURE__ */ jsx(IconSparkleRegular, { size: 14 })]
				})
			});
		}
		//#endregion
		//#region src/client/ClaudePromptSuggestion.tsx
		/** What is left to ghost after the draft, or undefined when nothing should be.
		*  Only a draft the suggestion still starts with keeps it: the moment the user
		*  types something else, the guess is wrong and goes away. A `/` draft is left
		*  to the command menu, which owns Tab while it is open. */
		function suggestionRemainder(suggestion, draft) {
			if (suggestion === void 0 || draft.length >= suggestion.length || !suggestion.startsWith(draft)) return void 0;
			if (draft.startsWith("/") || draft.endsWith("\n")) return void 0;
			return suggestion.slice(draft.length);
		}
		/** Whether the caret sits after the last character of `root`. */
		function caretAtEnd(root) {
			const selection = root.ownerDocument.getSelection();
			if (selection === null || !selection.isCollapsed || selection.focusNode === null || !root.contains(selection.focusNode)) return false;
			const rest = root.ownerDocument.createRange();
			rest.selectNodeContents(root);
			rest.setStart(selection.focusNode, selection.focusOffset);
			return rest.toString().length === 0;
		}
		/**
		* Claude Code's guess at the next prompt, drawn as grey text after the draft;
		* Tab, or → with the caret at the end, takes it.
		*
		* The Host composer has no ghost-text API, but it already draws its command
		* hints as a `::after` on the last paragraph. This does the same under its own
		* attribute and custom property, set on the editor's wrapper so the
		* placeholder (a sibling of the editor) can read it too: an empty draft shows
		* the suggestion in the placeholder's seat instead. The text therefore wraps
		* and scrolls exactly like the draft, and nothing is positioned by hand.
		*/
		function ClaudePromptSuggestion({ useClaudeProjection, useInput, acceptDraft, report }) {
			const owned = useClaudeProjection((projection) => projection.owned);
			const suggestion = useClaudeProjection((projection) => projection.promptSuggestion);
			const draft = useInput((state) => state.draft);
			const anchor = useRef(null);
			const remainder = owned && acceptDraft !== void 0 ? suggestionRemainder(suggestion, draft) : void 0;
			useEffect(() => {
				if (remainder === void 0 || suggestion === void 0 || acceptDraft === void 0) return void 0;
				const input = anchor.current?.closest("[data-composer-card]")?.querySelector("[data-composer-input]");
				const wrapper = input?.parentElement;
				if (input === void 0 || input === null || wrapper === void 0 || wrapper === null) {
					report?.("composer input not found: [data-composer-card] [data-composer-input]; prompt suggestions are not drawn");
					return;
				}
				wrapper.setAttribute(promptSuggestionAttribute, draft === "" ? "empty" : "inline");
				wrapper.style.setProperty(promptSuggestionProperty, JSON.stringify(remainder));
				const onKeyDown = (event) => {
					if (event.key !== "Tab" && event.key !== "ArrowRight") return;
					if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
					if (!(event.target instanceof Node) || !input.contains(event.target)) return;
					if (input.hasAttribute("data-composer-composing")) return;
					if (event.key === "ArrowRight" && !caretAtEnd(input)) return;
					event.preventDefault();
					event.stopPropagation();
					acceptDraft(suggestion);
				};
				document.addEventListener("keydown", onKeyDown, true);
				return () => {
					document.removeEventListener("keydown", onKeyDown, true);
					wrapper.removeAttribute(promptSuggestionAttribute);
					wrapper.style.removeProperty(promptSuggestionProperty);
				};
			}, [
				remainder,
				suggestion,
				draft,
				acceptDraft,
				report
			]);
			return /* @__PURE__ */ jsx("span", {
				ref: anchor,
				hidden: true,
				children: /* @__PURE__ */ jsx("style", {
					"data-dsh-claude-prompt-suggestion-styles": true,
					children: promptSuggestionCss
				})
			});
		}
		//#endregion
		//#region src/client/claude-prompt-source.ts
		/**
		* The user's own prompt snippets as a second `/` group.
		*
		* Unlike {@link createClaudeCommandSource}, a pick here settles as plain text:
		* the pipeline replaces the trigger token with the snippet body and leaves the
		* caret after it, so the draft stays editable and nothing is sent. A snippet is
		* a half-written message, not a command.
		*/
		function createClaudePromptSource(groupName, load = claudePrompts) {
			let known = [];
			return {
				trigger: "/",
				name: groupName,
				order: 20,
				async candidates(_session, request) {
					if (request.position !== "leading") return [];
					known = await load();
					const query = request.query.toLocaleLowerCase();
					return known.filter((prompt) => prompt.name.toLocaleLowerCase().includes(query)).map((prompt) => ({
						name: prompt.name,
						description: prompt.description
					}));
				},
				onPick(pick) {
					const prompt = known.find((item) => item.name === pick.candidate.name);
					return prompt === void 0 ? void 0 : { text: prompt.body };
				}
			};
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			nav: "Claude Code",
			title: "Claude Code",
			description: "DSH 使用本机 Claude Code，并保留其 Agent Loop、工具、CLAUDE.md、Skills、Hooks 与 MCP 配置。",
			activity: "Claude Code 活动",
			detail: "查看已脱敏详情",
			thinking: "思考",
			running: "运行中",
			failed: "失败",
			done: "完成",
			subagent: "子代理",
			usedTool: "使用了 1 个工具",
			usedTools: "使用了 {count} 个工具",
			compacted: "已压缩上下文",
			compactedAuto: "已自动压缩上下文",
			toolInput: "输入",
			toolOutput: "输出",
			toolAnswers: "回答",
			steeredMessage: "你插入的消息",
			planFeedbackMessage: "你对计划的修改意见",
			toolError: "错误",
			markdownCopy: "复制",
			markdownCopied: "已复制",
			markdownFootnotes: "脚注",
			codeBlockTitle: "代码",
			codeBlockWrap: "自动换行",
			codeBlockUnwrap: "不换行",
			tokens: "{count} 个 token",
			doctor: "运行诊断",
			refreshing: "诊断中…",
			diagnostics: "运行状态",
			diagnosticsBody: "检查 Claude Code 可执行文件、登录状态、协议握手与当前进程配置。",
			diagnosticsLoading: "正在加载诊断信息…",
			executable: "可执行文件",
			version: "版本",
			authentication: "登录状态",
			handshake: "协议握手",
			initialization: "初始化",
			processes: "活动进程",
			limits: "进程限制",
			processSummary: "共 {total} 个 · {active} 个活动中",
			limitSummary: "最多 {max} 个 · 空闲 {minutes} 分钟后回收",
			missing: "未找到",
			unknown: "未知",
			error: "诊断失败",
			security: "权限边界",
			securityBody: "Claude 工具权限通过 DSH 审批界面决定；当前版本不宣称对 ~/.claude 与工作区之外路径提供内核级写入隔离。",
			globalSettings: "Claude Code 设置",
			globalSettingsBody: "修改受支持的 Claude Code 与插件设置；其他字段会被保留。",
			globalSettingsLoading: "正在加载全局设置…",
			globalSettingsNewSession: "修改仅对新建 Claude 会话生效。",
			globalSettingsError: "全局设置保存失败",
			outputStyle: "输出风格",
			permissionSelector: "权限选择器",
			permissionSelectorPlugin: "插件（Claude Code 权限模式）",
			permissionSelectorNative: "DSH 原生（三档访问模式）",
			permissionSelectorEffect: "插件：composer 里显示本插件的选择器，提供 Claude Code 的全部权限模式，并按下面的\"默认权限模式\"初始化新会话。DSH 原生：保留 DSH 自带的只读 / 工作区写入 / 完全权限三档下拉，权限只按沙箱映射（只读对应计划，工作区写入对应自动接受编辑，完全权限对应跳过权限），会话里的选择和默认权限模式都不再参与。立即生效；正在运行的回合保持原模式。",
			defaultPermissionMode: "默认权限模式",
			defaultPermissionModeEffect: "新建 Claude 会话时采用的 Claude Code 权限模式，DSH 的访问预设会随之切到这个模式对应的沙箱；之后在 composer 里的权限选择器改过的会话按自己的选择运行。用 /permission 之类原生方式改过沙箱的会话，以沙箱对应的模式为准；当前模型不支持自动模式时退回默认模式。修改只对之后新建的会话生效。",
			renderer: "AI 输出渲染器",
			rendererPlugin: "插件渲染器",
			rendererNative: "DSH 原生渲染器",
			rendererEffect: "插件渲染器沿用本插件自带的转录视图：交错的正文、成组的工具卡片与活动行。DSH 原生渲染器改由 DSH 自身绘制：正文作为普通助手文本块，思考作为推理块；Claude 的工具卡片仍由本插件绘制。修改从下一个回合起生效；已经产生的回合仍按记录时的渲染器显示，不会重绘。",
			prose: "Markdown 彩色高亮",
			prosePlain: "关闭",
			proseEnhanced: "开启",
			proseEffect: "开启后，正文的标题、加粗、斜体、行内代码、列表符号、引用与链接各自着色，代码块换成深色描边底。这会覆盖本插件默认对齐 Claude 桌面版的配色。仅在使用插件渲染器时有效，改动立即生效，无需等待下一回合。",
			worktreeBranchPrefix: "Worktree 分支前缀",
			worktreeBranchPrefixEffect: "分支前缀修改会应用于之后自动创建的 Worktree 分支；显式指定的完整分支名不会被修改。",
			maxProcessesSetting: "Claude 进程上限",
			idleTimeoutSetting: "闲置回收时长（分钟）",
			maxProcessesEffect: "保存后立即回收超额空闲进程；运行中的进程完成后再收敛。满载时，新会话会等待可用容量。留空或非法值会被拒绝。",
			idleTimeoutEffect: "闲置回收时长在下一次回合结束后生效。留空或非法值会被拒绝。",
			settingHint: "查看说明",
			pluginUpdate: "插件更新",
			pluginUpdateBody: "检查 npm 上的新版本。只有可唯一识别的 npm 安装才能直接更新；本地开发链接不会被替换。",
			updateNotChecked: "尚未检查更新。",
			installedVersion: "已安装版本",
			latestVersion: "最新版本",
			installSource: "安装来源",
			updateStatus: "更新状态",
			checkUpdates: "检查更新",
			checkingUpdates: "检查中…",
			updatePlugin: "更新",
			updatingPlugin: "更新中…",
			updateError: "更新失败",
			restartRequired: "需要重启 DeepSeek Harness 才能加载更新后的插件。",
			updateSource_registry: "npm",
			updateSource_link: "本地开发链接",
			updateSource_unsupported: "不支持的来源",
			updateSource_unknown: "未知",
			updateState_current: "已是最新版本",
			updateState_available: "有可用更新",
			updateState_linked: "由链接的源码目录提供更新",
			updateState_unsupported: "此安装来源不支持自动更新",
			updateState_unavailable: "无法安全识别当前 DSH profile",
			updateState_error: "检查失败",
			planUsage: "账号额度",
			planUsageBody: "当前 Claude 订阅的用量窗口，来自 Claude Code 的 /usage 数据。会话空闲时自动刷新，也可随时手动刷新。",
			planUsageLoading: "读取中…",
			planUsageRefresh: "刷新额度",
			planUsageRefreshing: "刷新中…",
			planUsageUnavailable: "此账号没有订阅额度（API key、Bedrock、Vertex 等不受套餐限流）。",
			planUsageNever: "尚未获取额度数据，运行一次对话或点击刷新。",
			planUsageError: "额度读取失败",
			planUsageSubscription: "订阅",
			planUsageUpdated: "更新于 {age}前",
			planUsageResets: "{age}后重置",
			planUsageUsed: "已用 {percent}%",
			planWindow_five_hour: "5 小时",
			planWindow_seven_day: "全部模型 · 每周",
			planWindow_seven_day_opus: "Opus · 每周",
			planWindow_seven_day_sonnet: "Sonnet · 每周",
			repositoryOpen: "查看仓库与 PR 详情",
			repositoryPanel: "仓库状态",
			repositoryClose: "关闭仓库面板",
			repositorySection: "仓库",
			repositoryStatus: "状态",
			repositoryAvailable: "可用",
			repositoryUnavailable: "仓库状态不可用",
			repositoryNotGit: "非 Git 仓库",
			repositoryCwd: "会话目录",
			repositoryRoot: "仓库根目录",
			repositoryBranch: "分支",
			repositoryBranchSearch: "检索分支",
			repositoryBranchSearchEmpty: "没有匹配的分支",
			repositoryBranchRefresh: "刷新远程分支",
			repositoryBranchRefreshing: "正在刷新远程分支…",
			repositoryBranchRefreshed: "已刷新 · {count} 个分支",
			repositoryBranchRefreshFailed: "刷新远程分支失败",
			repositoryBranchRefreshStale: "宿主进程里的插件还是旧版本（没有刷新接口）。重启 DSH 后再试。",
			repositoryBranchesLoading: "正在加载分支…",
			repositoryProgressTitle: "正在创建 Worktree",
			repositoryProgressFailed: "Worktree 创建失败",
			repositoryProgressDismiss: "关闭 Worktree 进度",
			repositoryProgress_inspecting: "检查仓库和分支",
			repositoryProgress_fetching: "刷新远程引用",
			repositoryProgress_summarizing: "总结需求生成分支名",
			"repositoryProgress_creating-worktree": "创建分支和 Worktree",
			"repositoryProgress_saving-worktree": "保存 Worktree 状态",
			"repositoryProgress_switching-branch": "切换本地分支",
			"repositoryProgress_creating-workspace": "创建 DSH Workspace",
			"repositoryProgress_starting-session": "启动 Claude 会话",
			"repositoryProgress_transferring-draft": "转移消息和附件",
			repositoryProgress_submitting: "提交消息",
			repositorySessionUnavailable: "无法准备目标会话。",
			repositoryDraftTransferFailed: "无法将草稿附件转移到 worktree 会话。",
			repositoryDetached: "分离的 HEAD",
			repositoryUnknownBranch: "未知分支",
			repositoryWorktree: "工作树",
			repositoryWorktreeLabel: "Git 工作树",
			repositoryChanges: "改动",
			repositoryModified: "有修改",
			repositoryClean: "干净",
			repositoryLocal: "本地仓库",
			repositoryPullRequest: "Pull Request",
			repositoryNoPr: "当前分支没有关联 PR",
			repositoryPr: "PR #{number}",
			repositoryPrDraft: "草稿 PR #{number}",
			repositoryPrState: "PR 状态",
			repositoryDraft: "草稿",
			repositoryState_open: "开放",
			repositoryState_closed: "已关闭",
			repositoryState_merged: "已合并",
			repositoryMergedAgo: "{age}前",
			repositoryChecks: "检查",
			repositoryChecks_passing: "检查通过",
			repositoryChecks_pending: "检查进行中",
			repositoryChecks_failing: "检查失败",
			repositoryChecks_none: "无检查",
			repositoryReview: "评审",
			repositoryReview_approved: "已批准",
			"repositoryReview_changes-requested": "要求修改",
			"repositoryReview_review-required": "等待评审",
			repositoryReview_none: "无评审状态",
			repositoryMergeState: "合并状态",
			repositoryOpenPr: "在浏览器中打开 PR #{number}",
			yes: "是",
			no: "否",
			diffOpen: "查看分支改动",
			diffTabTitle: "分支改动",
			planPanelTitle: "计划",
			planClose: "关闭方案面板",
			planOpen: "查看方案",
			planNth: "{index} / {total}",
			planHistory: "本会话的方案",
			planNotePlaceholder: "写下要改的地方，Enter 记一条，⌘/Ctrl+Enter 发送",
			planNoteQuotedPlaceholder: "针对选中的这段，要改成什么？",
			planNoteHint: "在正文里选中一段可以引用它",
			planNoteRemove: "删掉这条意见",
			planQuoteClear: "取消引用",
			planSendForChanges: "发送并让 AI 修改",
			planSending: "发送中…",
			planSettled: "这个方案已经在审批弹框里被决定了，意见没能发出。",
			planFeedbackFailed: "意见发送失败，请重试。",
			planPending: "待审批",
			planApproved: "已批准",
			planRejected: "已拒绝",
			planEmpty: "本会话还没有待查看的方案。",
			planPendingHint: "在 DSH 的审批弹框里批准或拒绝这个方案。",
			diffClose: "关闭 Diff 面板",
			promptSource: "常用提示词",
			promptSave: "存为常用提示词",
			promptSaveName: "名字",
			promptSaveNaming: "正在起名…",
			promptRefine: "AI 优化提示词",
			promptRefineBusy: "优化中…",
			promptRefineUndo: "还原成优化前的内容",
			promptRefineFailed: "优化失败：{message}",
			promptSaveConfirm: "保存",
			promptSaveCancel: "取消",
			promptSaveDone: "知道了",
			promptSaved: "已存为「{name}」",
			promptSaveExists: "已有同名提示词，换个名字。",
			promptSaveFailed: "保存失败：{message}",
			promptManage: "管理常用提示词",
			promptManageLoading: "读取中…",
			promptManageEmpty: "还没有保存过提示词。",
			promptDelete: "删除",
			promptDeleteNamed: "删除「{name}」",
			promptDeleteConfirm: "删除「{name}」？",
			promptDeleteFailed: "删除失败：{message}",
			permissionMode: "权限模式",
			permissionModeAria: "权限模式：{name}",
			permissionModePlan: "计划",
			permissionModePlanHint: "只读探索并写出计划，经你批准后才执行",
			permissionModeDefault: "默认",
			permissionModeDefaultHint: "每次文件改动和命令都先询问",
			permissionModeAcceptEdits: "自动接受编辑",
			permissionModeAcceptEditsHint: "文件改动自动放行，命令仍会询问",
			permissionModeDontAsk: "不询问",
			permissionModeDontAskHint: "没有预先放行的操作直接拒绝，不弹出审批",
			permissionModeAuto: "自动",
			permissionModeAutoHint: "由 Claude Code 的分类器代为批准，拿不准的才问你",
			permissionModeAutoUnsupported: "当前模型不支持自动模式",
			permissionModeBypass: "跳过权限",
			permissionModeBypassHint: "跳过所有权限检查",
			permissionModeLocked: "回合进行中无法切换权限模式",
			permissionModeFailed: "切换权限模式失败：{message}",
			permissionModeHostKept: "DSH 未同步访问模式，Claude 仍按所选模式运行",
			permissionBypassTitle: "跳过所有权限检查？",
			permissionBypassDescription: "Claude Code 将不再请求审批，直接执行文件改动和命令。",
			permissionBypassAcknowledge: "我了解风险",
			permissionBypassCancel: "取消",
			permissionBypassClose: "关闭",
			permissionBypassConfirm: "启用",
			presetHeaderHint: "当前会话运行的 Agent 预设",
			presetClaudeDescription: "在 DSH 中以本地 Claude Code 作为完整的 Agent 运行时。",
			diffRepository: "仓库",
			repositoryLinked: "关联仓库：本会话改动过",
			linkedRepositoryPrompt: "以下内容针对关联仓库 {root}（分支 {branch}），不是本会话自己的仓库。",
			diffFiles: "{count} 个已修改文件",
			diffFilesShort: "{count} 个文件",
			diffTruncated: "Diff 超出安全显示上限。请在终端中查看完整内容。",
			diffEmpty: "没有可显示的 tracked 文件改动",
			diffElided: "{count} 个文件过大未展示：{files}",
			diffCommentPrevious: "上一条评论",
			diffCommentNext: "下一条评论",
			diffCommentPosition: "第 {index} 条，共 {total} 条",
			diffCommentCounter: "{index}/{total}",
			diffCardExpand: "展开其余 {count} 行",
			diffCardCollapse: "收起",
			diffExpandAll: "展开全部文件",
			diffCollapseAll: "收起全部文件",
			diffCommit: "提交",
			diffRevertAll: "全部撤销",
			diffRevertConfirmAction: "撤销",
			diffRevertFile: "撤销此文件的改动",
			diffRevertFileNamed: "撤销 {path} 的改动",
			diffRevertFileConfirm: "撤销 {path} 的未提交改动？此操作不可恢复。",
			diffRevertAllConfirm: "撤销全部 {count} 个文件的未提交改动？新建的文件会被删除，此操作不可恢复。",
			diffRevertCompleted: "已撤销 {count} 个文件的改动",
			diffRevertNothing: "没有可撤销的未提交改动，这些改动已经提交。",
			diffCommitMenu: "打开提交操作菜单",
			diffCommitPush: "提交并推送…",
			diffPush: "推送",
			diffCreatePr: "创建 PR…",
			diffConfirmDescription: "确认仓库快照和将要执行的 Git 操作。",
			diffPushDescription: "将本地未推送的 commit 推送到远端分支。",
			diffPushAhead: "{count} 个未推送的 commit",
			diffPushCompleted: "已推送 commit {commit}",
			diffGeneratingMessage: "正在生成建议的 commit message，只会填进你没写的字段。",
			diffLoadingPreview: "正在读取仓库变更…",
			diffCommitMessagePlaceholder: "简要描述这次修改…",
			diffCommitMessageHint: "首行写修改摘要，空一行后可补充详细说明。",
			diffActionFailed: "仓库操作失败。",
			diffIncludeUnstaged: "包含 unstaged 和 untracked 改动",
			diffCommitMessage: "提交信息",
			diffStaged: "已暂存",
			diffUnstaged: "未暂存",
			diffStagedUnstaged: "已暂存 + 未暂存",
			diffUntracked: "未跟踪",
			diffPrTitle: "PR 标题",
			diffPrBase: "目标分支",
			diffPrBaseDefault: "使用远端默认分支",
			diffPrDescription: "PR description（仅 Summary 与 Changes）",
			diffPrDraft: "创建为 Draft PR",
			diffCancel: "取消",
			diffConfirm: "确认",
			diffSubmitting: "执行中…",
			diffDone: "完成",
			diffCommitCompleted: "已创建 commit {commit}",
			diffPrCompleted: "已创建 PR，可在仓库栏打开",
			diffCommitPreserved: "本地 commit {commit} 已保留。",
			diffMergePr: "合并",
			repositoryMergeMenu: "打开 PR 合并选项",
			diffMerge_merge: "合并提交 (merge)",
			diffMerge_squash: "Squash 合并",
			diffMerge_rebase: "Rebase 合并",
			diffMergeDescription: "使用所选方式合并当前分支的 Pull Request。",
			diffMergeAdmin: "以管理员身份合并（绕过分支保护）",
			diffMergeCompleted: "已合并 PR #{number}",
			diffUpdateBranch: "更新分支…",
			repositoryUpdateBranch: "更新分支",
			diffUpdateBranchDescription: "用 origin/{base} 更新当前分支并推送;出现冲突时可交给 Claude 解决。",
			diffUpdateBranch_rebase: "Rebase 到 origin/{base}(改写历史,以 --force-with-lease 推送)",
			diffUpdateBranch_merge: "将 origin/{base} 合并进当前分支",
			diffUpdateBranchBehind: "落后 origin/{base} {count} 个 commit",
			diffUpdateBranchCompleted: "已更新并推送 commit {commit}",
			diffUpdateBranchConflicts: "更新产生冲突,以下文件需要解决:",
			diffUpdateBranchResolve: "让 Claude 解决冲突",
			conflictTitle: "解决冲突",
			conflictOperation_rebase: "Rebase",
			conflictOperation_merge: "合并",
			"conflictOperation_cherry-pick": "Cherry-pick",
			conflictOperation_revert: "Revert",
			conflictBadge: "{operation} 冲突 {count}",
			conflictBadgeReady: "继续 {operation}",
			conflictDescription: "{operation} 尚未完成。解决冲突后继续,或中止回到操作前的状态。",
			conflictFiles: "以下文件存在冲突,需要解决并 git add:",
			conflictReady: "冲突已全部解决,可以继续。",
			conflictResolve: "让 Claude 解决冲突",
			conflictContinue: "继续 {operation}",
			conflictAbort: "中止 {operation}",
			conflictAbortConfirm: "再次点击「中止 {operation}」确认:{operation} 期间的改动会被丢弃。",
			conflictPush: "完成后推送到远端",
			conflictContinued: "{operation} 已完成",
			conflictPushed: "{operation} 已完成并推送",
			conflictAborted: "已中止 {operation}",
			repositoryChecksOpen: "查看失败的检查",
			checksCardTitle: "失败的检查",
			checksCardLoading: "正在读取检查详情…",
			checksCardEmpty: "未能读取失败详情",
			checksCardFix: "让 Claude 修复",
			prCommentsButton: "GitHub 评论 ({count})",
			prCommentsSend: "让 Claude 处理 GitHub 上的 PR 评论",
			autoFixLabel: "自动修复",
			autoFixTitle: "自动监听这个 PR 的 review 评论与 CI 失败，交给 Claude 修复并推送，直到全部通过；取消勾选即停止。",
			heroTicket: "工单",
			heroTicketMenu: "选择 Jira ticket",
			heroTicketSearch: "搜索 ticket 或输入 key…",
			heroTicketLoading: "搜索中…",
			heroTicketEmpty: "没有匹配的 ticket",
			heroTicketNone: "清除已选 ticket",
			heroTicketRemove: "移除 {key}",
			heroTicketCount: "{count} 个 ticket",
			heroBatchStarted: "已为 {count} 个 ticket 各自创建 Worktree 会话并开工",
			heroTicketNotConnected: "请先在 Settings 中连接 Jira",
			heroTicketFailed: "Ticket 搜索失败",
			jiraTitle: "Jira",
			jiraBody: "连接 Jira Cloud 后，新会话可以直接从 ticket 开工：分支按 ticket key 命名，输入框预填 ticket 简报，worktree 创建后自动把 ticket 分配给你。",
			jiraSite: "站点地址",
			jiraSitePlaceholder: "https://your-team.atlassian.net",
			jiraEmail: "账号邮箱",
			jiraToken: "API 令牌",
			jiraTokenHelp: "在 Atlassian 创建 API Token",
			jiraConnect: "连接",
			jiraConnecting: "正在验证…",
			jiraDisconnect: "断开连接",
			jiraConnected: "已连接",
			jiraLoading: "正在读取 Jira 状态…",
			jiraError: "Jira 操作失败",
			cleanupButton: "清理",
			cleanupTitle: "清理已合并分支",
			cleanupDescription: "删除 worktree 与本地分支，并归档对应 workspace 的会话后移除 workspace；普通 checkout 则切回 base 分支并删除已合并分支。",
			cleanupCompleted: "已清理 {branch}",
			cleanupDescriptionUnmerged: "这个 worktree 没有对应的 PR。删除 worktree 与本地分支，并归档对应 workspace 的会话后移除 workspace；分支上有任何未推送到远端的提交时会拒绝。",
			askToolbar: "选中文本操作",
			askTooltip: "针对选中内容追问",
			copyTooltip: "复制",
			askCopied: "已复制",
			askPlaceholder: "针对选中内容提问…",
			askSubmit: "发送",
			askStarting: "正在启动 Claude…",
			askThinking: "思考中…",
			askThinkingLive: "思考中 ·",
			askThinkingLabel: "思考 ·",
			askCopyAnswer: "复制回答",
			askSendToChat: "转发到对话",
			askClose: "关闭",
			askFailed: "提问失败",
			reviewCommentAdd: "添加行评论",
			reviewCommentPlaceholder: "请求更改",
			reviewCommentSubmit: "注释",
			reviewCommentCancel: "取消",
			reviewCommentRemove: "删除评论",
			reviewThreadReply: "回复",
			reviewThreadSendToAi: "交给 AI 修复",
			reviewThreadBot: "机器人",
			reviewThreadAgo: "{age}前",
			reviewThreadReplyTo: "回复 @{author}",
			reviewThreadOpenOnGitHub: "在 GitHub 上打开",
			reviewThreadSend: "发送回复",
			reviewThreadResolve: "标记为已解决",
			reviewThreadUnresolve: "重新打开",
			reviewThreadResolved: "已解决",
			reviewThreadOutdated: "已过时",
			reviewThreadReplyPlaceholder: "回复这条评论，输入 @ 可提及成员",
			reviewThreadMention: "提及仓库成员",
			reviewThreadReplyFailed: "回复没有发送成功。",
			reviewThreadResolveFailed: "线程状态没有更新成功。",
			reviewCommentFailed: "评论操作失败。",
			reviewCommentsClear: "清除全部评论",
			reviewCommentsSend: "发送评论",
			reviewCommentsSendDraft: "请处理以上代码评论。",
			reviewCommentOldSide: "旧代码第 {line} 行",
			reviewCommentNewSide: "第 {line} 行",
			reviewCommentOldRange: "旧代码第 {start}–{end} 行",
			reviewCommentNewRange: "第 {start}–{end} 行",
			diffUnmodifiedLines: "{count} 行未修改",
			diffUnmodifiedTail: "文件末尾之前还有未修改的行",
			diffExpandUp: "向上展开",
			diffExpandDown: "向下展开",
			diffFileComments: "{count} 条评论",
			rewindTooltip: "回退到此处",
			rewindTitle: "回退到这条消息之前",
			rewindDescription: "将删除这条消息及其下方的 {count} 条内容，并让 Claude 回到发送它之前的上下文。此操作不可撤销。",
			rewindHint: "被删除的内容会从这个会话中隐藏，Claude 也会忘记它们；消息原文会放回输入框，方便修改后重新发送。",
			rewindConfirm: "删除并回退",
			rewindSubmitting: "回退中…",
			rewindFailed: "回退失败（{code}）。",
			rewindBusy: "这个会话正在运行，请等本轮结束后再回退。",
			rewindStale: "宿主进程里的插件还是旧版本（没有回退接口）。重启 DSH 后再试。",
			rewindRestoreFiles: "同时把文件改回这一轮开始前的样子",
			rewindRestoreFilesHint: "被删除的内容会从这个会话中隐藏，Claude 也会忘记它们；工作区会回到这一轮开始前的状态——这之后新建的文件会被删除，被改动的文件会被还原，被 .gitignore 忽略的文件不受影响。消息原文会放回输入框，方便修改后重新发送。",
			rewindFilesUnavailable: "对话已回退，但文件没有还原：这一轮没有留下工作区快照。",
			turnUsage: "本回合用量",
			turnUsageTokens: "{count} tok",
			turnUsageCache: "缓存命中 {percent}%",
			turnUsageTtft: "首字 {duration}",
			turnUsageCost: "累计 ${cost}",
			toolBackground: "转后台",
			toolBackgrounding: "正在转后台…",
			teamTitle: "团队",
			teamTrigger: "智能体团队",
			teamMembers: "成员",
			teamLead: "当前会话",
			teamLeadIdle: "未运行",
			teamTaskOwner: "Owner {owner}",
			teamTaskUnowned: "未分配",
			teamTaskBlockedBy: "依赖 {tasks}",
			teamTasks: "共享任务",
			teamNoTasks: "还没有共享任务",
			teamMessages: "消息",
			teamNoMessages: "还没有消息",
			teamStatusRunning: "运行中",
			teamStatusCompleted: "已完成",
			teamStatusFailed: "失败",
			teamStatusStopped: "已停止",
			teamStatusKilled: "已终止",
			teamTaskPending: "待处理",
			teamTaskInProgress: "进行中",
			teamTaskCompleted: "已完成",
			teammatePanelTitle: "队友",
			teammateOpen: "打开队友 {name}",
			fileMentionOpen: "在侧栏打开 {name}",
			teammateClose: "关闭队友面板",
			teammateGone: "这个队友已不在任务板上",
			teammateBrief: "派给它的任务",
			teammateToolUses: "{count} 次工具调用",
			teammateResult: "交回的结果",
			teammateWorking: "正在工作，还没有输出"
		};
		const en = {
			nav: "Claude Code",
			title: "Claude Code",
			description: "DSH uses the local Claude Code and preserves its agent loop, tools, CLAUDE.md, Skills, Hooks, and MCP configuration.",
			activity: "Claude Code activity",
			detail: "Show redacted detail",
			thinking: "Think",
			running: "Running",
			failed: "Failed",
			done: "Done",
			subagent: "Subagent",
			usedTool: "Used 1 tool",
			usedTools: "Used {count} tools",
			compacted: "Context compacted",
			compactedAuto: "Context auto-compacted",
			toolInput: "Input",
			toolOutput: "Output",
			toolAnswers: "Answers",
			steeredMessage: "Your steered message",
			planFeedbackMessage: "Your changes to the plan",
			toolError: "Error",
			markdownCopy: "Copy",
			markdownCopied: "Copied",
			markdownFootnotes: "Footnotes",
			codeBlockTitle: "Code",
			codeBlockWrap: "Wrap lines",
			codeBlockUnwrap: "No wrap",
			tokens: "{count} tokens",
			doctor: "Run Doctor",
			refreshing: "Running Doctor…",
			diagnostics: "Runtime status",
			diagnosticsBody: "Check the Claude Code executable, authentication, protocol handshake, and current process configuration.",
			diagnosticsLoading: "Loading diagnostics…",
			executable: "Executable",
			version: "Version",
			authentication: "Authentication",
			handshake: "Protocol handshake",
			initialization: "Initialization",
			processes: "Live processes",
			limits: "Process limits",
			processSummary: "{total} total · {active} active",
			limitSummary: "{max} max · {minutes} min idle",
			missing: "Not found",
			unknown: "Unknown",
			error: "Doctor failed",
			security: "Permission boundary",
			securityBody: "Claude tool permissions are decided through the DSH approval UI. This version does not claim kernel-level write isolation for ~/.claude or paths outside the workspace.",
			globalSettings: "Claude Code settings",
			globalSettingsBody: "Modify supported Claude Code and plugin settings while preserving every other field.",
			globalSettingsLoading: "Loading global settings…",
			globalSettingsNewSession: "Changes apply only to new Claude sessions.",
			globalSettingsError: "Global settings save failed",
			outputStyle: "Output Style",
			permissionSelector: "Permission selector",
			permissionSelectorPlugin: "Plugin (Claude Code permission modes)",
			permissionSelectorNative: "DSH native (three access modes)",
			permissionSelectorEffect: "Plugin: the composer shows this plugin's selector with every Claude Code permission mode, and new sessions start in the default mode below. DSH native: the Host's own read-only / workspace-write / full-access selector stays, and the mode follows the sandbox alone (read-only is Plan, workspace-write is Accept edits, full access is Bypass); per-session choices and the default mode are not consulted. Takes effect immediately; a running turn keeps its mode.",
			defaultPermissionMode: "Default permission mode",
			defaultPermissionModeEffect: "The Claude Code permission mode a new Claude session starts in; DSH's access preset is moved onto the sandbox that mode needs as the session is created. A session you have since changed with the composer's own selector runs its own choice. A sandbox switched natively (/permission) wins over the mode, and auto yields to Default on a model that cannot run it. Changes apply to sessions created from then on.",
			renderer: "AI output renderer",
			rendererPlugin: "Plugin renderer",
			rendererNative: "DSH native renderer",
			rendererEffect: "The plugin renderer keeps this package’s own transcript: interleaved prose, grouped tool cards, and activity rows. The DSH native renderer hands the same turn to DSH itself — prose as ordinary assistant text blocks, thinking as reasoning blocks; Claude’s tool cards are still drawn by this package. A change applies from the next turn; turns already recorded keep the renderer they were recorded with and are not redrawn.",
			prose: "Markdown colour highlighting",
			prosePlain: "Off",
			proseEnhanced: "On",
			proseEffect: "Gives headings, bold, italics, inline code, list markers, quotes and links their own colours, and paints the code block on a dark outlined surface. This overrides the Claude-desktop palette this package matches by default. Only applies under the plugin renderer, and takes effect immediately rather than on the next turn.",
			worktreeBranchPrefix: "Worktree branch prefix",
			worktreeBranchPrefixEffect: "Prefix changes apply to subsequently generated Worktree branches. Explicit full branch names remain unchanged.",
			maxProcessesSetting: "Claude process limit",
			idleTimeoutSetting: "Idle timeout (minutes)",
			maxProcessesEffect: "Saving immediately reclaims excess idle processes; running processes converge after they finish. New sessions wait for capacity while every process is busy. Blank or invalid values are rejected.",
			idleTimeoutEffect: "The idle timeout applies after the next completed turn. Blank or invalid values are rejected.",
			settingHint: "Show details",
			pluginUpdate: "Plugin updates",
			pluginUpdateBody: "Check npm for new releases. Only a uniquely identified npm installation can update in place; local development links are never replaced.",
			updateNotChecked: "Updates have not been checked yet.",
			installedVersion: "Installed version",
			latestVersion: "Latest version",
			installSource: "Installation source",
			updateStatus: "Update status",
			checkUpdates: "Check for updates",
			checkingUpdates: "Checking…",
			updatePlugin: "Update",
			updatingPlugin: "Updating…",
			updateError: "Update failed",
			restartRequired: "Restart DeepSeek Harness to load the updated plugin.",
			updateSource_registry: "npm",
			updateSource_link: "Local development link",
			updateSource_unsupported: "Unsupported source",
			updateSource_unknown: "Unknown",
			updateState_current: "Up to date",
			updateState_available: "Update available",
			updateState_linked: "Updated from the linked source checkout",
			updateState_unsupported: "This installation source cannot update automatically",
			updateState_unavailable: "The active DSH profile cannot be identified safely",
			updateState_error: "Check failed",
			planUsage: "Plan usage",
			planUsageBody: "Utilization windows for the signed-in Claude subscription, from Claude Code's /usage data. Refreshes whenever a session goes idle, and on demand.",
			planUsageLoading: "Loading…",
			planUsageRefresh: "Refresh usage",
			planUsageRefreshing: "Refreshing…",
			planUsageUnavailable: "This account has no plan limits (API key, Bedrock, and Vertex sessions are not rate limited by a subscription).",
			planUsageNever: "No usage data yet — run a turn or refresh.",
			planUsageError: "Usage lookup failed",
			planUsageSubscription: "Subscription",
			planUsageUpdated: "Updated {age} ago",
			planUsageResets: "Resets in {age}",
			planUsageUsed: "{percent}% used",
			planWindow_five_hour: "5-hour",
			planWindow_seven_day: "All models · weekly",
			planWindow_seven_day_opus: "Opus · weekly",
			planWindow_seven_day_sonnet: "Sonnet · weekly",
			repositoryOpen: "Show repository and pull request details",
			repositoryPanel: "Repository status",
			repositoryClose: "Close repository panel",
			repositorySection: "Repository",
			repositoryStatus: "Status",
			repositoryAvailable: "Available",
			repositoryUnavailable: "Repository status unavailable",
			repositoryNotGit: "Not a Git repository",
			repositoryCwd: "Session directory",
			repositoryRoot: "Repository root",
			repositoryBranch: "Branch",
			repositoryBranchSearch: "Search branches",
			repositoryBranchSearchEmpty: "No matching branches",
			repositoryBranchRefresh: "Refresh remote branches",
			repositoryBranchRefreshing: "Refreshing remote branches…",
			repositoryBranchRefreshed: "Refreshed · {count} branches",
			repositoryBranchRefreshFailed: "Could not refresh remote branches",
			repositoryBranchRefreshStale: "The Host process is still running the previous plugin build, which has no refresh route. Restart DSH and try again.",
			repositoryBranchesLoading: "Loading branches…",
			repositoryProgressTitle: "Creating Worktree",
			repositoryProgressFailed: "Worktree creation failed",
			repositoryProgressDismiss: "Dismiss Worktree progress",
			repositoryProgress_inspecting: "Checking repository and branch",
			repositoryProgress_fetching: "Refreshing remote references",
			repositoryProgress_summarizing: "Naming the branch after the request",
			"repositoryProgress_creating-worktree": "Creating branch and Worktree",
			"repositoryProgress_saving-worktree": "Saving Worktree state",
			"repositoryProgress_switching-branch": "Switching local branch",
			"repositoryProgress_creating-workspace": "Creating DSH Workspace",
			"repositoryProgress_starting-session": "Starting Claude session",
			"repositoryProgress_transferring-draft": "Transferring message and attachments",
			repositoryProgress_submitting: "Submitting message",
			repositorySessionUnavailable: "The target session could not be prepared.",
			repositoryDraftTransferFailed: "Draft attachments could not be moved to the worktree session.",
			repositoryDetached: "Detached HEAD",
			repositoryUnknownBranch: "Unknown branch",
			repositoryWorktree: "Worktree",
			repositoryWorktreeLabel: "Git worktree",
			repositoryChanges: "Changes",
			repositoryModified: "Modified",
			repositoryClean: "Clean",
			repositoryLocal: "Local repository",
			repositoryPullRequest: "Pull request",
			repositoryNoPr: "No pull request for this branch",
			repositoryPr: "PR #{number}",
			repositoryPrDraft: "Draft PR #{number}",
			repositoryPrState: "PR state",
			repositoryDraft: "Draft",
			repositoryState_open: "Open",
			repositoryState_closed: "Closed",
			repositoryState_merged: "Merged",
			repositoryMergedAgo: "{age} ago",
			repositoryChecks: "Checks",
			repositoryChecks_passing: "Checks passing",
			repositoryChecks_pending: "Checks pending",
			repositoryChecks_failing: "Checks failing",
			repositoryChecks_none: "No checks",
			repositoryReview: "Review",
			repositoryReview_approved: "Approved",
			"repositoryReview_changes-requested": "Changes requested",
			"repositoryReview_review-required": "Review required",
			repositoryReview_none: "No review status",
			repositoryMergeState: "Merge state",
			repositoryOpenPr: "Open PR #{number} in browser",
			yes: "Yes",
			no: "No",
			diffOpen: "View branch changes",
			diffTabTitle: "Branch changes",
			planPanelTitle: "Plan",
			planClose: "Close plan panel",
			planOpen: "View plan",
			planNth: "{index} / {total}",
			planHistory: "Plans in this session",
			planNotePlaceholder: "What should change? Enter files a note, ⌘/Ctrl+Enter sends",
			planNoteQuotedPlaceholder: "What should change about the selected passage?",
			planNoteHint: "Select a passage above to quote it",
			planNoteRemove: "Remove this note",
			planQuoteClear: "Clear the quote",
			planSendForChanges: "Send for changes",
			planSending: "Sending…",
			planSettled: "This plan was already decided in the approval dialog; the notes were not sent.",
			planFeedbackFailed: "The notes could not be sent. Try again.",
			planPending: "Awaiting approval",
			planApproved: "Approved",
			planRejected: "Rejected",
			planEmpty: "This session has no plan to read yet.",
			planPendingHint: "Approve or reject this plan in the DSH approval dialog.",
			diffClose: "Close diff panel",
			promptSource: "Prompts",
			promptSave: "Save as a prompt",
			promptSaveName: "Name",
			promptSaveNaming: "Naming it…",
			promptRefine: "Rewrite with AI",
			promptRefineBusy: "Rewriting…",
			promptRefineUndo: "Put the original back",
			promptRefineFailed: "Could not rewrite: {message}",
			promptSaveConfirm: "Save",
			promptSaveCancel: "Cancel",
			promptSaveDone: "Got it",
			promptSaved: "Saved as \"{name}\"",
			promptSaveExists: "A prompt with that name already exists. Try another.",
			promptSaveFailed: "Could not save: {message}",
			promptManage: "Manage prompts",
			promptManageLoading: "Loading…",
			promptManageEmpty: "No saved prompts yet.",
			promptDelete: "Delete",
			promptDeleteNamed: "Delete \"{name}\"",
			promptDeleteConfirm: "Delete \"{name}\"?",
			promptDeleteFailed: "Could not delete: {message}",
			permissionMode: "Permission mode",
			permissionModeAria: "Permission mode: {name}",
			permissionModePlan: "Plan",
			permissionModePlanHint: "Read-only exploration; the plan comes back for your approval before anything runs",
			permissionModeDefault: "Default",
			permissionModeDefaultHint: "Every file edit and command asks first",
			permissionModeAcceptEdits: "Accept edits",
			permissionModeAcceptEditsHint: "File edits go through on their own; commands still ask",
			permissionModeDontAsk: "Don't ask",
			permissionModeDontAskHint: "Anything not pre-approved is refused instead of asked about",
			permissionModeAuto: "Auto",
			permissionModeAutoHint: "Claude Code's classifier approves on your behalf and asks you only when unsure",
			permissionModeAutoUnsupported: "The current model does not support auto mode",
			permissionModeBypass: "Bypass permissions",
			permissionModeBypassHint: "Skip every permission check",
			permissionModeLocked: "The permission mode cannot change while a turn is running",
			permissionModeFailed: "Could not switch the permission mode: {message}",
			permissionModeHostKept: "DSH kept its own access preset; Claude still runs the chosen mode",
			permissionBypassTitle: "Skip every permission check?",
			permissionBypassDescription: "Claude Code will run file edits and commands without asking for approval.",
			permissionBypassAcknowledge: "I understand the risk",
			permissionBypassCancel: "Cancel",
			permissionBypassClose: "Close",
			permissionBypassConfirm: "Enable",
			presetHeaderHint: "The agent preset this session runs",
			presetClaudeDescription: "Use the local Claude Code as the complete agent runtime inside DSH.",
			diffRepository: "Repository",
			repositoryLinked: "Linked repository: changed by this session",
			linkedRepositoryPrompt: "The following concerns the linked repository at {root} (branch {branch}), not this session's own checkout.",
			diffFiles: "{count} modified file(s)",
			diffFilesShort: "{count} files",
			diffTruncated: "The diff exceeds the safe display limit. Use the terminal to inspect the complete content.",
			diffEmpty: "No tracked file changes to display",
			diffElided: "Skipped {count} oversized file(s): {files}",
			diffCommentPrevious: "Previous comment",
			diffCommentNext: "Next comment",
			diffCommentPosition: "Comment {index} of {total}",
			diffCommentCounter: "{index}/{total}",
			diffCardExpand: "Show {count} more lines",
			diffCardCollapse: "Show less",
			diffExpandAll: "Expand all files",
			diffCollapseAll: "Collapse all files",
			diffCommit: "Commit",
			diffRevertAll: "Revert all",
			diffRevertConfirmAction: "Revert",
			diffRevertFile: "Revert this file",
			diffRevertFileNamed: "Revert {path}",
			diffRevertFileConfirm: "Discard the uncommitted changes to {path}? This cannot be undone.",
			diffRevertAllConfirm: "Discard the uncommitted changes in all {count} files? New files are deleted. This cannot be undone.",
			diffRevertCompleted: "Reverted {count} file(s)",
			diffRevertNothing: "There are no uncommitted changes to revert; these are already committed.",
			diffCommitMenu: "Open commit actions",
			diffCommitPush: "Commit & Push…",
			diffPush: "Push",
			diffCreatePr: "Create PR…",
			diffConfirmDescription: "Confirm the repository snapshot and Git operation.",
			diffPushDescription: "Push local commits to the remote branch.",
			diffPushAhead: "{count} unpushed commit(s)",
			diffPushCompleted: "Pushed commit {commit}",
			diffGeneratingMessage: "Suggesting a commit message. It only fills the fields you leave empty.",
			diffLoadingPreview: "Loading repository changes…",
			diffCommitMessagePlaceholder: "Describe what changed…",
			diffCommitMessageHint: "Start with a short summary. Add details after a blank line.",
			diffActionFailed: "Repository action failed.",
			diffIncludeUnstaged: "Include unstaged and untracked changes",
			diffCommitMessage: "Commit message",
			diffStaged: "Staged",
			diffUnstaged: "Unstaged",
			diffStagedUnstaged: "Staged + unstaged",
			diffUntracked: "Untracked",
			diffPrTitle: "PR title",
			diffPrBase: "Base branch",
			diffPrBaseDefault: "Use the remote default branch",
			diffPrDescription: "PR description (Summary and Changes only)",
			diffPrDraft: "Create as a Draft PR",
			diffCancel: "Cancel",
			diffConfirm: "Confirm",
			diffSubmitting: "Working…",
			diffDone: "Done",
			diffCommitCompleted: "Created commit {commit}",
			diffPrCompleted: "Created the pull request — open it from the repository bar.",
			diffCommitPreserved: "Local commit {commit} was preserved.",
			diffMergePr: "Merge",
			repositoryMergeMenu: "Open merge options",
			diffMerge_merge: "Create a merge commit",
			diffMerge_squash: "Squash and merge",
			diffMerge_rebase: "Rebase and merge",
			diffMergeDescription: "Merge the pull request for this branch with the selected method.",
			diffMergeAdmin: "Merge as administrator (bypass branch protection)",
			diffMergeCompleted: "Merged PR #{number}",
			diffUpdateBranch: "Update branch…",
			repositoryUpdateBranch: "Update branch",
			diffUpdateBranchDescription: "Update the current branch from origin/{base} and push; hand any conflicts to Claude.",
			diffUpdateBranch_rebase: "Rebase onto origin/{base} (rewrites history, pushes with --force-with-lease)",
			diffUpdateBranch_merge: "Merge origin/{base} into the current branch",
			diffUpdateBranchBehind: "{count} commit(s) behind origin/{base}",
			diffUpdateBranchCompleted: "Updated and pushed commit {commit}",
			diffUpdateBranchConflicts: "The update left conflicts in these files:",
			diffUpdateBranchResolve: "Have Claude resolve the conflicts",
			conflictTitle: "Resolve conflicts",
			conflictOperation_rebase: "Rebase",
			conflictOperation_merge: "Merge",
			"conflictOperation_cherry-pick": "Cherry-pick",
			conflictOperation_revert: "Revert",
			conflictBadge: "{operation}: {count} conflict(s)",
			conflictBadgeReady: "Continue {operation}",
			conflictDescription: "The {operation} is unfinished. Resolve the conflicts and continue, or abort to return to the state before it.",
			conflictFiles: "These files conflict and must be resolved and staged:",
			conflictReady: "Every conflict is resolved. The operation can continue.",
			conflictResolve: "Have Claude resolve the conflicts",
			conflictContinue: "Continue {operation}",
			conflictAbort: "Abort {operation}",
			conflictAbortConfirm: "Press \"Abort {operation}\" again to confirm: work done during the {operation} is discarded.",
			conflictPush: "Push once it finishes",
			conflictContinued: "{operation} finished",
			conflictPushed: "{operation} finished and pushed",
			conflictAborted: "Aborted the {operation}",
			repositoryChecksOpen: "Show failing checks",
			checksCardTitle: "Failing checks",
			checksCardLoading: "Loading check details…",
			checksCardEmpty: "No failure details available",
			checksCardFix: "Have Claude fix these",
			prCommentsButton: "GitHub comments ({count})",
			prCommentsSend: "Have Claude address the GitHub pull request comments",
			autoFixLabel: "Auto fix",
			autoFixTitle: "Watch this pull request for review comments and failing checks, hand them to Claude to fix and push until everything passes; uncheck to stop.",
			heroTicket: "Ticket",
			heroTicketMenu: "Pick a Jira ticket",
			heroTicketSearch: "Search tickets or enter a key…",
			heroTicketLoading: "Searching…",
			heroTicketEmpty: "No matching tickets",
			heroTicketNone: "Clear selected tickets",
			heroTicketRemove: "Remove {key}",
			heroTicketCount: "{count} tickets",
			heroBatchStarted: "Kicked off {count} tickets, each in its own worktree session",
			heroTicketNotConnected: "Connect Jira in Settings first",
			heroTicketFailed: "Ticket search failed",
			jiraTitle: "Jira",
			jiraBody: "Connect Jira Cloud to start new sessions from a ticket: the branch is named after the ticket key, the composer is seeded with the ticket brief, and the ticket is assigned to you once the worktree exists.",
			jiraSite: "Site URL",
			jiraSitePlaceholder: "https://your-team.atlassian.net",
			jiraEmail: "Account email",
			jiraToken: "API token",
			jiraTokenHelp: "Create an API token at Atlassian",
			jiraConnect: "Connect",
			jiraConnecting: "Verifying…",
			jiraDisconnect: "Disconnect",
			jiraConnected: "Connected",
			jiraLoading: "Loading Jira status…",
			jiraError: "Jira request failed",
			cleanupButton: "Clean up",
			cleanupTitle: "Clean up merged branch",
			cleanupDescription: "Remove the worktree and local branch, then archive the workspace sessions and delete the workspace; a plain checkout switches back to the base branch and deletes the merged branch.",
			cleanupCompleted: "Cleaned up {branch}",
			cleanupDescriptionUnmerged: "This worktree has no pull request. Remove the worktree and local branch, then archive the workspace sessions and delete the workspace; refused while the branch holds commits that are on no remote.",
			askToolbar: "Selection actions",
			askTooltip: "Ask about this",
			copyTooltip: "Copy",
			askCopied: "Copied",
			askPlaceholder: "Ask about the selected text…",
			askSubmit: "Ask",
			askStarting: "Starting Claude…",
			askThinking: "Thinking…",
			askThinkingLive: "Thinking ·",
			askThinkingLabel: "Think ·",
			askCopyAnswer: "Copy answer",
			askSendToChat: "Send to chat",
			askClose: "Close",
			askFailed: "The question could not be answered",
			reviewCommentAdd: "Add line comment",
			reviewCommentPlaceholder: "Request changes",
			reviewCommentSubmit: "Comment",
			reviewCommentCancel: "Cancel",
			reviewCommentRemove: "Remove comment",
			reviewThreadReply: "Reply",
			reviewThreadSendToAi: "Send to AI",
			reviewThreadBot: "Bot",
			reviewThreadAgo: "{age} ago",
			reviewThreadReplyTo: "Reply to @{author}",
			reviewThreadOpenOnGitHub: "Open on GitHub",
			reviewThreadSend: "Send reply",
			reviewThreadResolve: "Resolve",
			reviewThreadUnresolve: "Unresolve",
			reviewThreadResolved: "Resolved",
			reviewThreadOutdated: "Outdated",
			reviewThreadReplyPlaceholder: "Reply to this comment; type @ to mention someone",
			reviewThreadMention: "Mention a repository member",
			reviewThreadReplyFailed: "The reply could not be posted.",
			reviewThreadResolveFailed: "The thread could not be updated.",
			reviewCommentFailed: "The comment could not be saved.",
			reviewCommentsClear: "Clear all comments",
			reviewCommentsSend: "Send comments",
			reviewCommentsSendDraft: "Please address the attached review comments.",
			reviewCommentOldSide: "Old line {line}",
			reviewCommentNewSide: "Line {line}",
			reviewCommentOldRange: "Old lines {start}–{end}",
			reviewCommentNewRange: "Lines {start}–{end}",
			diffUnmodifiedLines: "{count} unmodified lines",
			diffUnmodifiedTail: "More unmodified lines below",
			diffExpandUp: "Expand up",
			diffExpandDown: "Expand down",
			diffFileComments: "{count} comments",
			rewindTooltip: "Rewind to here",
			rewindTitle: "Rewind to before this message",
			rewindDescription: "This removes the message and the {count} entries below it, and returns Claude to the context it had before you sent it. This cannot be undone.",
			rewindHint: "The removed entries are hidden from this session and Claude forgets them; the message text goes back to the composer so you can edit and resend it.",
			rewindConfirm: "Delete and rewind",
			rewindSubmitting: "Rewinding…",
			rewindFailed: "The rewind failed ({code}).",
			rewindBusy: "This session is running; wait for the turn to finish before rewinding.",
			rewindStale: "The Host process is still running the previous plugin build, which has no rewind route. Restart DSH and try again.",
			rewindRestoreFiles: "Also put the files back to where this turn found them",
			rewindRestoreFilesHint: "The removed entries are hidden from this session and Claude forgets them, and the checkout returns to the state this turn started from — files created since are deleted, changed files are restored, and files ignored by .gitignore are left alone. The message text goes back to the composer so you can edit and resend it.",
			rewindFilesUnavailable: "The conversation was rewound, but the files were left alone: that turn recorded no working-tree snapshot.",
			turnUsage: "Turn usage",
			turnUsageTokens: "{count} tok",
			turnUsageCache: "Cache hit {percent}%",
			turnUsageTtft: "TTFT {duration}",
			turnUsageCost: "${cost} total",
			toolBackground: "Move to background",
			toolBackgrounding: "Moving…",
			teamTitle: "Team",
			teamTrigger: "Agent Team",
			teamMembers: "Members",
			teamLead: "Current chat",
			teamLeadIdle: "Inactive",
			teamTaskOwner: "Owner {owner}",
			teamTaskUnowned: "Unowned",
			teamTaskBlockedBy: "Blocked by {tasks}",
			teamTasks: "Shared tasks",
			teamNoTasks: "No shared tasks yet",
			teamMessages: "Messages",
			teamNoMessages: "No messages yet",
			teamStatusRunning: "Running",
			teamStatusCompleted: "Completed",
			teamStatusFailed: "Failed",
			teamStatusStopped: "Stopped",
			teamStatusKilled: "Killed",
			teamTaskPending: "Pending",
			teamTaskInProgress: "In progress",
			teamTaskCompleted: "Completed",
			teammatePanelTitle: "Teammate",
			teammateOpen: "Open teammate {name}",
			fileMentionOpen: "Open {name} in the sidebar",
			teammateClose: "Close teammate panel",
			teammateGone: "This teammate is no longer on the task board",
			teammateBrief: "Brief",
			teammateToolUses: "{count} tool calls",
			teammateResult: "Report",
			teammateWorking: "Working, no output yet"
		};
		//#endregion
		//#region src/client/preset-seat-mark.ts
		/** Flags the Host's agent-preset seat while it names the Claude preset.
		*
		*  The seat is a `single` slot whose occupant owns the whole picker — menu,
		*  staging, the intro animation. Shadowing it to change one glyph would mean
		*  reimplementing all of that, so the glyph is swapped in CSS instead. CSS
		*  cannot read the seat's text, though, and the seat names whichever preset is
		*  currently staged, so the brand mark would otherwise land on `standard` or
		*  `cordis` too. This bridge supplies the one bit CSS is missing.
		*
		*  Keyed on the seat icon's CSS Module local name plus `aria-haspopup`, both of
		*  which fail open: a Host rename leaves the attribute unset and the stock
		*  glyph in place.
		*/
		/** Attribute the stylesheet keys the mark swap off. */
		const CLAUDE_SEAT_ATTRIBUTE = "data-dsh-claude-preset";
		const SEAT_SELECTOR = "button[aria-haspopup=\"menu\"]";
		const SEAT_ICON_SELECTOR = "[class*=\"seatIcon\"]";
		/**
		* Set or clear the flag on every preset seat currently in the tree.
		* @param root - subtree to sweep; the document by default.
		*/
		function markClaudePresetSeats(root) {
			for (const icon of root.querySelectorAll(SEAT_ICON_SELECTOR)) {
				const seat = icon.closest(SEAT_SELECTOR);
				if (seat === null) continue;
				if (isClaudePresetText(seat.textContent ?? "")) seat.setAttribute(CLAUDE_SEAT_ATTRIBUTE, "");
				else seat.removeAttribute(CLAUDE_SEAT_ATTRIBUTE);
			}
		}
		/** Every spelling the Claude preset's description can currently have in the
		*  tree: the published English, or a translation this bridge already wrote
		*  before the locale changed. */
		const DESCRIPTION_VARIANTS = /* @__PURE__ */ new Set([
			CLAUDE_PRESET_DESCRIPTION,
			en.presetClaudeDescription,
			zh.presetClaudeDescription
		]);
		/**
		* Translate the Claude preset's description where the Host's preset menu
		* renders it. The Host resolves only its own presets' copy through the locale
		* dictionaries and prints a third-party preset's metadata verbatim, and no
		* public hook reaches that menu, so the text node itself is rewritten. It
		* fails open: a Host that renders the copy differently keeps the English.
		* @param root - subtree to sweep.
		* @param text - the description in the active locale.
		*/
		function localizeClaudePresetDescription(root, text) {
			for (const menu of root.querySelectorAll("[role=\"menu\"], [role=\"listbox\"], [role=\"dialog\"], [role=\"tooltip\"]")) {
				const walker = menu.ownerDocument.createTreeWalker(menu, 4);
				for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
					const value = node.nodeValue ?? "";
					const trimmed = value.trim();
					if (trimmed === text || !DESCRIPTION_VARIANTS.has(trimmed)) continue;
					node.nodeValue = value.replace(trimmed, text);
				}
			}
		}
		/** Keep the flag, and the translated description, in step with the Host's
		*  own re-renders.
		*  @param description - the Claude preset description in the active locale.
		*  @returns a disposer that stops observing and clears every flag it set. */
		function trackClaudePresetSeats(description) {
			if (typeof document === "undefined" || typeof window === "undefined" || typeof MutationObserver === "undefined") return () => {};
			let frame;
			const schedule = () => {
				if (frame !== void 0) return;
				frame = window.requestAnimationFrame(() => {
					frame = void 0;
					markClaudePresetSeats(document);
					if (description !== void 0) localizeClaudePresetDescription(document, description());
				});
			};
			const observer = new MutationObserver(schedule);
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true
			});
			markClaudePresetSeats(document);
			if (description !== void 0) localizeClaudePresetDescription(document, description());
			return () => {
				observer.disconnect();
				if (frame !== void 0) window.cancelAnimationFrame(frame);
				for (const seat of document.querySelectorAll(`[${CLAUDE_SEAT_ATTRIBUTE}]`)) seat.removeAttribute(CLAUDE_SEAT_ATTRIBUTE);
			};
		}
		const HOST_CHROME_CSS = `button[class*="sessionLogButton"],button[class*="moreButton"][aria-haspopup="menu"]{display:none}${["header:has(.dsh-claude-header-diff) [role=\"tablist\"]{display:none}", "header:has(.dsh-claude-header-diff){padding-bottom:10px}"].join("")}${[
			`button[${CLAUDE_SEAT_ATTRIBUTE}]>[class*="seatIcon"]{display:none}`,
			`button[${CLAUDE_SEAT_ATTRIBUTE}]::before{content:"";flex:none;width:16px;height:16px;`,
			`background:${claudeMarkUrl()} center/contain no-repeat}`
		].join("")}${[`[class*="_tools"]:has(.${permissionSelectClass}) [data-slot="conversation.input.permission"]{display:none!important}`, `[class*="_tools"]:has(.${permissionSelectClass}) [class*="_modes"]>*:has(span[class*="_triggerLabel"]){display:none!important}`].join("")}header:has(.dsh-claude-team-root) [data-team-action]{display:none}`;
		/** Install the stylesheet and the one DOM flag it depends on.
		*  @returns a disposer that removes both again. */
		function restyleHostChrome(presetDescription) {
			if (typeof document === "undefined") return () => {};
			const element = document.createElement("style");
			element.dataset.dshClaudeHostChrome = "";
			element.textContent = HOST_CHROME_CSS;
			document.head.appendChild(element);
			const untrack = trackClaudePresetSeats(presetDescription);
			return () => {
				untrack();
				element.remove();
			};
		}
		//#endregion
		//#region src/client/main-session.ts
		/** The Session in the main view, or undefined on the blank screen.
		*
		*  Host 0.1.7 dropped `current` from the session list: the main view now holds
		*  its Session through a `mainView` retain, and the Host's own sidebar finds
		*  the on-screen Session the same way. */
		function mainSessionId(list) {
			for (const [id, row] of Object.entries(list.byId)) if ((row?.retainedBy?.mainView ?? 0) > 0) return id;
		}
		//#endregion
		//#region src/client/session-handoff.ts
		/** Retain a Session this plugin just created so its scope can be borrowed.
		*
		*  Host 0.1.7 hands out `sessions.scope()` only for a retained generation; a
		*  Session created through `connectWorkspace` has no holder until the main
		*  view opens it, so the worktree hand-off borrowed nothing and failed with
		*  "could not prepare the target session". */
		async function retainForHandoff(sessions, id) {
			const reference = sessions.retain(id, { source: "claudeWorktreeHandoff" });
			try {
				await reference.ready;
			} catch (error) {
				reference.release();
				throw error;
			}
			return reference;
		}
		/** Release the hand-off's hold once the Host has taken the submitted draft.
		*
		*  `submit()` returns before the message leaves the Client, and the last
		*  release tears the scope down, aborting a submission still in flight. The
		*  draft counts as taken once the Session runs or its pending submission
		*  drains; the timeout bounds a Host that reports neither. */
		function releaseAfterSubmission(reference, timeoutMs = HANDOFF_HOLD_BUDGET_MS) {
			const session = reference.binding.session;
			let sawPending = false;
			let released = false;
			let unsubscribe = () => {};
			let timer;
			const release = () => {
				if (released) return;
				released = true;
				unsubscribe();
				if (timer !== void 0) clearTimeout(timer);
				reference.release();
			};
			const taken = () => {
				const snapshot = session.getSnapshot();
				const pending = snapshot.pendingSubmissions?.length ?? 0;
				if (pending > 0) sawPending = true;
				return snapshot.running === true || sawPending && pending === 0;
			};
			unsubscribe = session.subscribe(() => {
				if (taken()) release();
			});
			timer = setTimeout(release, timeoutMs);
			if (taken()) release();
		}
		//#endregion
		//#region src/client/index.tsx
		const name = "dsh-claude-client";
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.agentPresets",
			"remote.workspaceFiles",
			"sessions",
			"uiSession",
			"uiConversation",
			"workspaces",
			"inputTriggers",
			"conversation",
			"connection",
			"sidebarRight",
			"sidebarRightTabs"
		];
		/** Resolve one session's composer facade.
		*
		*  `sessions.scope()` returns the client runtime's AgentContext, and the
		*  conversation package -- a release ahead of the runtime in the graph the Host
		*  itself ships -- types `input.for` against a Context whose `remote` has since
		*  gained `$stream` and `$host`. It is the same object at runtime; only the two
		*  declarations disagree, and they disagree inside the Host too, so the cast
		*  lives here once instead of at all nine call sites. */
		function sessionInput(conversation, scope) {
			return conversation.input.for(scope);
		}
		function apply(ctx) {
			const namespace = "settings.claude-code";
			const diagnostics = createClaudeDiagnosticsReporter();
			for (const finding of claudeBootCheckFindings({
				services: [...inject, "uiWorkspace"],
				resolve: (name) => ctx.get(name)
			})) diagnostics.report("boot-check", finding);
			ctx.effect(() => watchClaudeComposerBar((finding) => {
				diagnostics.report("boot-check", finding);
			}), "dsh-claude: composer style drift probe");
			ctx.effect(() => ctx.locale.register(namespace, {
				zh,
				en
			}), "dsh-claude: client copy");
			const t = ctx.locale.bind(namespace);
			ctx.effect(() => restyleHostChrome(() => t("presetClaudeDescription")), "dsh-claude: Host chrome restyling");
			pluginRead(CLAUDE_GLOBAL_SETTINGS_PATH, "fast").then((payload) => {
				if (!isGlobalSettingsView(payload)) return;
				applyClaudeMarkdownTheme(proseModeOf(payload.settings));
			}).catch(() => {});
			const projections = new ClaudeProjectionStore({ report: (kind, detail) => {
				diagnostics.report(kind, detail);
			} });
			ctx.effect(() => ctx.inputTriggers.registerSource(createClaudeCommandSource(ctx, projections)), "dsh-claude: Claude slash source");
			ctx.effect(() => ctx.inputTriggers.registerSource(createClaudePromptSource(t("promptSource"))), "dsh-claude: Claude prompt source");
			const sessions = ctx.get("sessions");
			const workspaces = ctx.get("workspaces");
			const uiWorkspace = ctx.get("uiWorkspace");
			const connectWorkspace = uiWorkspace?.connectWorkspace?.bind(uiWorkspace);
			const openSession = (id) => {
				uiWorkspace?.openSession?.(id);
			};
			if (workspaces !== void 0) ctx.effect(() => {
				let known = new Set(workspaces.list.getSnapshot().items.map((item) => item.workspaceId));
				return workspaces.list.subscribe(() => {
					const next = new Set(workspaces.list.getSnapshot().items.map((item) => item.workspaceId));
					const removed = [...known].some((id) => !next.has(id));
					known = next;
					if (removed) sweepWorktrees().catch(() => void 0);
				});
			}, "dsh-claude: worktree sweep on workspace deletion");
			const conversation = ctx.get("conversation");
			const connection = ctx.get("connection");
			const remote = ctx.get("remote");
			/** Composer submit hook shared by the repository feedback affordances.
			*  'append' keeps any user draft and adds the prompt below it; 'idle'
			*  submits only when the composer is empty and reports false otherwise. */
			const submitPromptFor = (sessionId) => {
				if (sessions === void 0 || conversation === void 0) return void 0;
				return (draft, mode = "append") => {
					const scope = sessions.scope(sessionId);
					if (scope === void 0) return false;
					const input = sessionInput(conversation, scope);
					const current = input.state.getSnapshot().draft;
					if (current.trim() === "") input.setDraft(draft);
					else if (mode === "append") input.setDraft(`${current}\n\n${draft}`);
					else return false;
					input.submit();
					return true;
				};
			};
			const uiSession = ctx.get("uiSession");
			if (uiSession !== void 0) ctx.effect(() => uiSession.provide({
				hooks: ["claudeProjection"],
				resolve: (binding) => ({ hooks: { claudeProjection: projections.source(binding.sessionId) } })
			}), "dsh-claude: sidecar projection provider");
			ctx.effect(() => () => projections.dispose(), "dsh-claude: sidecar projection lifecycle");
			const uiConversation = ctx.get("uiConversation");
			if (uiConversation !== void 0) {
				ctx.effect(() => uiConversation.events.register(claudeTurnDefinition), "dsh-claude: Claude turn marker");
				ctx.effect(() => uiConversation.events.register(claudeActivityStepDefinition), "dsh-claude: Claude activity flow node");
			}
			const fileSources = /* @__PURE__ */ new Map();
			const filesFor = (sessionId) => {
				const workspaceFiles = remote?.workspaceFiles;
				if (workspaceFiles === void 0) return void 0;
				let source = fileSources.get(sessionId);
				if (source === void 0) {
					source = {
						exists: cachedExists(async (path) => (await workspaceFiles.stat(sessionId, path)).ok),
						open: (path, line) => ctx.sidebarRight.openResourceIn(sessionId, sessionFileAddress(sessionId, path), line === void 0 ? void 0 : { params: { line } })
					};
					fileSources.set(sessionId, source);
				}
				return source;
			};
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "claude-activity-step",
				locale: namespace,
				inject: (sessionId) => {
					const files = filesFor(sessionId);
					return {
						backgroundCall: (toolUseId) => backgroundToolCall(sessionId, toolUseId),
						...files === void 0 ? {} : { files }
					};
				}
			}, ClaudeActivityNode));
			const sidebarTabs = registerClaudeSidebarTabs(ctx, {
				t,
				namespace,
				diffFace: (sessionId) => {
					const submitPrompt = submitPromptFor(sessionId);
					return submitPrompt === void 0 ? {} : { submitPrompt };
				}
			});
			const openDiffPanel = (sessionId, initialRoot) => {
				sidebarTabs.open(CLAUDE_TAB_KINDS.diff, sessionId, initialRoot === void 0 ? {} : { initialRoot });
			};
			ctx.effect(() => ctx.slots.onEntryError((key, entry, error) => {
				const label = "options" in entry ? entry.options.id : entry.name;
				const id = label === void 0 ? "" : ` id="${String(label)}"`;
				const message = error instanceof Error ? `${error.message}
		${error.stack ?? ""}` : String(error);
				diagnostics.report("slot-entry-crashed", `slot "${key}"${id}: ${message}`);
			}), "dsh-claude: Slot entry failure reporting");
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				id: "claude-activity-tail",
				inject: () => ({ t })
			}, ClaudeActivityTail));
			if (remote !== void 0) {
				const roster = new AgentPresetRoster(remote.agentPresets);
				const hostT = ctx.locale.bind("settings.agentPreset");
				ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
					name: "conversation.session.header.actions",
					id: "agent-preset",
					order: -10,
					priority: -10,
					locale: namespace,
					inject: () => ({
						t,
						hostT: (key) => hostT(key),
						roster: {
							subscribe: roster.subscribe,
							getSnapshot: roster.getSnapshot,
							load: () => roster.load()
						}
					})
				}, ClaudeAgentPresetLabel));
			}
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "claude-team",
				order: -19,
				locale: namespace,
				inject: (sessionId) => ({
					t,
					openTeammate: (taskId) => {
						sidebarTabs.open(CLAUDE_TAB_KINDS.teammate, sessionId, { teammate: taskId });
					}
				})
			}, ClaudeTeamHeaderAction));
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "claude-plan",
				order: 29,
				locale: namespace,
				inject: (sessionId) => ({
					t,
					togglePlan: () => {
						sidebarTabs.toggle(CLAUDE_TAB_KINDS.plan, sessionId, {});
					},
					planOpen: sidebarTabs.sourceFor(CLAUDE_TAB_KINDS.plan, sessionId)
				})
			}, ClaudePlanHeaderAction));
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "claude-diff",
				order: 30,
				locale: namespace,
				inject: (sessionId) => ({
					t,
					toggleDiff: () => {
						sidebarTabs.toggle(CLAUDE_TAB_KINDS.diff, sessionId, {});
					},
					diffOpen: sidebarTabs.sourceFor(CLAUDE_TAB_KINDS.diff, sessionId)
				})
			}, ClaudeDiffHeaderAction));
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "claude-permission-mode",
				order: 30,
				locale: namespace,
				inject: (sessionId) => {
					const scope = sessions?.scope(sessionId);
					return {
						t,
						setMode: (mode) => setClaudePermissionMode(sessionId, mode),
						...scope === void 0 || conversation === void 0 ? {} : { notify: (level, text) => {
							sessionInput(conversation, scope).notify(level, text);
						} }
					};
				}
			}, ClaudePermissionSelect));
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "claude-prompt-suggestion",
				order: 90,
				locale: namespace,
				inject: (sessionId) => {
					const report = (detail) => {
						diagnostics.report("prompt-suggestion", detail);
					};
					const scope = sessions?.scope(sessionId);
					if (scope === void 0 || conversation === void 0) return { report };
					const facade = sessionInput(conversation, scope);
					return {
						report,
						acceptDraft: (text) => {
							facade.setDraft(text);
						}
					};
				}
			}, ClaudePromptSuggestion));
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "claude-prompt-save",
				order: 40,
				locale: namespace,
				inject: () => ({ t })
			}, ClaudePromptSaveAction));
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "claude-prompt-refine",
				order: 41,
				locale: namespace,
				inject: (sessionId) => {
					if (sessions === void 0 || conversation === void 0) return { t };
					const scope = sessions.scope(sessionId);
					if (scope === void 0) return { t };
					const facade = sessionInput(conversation, scope);
					return {
						t,
						replaceDraft: (text) => {
							facade.setDraft(text);
						},
						notify: (level, text) => {
							facade.notify(level, text);
						}
					};
				}
			}, ClaudePromptRefineAction));
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "claude-review-comments",
				order: 18,
				locale: namespace,
				inject: (sessionId) => ({
					t,
					sessionId,
					...sessions === void 0 || conversation === void 0 ? {} : { submitWith: (fallbackDraft) => {
						const scope = sessions.scope(sessionId);
						if (scope === void 0) return;
						const input = sessionInput(conversation, scope);
						if (input.state.getSnapshot().draft.trim() === "") input.setDraft(fallbackDraft);
						input.submit();
					} }
				})
			}, ClaudeReviewComments));
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "claude-repository-status",
				order: 20.5,
				locale: namespace,
				inject: (sessionId) => {
					const submitPrompt = submitPromptFor(sessionId);
					return {
						t,
						openDiff: (root) => openDiffPanel(sessionId, root),
						...submitPrompt === void 0 ? {} : { submitPrompt },
						...workspaces === void 0 ? {} : { deleteWorkspace: async () => {
							const workspace = workspaces.list.getSnapshot().items.find((item) => item.sessionIds.includes(sessionId));
							if (workspace === void 0) return;
							for (const id of workspace.sessionIds) await workspaces.archiveSession(id);
							await workspaces.delete(workspace.workspaceId);
						} }
					};
				}
			}, ClaudeRepositoryStatus));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "claude-selection-ask",
				locale: namespace
			}, () => /* @__PURE__ */ jsx(ClaudeSelectionAsk, {
				t,
				currentSessionId: () => sessions === void 0 ? void 0 : mainSessionId(sessions.list.getSnapshot()),
				ownsSession: (sessionId) => projections.source(sessionId).getSnapshot().owned,
				...sessions === void 0 || conversation === void 0 ? {} : { insertIntoChat: (sessionId, text) => {
					const scope = sessions.scope(sessionId);
					if (scope === void 0) return;
					const input = sessionInput(conversation, scope);
					const current = input.state.getSnapshot().draft;
					input.setDraft(current.trim() === "" ? text : `${current}\n\n${text}`);
				} }
			})));
			/** Compose the chat view the rewind control reads.
			*
			*  Desktop 2.0 split what used to be one Session snapshot: the Controller's
			*  `binding.session` kept `running`, while the assembled Chat nodes moved to
			*  the Conversation binding's 'chat' target. Reading the old combined shape
			*  threw on `snapshot.chat.order` and took the whole overlay entry down. */
			const chatSourceCache = /* @__PURE__ */ new Map();
			const claudeChatSource = (sessionId) => {
				const cached = chatSourceCache.get(sessionId);
				if (cached !== void 0) return cached;
				if (sessions === void 0 || uiConversation === void 0) return void 0;
				const session = sessions.binding(sessionId)?.session;
				if (session === void 0) return void 0;
				let chatTarget;
				try {
					chatTarget = uiConversation.binding(sessionId).target("chat");
				} catch {
					return;
				}
				let lastChat;
				let lastRunning;
				let view = EMPTY_CHAT_VIEW;
				const source = {
					subscribe(listener) {
						const dropChat = chatTarget.subscribe(listener);
						const dropSession = session.subscribe(listener);
						return () => {
							dropChat();
							dropSession();
						};
					},
					getSnapshot() {
						const chat = chatTarget.getSnapshot();
						const running = session.getSnapshot().running === true;
						if (chat === lastChat && running === lastRunning) return view;
						lastChat = chat;
						lastRunning = running;
						view = chat === void 0 ? EMPTY_CHAT_VIEW : {
							chat,
							running
						};
						return view;
					}
				};
				chatSourceCache.set(sessionId, source);
				return source;
			};
			if (sessions !== void 0) {
				const rewind = {
					t,
					currentSessionId: () => mainSessionId(sessions.list.getSnapshot()),
					subscribeSessions: (listener) => sessions.list.subscribe(listener),
					chatOf: (sessionId) => claudeChatSource(sessionId),
					projectionOf: (sessionId) => projections.source(sessionId),
					...conversation === void 0 ? {} : { setDraft: (sessionId, text) => {
						const scope = sessions.scope(sessionId);
						if (scope === void 0) return;
						sessionInput(conversation, scope).setDraft(text);
					} }
				};
				ctx.slots.inject("shell.overlay", () => ctx.slots.register({
					name: "shell.overlay",
					id: "claude-rewind",
					locale: namespace
				}, () => /* @__PURE__ */ jsx(ClaudeRewind, { ...rewind })));
			}
			if (sessions !== void 0 && workspaces !== void 0 && connectWorkspace !== void 0 && conversation !== void 0 && connection !== void 0 && remote !== void 0) {
				/** Attach a prepared worktree to its session without blocking the flow. */
				const bindLease = (leaseId, targetSessionId) => {
					if (leaseId === void 0) return;
					bindRepositoryLease(leaseId, targetSessionId).catch((reason) => {
						console.warn(`dsh-claude: could not bind the worktree lease: ${reason instanceof Error ? reason.message : String(reason)}`);
					});
				};
				/** The mode picked on the hero was recorded on the hero's session; a
				*  worktree session is a new one and would otherwise start on the default. */
				const carryPermissionMode = async (sourceSessionId, targetSessionId) => {
					const mode = projections.source(sourceSessionId).getSnapshot().permissionMode?.mode;
					if (mode !== void 0) await setClaudePermissionMode(targetSessionId, mode);
				};
				ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
					name: "conversation.input.dock",
					id: "claude-hero-repository-controls",
					order: 21,
					locale: namespace,
					inject: (sourceSessionId) => ({
						t,
						prepare: async (cwd, branch, useWorktree, onProgress, ticket) => {
							const sourceScope = sessions.scope(sourceSessionId);
							if (sourceScope === void 0) throw new Error(t("repositorySessionUnavailable"));
							const sourceInput = sessionInput(conversation, sourceScope);
							const rawDraft = sourceInput.state.getSnapshot().draft;
							const draft = ticket === void 0 ? rawDraft : rawDraft.trim() === "" ? ticketPrompt(ticket) : `${rawDraft.trimEnd()}\n\n${ticketContext(ticket)}`;
							const imageIds = sourceInput.state.getSnapshot().attachmentIds;
							const prepared = await prepareRepository(cwd, branch, useWorktree, ticket?.key, onProgress, ticket === void 0 ? draft : void 0);
							if (ticket !== void 0) assignJiraTicket(ticket.key).catch((reason) => {
								console.warn(`dsh-claude: could not assign ${ticket.key}: ${reason instanceof Error ? reason.message : String(reason)}`);
							});
							if (prepared.mode === "checkout") {
								if (draft !== rawDraft) sourceInput.setDraft(draft);
								sourceInput.submit();
								return;
							}
							onProgress("creating-workspace");
							const workspace = await workspaces.create({ path: prepared.path });
							onProgress("starting-session");
							const targetSessionId = await connectWorkspace(workspace.workspaceId);
							const reference = await retainForHandoff(sessions, targetSessionId);
							try {
								const targetScope = sessions.scope(targetSessionId);
								if (targetScope === void 0) throw new Error(t("repositorySessionUnavailable"));
								const presetResponse = await remote.agentPresets.select(targetSessionId, "claude");
								if (!presetResponse.ok) throw new Error(presetResponse.error.message);
								await carryPermissionMode(sourceSessionId, targetSessionId);
								const targetInput = sessionInput(conversation, targetScope);
								onProgress("transferring-draft");
								if (imageIds.length > 0 && !targetInput.addAttachments(imageIds)) throw new Error(t("repositoryDraftTransferFailed"));
								if (draft !== "") targetInput.setDraft(draft);
								bindLease(prepared.leaseId, targetSessionId);
								openSession(targetSessionId);
								onProgress("submitting");
								targetInput.submit();
							} catch (error) {
								reference.release();
								throw error;
							}
							releaseAfterSubmission(reference);
							sourceInput.setDraft("");
							for (const imageId of imageIds) sourceInput.removeAttachment(imageId);
						},
						prepareMany: async (cwd, branch, tickets, onProgress) => {
							const sourceScope = sessions.scope(sourceSessionId);
							if (sourceScope === void 0) throw new Error(t("repositorySessionUnavailable"));
							const sourceInput = sessionInput(conversation, sourceScope);
							const rawDraft = sourceInput.state.getSnapshot().draft;
							const failures = [];
							for (const [index, ticket] of tickets.entries()) {
								const report = (stage) => {
									onProgress({
										ticketKey: ticket.key,
										index,
										total: tickets.length,
										stage
									});
								};
								try {
									report("inspecting");
									const prepared = await prepareRepository(cwd, branch, true, ticket.key, report);
									assignJiraTicket(ticket.key).catch((reason) => {
										console.warn(`dsh-claude: could not assign ${ticket.key}: ${reason instanceof Error ? reason.message : String(reason)}`);
									});
									report("creating-workspace");
									const workspace = await workspaces.create({ path: prepared.path });
									report("starting-session");
									const targetSessionId = await connectWorkspace(workspace.workspaceId);
									const reference = await retainForHandoff(sessions, targetSessionId);
									try {
										const targetScope = sessions.scope(targetSessionId);
										if (targetScope === void 0) throw new Error(t("repositorySessionUnavailable"));
										const presetResponse = await remote.agentPresets.select(targetSessionId, "claude");
										if (!presetResponse.ok) throw new Error(presetResponse.error.message);
										await carryPermissionMode(sourceSessionId, targetSessionId);
										const targetInput = sessionInput(conversation, targetScope);
										report("transferring-draft");
										targetInput.setDraft(rawDraft.trim() === "" ? ticketPrompt(ticket) : `${rawDraft.trimEnd()}\n\n${ticketContext(ticket)}`);
										bindLease(prepared.leaseId, targetSessionId);
										report("submitting");
										targetInput.submit();
									} catch (error) {
										reference.release();
										throw error;
									}
									releaseAfterSubmission(reference);
								} catch (cause) {
									failures.push(`${ticket.key}: ${cause instanceof Error ? cause.message : String(cause)}`);
								}
							}
							if (failures.length < tickets.length) sourceInput.setDraft("");
							if (failures.length > 0) throw new Error(failures.join(" · "));
						}
					})
				}, ClaudeHeroRepositoryControls));
			}
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "claude-code",
				order: 16,
				label: () => t("nav"),
				inject: () => ({ t })
			}, ClaudeCodeSettings));
		}
		//#endregion
		module.exports.apply = apply;
		module.exports.inject = inject;
		module.exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map