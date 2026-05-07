import type { JSX } from "react";
import { PropRow, SelectRow } from "./prop-row.js";

export interface TypographyPanelProps {
  values: Record<string, string>;
  onChange(property: string, value: string): void;
}

const FONT_WEIGHTS = [
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
  "normal", "bold",
];

const TEXT_ALIGNS = ["left", "center", "right", "justify"];
const TEXT_DECORATIONS = ["none", "underline", "line-through", "overline"];
const TEXT_TRANSFORMS = ["none", "uppercase", "lowercase", "capitalize"];

export function TypographyPanel(props: TypographyPanelProps): JSX.Element {
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
      {r("Family", "font-family")}
      {r("Size", "font-size")}
      <SelectRow
        label="Weight"
        value={values["font-weight"] ?? "400"}
        options={FONT_WEIGHTS}
        onChange={(v): void => onChange("font-weight", v)}
      />
      {r("Line H.", "line-height")}
      {r("Spacing", "letter-spacing")}
      <SelectRow
        label="Align"
        value={values["text-align"] ?? "left"}
        options={TEXT_ALIGNS}
        onChange={(v): void => onChange("text-align", v)}
      />
      <SelectRow
        label="Decor."
        value={values["text-decoration-line"] ?? "none"}
        options={TEXT_DECORATIONS}
        onChange={(v): void => onChange("text-decoration-line", v)}
      />
      <SelectRow
        label="Transform"
        value={values["text-transform"] ?? "none"}
        options={TEXT_TRANSFORMS}
        onChange={(v): void => onChange("text-transform", v)}
      />
    </div>
  );
}
