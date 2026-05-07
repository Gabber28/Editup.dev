import { SecurityViolationError } from "../errors.js";

const FORBIDDEN_FLAGS = [
  "--dangerously-skip-permissions",
  "--skip-permissions",
];

const FORBIDDEN_TOOLS = ["Write", "Bash", "WebFetch"];

const COMMANDS_REQUIRING_ALLOWLIST = new Set(["claude"]);
const ALLOWED_TOOLS_FLAGS = new Set(["--allowedTools", "--allowed-tools"]);

export interface SpawnSafeOptions {
  cmd: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  env?: Record<string, string> | undefined;
}

export interface SpawnSafeResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

function splitFlagValue(arg: string): { flag: string; value?: string } {
  const eqIdx = arg.indexOf("=");
  if (eqIdx === -1) return { flag: arg };
  return { flag: arg.slice(0, eqIdx), value: arg.slice(eqIdx + 1) };
}

export function assertSafeArgs(args: readonly string[]): void {
  for (const arg of args) {
    const { flag } = splitFlagValue(arg);
    for (const forbidden of FORBIDDEN_FLAGS) {
      if (flag === forbidden || arg.includes(forbidden)) {
        throw new SecurityViolationError(
          `Forbidden flag detected: ${forbidden}`
        );
      }
    }
  }

  for (let i = 0; i < args.length; i++) {
    const current = args[i];
    if (current === undefined) continue;
    const { flag, value } = splitFlagValue(current);
    if (!ALLOWED_TOOLS_FLAGS.has(flag)) continue;
    const raw = value ?? args[i + 1] ?? "";
    if (value === undefined) i++;
    for (const tool of raw.split(",").map((t) => t.trim()).filter(Boolean)) {
      if (FORBIDDEN_TOOLS.includes(tool)) {
        throw new SecurityViolationError(
          `Forbidden tool in allowedTools: ${tool}`
        );
      }
    }
  }
}

export function assertHasAllowedTools(args: readonly string[]): void {
  const present = args.some((a) => {
    const { flag } = splitFlagValue(a);
    return ALLOWED_TOOLS_FLAGS.has(flag);
  });
  if (!present) {
    throw new SecurityViolationError(
      "spawn args must include --allowedTools (positive allowlist required)"
    );
  }
}

export function assertCommandSafety(
  cmd: string,
  args: readonly string[]
): void {
  assertSafeArgs(args);
  if (COMMANDS_REQUIRING_ALLOWLIST.has(cmd)) {
    assertHasAllowedTools(args);
  }
}

export async function spawnSafe(
  opts: SpawnSafeOptions
): Promise<SpawnSafeResult> {
  assertCommandSafety(opts.cmd, opts.args);
  const { spawnViaTauri } = await import("./spawn-tauri.js");
  return spawnViaTauri(opts);
}
