import type { EnrichedSnapshot } from "../src/types/snapshot.js";
import type { EditPlan } from "../src/types/edit-plan.js";
import type { ExecuteResult } from "../src/types/execute.js";
import type {
  AIAdapter,
  AdapterContext,
} from "../src/lib/ai-adapters/types.js";
import { ExecuteFailedError } from "../src/lib/errors.js";
import { logger } from "../src/lib/logger.js";

export async function runExecute(
  adapter: AIAdapter,
  plan: EditPlan,
  snapshot: EnrichedSnapshot,
  context: AdapterContext
): Promise<ExecuteResult> {
  logger.info("execute starting", {
    adapter: adapter.name,
    files_planned: plan.files.length,
  });

  try {
    const result = await adapter.execute(plan, snapshot, context);
    logger.info("execute completed", {
      adapter: adapter.name,
      files_modified: result.files_modified.length,
      files_extra: result.files_extra.length,
      duration_ms: result.duration_ms,
    });
    return result;
  } catch (err) {
    logger.error("execute failed", {
      adapter: adapter.name,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new ExecuteFailedError(
      `Execute failed via ${adapter.name}: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}
