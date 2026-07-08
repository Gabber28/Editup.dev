import type { EnrichedSnapshot } from "@/types/snapshot.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type {
  AIAdapter,
  AdapterContext,
} from "@/lib/ai-adapters/types.js";
import type { ExecuteResult, VerificationResult } from "@/types/execute.js";
import type { VisualCheckResult } from "./visual.js";
import { runExecute } from "@bridge/execute.js";
import { logger } from "@/lib/logger.js";

const MAX_CORRECTION_ATTEMPTS = 2;

export interface CorrectionInput {
  adapter: AIAdapter;
  plan: EditPlan;
  snapshot: EnrichedSnapshot;
  context: AdapterContext;
  visualResult: VisualCheckResult;
  recheckVisual: () => Promise<VisualCheckResult>;
}

export interface CorrectionOutput {
  attempts: number;
  finalVisual: VisualCheckResult;
  executeResults: ExecuteResult[];
}

export async function runCorrectionPass(
  input: CorrectionInput
): Promise<CorrectionOutput> {
  const executeResults: ExecuteResult[] = [];
  let currentVisual = input.visualResult;
  let attempts = 0;

  while (
    currentVisual.status === "fail" &&
    attempts < MAX_CORRECTION_ATTEMPTS
  ) {
    attempts++;
    logger.info("correction pass starting", {
      attempt: attempts,
      divergences: currentVisual.divergences.length,
    });

    const correctionPlan = buildCorrectionPlan(input.plan, currentVisual);
    try {
      const result = await runExecute(
        input.adapter,
        correctionPlan,
        input.snapshot,
        input.context
      );
      executeResults.push(result);
    } catch (err) {
      logger.error("correction execute failed", {
        attempt: attempts,
        error: err instanceof Error ? err.message : String(err),
      });
      break;
    }

    currentVisual = await input.recheckVisual();
  }

  return {
    attempts,
    finalVisual: currentVisual,
    executeResults,
  };
}

function buildCorrectionPlan(
  original: EditPlan,
  visual: VisualCheckResult
): EditPlan {
  const summary = `Correction: ${visual.divergences
    .map((d) => `${d.property} expected ${d.expected} got ${d.actual}`)
    .join("; ")}`;

  return {
    ...original,
    summary: summary.slice(0, 290),
    side_effects: [
      ...original.side_effects,
      "automatic correction pass triggered by failed visual check",
    ],
  };
}

export function summarizeVerification(
  visual: VisualCheckResult,
  scopeStatus: "pass" | "warn" | "fail",
  diffStatus: "pass_exact" | "pass_subset" | "warn_extras" | "fail",
  correctionAttempts: number
): VerificationResult {
  return {
    visual_check:
      visual.checked === 0
        ? "skipped"
        : visual.status === "pass"
          ? "pass"
          : "fail",
    scope_check:
      scopeStatus === "fail" ? "fail" : scopeStatus,
    diff_check: diffStatus,
    correction_attempts: correctionAttempts,
  };
}
