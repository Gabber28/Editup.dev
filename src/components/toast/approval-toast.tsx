import { useEffect, useRef, type JSX } from "react";
import type { EditPlan } from "../../types/edit-plan.js";

export interface ApprovalToastProps {
  plan: EditPlan;
  onApprove(): void;
  onReject(): void;
  onShowDetails?(): void;
}

export function ApprovalToast(props: ApprovalToastProps): JSX.Element {
  const { plan } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const expanded =
    plan.confidence === "low" ||
    plan.recommended_action === "consider_alternatives";

  const fileNames = plan.files.map((f) => f.path).join(", ");

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (ev: KeyboardEvent): void => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        props.onApprove();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        props.onReject();
      }
    };
    document.addEventListener("keydown", handler);
    return (): void => document.removeEventListener("keydown", handler);
  }, [props.onApprove, props.onReject]);

  return (
    <div className="toast" role="alertdialog" ref={containerRef} tabIndex={-1}>
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
          Side effects: {plan.side_effects.join("; ")}
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
          Apply (Enter)
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
          Cancel (Esc)
        </button>
      </div>
    </div>
  );
}
