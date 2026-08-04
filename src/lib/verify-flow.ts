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

const SNAPSHOT_TIMEOUT_MS = 20_000;
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

/**
 * Reloads the page and waits for the snapshot captured after it.
 *
 * The agent applies previews as inline styles on the live element, so reading
 * the element back without reloading confirms the edit even when the AI wrote
 * nothing. Only a snapshot tagged `verification` — taken after the document was
 * rebuilt from source — is evidence.
 *
 * @returns The post-reload snapshot, or null when it never arrived
 */
async function awaitVerificationSnapshot(): Promise<AgentSnapshot | null> {
  return new Promise<AgentSnapshot | null>((resolve) => {
    let settled = false;
    let unlisten: (() => void) | null = null;

    const finish = (snap: AgentSnapshot | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (unlisten) unlisten();
      resolve(snap);
    };

    const timer = setTimeout(() => {
      logger.warn("verification snapshot never arrived after reload");
      finish(null);
    }, SNAPSHOT_TIMEOUT_MS);

    const setup = async (): Promise<void> => {
      unlisten = await listen<AgentSnapshot>("agent_snapshot", (event) => {
        if (event.payload?.verification === true) finish(event.payload);
      });
      await invoke("verify_reload");
    };

    setup().catch((err) => {
      logger.warn("verification reload failed", {
        reason: err instanceof Error ? err.message : String(err),
      });
      finish(null);
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

/** True when git can act as the independent witness for the diff audit. */
async function isGitAvailable(): Promise<boolean> {
  return (await fetchChangedFiles()) !== null;
}

const CAPTURE_TIMEOUT_MS = 5_000;

interface ElementStylesPayload {
  styles: Record<string, Record<string, string>>;
}

/**
 * Asks the page for the computed styles of the other edited elements, so each
 * one is verified against itself instead of being skipped.
 *
 * @param paths dom_path selectors of the elements to measure
 * @returns Styles keyed by dom_path; empty when the page did not answer
 */
async function captureElementStyles(
  paths: string[]
): Promise<Record<string, Record<string, string>>> {
  if (paths.length === 0) return {};
  return new Promise((resolve) => {
    let settled = false;
    let unlisten: (() => void) | null = null;

    const finish = (styles: Record<string, Record<string, string>>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (unlisten) unlisten();
      resolve(styles);
    };

    const timer = setTimeout(() => finish({}), CAPTURE_TIMEOUT_MS);

    const setup = async (): Promise<void> => {
      unlisten = await listen<ElementStylesPayload>("agent_elements_captured", (ev) => {
        finish(ev.payload?.styles ?? {});
      });
      await invoke("capture_elements", { paths });
    };

    setup().catch(() => finish({}));
  });
}

/** dom_paths of every element edited besides the primary one. */
function secondaryPaths(snapshot: EnrichedSnapshot): string[] {
  const paths = new Set<string>();
  for (const change of snapshot.changes) {
    const path = change.element_ref?.dom_path;
    if (path) paths.add(path);
  }
  return Array.from(paths);
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
  /**
   * Captures the page as the source now renders it and compares it with what
   * the user asked for. Returns null when the page could not be observed — that
   * is "unverified", never a pass.
   */
  const observe = async (): Promise<VisualCheckResult | null> => {
    await delay(HOT_RELOAD_DELAY_MS);
    const fresh = await awaitVerificationSnapshot();
    if (!fresh) return null;
    if (!isSameElement(snapshot.element, fresh.element)) {
      logger.warn("verification element mismatch", {
        expected_tag: snapshot.element.tag,
        actual_tag: fresh.element.tag,
      });
      return null;
    }
    const elementStyles = await captureElementStyles(secondaryPaths(snapshot));
    return checkVisual({
      snapshot,
      postEditComputed: fresh.computed_style ?? {},
      elementStyles,
    });
  };

  return async (plan, result) => {
    const visual = await observe();

    const gitAvailable = await isGitAvailable();
    const modifiedFiles = await resolveModifiedFiles(result, preexistingChanges);
    const diffResult = auditDiff({ plan, modifiedFiles, gitAvailable });

    let correctionAttempts = 0;
    let finalVisual = visual;

    if (visual && visual.status === "fail" && visual.checked > 0) {
      const correction = await runCorrectionPass({
        adapter,
        plan,
        snapshot,
        context,
        visualResult: visual,
        recheckVisual: async () => (await observe()) ?? visual,
      });
      correctionAttempts = correction.attempts;
      finalVisual = correction.finalVisual;
    }

    return summarizeVerification(
      finalVisual,
      "skipped",
      diffResult.status,
      correctionAttempts
    );
  };
}
