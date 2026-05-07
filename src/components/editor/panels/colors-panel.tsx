import type { JSX } from "react";
import { PropRow } from "./prop-row.js";

export interface ColorsPanelProps {
  values: Record<string, string>;
  onChange(property: string, value: string): void;
}

const COLOR_SWATCH: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 3,
  border: "1px solid var(--color-border)",
  flexShrink: 0,
};

function ColorRow(props: {
  label: string;
  cssProp: string;
  value: string;
  onChange(property: string, value: string): void;
}): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ ...COLOR_SWATCH, background: props.value || "transparent" }} />
      <div style={{ flex: 1 }}>
        <PropRow
          label={props.label}
          value={props.value}
          onChange={(v): void => props.onChange(props.cssProp, v)}
        />
      </div>
    </div>
  );
}

export function ColorsPanel(props: ColorsPanelProps): JSX.Element {
  return (
    <div>
      <ColorRow
        label="Background"
        cssProp="background-color"
        value={props.values["background-color"] ?? ""}
        onChange={props.onChange}
      />
      <ColorRow
        label="Color"
        cssProp="color"
        value={props.values["color"] ?? ""}
        onChange={props.onChange}
      />
    </div>
  );
}
