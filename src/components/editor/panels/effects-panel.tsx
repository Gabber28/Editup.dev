import type { JSX } from "react";
import { PropRow, SelectRow, SectionLabel } from "./prop-row.js";

export interface EffectsPanelProps {
  values: Record<string, string>;
  onChange(property: string, value: string): void;
}

const BLEND_MODES = [
  "normal", "multiply", "screen", "overlay", "darken", "lighten",
  "color-dodge", "color-burn", "hard-light", "soft-light",
  "difference", "exclusion",
];
const CURSORS = [
  "auto", "default", "pointer", "move", "text", "wait",
  "crosshair", "not-allowed", "grab", "grabbing",
];

export function EffectsPanel(props: EffectsPanelProps): JSX.Element {
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
      <SectionLabel>Opacity & Shadow</SectionLabel>
      {r("Opacity", "opacity")}
      {r("Box Shadow", "box-shadow")}

      <SectionLabel>Transform</SectionLabel>
      {r("Transform", "transform")}
      {r("Transition", "transition")}

      <SectionLabel>Filters</SectionLabel>
      {r("Filter", "filter")}
      {r("Backdrop", "backdrop-filter")}

      <SectionLabel>Misc</SectionLabel>
      <SelectRow
        label="Blend"
        value={values["mix-blend-mode"] ?? "normal"}
        options={BLEND_MODES}
        onChange={(v): void => onChange("mix-blend-mode", v)}
      />
      <SelectRow
        label="Cursor"
        value={values["cursor"] ?? "auto"}
        options={CURSORS}
        onChange={(v): void => onChange("cursor", v)}
      />
    </div>
  );
}
