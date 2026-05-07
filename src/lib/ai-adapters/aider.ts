import type { AIAdapter, AdapterContext } from "./types.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type { ExecuteResult } from "@/types/execute.js";
import { spawnSafe } from "./spawn-safe.js";
import {
  buildPlanPrompt,
  buildExecutePrompt,
} from "@bridge/prompt.js";
import { extractEditPlanFromText } from "@bridge/edit-plan.js";
import { PlanFailedError, ExecuteFailedError } from "@/lib/errors.js";

const DEFAULT_TIMEOUT_MS = 180_000;

export class AiderAdapter implements AIAdapter {
  readonly name = "aider";
  readonly type = "cli" as const;

  async detect(): Promise<boolean> {
    try {
      const { detectCliViaTauri } = await import("./spawn-tauri.js");
      return await detectCliViaTauri("aider");
    } catch {
      return false;
    }
  }

  async plan(
    snapshot: EnrichedSnapshot,
    context: AdapterContext
  ): Promise<EditPlan> {
    const prompt = buildPlanPrompt({
      snapshot,
      projectRoot: context.projectRoot,
    });

    const result = await spawnSafe({
      cmd: "aider",
      args: ["--message", prompt, "--no-auto-commits", "--yes-always"],
      cwd: context.projectRoot,
      timeoutMs: context.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    if (result.exitCode !== 0) {
      throw new PlanFailedError(
        `aider plan exited with code ${result.exitCode}`,
        1
      );
    }

    return extractEditPlanFromText(result.stdout);
  }

  async execute(
    plan: EditPlan,
    snapshot: EnrichedSnapshot,
    context: AdapterContext
  ): Promise<ExecuteResult> {
    const prompt = buildExecutePrompt({
      snapshot,
      projectRoot: context.projectRoot,
      approvedPlanJson: JSON.stringify(plan),
    });

    const start = Date.now();
    const result = await spawnSafe({
      cmd: "aider",
      args: ["--message", prompt, "--yes-always", "--no-auto-commits"],
      cwd: context.projectRoot,
      timeoutMs: context.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    if (result.exitCode !== 0) {
      throw new ExecuteFailedError(
        `aider execute exited with code ${result.exitCode}`
      );
    }

    return {
      files_modified: plan.files.map((f) => f.path),
      files_extra: [],
      duration_ms: Date.now() - start,
      model: "aider",
      token_usage: { input_total: 0, output_total: 0 },
    };
  }

  async isRunning(): Promise<boolean> {
    return false;
  }
}
