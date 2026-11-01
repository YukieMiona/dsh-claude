import { Context } from "@deepseek-ai/cordis";
//#region src/preset-route.d.ts
declare const name = "claude-code-preset-route";
declare const inject: string[];
interface Config {
  model?: string;
}
declare function apply(ctx: Context, config?: Config): void;
//#endregion
export { Config, apply, inject, name };
//# sourceMappingURL=preset-route.d.mts.map