import { s as redactText } from "./events-BRPDopbd.mjs";
import { isAbsolute, join, win32 } from "node:path";
import { access } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { homedir } from "node:os";
import { EventEmitter } from "node:events";
import { DSH_ENV_PREFIX, SENSITIVE_ENV_PATTERN } from "@deepseek-ai/dsh-subprocess";
//#region src/spawn.ts
const CLAUDE_PROCESS_GRACE_MS = 2e3;
const CLAUDE_STDERR_TAIL_BYTES = 32768;
const ADDITIONAL_SENSITIVE_ENV_PATTERN = /(?:authorization|cookie|credential|database[_-]?url|private[_-]?key|netrc)/iu;
function scrubClaudeSpawnEnv(env) {
	const safe = {};
	for (const [key, value] of Object.entries(env)) {
		if (value === void 0) continue;
		if (key.toUpperCase().startsWith(DSH_ENV_PREFIX)) continue;
		if (SENSITIVE_ENV_PATTERN.test(key)) continue;
		if (ADDITIONAL_SENSITIVE_ENV_PATTERN.test(key)) continue;
		safe[key] = value;
	}
	return safe;
}
/** Where macOS keeps the tools a user's hooks call (`node`, `pnpm`, …). A
*  Desktop app launched from the Dock inherits launchd's PATH, which has none
*  of them, so a hook such as `node some-hook.mjs` dies with "command not
*  found" inside the CLI. Appended, never prepended: the user's own order wins. */
const MACOS_TOOL_PATHS = [
	"/opt/homebrew/bin",
	"/usr/local/bin",
	join(homedir(), ".local", "bin")
];
function appendToolPaths(env, platform = process.platform, exists = existsSync) {
	if (platform !== "darwin" || env.PATH === void 0) return env;
	const current = env.PATH.split(":").filter(Boolean);
	const missing = MACOS_TOOL_PATHS.filter((dir) => !current.includes(dir) && exists(dir));
	return missing.length === 0 ? env : {
		...env,
		PATH: [...current, ...missing].join(":")
	};
}
/** The lookup environment for `gh`, `git`, and Claude itself. The Host's own
*  PATH is launchd's when the app was opened from the Dock, which has none of
*  the tool directories, so `resolveExecutable('gh')` fails there and every
*  pull-request lookup silently goes missing. */
function toolPathEnv(env = process.env) {
	const PATH = appendToolPaths({ PATH: env.PATH ?? "/usr/local/bin:/usr/bin:/bin" }).PATH;
	return PATH === void 0 ? {} : { PATH };
}
var ManagedClaudeProcess = class extends EventEmitter {
	stdin;
	stdout;
	handle;
	#killed = false;
	#exitCode = null;
	#signalCode = null;
	constructor(handle) {
		super();
		if (handle.stdin === void 0 || handle.stdout === void 0) throw new Error("dsh-claude: managed Claude process requires piped stdin/stdout");
		this.handle = handle;
		this.stdin = handle.stdin;
		this.stdout = handle.stdout;
		handle.done.then((outcome) => {
			this.#exitCode = outcome.exitCode;
			this.#signalCode = outcome.signal;
			this.emit("exit", outcome.exitCode, outcome.signal);
		}, (error) => {
			this.emit("error", error instanceof Error ? error : new Error(String(error)));
		});
	}
	get killed() {
		return this.#killed;
	}
	get exitCode() {
		return this.#exitCode;
	}
	get signalCode() {
		return this.#signalCode;
	}
	kill(signal) {
		if (this.#exitCode !== null || this.#signalCode !== null) return false;
		this.#killed = true;
		this.handle.terminate();
		return true;
	}
	stderrTail() {
		return this.handle.collected.stderr?.readFrom(0).text ?? "";
	}
};
function createManagedClaudeSpawner(runtime, executablePath, observe) {
	return (options) => {
		if (options.command !== executablePath) throw new Error(`dsh-claude: SDK requested unexpected executable ${JSON.stringify(options.command)}`);
		const managed = new ManagedClaudeProcess(runtime.spawn({
			argv: [executablePath, ...options.args],
			cwd: options.cwd ?? process.cwd(),
			stdio: {
				stdin: "pipe",
				stdout: "pipe",
				stderr: { maxBytes: CLAUDE_STDERR_TAIL_BYTES }
			},
			graceMs: CLAUDE_PROCESS_GRACE_MS,
			signal: options.signal,
			env: appendToolPaths(scrubClaudeSpawnEnv({
				CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
				CLAUDE_CODE_ENABLE_TODO_TOOLS: "1",
				HOME: process.env.HOME || "/root",
				USER: process.env.USER || "root",
				GIT_CONFIG_GLOBAL: "/root/.dsh/git-forge/gitconfig",
				...options.env,
				IS_SANDBOX: "1"
			}))
		}));
		observe?.(managed, options);
		return managed;
	};
}
//#endregion
//#region src/executable.ts
const VERSION_PATTERN = /(?:Claude Code\s+)?v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/i;
const MAX_PROBE_STDOUT = 65536;
const MAX_PROBE_STDERR = 8192;
var ClaudeExecutableNotFoundError = class extends Error {
	searched;
	constructor(searched, options) {
		super(`Claude Code executable not found. Searched: ${searched.join(", ")}`, options);
		this.name = "ClaudeExecutableNotFoundError";
		this.searched = [...searched];
	}
};
function fallbackCandidates() {
	if (process.platform !== "darwin") return [];
	return [
		join(homedir(), ".local", "bin", "claude"),
		"/opt/homebrew/bin/claude",
		"/usr/local/bin/claude"
	];
}
function abortError(error) {
	return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}
/**
* Prefer the package's own native binary over a Windows npm shim.
*
* A PATH lookup on Windows answers `claude.CMD`, and since the fix for
* CVE-2024-27980 Node refuses to spawn `.cmd` and `.bat` without
* `shell: true` — every probe and every session then fails with
* `spawn EINVAL`, reported to the user as an executable and authentication
* error with nothing pointing at the file extension. Auto-resolution
* therefore cannot work on Windows at all, and the user has to discover
* `executablePath` to get anywhere.
*
* npm installs the package beside the shim it writes, and
* `@anthropic-ai/claude-code` ships a native executable (its own manifest
* declares `"bin": { "claude": "bin/claude.exe" }`), which carries no such
* restriction. Falling back to the shim keeps a layout that does not match
* this assumption working exactly as before.
*
* @param path - the resolved candidate, possibly a Windows shim.
* @returns the native executable when one sits beside the shim, else `path`.
*/
async function preferNativeWindowsBinary(path) {
	if (process.platform !== "win32") return path;
	if (!/\.(?:cmd|bat)$/iu.test(path)) return path;
	const native = win32.join(win32.dirname(path), "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
	try {
		await access(native, constants.X_OK);
		return native;
	} catch {
		return path;
	}
}
async function resolveClaudeExecutable(runtime, configuredPath, signal) {
	const searched = [];
	const candidates = configuredPath === void 0 ? ["claude", ...fallbackCandidates()] : [configuredPath];
	if (configuredPath !== void 0 && !isAbsolute(configuredPath) && !win32.isAbsolute(configuredPath)) throw new Error(`Claude Code executable path must be absolute: ${configuredPath}`);
	let lastError;
	for (const candidate of candidates) {
		if (searched.includes(candidate)) continue;
		searched.push(candidate);
		try {
			return {
				path: await preferNativeWindowsBinary(await runtime.resolveExecutable(candidate, toolPathEnv(), signal)),
				searched
			};
		} catch (error) {
			if (abortError(error) || signal?.aborted === true) throw error;
			lastError = error;
		}
	}
	throw new ClaudeExecutableNotFoundError(searched, lastError === void 0 ? void 0 : { cause: lastError });
}
async function collect(handle) {
	const outcome = await handle.done;
	const stdout = handle.collected.stdout?.readFrom(0).text ?? "";
	const stderr = handle.collected.stderr?.readFrom(0).text ?? "";
	return {
		...outcome,
		stdout,
		stderr
	};
}
async function runProbe(runtime, executable, args, cwd, signal) {
	return collect(runtime.spawn({
		argv: [executable, ...args],
		cwd,
		stdio: {
			stdin: "ignore",
			stdout: { maxBytes: MAX_PROBE_STDOUT },
			stderr: { maxBytes: MAX_PROBE_STDERR }
		},
		graceMs: 2e3,
		...signal === void 0 ? {} : { signal },
		env: {}
	}));
}
function parseClaudeVersion(output) {
	return VERSION_PATTERN.exec(output)?.[1];
}
async function probeClaudeVersion(runtime, executable, cwd, signal) {
	const result = await runProbe(runtime, executable, ["--version"], cwd, signal);
	const version = parseClaudeVersion(`${result.stdout}\n${result.stderr}`);
	if (result.exitCode !== 0 || version === void 0) throw new Error(`Claude Code version probe failed (${result.exitCode ?? result.signal ?? "unknown exit"})`);
	return version;
}
async function probeClaudeAuthentication(runtime, executable, cwd, signal) {
	const result = await runProbe(runtime, executable, [
		"auth",
		"status",
		"--json"
	], cwd, signal);
	if (result.exitCode !== 0) return {
		status: "unknown",
		message: "Claude authentication status command failed"
	};
	try {
		const value = JSON.parse(result.stdout);
		const report = { status: value.loggedIn === true ? "signed-in" : value.loggedIn === false ? "signed-out" : "unknown" };
		if (typeof value.authMethod === "string") report.method = redactText(value.authMethod, 100);
		if (typeof value.apiProvider === "string") report.provider = redactText(value.apiProvider, 100);
		if (typeof value.subscriptionType === "string") report.subscription = redactText(value.subscriptionType, 100);
		return report;
	} catch {
		return {
			status: "unknown",
			message: "Claude authentication status was not valid JSON"
		};
	}
}
async function runClaudeDoctor(runtime, options) {
	let resolution;
	try {
		resolution = await resolveClaudeExecutable(runtime, options.configuredPath, options.signal);
	} catch (error) {
		if (error instanceof ClaudeExecutableNotFoundError) return {
			executable: {
				status: "missing",
				searched: error.searched
			},
			version: { status: "not-run" },
			authentication: { status: "not-run" },
			handshake: "not-run"
		};
		throw error;
	}
	const report = {
		executable: {
			status: "found",
			path: resolution.path,
			searched: resolution.searched
		},
		version: { status: "not-run" },
		authentication: { status: "not-run" },
		handshake: "not-run"
	};
	const [versionOutcome, authOutcome] = await Promise.allSettled([probeClaudeVersion(runtime, resolution.path, options.cwd, options.signal), probeClaudeAuthentication(runtime, resolution.path, options.cwd, options.signal)]);
	if (versionOutcome.status === "fulfilled") report.version = {
		status: "ok",
		value: versionOutcome.value
	};
	else report.version = {
		status: "error",
		message: versionOutcome.reason instanceof Error ? versionOutcome.reason.message : "Version probe failed"
	};
	if (authOutcome.status === "fulfilled") report.authentication = authOutcome.value;
	else report.authentication = {
		status: "unknown",
		message: authOutcome.reason instanceof Error ? authOutcome.reason.message : "Authentication probe failed"
	};
	return report;
}
//#endregion
export { toolPathEnv as a, createManagedClaudeSpawner as i, resolveClaudeExecutable as n, runClaudeDoctor as r, parseClaudeVersion as t };

//# sourceMappingURL=executable-BzlqkThH.mjs.map