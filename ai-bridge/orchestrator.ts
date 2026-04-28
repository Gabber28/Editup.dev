import type { EnrichedSnapshot } from "@/types/snapshot.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type { ExecuteResult, VerificationResult } from "@/types/execute.js";
import type {
  AIAdapter,
  AdapterContext,
} from "@/lib/ai-adapters/types.js";
import { runPlan } from "./plan.js";
import { runExecute } from "./execute.js";
import { logger } from "@/lib/logger.js";

export type OrchestratorPhase =
  | "idle"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled";

export interface ApprovalRequest {
  plan: EditPlan;
  approve: () => void;
  reject: () => void;
}

export interface OrchestratorEvents {
  onPhaseChange?(phase: OrchestratorPhase): void;
  onApprovalNeeded?(request: ApprovalRequest): void;
  onPlanReady?(plan: EditPlan): void;
  onExecuteResult?(result: ExecuteResult): void;
  onVerificationResult?(result: VerificationResult): void;
  onError?(err: Error): void;
}

export interface OrchestratorRunInput {
  snapshot: EnrichedSnapshot;
  context: AdapterContext;
  expressMode?: boolean;
  verifier?: (
    plan: EditPlan,
    result: ExecuteResult
  ) => Promise<VerificationResult>;
  events?: OrchestratorEvents;
}

export interface OrchestratorRunOutput {
  phase: OrchestratorPhase;
  plan?: EditPlan;
  executeResult?: ExecuteResult;
  verification?: VerificationResult;
  error?: Error;
}

export class Orchestrator {
  constructor(private readonly adapter: AIAdapter) {}

  async run(input: OrchestratorRunInput): Promise<OrchestratorRunOutput> {
    const { snapshot, context, expressMode, verifier, events } = input;
    const out: OrchestratorRunOutput = { phase: "idle" };

    try {
      events?.onPhaseChange?.("planning");
      out.phase = "planning";
      const plan = await runPlan(this.adapter, snapshot, context);
      out.plan = plan;
      events?.onPlanReady?.(plan);

      const skipApproval =
        expressMode === true &&
        plan.confidence === "high" &&
        plan.side_effects.length === 0;

      if (!skipApproval) {
        events?.onPhaseChange?.("awaiting_approval");
        out.phase = "awaiting_approval";
        const approved = await this.requestApproval(plan, events);
        if (!approved) {
          out.phase = "cancelled";
          events?.onPhaseChange?.("cancelled");
          logger.info("orchestrator cancelled by user", {
            adapter: this.adapter.name,
          });
          return out;
        }
      } else {
        logger.info("orchestrator express mode — skipping approval", {
          adapter: this.adapter.name,
        });
      }

      events?.onPhaseChange?.("executing");
      out.phase = "executing";
      const executeResult = await runExecute(
        this.adapter,
        plan,
        snapshot,
        context
      );
      out.executeResult = executeResult;
      events?.onExecuteResult?.(executeResult);

      if (verifier) {
        events?.onPhaseChange?.("verifying");
        out.phase = "verifying";
        const verification = await verifier(plan, executeResult);
        out.verification = verification;
        events?.onVerificationResult?.(verification);
      }

      out.phase = "completed";
      events?.onPhaseChange?.("completed");
      return out;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      out.error = error;
      out.phase = "failed";
      events?.onPhaseChange?.("failed");
      events?.onError?.(error);
      logger.error("orchestrator failed", {
        adapter: this.adapter.name,
        phase: out.phase,
        error: error.message,
      });
      return out;
    }
  }

  private requestApproval(
    plan: EditPlan,
    events?: OrchestratorEvents
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!events?.onApprovalNeeded) {
        resolve(true);
        return;
      }
      events.onApprovalNeeded({
        plan,
        approve: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }
}
