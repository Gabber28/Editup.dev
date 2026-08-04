import type { AIAdapter, AdapterContext } from "./types.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type { ExecuteResult } from "@/types/execute.js";
import { spawnSafe } from "./spawn-safe.js";
import { buildPlanPrompt, buildExecutePrompt } from "@bridge/prompt.js";
import { extractEditPlanFromText } from "@bridge/edit-plan.js";
import { PlanFailedError, ExecuteFailedError } from "@/lib/errors.js";
import { logger } from "@/lib/logger.js";
import { parseClaudeOutput } from "./claude-stream.js";
import { toProjectRelative, normalizePath } from "./project-paths.js";

const PLAN_ALLOWED_TOOLS = "Read,Glob,Grep";
const EXECUTE_ALLOWED_TOOLS = "Read,Glob,Grep,Edit";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = 180_000;

export class ClaudeCodeAdapter implements AIAdapter {
  readonly name = "claude-code";
  readonly type = "cli" as const;

  async detect(): Promise<boolean> {
    try {
      const { detectCliViaTauri } = await import("./spawn-tauri.js");
      return await detectCliViaTauri("claude");
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
      ...(context.retryHint !== undefined ? { retryHint: context.retryHint } : {}),
    });

    const args = [
      "-p",
      prompt,
      "--model",
      context.model ?? DEFAULT_MODEL,
      "--allowedTools",
      PLAN_ALLOWED_TOOLS,
      "--add-dir",
      context.projectRoot,
      "--output-format",
      "json",
      "--max-turns",
      "10",
    ];

    logger.info("claude-code plan starting", {
      model: context.model ?? DEFAULT_MODEL,
    });

    const result = await spawnSafe({
      cmd: "claude",
      args,
      cwd: context.projectRoot,
      timeoutMs: context.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    if (result.exitCode !== 0) {
      throw new PlanFailedError(
        `claude-code plan exited with code ${result.exitCode}`,
        1
      );
    }

    const outcome = parseClaudeOutput(result.stdout);
    if (outcome.isError) {
      throw new PlanFailedError(
        `claude-code plan reported a failed run (${outcome.subtype || "unknown"})`,
        1
      );
    }
    return extractEditPlanFromText(outcome.text);
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

    const args = [
      "-p",
      prompt,
      "--model",
      context.model ?? DEFAULT_MODEL,
      "--allowedTools",
      EXECUTE_ALLOWED_TOOLS,
      "--add-dir",
      context.projectRoot,
      // stream-json is the only format carrying per-tool records, which is how
      // we learn which files were really written instead of assuming the plan.
      "--output-format",
      "stream-json",
      "--verbose",
      "--max-turns",
      "15",
    ];

    logger.info("claude-code execute starting", {
      files_planned: plan.files.length,
    });

    const start = Date.now();
    const result = await spawnSafe({
      cmd: "claude",
      args,
      cwd: context.projectRoot,
      timeoutMs: context.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    if (result.exitCode !== 0) {
      throw new ExecuteFailedError(
        `claude-code execute exited with code ${result.exitCode}`
      );
    }

    const outcome = parseClaudeOutput(result.stdout);

    // A denied Edit tool still exits 0, so the exit code alone proves nothing.
    if (outcome.isError) {
      throw new ExecuteFailedError(
        `claude-code reported a failed run (${outcome.subtype || "unknown"})`
      );
    }
    if (outcome.permissionDenials.length > 0) {
      throw new ExecuteFailedError(
        `claude-code was denied the tools it needed: ${outcome.permissionDenials.join(", ")}`
      );
    }
    if (outcome.filesEdited.length === 0) {
      throw new ExecuteFailedError(
        "claude-code edited no files — the changes were not applied"
      );
    }

    const modified = outcome.filesEdited.map((f) =>
      toProjectRelative(f, context.projectRoot)
    );
    const planned = new Set(plan.files.map((f) => normalizePath(f.path)));

    return {
      files_modified: modified,
      files_extra: modified.filter((f) => !planned.has(normalizePath(f))),
      duration_ms: Date.now() - start,
      model: context.model ?? DEFAULT_MODEL,
      token_usage: outcome.usage,
    };
  }

  async isRunning(): Promise<boolean> {
    return false;
  }
}

