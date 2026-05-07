import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { EnrichedSnapshot } from "@/types/snapshot.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type { ExecuteResult, VerificationResult } from "@/types/execute.js";
import type { AIAdapter, AdapterContext } from "@/lib/ai-adapters/types.js";
import { checkVisual } from "@verify/visual.js";
import { auditDiff } from "@verify/diff-audit.js";
import {
  runCorrectionPass,
  summarizeVerification,
} from "@verify/correction.js";
import type { AgentSnapshot } from "@/hooks/useAgentConnection.js";

const SNAPSHOT_TIMEOUT_MS = 10_000;
const HOT_RELOAD_DELAY_MS = 2_000;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function awaitFreshComputed(): Promise<Record<string, string>> {
  return new Promise<Record<string, string>>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("snapshot timeout after verification")),
      SNAPSHOT_TIMEOUT_MS
    );

    const setup = async (): Promise<void> => {
      const unlisten = await listen<AgentSnapshot>(
        "agent_snapshot",
        (event) => {
          clearTimeout(timer);
          unlisten();
          resolve(event.payload.computed_style ?? {});
        }
      );
      await invoke("request_snapshot");
    };

    setup().catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export function createVerifier(
  adapter: AIAdapter,
  snapshot: EnrichedSnapshot,
  context: AdapterContext
): (plan: EditPlan, result: ExecuteResult) => Promise<VerificationResult> {
  return async (plan, result) => {
    await delay(HOT_RELOAD_DELAY_MS);

    const freshComputed = await awaitFreshComputed();
    const visual = checkVisual({ snapshot, postEditComputed: freshComputed });
    const diffResult = auditDiff({
      plan,
      modifiedFiles: result.files_modified,
    });

    let correctionAttempts = 0;
    let finalVisual = visual;

    if (visual.status === "fail") {
      const correction = await runCorrectionPass({
        adapter,
        plan,
        snapshot,
        context,
        visualResult: visual,
        recheckVisual: async () => {
          await delay(HOT_RELOAD_DELAY_MS);
          const recomputed = await awaitFreshComputed();
          return checkVisual({ snapshot, postEditComputed: recomputed });
        },
      });
      correctionAttempts = correction.attempts;
      finalVisual = correction.finalVisual;
    }

    return summarizeVerification(
      finalVisual,
      "pass",
      diffResult.status,
      correctionAttempts
    );
  };
}
