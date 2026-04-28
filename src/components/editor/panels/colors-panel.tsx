import type { JSX } from "react";

export interface ColorsPanelProps {
  background?: string;
  color?: string;
  onChange(prop: string, value: string): void;
}

export function ColorsPanel(props: ColorsPanelProps): JSX.Element {
  return (
    <div>
      <PropRow
        label="Background"
        value={props.background ?? ""}
        onChange={(v): void => props.onChange("background-color", v)}
      />
      <PropRow
        label="Color"
        value={props.color ?? ""}
        onChange={(v): void => props.onChange("color", v)}
      />
    </div>
  );
}

interface PropRowProps {
  label: string;
  value: string;
  onChange(value: string): void;
}

function PropRow(props: PropRowProps): JSX.Element {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      }}
    >
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--color-muted)",
          minWidth: 80,
        }}
      >
        {props.label}
      </span>
      <input
        type="text"
        value={props.value}
        onChange={(ev): void => props.onChange(ev.currentTarget.value)}
        style={{
          flex: 1,
          padding: "4px 8px",
          background: "var(--color-card)",
          border: "1px solid var(--color-border)",
          borderRadius: 4,
          color: "var(--color-fg)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
        }}
      />
    </label>
  );
}
