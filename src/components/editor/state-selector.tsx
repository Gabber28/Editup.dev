import type { JSX } from "react";
import type { PseudoState } from "@/types/snapshot.js";

export interface StateSelectorProps {
  availableStates: PseudoState[];
  active: PseudoState;
  onSelect(state: PseudoState): void;
}

const STATE_LABELS: Record<string, string> = {
  default: "Default",
  ":hover": "Hover",
  ":focus": "Focus",
  ":active": "Active",
  ":focus-visible": "Focus-V",
  ":focus-within": "Focus-W",
  ":visited": "Visited",
  ":checked": "Checked",
  ":disabled": "Disabled",
};

export function StateSelector(props: StateSelectorProps): JSX.Element | null {
  if (props.availableStates.length <= 1) return null;

  return (
    <div className="state-selector">
      {props.availableStates.map((state) => (
        <button
          key={state}
          type="button"
          className={`state-selector__pill ${
            props.active === state ? "state-selector__pill--active" : ""
          }`}
          onClick={(): void => props.onSelect(state)}
        >
          {STATE_LABELS[state] ?? state}
        </button>
      ))}
    </div>
  );
}
