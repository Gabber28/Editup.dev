import type { JSX } from "react";

export interface ProgressItem {
  label: string;
  done: boolean;
}

export interface ProgressMarkerProps {
  items: ProgressItem[];
}

export function ProgressMarker(props: ProgressMarkerProps): JSX.Element {
  return (
    <div className="progress-marker">
      <span style={{ color: "var(--color-muted)" }}>Edited:</span>
      {props.items.map((item) => (
        <span
          key={item.label}
          className={`progress-marker__dot progress-marker__dot--${
            item.done ? "done" : "pending"
          }`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
