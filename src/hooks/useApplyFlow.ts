import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Orchestrator } from "@bridge/orchestrator.js";
import type {
  OrchestratorPhase,
  ApprovalRequest,
} from "@bridge/orchestrator.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type { VerificationResult } from "@/types/execute.js";
import type { RateLimitState } from "@/types/license.js";
import type { EnrichedSnapshot, CSSChange, PseudoState } from "@/types/snapshot.js";
import type { AIAdapter, AdapterContext, DetectionResult } from "@/lib/ai-adapters/types.js";
import { AdapterRegistry } from "@/lib/ai-adapters/registry.js";
import { ClaudeCodeAdapter } from "@/lib/ai-adapters/claude-code.js";
import { AiderAdapter } from "@/lib/ai-adapters/aider.js";
import { CopyPromptAdapter } from "@/lib/ai-adapters/copy-prompt.js";
import { createVerifier } from "@/lib/verify-flow.js";
import {
  PlanFailedError,
  ExecuteFailedError,
  SessionConflictError,
  SecurityViolationError,
} from "@/lib/errors.js";
import { logger } from "@/lib/logger.js";
import { recordApply } from "@/lib/history-logger.js";
import type { AgentSnapshot } from "./useAgentConnection.js";

export interface ApplyError {
  title: string;
  message: string;
  hint: string;
  canRetry: boolean;
}

export interface ApplyFlowState {
  phase: OrchestratorPhase;
  plan: EditPlan | null;
  approval: ApprovalRequest | null;
  verification: VerificationResult | null;
  commitHash: string | null;
  error: ApplyError | null;
  expressMode: boolean;
}

export interface ApplyFlowActions {
  apply(
    snapshotCache: Record<string, AgentSnapshot>,
    allOverrides: Record<string, Record<string, Record<string, string>>>,
    textInstructions: string,
    projectRoot: string
  ): Promise<void>;
  approve(): void;
  reject(): void;
  revert(): Promise<void>;
  toggleExpress(): void;
  reset(): void;
}

export type ApplyFlow = ApplyFlowState & ApplyFlowActions;

const INITIAL: ApplyFlowState = {
  phase: "idle", plan: null, approval: null, verification: null,
  commitHash: null, error: null, expressMode: false,
};

function causeMsg(err: unknown): string {
  const c = (err as { cause?: unknown })?.cause;
  return c instanceof Error ? c.message : "";
}

