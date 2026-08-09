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
 * Reloads the page and waits for the agent to announce it is back.
 *
 * The agent applies previews as inline styles on the live element, so reading
 * the element back without reloading confirms the edit even when the AI wrote
 * nothing. The readiness signal is deliberately independent of the selection:
 * a reorder moves the element, its positional selector stops matching, and
 * waiting for a re-anchored snapshot would hang until timeout.
 *
 * @returns True when the reloaded page reported in
 */
async function reloadAndAwaitReady(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let unlistenReady: (() => void) | null = null;
    let unlistenSnap: (() => void) | null = null;

    const finish = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (unlistenReady) unlistenReady();
      if (unlistenSnap) unlistenSnap();
      resolve(ok);
    };

    const timer = setTimeout(() => {
      logger.warn("page never reported back after the verification reload");
      finish(false);
    }, SNAPSHOT_TIMEOUT_MS);

    const setup = async (): Promise<void> => {
      unlistenReady = await listen("agent_verify_ready", () => finish(true));
      // A tagged snapshot also proves the page came back, for agents that
      // re-anchor before announcing.
      unlistenSnap = await listen<AgentSnapshot>("agent_snapshot", (event) => {
        if (event.payload?.verification === true) finish(true);
      });
      await invoke("verify_reload");
    };

    setup().catch((err) => {
      logger.warn("verification reload failed", {
        reason: err instanceof Error ? err.message : String(err),
      });
      finish(false);
    });
  });
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

/** How an element is located after the edit: by path, else by description. */
interface VerificationTarget {
  path: string;
  tag: string;
  classes: string[];
  text?: string;
}

/**
 * Asks the page for the computed styles of every edited element, so each one is
 * verified against itself instead of being skipped.
 *
 * @param targets Elements to measure, keyed by their dom_path
 * @returns Styles keyed by dom_path; empty when the page did not answer
 */
async function captureElementStyles(
  targets: VerificationTarget[]
): Promise<Record<string, Record<string, string>>> {
  if (targets.length === 0) return {};
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
      await invoke("capture_elements", { targets });
    };

    setup().catch(() => finish({}));
  });
}

/** Every element touched by this edit: the selected one plus each element_ref. */
function verificationTargets(snapshot: EnrichedSnapshot): VerificationTarget[] {
  const byPath = new Map<string, VerificationTarget>();

  const el = snapshot.element;
  if (el.dom_path) {
    byPath.set(el.dom_path, {
      path: el.dom_path,
      tag: el.tag,
      classes: el.classes,
      ...(el.text_preview ? { text: el.text_preview } : {}),
    });
  }

  for (const change of snapshot.changes) {
    const ref = change.element_ref;
    if (!ref?.dom_path || byPath.has(ref.dom_path)) continue;
    byPath.set(ref.dom_path, {
      path: ref.dom_path,
      tag: ref.tag,
      classes: ref.classes,
      ...(ref.text_preview ? { text: ref.text_preview } : {}),
    });
  }

  return Array.from(byPath.values());
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
    if (!(await reloadAndAwaitReady())) return null;

    const targets = verificationTargets(snapshot);
    const styles = await captureElementStyles(targets);

    const primaryPath = snapshot.element.dom_path;
    const primaryStyles = primaryPath ? styles[primaryPath] : undefined;
    const primaryChanges = snapshot.changes.some((c) => c.element_ref === undefined);

    // Measuring nothing is not a pass: if the element the developer edited
    // cannot be found in the reloaded page, say so instead of guessing.
    if (primaryChanges && !primaryStyles) {
      logger.warn("edited element not found after reload", { path: primaryPath });
      return null;
    }

    return checkVisual({
      snapshot,
      postEditComputed: primaryStyles ?? {},
      elementStyles: styles,
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
