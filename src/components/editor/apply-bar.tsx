import type { JSX } from "react";
import type { OrchestratorPhase } from "@bridge/orchestrator.js";
import type { ApplyError } from "@/hooks/useApplyFlow.js";

export interface ApplyBarProps {
  phase: OrchestratorPhase;
  hasChanges: boolean;
  commitHash: string | null;
  error: ApplyError | null;
  expressMode: boolean;
  editsUsed?: number | undefined;
  editsLimit?: number | undefined;
  canApply: boolean;
  canUseExpress: boolean;
  onApply(): void;
  onRevert(): void;
  onToggleExpress(): void;
  onReset(): void;
}

const PHASE_LABELS: Record<string, string> = {
  planning: "Planning...",
  awaiting_approval: "Awaiting approval",
  executing: "Applying changes...",
  verifying: "Verifying...",
};

/**
 * Determines the CSS class for the edits counter based on remaining edits.
 * @param remaining - number of edits remaining
 * @returns CSS modifier class name
 */
function counterClass(remaining: number): string {
  if (remaining <= 0) return "apply-bar__counter apply-bar__counter--blocked";
  if (remaining < 3) return "apply-bar__counter apply-bar__counter--warn";
  return "apply-bar__counter";
}

/**
 * Determines the Apply button label based on license/limit state.
 * @param canApply - whether applying is permitted
 * @param hasChanges - whether there are pending changes
 * @param editsLimit - the plan edit limit (undefined if license not loaded)
 * @returns button label string
 */
function applyLabel(canApply: boolean, hasChanges: boolean, editsLimit?: number): string {
  if (!canApply) {
    return editsLimit !== undefined ? "Limit reached" : "License required";
  }
  if (!hasChanges) return "Apply";
  return "Apply";
}

export function ApplyBar(props: ApplyBarProps): JSX.Element {
  const { phase, hasChanges, commitHash, error, canApply, canUseExpress } = props;
  const busy = phase === "planning" || phase === "executing" || phase === "verifying";
  const label = PHASE_LABELS[phase];

  if (error) {
    return (
      <div className="apply-bar apply-bar--error">
        <div className="apply-bar__error-detail">
          <span className="apply-bar__error-title">{error.title}</span>
          <span className="apply-bar__error-msg">{error.message}</span>
          <span className="apply-bar__error-hint">{error.hint}</span>
        </div>
        <div className="apply-bar__error-actions">
          {error.canRetry && (
            <button type="button" className="apply-bar__btn apply-bar__btn--retry" onClick={props.onApply}>
              Try again
            </button>
          )}
          <button type="button" className="apply-bar__btn" onClick={props.onReset}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (phase === "completed" && commitHash) {
    return (
      <div className="apply-bar apply-bar--done">
        <span className="apply-bar__msg">
          Applied ({commitHash})
        </span>
        <button type="button" className="apply-bar__btn" onClick={props.onRevert}>
          Revert
        </button>
        <button type="button" className="apply-bar__btn" onClick={props.onReset}>
          Done
        </button>
      </div>
    );
  }

  if (busy) {
    return (
      <div className="apply-bar apply-bar--busy">
        <div className="apply-bar__spinner" />
        <span className="apply-bar__msg">{label}</span>
      </div>
    );
  }

  const remaining = props.editsLimit !== undefined && props.editsUsed !== undefined
    ? props.editsLimit - props.editsUsed
    : undefined;

  return (
    <div className="apply-bar">
      {canUseExpress && (
        <label className="apply-bar__express">
          <input
            type="checkbox"
            checked={props.expressMode}
            onChange={props.onToggleExpress}
          />
          <span>Express</span>
        </label>
      )}
      {props.editsLimit !== undefined && props.editsUsed !== undefined && (
        <span className={counterClass(remaining as number)}>
          {props.editsUsed}/{props.editsLimit} edits
        </span>
      )}
      <button
        type="button"
        className="apply-bar__btn apply-bar__btn--primary"
        disabled={!canApply || !hasChanges}
        onClick={props.onApply}
      >
        {applyLabel(canApply, hasChanges, props.editsLimit)}
      </button>
    </div>
  );
}