function classifyError(err: unknown): ApplyError {
  if (err instanceof PlanFailedError) {
    const detail = causeMsg(err);
    return {
      title: "Planning failed",
      message: detail || `Could not generate a valid edit plan after ${err.attempts} attempt${err.attempts !== 1 ? "s" : ""}.`,
      hint: "Check if your AI tool is running and try again. Simplifying changes may help.",
      canRetry: true,
    };
  }
  if (err instanceof ExecuteFailedError) {
    const detail = causeMsg(err);
    return {
      title: "Execution failed",
      message: detail || "The AI could not apply the planned changes.",
      hint: "Try again or switch to a different AI adapter.",
      canRetry: true,
    };
  }
  if (err instanceof SessionConflictError) {
    return {
      title: "Session conflict",
      message: "Another AI session is active for this project.",
      hint: err.existingPid
        ? `Process ${err.existingPid} is running. Close it or wait, then retry.`
        : "Close the other session or wait for it to finish.",
      canRetry: true,
    };
  }
  if (err instanceof SecurityViolationError) {
    return {
      title: "Security violation",
      message: err instanceof Error ? err.message : String(err),
      hint: "This operation was blocked for safety. Please report this issue.",
      canRetry: false,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("No changes to apply")) {
    return { title: "Nothing to apply", message: "No visual changes detected.", hint: "Make CSS changes before clicking Apply.", canRetry: false };
  }
  if (msg.includes("No snapshot")) {
    return { title: "Element not captured", message: "Snapshot data missing.", hint: "Re-select the element in the browser.", canRetry: false };
  }
  if (msg.includes("ENOENT") || msg.toLowerCase().includes("not found")) {
    return { title: "AI tool not found", message: msg, hint: "Verify Claude Code or Aider is installed and in PATH.", canRetry: false };
  }
  if (msg.toLowerCase().includes("timeout")) {
    return { title: "Timed out", message: "The AI tool took too long to respond.", hint: "Try with simpler changes or increase timeout.", canRetry: true };
  }
  return { title: "Unexpected error", message: msg || "Something went wrong.", hint: "Try again. If it persists, restart EditUp.", canRetry: true };
}

const browserClipboard = {
  write: (text: string): Promise<void> => navigator.clipboard.writeText(text),
};

function buildRegistry(): AdapterRegistry {
  const reg = new AdapterRegistry();
  reg.register(new ClaudeCodeAdapter());
  reg.register(new AiderAdapter());
  reg.register(new CopyPromptAdapter(browserClipboard));
  return reg;
}

function buildMultiSnapshot(
  cache: Record<string, AgentSnapshot>,
  allOverrides: Record<string, Record<string, Record<string, string>>>,
  textInstructions: string
): EnrichedSnapshot {
  const editedKeys = Object.keys(allOverrides).filter(
    (k) => {
      const stateMap = allOverrides[k];
      return stateMap !== undefined &&
        Object.values(stateMap).some((props) => Object.keys(props).length > 0);
    }
  );
  if (editedKeys.length === 0) {
    throw new Error("No changes to apply");
  }
  const primaryKey = editedKeys[0] as string;
  const primarySnap = cache[primaryKey];
  if (!primarySnap) {
    throw new Error("No snapshot found for edited element");
  }

  const allChanges: CSSChange[] = [];
  const descriptions: string[] = [];

  for (const key of editedKeys) {
    const snap = cache[key];
    if (!snap) continue;
    const stateMap = allOverrides[key] ?? {};
    const computed = snap.base_computed_style ?? snap.computed_style ?? {};
    const elLabel = `<${snap.element.tag}${snap.element.classes.length > 0 ? ` class="${snap.element.classes.join(" ")}"` : ""}>`;
    const perElement: string[] = [];

    for (const [state, props] of Object.entries(stateMap)) {
      for (const [property, value] of Object.entries(props)) {
        const change: CSSChange = {
          property,
          before_computed: computed[property] ?? "",
          after_computed: value,
          expected_final_computed: value,
        };
        if (state !== "default") {
          change.pseudo_state = state as PseudoState;
        }
        allChanges.push(change);
        const stateLabel = state === "default" ? "" : ` (${state})`;
        perElement.push(`  ${property}${stateLabel}: ${computed[property] ?? "unset"} → ${value}`);
      }
    }

    if (editedKeys.length > 1) {
      const src = snap.element.source_file
        ? ` (${snap.element.source_file}:${snap.element.source_line ?? 0})`
        : "";
      descriptions.push(`Element ${elLabel}${src}:\n${perElement.join("\n")}`);
    }
  }

  let combined = "";
  if (editedKeys.length > 1) {
    combined = `Multiple elements edited:\n\n${descriptions.join("\n\n")}`;
    if (textInstructions) combined += `\n\nAdditional instructions: ${textInstructions}`;
  } else {
    combined = textInstructions;
  }

  const base: EnrichedSnapshot = {
    element: primarySnap.element,
    styling: {
      framework: (primarySnap.styling.framework ?? "plain-css") as EnrichedSnapshot["styling"]["framework"],
      class_to_rule_map: primarySnap.styling.class_to_rule_map,
      active_css_variables: primarySnap.styling.active_css_variables,
    },
    changes: allChanges,
  };
  if (combined) base.text_instructions = combined;
  return base;
}

/**
 * Hook managing the full apply flow lifecycle with rate limiting.
 * @param sessionToken - Active session token for adapter context
 * @param canApply - Whether the current license allows applying edits
 * @returns ApplyFlow state and actions
 */
export function useApplyFlow(sessionToken: string, canApply = true): ApplyFlow {
  const [state, setState] = useState<ApplyFlowState>(INITIAL);
  const registryRef = useRef<AdapterRegistry | null>(null);
  const detectionRef = useRef<{ result: DetectionResult; ts: number } | null>(null);

  const set = useCallback(
    (patch: Partial<ApplyFlowState>) =>
      setState((prev) => ({ ...prev, ...patch })),
    []
  );

  const apply = useCallback(
    async (
      snapCache: Record<string, AgentSnapshot>,
      allOverrides: Record<string, Record<string, Record<string, string>>>,
      textInstructions: string,
      projectRoot: string
    ) => {
      if (!canApply) {
        set({ phase: "failed", error: {
          title: "Rate limit reached",
          message: "You've reached your edit limit for this period.",
          hint: "Upgrade your plan or wait for the limit to reset.",
          canRetry: false,
        } });
        return;
      }

      if (!registryRef.current) registryRef.current = buildRegistry();
      const registry = registryRef.current;

      const DETECTION_TTL_MS = 300_000;
      const cached = detectionRef.current;
      const detection = cached && Date.now() - cached.ts < DETECTION_TTL_MS
        ? cached.result
        : await registry.detectAvailable();
      detectionRef.current = { result: detection, ts: Date.now() };

      if (!detection.preferred) {
        set({ phase: "failed", error: {
          title: "No AI tool found",
          message: "EditUp could not detect any compatible AI tool.",
          hint: "Install Claude Code (npm i -g @anthropic-ai/claude-code) or Aider, then restart.",
          canRetry: false,
        } });
        return;
      }

      const adapter: AIAdapter = detection.preferred;

      let snapshot: EnrichedSnapshot;
      try {
        snapshot = buildMultiSnapshot(snapCache, allOverrides, textInstructions);
      } catch (err) {
        set({ phase: "failed", error: classifyError(err) });
        return;
      }

      const context: AdapterContext = { projectRoot, sessionToken };
      const orchestrator = new Orchestrator(adapter);
      const verifier = createVerifier(adapter, snapshot, context);

      set({ phase: "planning", error: null, plan: null, approval: null });

      const result = await orchestrator.run({
        snapshot,
        context,
        expressMode: state.expressMode,
        verifier,
        events: {
          onPhaseChange: (phase) => set({ phase }),
          onApprovalNeeded: (req) => set({ approval: req }),
          onPlanReady: (plan) => set({ plan }),
          onVerificationResult: (v) => set({ verification: v }),
          onError: (err) => set({ error: classifyError(err) }),
        },
      });

      if (result.phase === "completed") {
        try {
          const commit = await invoke<{ hash: string }>(
            "git_auto_commit",
            { message: `editup: ${result.plan?.summary ?? "visual edit"}`, files: [] }
          );
          set({ commitHash: commit.hash, phase: "completed" });

          void recordApply({
            timestamp: new Date().toISOString(),
            project_root: projectRoot,
            element_tag: snapshot.element.tag,
            element_classes: snapshot.element.classes,
            plan_summary: result.plan?.summary ?? "",
            plan_files_count: result.plan?.files.length ?? 0,
            plan_confidence: result.plan?.confidence ?? "high",
            side_effects_count: result.plan?.side_effects.length ?? 0,
            user_approved: true,
            approval_mode: state.expressMode ? "express" : "toast",
            ai_adapter_used: adapter.name,
            files_modified: result.executeResult?.files_modified ?? [],
            duration_ms: result.executeResult?.duration_ms ?? 0,
            verification_visual: result.verification?.visual_check ?? "skipped",
            verification_scope: result.verification?.scope_check ?? "pass",
            verification_diff: result.verification?.diff_check ?? "pass_exact",
            correction_attempts: result.verification?.correction_attempts ?? 0,
            git_commit: commit.hash,
            status: "completed",
          });

          const rl = await invoke<RateLimitState>("increment_edit_count");
          if (rl.blocked) {
            logger.info("Edit limit reached after this apply", {
              edits_used: rl.edits_used,
              edits_limit: rl.edits_limit,
            });
          }
        } catch {
          set({ phase: "completed", commitHash: null });
        }
      }
    },
    [set, state.expressMode, sessionToken, canApply]
  );

  const approve = useCallback(() => {
    state.approval?.approve();
    set({ approval: null });
  }, [state.approval, set]);

  const reject = useCallback(() => {
    state.approval?.reject();
    set({ approval: null });
  }, [state.approval, set]);

  const revert = useCallback(async () => {
    if (!state.commitHash) return;
    try {
      await invoke("git_revert");
      set({ ...INITIAL });
    } catch (err) {
      set({ error: {
        title: "Revert failed",
        message: err instanceof Error ? err.message : String(err),
        hint: "Try reverting manually with git.",
        canRetry: false,
      } });
    }
  }, [state.commitHash, set]);

  const toggleExpress = useCallback(() => {
    setState((prev) => ({ ...prev, expressMode: !prev.expressMode }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, apply, approve, reject, revert, toggleExpress, reset };
}
