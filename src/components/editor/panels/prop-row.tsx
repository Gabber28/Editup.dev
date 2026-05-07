import type { JSX } from "react";

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--color-muted)",
  minWidth: 80,
};

const INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  padding: "4px 8px",
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 4,
  color: "var(--color-fg)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
};

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};

export interface PropRowProps {
  label: string;
  value: string;
  onChange(value: string): void;
}

export function PropRow(props: PropRowProps): JSX.Element {
  return (
    <label style={ROW_STYLE}>
      <span style={LABEL_STYLE}>{props.label}</span>
      <input
        type="text"
        value={props.value}
        onChange={(ev): void => props.onChange(ev.currentTarget.value)}
        style={INPUT_STYLE}
      />
    </label>
  );
}

export interface SelectRowProps {
  label: string;
  value: string;
  options: string[];
  onChange(value: string): void;
}

export function SelectRow(props: SelectRowProps): JSX.Element {
  return (
    <label style={ROW_STYLE}>
      <span style={LABEL_STYLE}>{props.label}</span>
      <select
        value={props.value}
        onChange={(ev): void => props.onChange(ev.currentTarget.value)}
        style={{ ...INPUT_STYLE, padding: "4px 4px" }}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SectionLabel(props: { children: string }): JSX.Element {
  return (
    <div
      style={{
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "var(--color-accent-light)",
        marginTop: 12,
        marginBottom: 6,
      }}
    >
      {props.children}
    </div>
  );
}
