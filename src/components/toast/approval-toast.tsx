import type { JSX } from "react";
import type { EditPlan } from "../../types/edit-plan.js";

export interface ApprovalToastProps {
  plan: EditPlan;
  onApprove(): void;
  onReject(): void;
  onShowDetails?(): void;
}

export function ApprovalToast(props: ApprovalToastProps): JSX.Element {
  const { plan } = props;
  const expanded =
    plan.confidence === "low" ||
    plan.recommended_action === "consider_alternatives";

  const fileNames = plan.files.map((f) => f.path).join(", ");

  return (
    <div className="toast" role="alertdialog">
      <div className="toast__title">
        Apply changes? ({plan.files.length} {plan.files.length === 1 ? "file" : "files"})
      </div>
      <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
        {fileNames}
      </div>

      {plan.side_effects.length > 0 && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "var(--color-accent-light)",
          }}
        >
          ⚠ {plan.side_effects.join("; ")}
        </div>
      )}

      {expanded && plan.alternatives && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600 }}>Alternatives:</div>
          <ul style={{ fontSize: 11, paddingLeft: 16, margin: "4px 0" }}>
            {plan.alternatives.map((alt) => (
              <li key={alt.description}>{alt.description}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="toast__actions">
        <button
          type="button"
          className="toast__btn toast__btn--primary"
          onClick={props.onApprove}
        >
          Apply
        </button>
        {props.onShowDetails && (
          <button
            type="button"
            className="toast__btn"
            onClick={props.onShowDetails}
          >
            Details
          </button>
        )}
        <button
          type="button"
          className="toast__btn"
          onClick={props.onReject}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
