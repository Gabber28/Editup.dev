import type { JSX } from "react";
import { PropRow, SelectRow, SectionLabel } from "./prop-row.js";

export interface BorderPanelProps {
  values: Record<string, string>;
  onChange(property: string, value: string): void;
}

const BORDER_STYLES = [
  "none", "solid", "dashed", "dotted", "double",
  "groove", "ridge", "inset", "outset",
];

export function BorderPanel(props: BorderPanelProps): JSX.Element {
  const { values, onChange } = props;
  const r = (label: string, prop: string): JSX.Element => (
    <PropRow
      key={prop}
      label={label}
      value={values[prop] ?? ""}
      onChange={(v): void => onChange(prop, v)}
    />
  );

  return (
    <div>
      <SectionLabel>Border</SectionLabel>
      {r("Width", "border-top-width")}
      <SelectRow
        label="Style"
        value={values["border-top-style"] ?? "none"}
        options={BORDER_STYLES}
        onChange={(v): void => onChange("border-top-style", v)}
      />
      {r("Color", "border-top-color")}

      <SectionLabel>Radius</SectionLabel>
      {r("Top L", "border-top-left-radius")}
      {r("Top R", "border-top-right-radius")}
      {r("Bot R", "border-bottom-right-radius")}
      {r("Bot L", "border-bottom-left-radius")}

      <SectionLabel>Outline</SectionLabel>
      {r("Width", "outline-width")}
      <SelectRow
        label="Style"
        value={values["outline-style"] ?? "none"}
        options={BORDER_STYLES}
        onChange={(v): void => onChange("outline-style", v)}
      />
      {r("Color", "outline-color")}
      {r("Offset", "outline-offset")}
    </div>
  );
}
