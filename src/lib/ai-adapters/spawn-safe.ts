import { spawn, type ChildProcess } from "node:child_process";
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
  env?: NodeJS.ProcessEnv | undefined;
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

  const collectedTools: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const current = args[i];
    if (current === undefined) continue;
    const { flag, value } = splitFlagValue(current);
    if (!ALLOWED_TOOLS_FLAGS.has(flag)) continue;
    const raw = value ?? args[i + 1] ?? "";
    if (value === undefined) i++;
    for (const tool of raw.split(",").map((t) => t.trim()).filter(Boolean)) {
      collectedTools.push(tool);
      if (FORBIDDEN_TOOLS.includes(tool)) {
        throw new SecurityViolationError(
          `Forbidden tool in allowedTools: ${tool}`
        );
      }
    }
  }

  void collectedTools;
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

export function assertCommandSafety(cmd: string, args: readonly string[]): void {
  assertSafeArgs(args);
  if (COMMANDS_REQUIRING_ALLOWLIST.has(cmd)) {
    assertHasAllowedTools(args);
  }
}

export function spawnSafe(opts: SpawnSafeOptions): Promise<SpawnSafeResult> {
  assertCommandSafety(opts.cmd, opts.args);

  return new Promise((resolve, reject) => {
    const start = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const child: ChildProcess = spawn(opts.cmd, opts.args, {
      shell: false,
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 2_000);
    }, opts.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      if (timedOut) {
        reject(
          new Error(`spawnSafe: timeout after ${opts.timeoutMs}ms (${opts.cmd})`)
        );
        return;
      }
      resolve({ exitCode: code, stdout, stderr, durationMs });
    });
  });
}
