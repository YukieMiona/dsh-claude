import { h as CLAUDE_CODE_PROVIDER } from "./events-CKwSqljn.mjs";
import { l as CLAUDE_COMMANDS_SERVICE, t as canonicalClaudeModelId } from "./model-catalog-XyyBnQdc.mjs";
//#region src/presenters.ts
function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function str(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function resultText(result) {
	return result.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
}
/** Bash: a terminal card headed by the command, described above by Claude's own summary. */
function bashCallView(args) {
	const command = str(record(args)?.command);
	if (command === void 0) return void 0;
	const description = str(record(args)?.description);
	return {
		card: "terminal",
		title: command,
		...description === void 0 ? {} : { description }
	};
}
function terminalResultView(_args, result) {
	const output = resultText(result);
	return output.length === 0 ? void 0 : {
		card: "terminal",
		output
	};
}
/** Read: a generic read card that follow-alongs the file window. */
function readCallView(args) {
	const arguments_ = record(args);
	const path = str(arguments_?.file_path);
	if (path === void 0) return void 0;
	const offset = typeof arguments_?.offset === "number" ? arguments_.offset : void 0;
	return {
		card: "generic",
		kind: "read",
		title: `Read ${path}`,
		locations: [{
			path,
			...offset === void 0 ? {} : { line: offset }
		}]
	};
}
function fileDiffs(args) {
	const arguments_ = record(args);
	const path = str(arguments_?.file_path);
	if (path === void 0) return void 0;
	if (Array.isArray(arguments_?.edits)) {
		const diffs = [];
		for (const edit of arguments_.edits) {
			const item = record(edit);
			const oldText = str(item?.old_string);
			const newText = str(item?.new_string);
			if (newText === void 0) continue;
			diffs.push({
				path,
				oldText: oldText ?? null,
				newText
			});
		}
		return diffs.length > 0 ? diffs : void 0;
	}
	const newText = str(arguments_?.new_string) ?? arguments_?.content;
	if (typeof newText !== "string" || newText.length === 0) return void 0;
	return [{
		path,
		oldText: str(arguments_?.old_string) ?? null,
		newText
	}];
}
/** Edit / MultiEdit / Write: inline diff cards derived from the call arguments. */
function diffCallView(args) {
	const arguments_ = record(args);
	const path = str(arguments_?.file_path);
	const diffs = fileDiffs(args);
	if (path === void 0 || diffs === void 0) return void 0;
	return {
		card: "diff",
		title: `${typeof arguments_?.new_string === "string" || Array.isArray(arguments_?.edits) ? "Edit" : "Write"} ${path}`,
		diffs,
		locations: [{ path }]
	};
}
/** Edit / MultiEdit / Write results: the same diff, again.
*
*  A completed card replaces the pending one, so a mutation that returns no
*  result view loses its diff to the raw result text. The plugin transcript
*  drops the diff on failure and shows the error instead; mirror that. */
function diffResultView(args, result) {
	if (result.isError) return void 0;
	const diffs = fileDiffs(args);
	return diffs === void 0 ? void 0 : {
		card: "diff",
		diffs
	};
}
function parsedResult(result) {
	const text = resultText(result);
	if (text.length === 0) return void 0;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
/** Grep / Glob results: the discovered paths as a search card.
*
*  Only the structured `filenames` shape is projected. A text result (Grep's
*  content mode) carries its own formatting, so it falls through to the raw
*  result content rather than being re-parsed into fake match groups. */
function searchResultView(_args, result) {
	if (result.isError) return void 0;
	const output = record(parsedResult(result));
	if (!Array.isArray(output?.filenames)) return void 0;
	const paths = output.filenames.filter((item) => typeof item === "string");
	const reported = output.numFiles;
	const total = typeof reported === "number" && Number.isInteger(reported) && reported >= paths.length ? reported : paths.length;
	return {
		card: "search",
		shape: "paths",
		paths,
		truncated: total > paths.length,
		total
	};
}
/** Grep / Glob / WebSearch: search-category cards titled by the query. */
function searchCallView(args) {
	const arguments_ = record(args);
	const query = str(arguments_?.pattern) ?? str(arguments_?.query);
	if (query === void 0) return void 0;
	const scope = str(arguments_?.path);
	return {
		card: "generic",
		kind: "search",
		title: scope === void 0 ? query : `${query} · ${scope}`,
		rawInput: args
	};
}
/** WebFetch: a fetch-category card titled by the URL. */
function fetchCallView(args) {
	const url = str(record(args)?.url);
	if (url === void 0) return void 0;
	return {
		card: "generic",
		kind: "fetch",
		title: url,
		rawInput: args
	};
}
/** ExitPlanMode: the plan itself, as prose rather than as tool arguments.
*
*  This is the one built-in tool whose whole payload is written for the user
*  to read: Claude asks to leave plan mode and the approval that follows is
*  the user agreeing to the plan. Rendering it as `Input: {"plan":"..."}`
*  buries the only thing worth reading, so the plan becomes the card body. */
function planCallView(args) {
	const plan = str(record(args)?.plan);
	return plan === void 0 ? void 0 : {
		card: "generic",
		kind: "other",
		title: "Plan ready for review",
		content: [{
			type: "text",
			text: plan
		}]
	};
}
/** Task: a subagent card titled by Claude's task description. */
function taskCallView(args) {
	const arguments_ = record(args);
	return {
		card: "generic",
		kind: "other",
		title: str(arguments_?.description) ?? str(arguments_?.subagent_type) ?? "Subagent",
		rawInput: args
	};
}
function genericTitle(title) {
	return {
		card: "generic",
		kind: "other",
		title
	};
}
function presenterDefinition(name, description, presentCall, presentResult) {
	return {
		name,
		description,
		parameters: {
			type: "object",
			properties: {}
		},
		output: {
			schema: {
				type: "object",
				properties: {}
			},
			render: () => []
		},
		execute: async () => {
			throw new Error(`dsh-claude: Claude Code owns execution of ${name}`);
		},
		...presentCall === void 0 ? {} : { presentCall },
		...presentResult === void 0 ? {} : { presentResult }
	};
}
const PRESENTATION_NOTE = "Presentation mirror of the Claude Code tool; execution is owned by Claude Code.";
/** The presentation-only registry contributed to the Claude Code preset scope. */
function claudePresenterDefinitions() {
	return [
		presenterDefinition("Bash", PRESENTATION_NOTE, bashCallView, terminalResultView),
		presenterDefinition("PowerShell", PRESENTATION_NOTE, bashCallView, terminalResultView),
		presenterDefinition("Read", PRESENTATION_NOTE, readCallView),
		presenterDefinition("Edit", PRESENTATION_NOTE, diffCallView, diffResultView),
		presenterDefinition("MultiEdit", PRESENTATION_NOTE, diffCallView, diffResultView),
		presenterDefinition("Write", PRESENTATION_NOTE, diffCallView, diffResultView),
		presenterDefinition("NotebookEdit", PRESENTATION_NOTE, (args) => {
			const path = str(record(args)?.notebook_path);
			return path === void 0 ? void 0 : genericTitle(`NotebookEdit ${path}`);
		}),
		presenterDefinition("Grep", PRESENTATION_NOTE, searchCallView, searchResultView),
		presenterDefinition("Glob", PRESENTATION_NOTE, searchCallView, searchResultView),
		presenterDefinition("WebSearch", PRESENTATION_NOTE, searchCallView),
		presenterDefinition("WebFetch", PRESENTATION_NOTE, fetchCallView),
		presenterDefinition("Task", PRESENTATION_NOTE, taskCallView),
		presenterDefinition("ExitPlanMode", PRESENTATION_NOTE, planCallView),
		presenterDefinition("TodoWrite", PRESENTATION_NOTE, () => genericTitle("Update todos"))
	];
}
//#endregion
//#region src/preset-route.ts
const name = "claude-code-preset-route";
const inject = ["tools", "commands"];
function apply(ctx, config = {}) {
	ctx.on("agent/request", async (_payload, next) => {
		const upstream = await next();
		return {
			...upstream,
			provider: CLAUDE_CODE_PROVIDER,
			model: canonicalClaudeModelId(config.model ?? upstream.model ?? "default")
		};
	});
	ctx.provide(CLAUDE_COMMANDS_SERVICE, { list: (agent) => ctx.commands.list(agent) });
	for (const definition of claudePresenterDefinitions()) ctx.effect(() => ctx.tools.register(definition), `dsh-claude: ${definition.name} presentation`);
	ctx.inject(["jobs"], (jobsCtx) => {
		jobsCtx.effect(() => jobsCtx.jobs.attachController("dsh-claude"), "dsh-claude: job controller");
	});
}
//#endregion
export { apply, inject, name };

//# sourceMappingURL=preset-route.mjs.map