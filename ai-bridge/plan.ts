import type { EnrichedSnapshot } from "../src/types/snapshot.js";
import type { EditPlan } from "../src/types/edit-plan.js";
import type {
  AIAdapter,
  AdapterContext,
} from "../src/lib/ai-adapters/types.js";
import { tryParseEditPlan } from "./edit-plan.js";
import { PlanFailedError } from "../src/lib/errors.js";
import { logger } from "../src/lib/logger.js";

const MAX_PLAN_ATTEMPTS = 2;

export async function runPlan(
  adapter: AIAdapter,
  snapshot: EnrichedSnapshot,
  context: AdapterContext
): Promise<EditPlan> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_PLAN_ATTEMPTS; attempt++) {
    try {
      const plan = await adapter.plan(snapshot, context);
      const validated = tryParseEditPlan(plan);
      if (!validated.success) {
        logger.warn("plan schema validation failed", {
          adapter: adapter.name,
          attempt,
          issue_count: validated.issues.length,
        });
        lastError = new PlanFailedError(
          `Plan from ${adapter.name} failed schema validation`,
          attempt
        );
        continue;
      }
      logger.info("plan succeeded", {
        adapter: adapter.name,
        attempt,
        files: validated.data.files.length,
        confidence: validated.data.confidence,
      });
      return validated.data;
    } catch (err) {
      lastError = err;
      logger.warn("plan attempt failed", {
        adapter: adapter.name,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  throw new PlanFailedError(
    `Plan failed after ${MAX_PLAN_ATTEMPTS} attempts`,
    MAX_PLAN_ATTEMPTS,
    lastError
  );
}
