#!/usr/bin/env node
import { m as CLAUDE_CODE_PRESET_ID } from "./events-CKwSqljn.mjs";
import { t as parseClaudeVersion } from "./executable-6jefso8L.mjs";
import { delimiter, isAbsolute, join } from "node:path";
import "node:crypto";
import { access, lstat, readFile, readdir, rm, rmdir } from "node:fs/promises";
import { dshHomePath } from "@deepseek-ai/dsh-home-paths";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { scrubbedParentEnv } from "@deepseek-ai/dsh-subprocess";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
//#region src/preset-installer.ts
const MANAGED_PRESET_FILES = ["agent.cordis.yml", "preset.yml"];
/** Package specifier kept in the installed template. DSH Desktop 2.0.4 resolves
* it through the active profile package factory, so the preset route and client
* module share one Loader source. An absolute built entry would register a
* second source and make the Desktop renderer reject the plugin graph. */
const PRESET_ROUTE_PACKAGE_SPECIFIER = "@norman-else/dsh-claude/preset-route";
var ManagedPresetConflictError = class extends Error {
	path;
	constructor(path) {
		super(`dsh-claude: refusing to overwrite user-modified preset file ${path}`);
		this.name = "ManagedPresetConflictError";
		this.path = path;
	}
};
function defaultManagedPresetPaths(dshHome) {
	const packageRoot = fileURLToPath(new URL("../", import.meta.url));
	return {
		sourceDir: join(packageRoot, "legacy-preset"),
		targetDir: dshHome === void 0 ? dshHomePath(".agent-presets", CLAUDE_CODE_PRESET_ID) : join(dshHome, ".agent-presets", CLAUDE_CODE_PRESET_ID)
	};
}
async function managedContents(paths) {
	return await Promise.all(MANAGED_PRESET_FILES.map(async (file) => {
		const source = await readFile(join(paths.sourceDir, file), "utf8");
		const nameRow = `name: '${PRESET_ROUTE_PACKAGE_SPECIFIER}'`;
		const legacyNameRow = `name: ${PRESET_ROUTE_PACKAGE_SPECIFIER}`;
		if (file !== "agent.cordis.yml" || !source.includes(nameRow)) return {
			file,
			content: source,
			legacy: [],
			isLegacy: () => false
		};
		return {
			file,
			content: source,
			legacy: [],
			isLegacy: (current) => current.includes("id: claude-code-route") && (current.includes(legacyNameRow) || current.replaceAll("\\", "/").includes("lib/preset-route.mjs"))
		};
	}));
}
async function readIfPresent(path) {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return void 0;
		throw error;
	}
}
/** Reject a target directory that is a symlink (or occupies the path as a file)
*  so the managed preset never writes through an attacker-controlled link. */
async function assertSafeTargetDirectory(targetDir) {
	try {
		const stat = await lstat(targetDir);
		if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ManagedPresetConflictError(targetDir);
	} catch (error) {
		if (error.code === "ENOENT") return;
		throw error;
	}
}
async function removeManagedPreset(paths = defaultManagedPresetPaths()) {
	await assertSafeTargetDirectory(paths.targetDir);
	const expected = await managedContents(paths);
	const managedTargets = [];
	for (const { file, content, legacy, isLegacy } of expected) {
		const target = join(paths.targetDir, file);
		const current = await readIfPresent(target);
		if (current === void 0) continue;
		if (current !== content && !legacy.includes(current) && !isLegacy(current)) throw new ManagedPresetConflictError(target);
		managedTargets.push(target);
	}
	for (const target of managedTargets) await rm(target);
	try {
		if ((await readdir(paths.targetDir)).length === 0) await rmdir(paths.targetDir);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	return managedTargets.length > 0 ? "removed" : "absent";
}
//#endregion
//#region src/bin.ts
function option(name) {
	const index = process.argv.indexOf(name);
	return index < 0 ? void 0 : process.argv[index + 1];
}
async function executable(configured) {
	const candidates = [];
	if (configured !== void 0) candidates.push(configured);
	else {
		for (const directory of (process.env.PATH ?? "").split(delimiter)) if (directory.length > 0) candidates.push(join(directory, "claude"));
		candidates.push(join(homedir(), ".local", "bin", "claude"), "/opt/homebrew/bin/claude", "/usr/local/bin/claude");
	}
	for (const candidate of [...new Set(candidates)]) {
		if (!isAbsolute(candidate)) continue;
		try {
			await access(candidate, constants.X_OK);
			return candidate;
		} catch {}
	}
}
function run(executablePath, args) {
	return spawnSync(executablePath, args, {
		encoding: "utf8",
		env: scrubbedParentEnv(),
		timeout: 15e3,
		windowsHide: true
	});
}
async function doctor() {
	const configured = option("--executable") ?? process.env.DSH_CLAUDE_CODE_EXECUTABLE;
	const path = await executable(configured);
	if (path === void 0) {
		process.stdout.write(`${JSON.stringify({
			executable: {
				status: "missing",
				searched: configured === void 0 ? [
					"claude",
					"~/.local/bin/claude",
					"/opt/homebrew/bin/claude",
					"/usr/local/bin/claude"
				] : [configured]
			},
			version: { status: "not-run" },
			authentication: { status: "not-run" },
			message: "Set executablePath to an absolute Claude Code CLI path"
		}, null, 2)}\n`);
		return 1;
	}
	const versionProbe = run(path, ["--version"]);
	const version = parseClaudeVersion(`${versionProbe.stdout ?? ""}\n${versionProbe.stderr ?? ""}`);
	const authProbe = run(path, [
		"auth",
		"status",
		"--json"
	]);
	let authentication = { status: "unknown" };
	if (authProbe.status === 0) try {
		const value = JSON.parse(authProbe.stdout);
		authentication = {
			status: value.loggedIn === true ? "signed-in" : "signed-out",
			...typeof value.authMethod === "string" ? { method: value.authMethod } : {},
			...typeof value.apiProvider === "string" ? { provider: value.apiProvider } : {},
			...typeof value.subscriptionType === "string" ? { subscription: value.subscriptionType } : {}
		};
	} catch {
		authentication = {
			status: "unknown",
			message: "Authentication status was not valid JSON"
		};
	}
	process.stdout.write(`${JSON.stringify({
		executable: {
			status: "found",
			path
		},
		version: version === void 0 ? { status: "error" } : {
			status: "ok",
			value: version
		},
		authentication,
		handshake: "not-run"
	}, null, 2)}\n`);
	return version === void 0 ? 1 : 0;
}
async function main() {
	const command = process.argv[2] ?? "doctor";
	if (command === "doctor") return doctor();
	if (command === "remove-preset") {
		process.stdout.write(`${await removeManagedPreset()}\n`);
		return 0;
	}
	process.stderr.write(`Usage: dsh-claude [doctor [--executable PATH] | remove-preset]\n`);
	return 2;
}
try {
	process.exitCode = await main();
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
}
//#endregion
export {};

//# sourceMappingURL=bin.mjs.map