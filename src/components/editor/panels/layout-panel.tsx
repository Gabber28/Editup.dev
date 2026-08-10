import type { JSX } from "react";
import type { ElementInfo, MatchingRule } from "@/types/snapshot.js";
import { SelectRow, SectionLabel } from "./prop-row.js";
import { PositionControls } from "./position-controls.js";

export interface LayoutPanelProps {
  values: Record<string, string>;
  onChange(property: string, value: string): void;
  /** Selected element — supplies the parent layout the Position controls need. */
  element?: ElementInfo | null;
  /** This element+state's own edits, for the authored/computed distinction. */
  overrides?: Record<string, string>;
  /** Rules governing the element, for the authored/computed distinction. */
  rules?: readonly MatchingRule[];
  /** Removes a declaration, rather than writing a literal `auto`. */
  onClear?(property: string): void;
}

const DISPLAYS = [
  "block",
  "flex",
  "grid",
  "inline",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "none",
];
const FLEX_DIRECTIONS = ["row", "row-reverse", "column", "column-reverse"];
const JUSTIFY = [
  "flex-start",
  "flex-end",
  "center",
  "space-between",
  "space-around",
  "space-evenly",
];
const ALIGN = ["flex-start", "flex-end", "center", "stretch", "baseline"];
const FLEX_WRAPS = ["nowrap", "wrap", "wrap-reverse"];
const OVERFLOWS = ["visible", "hidden", "scroll", "auto"];

/** Identity of the selected element, used to reset per-element control state. */
function elementKey(el?: ElementInfo | null): string {
  if (!el) return "none";
  return `${el.tag}#${el.id ?? ""}.${el.classes.join(".")}@${el.source_file ?? ""}:${el.source_line ?? 0}`;
}

export function LayoutPanel(props: LayoutPanelProps): JSX.Element {
  const { values, onChange } = props;
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

      {/* The Position block owns the mode select, the offsets and z-index — the
          separate rows that used to duplicate them are gone. */}
      <PositionControls
        // Re-keyed per element so no transient hint carries over on reselect.
        key={elementKey(props.element)}
        element={props.element ?? null}
        values={values}
        {...(props.overrides ? { overrides: props.overrides } : {})}
        {...(props.rules ? { rules: props.rules } : {})}
        onChange={onChange}
        {...(props.onClear ? { onClear: props.onClear } : {})}
      />

      <SectionLabel>Overflow</SectionLabel>
      {s("Overflow X", "overflow-x", OVERFLOWS)}
      {s("Overflow Y", "overflow-y", OVERFLOWS)}
    </div>
  );
}
