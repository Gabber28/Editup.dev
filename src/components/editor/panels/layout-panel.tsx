import type { JSX } from "react";
import { PropRow, SelectRow, SectionLabel } from "./prop-row.js";

export interface LayoutPanelProps {
  values: Record<string, string>;
  onChange(property: string, value: string): void;
}

const DISPLAYS = [
  "block", "flex", "grid", "inline", "inline-block",
  "inline-flex", "inline-grid", "none",
];
const FLEX_DIRECTIONS = ["row", "row-reverse", "column", "column-reverse"];
const JUSTIFY = [
  "flex-start", "flex-end", "center",
  "space-between", "space-around", "space-evenly",
];
const ALIGN = ["flex-start", "flex-end", "center", "stretch", "baseline"];
const FLEX_WRAPS = ["nowrap", "wrap", "wrap-reverse"];
const POSITIONS = ["static", "relative", "absolute", "fixed", "sticky"];
const OVERFLOWS = ["visible", "hidden", "scroll", "auto"];

export function LayoutPanel(props: LayoutPanelProps): JSX.Element {
  const { values, onChange } = props;
  const r = (label: string, prop: string): JSX.Element => (
    <PropRow
      key={prop}
      label={label}
      value={values[prop] ?? ""}
      onChange={(v): void => onChange(prop, v)}
    />
  );
  const s = (label: string, prop: string, opts: string[]): JSX.Element => (
    <SelectRow
      key={prop}
      label={label}
      value={values[prop] ?? opts[0] ?? ""}
      options={opts}
      onChange={(v): void => onChange(prop, v)}
    />
  );

  return (
    <div>
      <SectionLabel>Display</SectionLabel>
      {s("Display", "display", DISPLAYS)}
      {s("Direction", "flex-direction", FLEX_DIRECTIONS)}
      {s("Justify", "justify-content", JUSTIFY)}
      {s("Align", "align-items", ALIGN)}
      {s("Wrap", "flex-wrap", FLEX_WRAPS)}

      <SectionLabel>Position</SectionLabel>
      {s("Position", "position", POSITIONS)}
      {r("Top", "top")}
      {r("Right", "right")}
      {r("Bottom", "bottom")}
      {r("Left", "left")}
      {r("Z-Index", "z-index")}

      <SectionLabel>Overflow</SectionLabel>
      {s("Overflow X", "overflow-x", OVERFLOWS)}
      {s("Overflow Y", "overflow-y", OVERFLOWS)}
    </div>
  );
}
