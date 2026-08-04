import type { JSX } from "react";
import type { OrchestratorPhase } from "@bridge/orchestrator.js";
import type { ApplyError } from "@/hooks/useApplyFlow.js";
import type { VerificationResult } from "@/types/execute.js";
import { hasVerificationWarnings } from "@/types/execute.js";

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
  /** Drag drops the element where released instead of snapping between siblings. */
  freeEdit: boolean;
  /** Post-apply checks; drives the warning shown when fidelity was not proven. */
  verification?: VerificationResult | null;
  onApply(): void;
  onRevert(): void;
  onToggleExpress(): void;
  onToggleFreeEdit(): void;
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

const CHECK_LABELS: Record<string, string> = {
  unverified: "the page could not be checked after the edit",
  fail: "the applied values do not match what you set",
  no_git: "no git repository here, so the file audit had no witness",
};

/**
 * States plainly what could not be proven and which element diverged, instead
 * of showing a green "Applied" the run did not earn.
 */
function VerificationWarning(props: { verification: VerificationResult }): JSX.Element {
  const { verification: v } = props;
  const reasons = [
    v.visual_check === "unverified" || v.visual_check === "fail"
      ? CHECK_LABELS[v.visual_check]
      : null,
    v.diff_check === "no_git" ? CHECK_LABELS["no_git"] : null,
    v.scope_check === "fail" ? "the change leaked to other elements" : null,
  ].filter(Boolean);

  return (
    <div className="apply-bar__error-detail">
      <span className="apply-bar__error-title">Applied, but not verified</span>
      {reasons.map((r) => (
        <span key={r} className="apply-bar__error-msg">
          {r}
        </span>
      ))}
      {(v.divergences ?? []).slice(0, 4).map((d) => (
        <span key={`${d.element}-${d.property}`} className="apply-bar__error-hint">
          {d.element} · {d.property}: expected {d.expected}, got {d.actual}
        </span>
      ))}
      {v.correction_attempts > 0 && (
        <span className="apply-bar__error-hint">
          {v.correction_attempts} correction attempt
          {v.correction_attempts === 1 ? "" : "s"} did not close the gap
        </span>
      )}
    </div>
  );
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

  if (phase === "completed") {
    const warn = hasVerificationWarnings(props.verification ?? null);
    return (
      <div className={`apply-bar ${warn ? "apply-bar--warn" : "apply-bar--done"}`}>
        {warn ? (
          <VerificationWarning verification={props.verification as VerificationResult} />
        ) : (
          <span className="apply-bar__msg">
            Applied{commitHash ? ` (${commitHash})` : ""}
          </span>
        )}
        <div className="apply-bar__error-actions">
          {commitHash && (
            <button type="button" className="apply-bar__btn" onClick={props.onRevert}>
              Revert
            </button>
          )}
          <button type="button" className="apply-bar__btn" onClick={props.onReset}>
            Done
          </button>
        </div>
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
        className={`apply-bar__btn apply-bar__btn--mode${
          props.freeEdit ? " apply-bar__btn--mode-on" : ""
        }`}
        aria-pressed={props.freeEdit}
        title={
          props.freeEdit
            ? "Free edit: dragging drops the element where you release it"
            : "Snap: dragging slots the element between its siblings"
        }
        onClick={props.onToggleFreeEdit}
      >
        Free edit
      </button>
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
