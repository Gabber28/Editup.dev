import type { JSX } from "react";
import { PropRow, SectionLabel } from "./prop-row.js";

export interface SpacingPanelProps {
  values: Record<string, string>;
  onChange(property: string, value: string): void;
}

function row(
  label: string,
  prop: string,
  values: Record<string, string>,
  onChange: (p: string, v: string) => void,
): JSX.Element {
  return (
    <PropRow
      key={prop}
      label={label}
      value={values[prop] ?? ""}
      onChange={(v): void => onChange(prop, v)}
    />
  );
}

export function SpacingPanel(props: SpacingPanelProps): JSX.Element {
  const { values, onChange } = props;
  return (
    <div>
      <SectionLabel>Margin</SectionLabel>
      {row("Top", "margin-top", values, onChange)}
      {row("Right", "margin-right", values, onChange)}
      {row("Bottom", "margin-bottom", values, onChange)}
      {row("Left", "margin-left", values, onChange)}

      <SectionLabel>Padding</SectionLabel>
      {row("Top", "padding-top", values, onChange)}
      {row("Right", "padding-right", values, onChange)}
      {row("Bottom", "padding-bottom", values, onChange)}
      {row("Left", "padding-left", values, onChange)}

      <SectionLabel>Size</SectionLabel>
      {row("Width", "width", values, onChange)}
      {row("Height", "height", values, onChange)}
      {row("Min W", "min-width", values, onChange)}
      {row("Max W", "max-width", values, onChange)}
      {row("Min H", "min-height", values, onChange)}
      {row("Max H", "max-height", values, onChange)}

      <SectionLabel>Gap</SectionLabel>
      {row("Gap", "gap", values, onChange)}
    </div>
  );
}
