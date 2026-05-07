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
import type { EnrichedSnapshot, CSSChange } from "@/types/snapshot.js";
import type { AIAdapter, AdapterContext } from "@/lib/ai-adapters/types.js";
import { AdapterRegistry } from "@/lib/ai-adapters/registry.js";
import { ClaudeCodeAdapter } from "@/lib/ai-adapters/claude-code.js";
import { AiderAdapter } from "@/lib/ai-adapters/aider.js";
import { CopyPromptAdapter } from "@/lib/ai-adapters/copy-prompt.js";
import { createVerifier } from "@/lib/verify-flow.js";
import { logger } from "@/lib/logger.js";
import { recordApply } from "@/lib/history-logger.js";
import type { AgentSnapshot } from "./useAgentConnection.js";

export interface ApplyFlowState {
  phase: OrchestratorPhase;
  plan: EditPlan | null;
  approval: ApprovalRequest | null;
  verification: VerificationResult | null;
  commitHash: string | null;
  error: string | null;
  expressMode: boolean;
}

export interface ApplyFlowActions {
  apply(
    snapshot: AgentSnapshot,
    overrides: Record<string, string>,
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

function buildSnapshot(
  agent: AgentSnapshot,
  overrides: Record<string, string>,
  textInstructions: string
): EnrichedSnapshot {
  const computed = agent.computed_style ?? {};
  const changes: CSSChange[] = Object.entries(overrides).map(
    ([property, value]) => ({
      property,
      before_computed: computed[property] ?? "",
      after_computed: value,
      expected_final_computed: value,
    })
  );
  const base: EnrichedSnapshot = {
    element: agent.element,
    styling: {
      framework: (agent.styling.framework ?? "plain-css") as EnrichedSnapshot["styling"]["framework"],
      class_to_rule_map: agent.styling.class_to_rule_map,
      active_css_variables: agent.styling.active_css_variables,
    },
    changes,
  };
  if (textInstructions) base.text_instructions = textInstructions;
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

  const set = useCallback(
    (patch: Partial<ApplyFlowState>) =>
      setState((prev) => ({ ...prev, ...patch })),
    []
  );

  const apply = useCallback(
    async (
      agentSnap: AgentSnapshot,
      overrides: Record<string, string>,
      textInstructions: string,
      projectRoot: string
    ) => {
      if (!canApply) {
        set({ phase: "failed", error: "Edit limit reached. Upgrade your plan or wait for reset." });
        return;
      }

      if (!registryRef.current) registryRef.current = buildRegistry();
      const registry = registryRef.current;

      const detection = await registry.detectAvailable();
      if (!detection.preferred) {
        set({ phase: "failed", error: "No AI adapter found. Install Claude Code or Aider." });
        return;
      }

      const adapter: AIAdapter = detection.preferred;
      const snapshot = buildSnapshot(agentSnap, overrides, textInstructions);
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
          onError: (err) => set({ error: err.message }),
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
      set({ error: `Revert failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  }, [state.commitHash, set]);

  const toggleExpress = useCallback(() => {
    setState((prev) => ({ ...prev, expressMode: !prev.expressMode }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, apply, approve, reject, revert, toggleExpress, reset };
}
