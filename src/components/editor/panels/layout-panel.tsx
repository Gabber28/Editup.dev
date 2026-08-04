import type { JSX } from "react";
import type { ElementInfo } from "@/types/snapshot.js";
import { PropRow, SelectRow, SectionLabel } from "./prop-row.js";
import { PositionControls } from "./position-controls.js";

export interface LayoutPanelProps {
  values: Record<string, string>;
  onChange(property: string, value: string): void;
  /** Selected element — supplies the parent layout the Position controls need. */
  element?: ElementInfo | null;
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

/** Identity of the selected element, used to reset per-element control state. */
function elementKey(el?: ElementInfo | null): string {
  if (!el) return "none";
  return `${el.tag}#${el.id ?? ""}.${el.classes.join(".")}@${el.source_file ?? ""}:${el.source_line ?? 0}`;
}

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
      <PositionControls
        // Re-keyed per element so no transient hint carries over on reselect.
        key={elementKey(props.element)}
        element={props.element ?? null}
        values={values}
        onChange={onChange}
      />
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
