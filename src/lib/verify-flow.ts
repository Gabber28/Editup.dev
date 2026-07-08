import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { EnrichedSnapshot } from "@/types/snapshot.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type { ExecuteResult, VerificationResult } from "@/types/execute.js";
import type { AIAdapter, AdapterContext } from "@/lib/ai-adapters/types.js";
import { checkVisual } from "@verify/visual.js";
import type { VisualCheckResult } from "@verify/visual.js";
import { auditDiff } from "@verify/diff-audit.js";
import {
  runCorrectionPass,
  summarizeVerification,
} from "@verify/correction.js";
import { logger } from "@/lib/logger.js";
import type { AgentSnapshot } from "@/hooks/useAgentConnection.js";

const SNAPSHOT_TIMEOUT_MS = 10_000;
const HOT_RELOAD_DELAY_MS = 2_000;

interface GitStatusPayload {
  is_repo: boolean;
  is_clean: boolean;
  branch: string;
  changed_files?: string[];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function awaitFreshSnapshot(): Promise<AgentSnapshot> {
  return new Promise<AgentSnapshot>((resolve, reject) => {
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
          resolve(event.payload);
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

/**
 * Checks that the freshly captured element is the same one the edit targeted.
 * Compares tag plus source file when both sides know it; classes are not used
 * because the edit itself may legitimately rewrite them (e.g. Tailwind).
 */
function isSameElement(
  expected: EnrichedSnapshot["element"],
  fresh: AgentSnapshot["element"]
): boolean {
  if (expected.tag !== fresh.tag) return false;
  if (expected.source_file && fresh.source_file) {
    return expected.source_file === fresh.source_file;
  }
  return true;
}

async function fetchChangedFiles(): Promise<string[] | null> {
  try {
    const status = await invoke<GitStatusPayload>("git_status");
    if (!status.is_repo || !Array.isArray(status.changed_files)) return null;
    return status.changed_files;
  } catch {
    return null;
  }
}

/** Captures the set of dirty files before execute, so the post-execute diff audit only counts files the AI actually touched. */
export async function capturePreexistingChanges(): Promise<string[]> {
  return (await fetchChangedFiles()) ?? [];
}

async function resolveModifiedFiles(
  result: ExecuteResult,
  preexisting: readonly string[]
): Promise<string[]> {
  const changedNow = await fetchChangedFiles();
  if (changedNow === null) return result.files_modified;
  const before = new Set(preexisting);
  return changedNow.filter((f) => !before.has(f));
}

export function createVerifier(
  adapter: AIAdapter,
  snapshot: EnrichedSnapshot,
  context: AdapterContext,
  preexistingChanges: readonly string[] = []
): (plan: EditPlan, result: ExecuteResult) => Promise<VerificationResult> {
  return async (plan, result) => {
    await delay(HOT_RELOAD_DELAY_MS);

    const fresh = await awaitFreshSnapshot();
    const sameElement = isSameElement(snapshot.element, fresh.element);
    if (!sameElement) {
      logger.warn("verification element mismatch — skipping visual check", {
        expected_tag: snapshot.element.tag,
        actual_tag: fresh.element.tag,
      });
    }

    const visual: VisualCheckResult = sameElement
      ? checkVisual({
          snapshot,
          postEditComputed: fresh.computed_style ?? {},
        })
      : { status: "pass", checked: 0, divergences: [] };

    const modifiedFiles = await resolveModifiedFiles(result, preexistingChanges);
    const diffResult = auditDiff({ plan, modifiedFiles });

    let correctionAttempts = 0;
    let finalVisual = visual;

    if (visual.status === "fail" && visual.checked > 0) {
      const correction = await runCorrectionPass({
        adapter,
        plan,
        snapshot,
        context,
        visualResult: visual,
        recheckVisual: async () => {
          await delay(HOT_RELOAD_DELAY_MS);
          const recheck = await awaitFreshSnapshot();
          if (!isSameElement(snapshot.element, recheck.element)) {
            return { status: "pass", checked: 0, divergences: [] };
          }
          return checkVisual({
            snapshot,
            postEditComputed: recheck.computed_style ?? {},
          });
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
