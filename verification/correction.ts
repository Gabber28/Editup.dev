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

/** Rounds of automatic correction before the run concludes with a warning. */
const MAX_CORRECTION_ATTEMPTS = 4;

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

    const correctionPlan = buildCorrectionPlan(input.plan, currentVisual, attempts);
    try {
      const result = await runExecute(
        input.adapter,
        correctionPlan,
        // The snapshot carries the correction instructions so the execute
        // prompt states what is still wrong, instead of repeating the request
        // that already failed.
        withCorrectionInstructions(input.snapshot, currentVisual, attempts),
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

/** One line per divergence, naming the element that is still wrong. */
function describeDivergences(visual: VisualCheckResult): string[] {
  return visual.divergences.map(
    (d) =>
      `${d.element ?? "the selected element"} — ${d.property}: expected ${d.expected}, page shows ${d.actual}`
  );
}

function buildCorrectionPlan(
  original: EditPlan,
  visual: VisualCheckResult,
  attempt: number
): EditPlan {
  const summary = `Correction ${attempt}: ${describeDivergences(visual).join("; ")}`;

  return {
    ...original,
    summary: summary.slice(0, 290),
    side_effects: [
      ...original.side_effects,
      "automatic correction pass triggered by failed visual check",
    ],
  };
}

/**
 * Restates the still-failing properties as explicit instructions, so the retry
 * carries new information instead of repeating the original request verbatim.
 *
 * @param snapshot The original snapshot
 * @param visual The failing comparison
 * @param attempt Which correction round this is
 * @returns A snapshot whose text instructions describe what to fix
 */
function withCorrectionInstructions(
  snapshot: EnrichedSnapshot,
  visual: VisualCheckResult,
  attempt: number
): EnrichedSnapshot {
  const lines = describeDivergences(visual);
  const instruction = [
    `CORRECTION PASS ${attempt}. The previous edit did not take effect on the page.`,
    "After reloading, these values are still wrong:",
    ...lines.map((l) => `- ${l}`),
    "Find why the previous edit did not apply — the value may be overridden by a more specific rule, written to a rule the element does not use, or scoped to the wrong instance — and fix it for the element identified above only.",
  ].join("\n");

  return {
    ...snapshot,
    text_instructions: snapshot.text_instructions
      ? `${snapshot.text_instructions}\n\n${instruction}`
      : instruction,
  };
}

/**
 * Turns the raw checks into the result the app records and shows.
 *
 * A null visual result means the page could not be observed, which is reported
 * as "unverified" — distinct from "skipped" (observed, nothing comparable) and
 * never equivalent to a pass.
 *
 * @param visual Visual comparison, or null when the page was never observed
 * @param scopeStatus Collateral-damage check status
 * @param diffStatus File audit status
 * @param correctionAttempts How many correction rounds ran
 * @returns The verification summary, carrying divergences when they exist
 */
export function summarizeVerification(
  visual: VisualCheckResult | null,
  scopeStatus: VerificationResult["scope_check"],
  diffStatus: VerificationResult["diff_check"],
  correctionAttempts: number
): VerificationResult {
  const visualCheck: VerificationResult["visual_check"] = !visual
    ? "unverified"
    : visual.checked === 0
      ? "skipped"
      : visual.status === "pass"
        ? "pass"
        : "fail";

  const result: VerificationResult = {
    visual_check: visualCheck,
    scope_check: scopeStatus,
    diff_check: diffStatus,
    correction_attempts: correctionAttempts,
  };

  const divergences = (visual?.divergences ?? []).map((d) => ({
    element: d.element ?? "selected element",
    property: d.property,
    expected: d.expected,
    actual: d.actual,
  }));
  if (divergences.length > 0) result.divergences = divergences;

  return result;
}
