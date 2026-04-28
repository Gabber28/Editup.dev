import type { AIAdapter, AdapterContext } from "./types.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type { ExecuteResult } from "@/types/execute.js";
import { spawnSafe } from "./spawn-safe.js";
import { buildPlanPrompt, buildExecutePrompt } from "@bridge/prompt.js";
import { extractEditPlanFromText } from "@bridge/edit-plan.js";
import { PlanFailedError, ExecuteFailedError } from "@/lib/errors.js";
import { logger } from "@/lib/logger.js";

const PLAN_ALLOWED_TOOLS = "Read,Glob,Grep";
const EXECUTE_ALLOWED_TOOLS = "Read,Glob,Grep,Edit";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = 180_000;

export class ClaudeCodeAdapter implements AIAdapter {
  readonly name = "claude-code";
  readonly type = "cli" as const;

  async detect(): Promise<boolean> {
    try {
      const result = await spawnSafe({
        cmd: process.platform === "win32" ? "where" : "which",
        args: ["claude"],
        cwd: process.cwd(),
        timeoutMs: 5_000,
      });
      return result.exitCode === 0;
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

    const responseText = extractClaudeResponseText(result.stdout);
    return extractEditPlanFromText(responseText);
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
      "--output-format",
      "json",
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

    const usage = parseClaudeUsage(result.stdout);

    return {
      files_modified: plan.files.map((f) => f.path),
      files_extra: [],
      duration_ms: Date.now() - start,
      model: context.model ?? DEFAULT_MODEL,
      token_usage: usage,
    };
  }

  async isRunning(): Promise<boolean> {
    return false;
  }
}

function extractClaudeResponseText(stdout: string): string {
  try {
    const parsed = JSON.parse(stdout) as {
      result?: string;
      content?: Array<{ text?: string }>;
    };
    if (typeof parsed.result === "string") return parsed.result;
    if (Array.isArray(parsed.content)) {
      return parsed.content
        .map((c) => c.text ?? "")
        .filter(Boolean)
        .join("\n");
    }
  } catch {
    // fall through
  }
  return stdout;
}

function parseClaudeUsage(stdout: string): {
  input_total: number;
  output_total: number;
} {
  try {
    const parsed = JSON.parse(stdout) as {
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    return {
      input_total: parsed.usage?.input_tokens ?? 0,
      output_total: parsed.usage?.output_tokens ?? 0,
    };
  } catch {
    return { input_total: 0, output_total: 0 };
  }
}
