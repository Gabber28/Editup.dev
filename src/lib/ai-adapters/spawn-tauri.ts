import { invoke } from "@tauri-apps/api/core";
import type { SpawnSafeOptions, SpawnSafeResult } from "./spawn-safe.js";
import { assertCommandSafety } from "./spawn-safe.js";

interface SpawnCliInput {
  cmd: string;
  args: string[];
  cwd: string;
  timeout_ms: number;
}

interface SpawnCliOutput {
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
}

export async function spawnViaTauri(
  opts: SpawnSafeOptions
): Promise<SpawnSafeResult> {
  assertCommandSafety(opts.cmd, opts.args);

  const input: SpawnCliInput = {
    cmd: opts.cmd,
    args: opts.args,
    cwd: opts.cwd,
    timeout_ms: opts.timeoutMs,
  };

  const result = await invoke<SpawnCliOutput>("spawn_cli", { input });

  return {
    exitCode: result.exit_code,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.duration_ms,
  };
}

export async function detectCliViaTauri(name: string): Promise<boolean> {
  return invoke<boolean>("detect_cli", { name });
}
