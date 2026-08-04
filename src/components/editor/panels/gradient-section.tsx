import type { JSX } from "react";
import { GradientEditor } from "./gradient-editor.js";
import {
  composeGradients,
  defaultGradient,
  parseGradient,
  parseGradientLayers,
  serializeGradient,
  type Gradient,
  type GradientLayers,
} from "@/lib/gradient.js";

export interface GradientSectionProps {
  values: Record<string, string>;
  onChange(property: string, value: string): void;
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--color-accent-light)",
  margin: "14px 0 8px",
};

const MINI_BTN: React.CSSProperties = {
  fontSize: 10,
  padding: "5px 8px",
  borderRadius: 4,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  color: "var(--color-fg)",
  cursor: "pointer",
};

/**
 * Two independent gradient controls — Background and Text — that can both be
 * active at once. They compose into layered `background-image` + per-layer
 * `background-clip` (text layer first, painting the glyphs over the background).
 *
 * @param props Current computed values and the change handler
 * @returns The gradient section UI
 */
export function GradientSection(props: GradientSectionProps): JSX.Element {
  const { values, onChange } = props;
  const clip = values["-webkit-background-clip"] || values["background-clip"] || "";
  const layers = parseGradientLayers(values["background-image"] ?? "", clip);

  const applyLayers = (next: GradientLayers): void => {
    const composed = composeGradients(next);
    onChange("background-image", composed["background-image"]);
    onChange("background-clip", composed["background-clip"]);
    onChange("-webkit-background-clip", composed["-webkit-background-clip"]);
    onChange("-webkit-text-fill-color", composed["-webkit-text-fill-color"]);
  };

  return (
    <div>
      <LayerBlock
        label="Background gradient"
        gradient={layers.background}
        onAdd={(): void => applyLayers({ ...layers, background: defaultGradient() })}
        onEdit={(g): void => applyLayers({ ...layers, background: g })}
        onRemove={(): void => applyLayers({ ...layers, background: null })}
      />
      <LayerBlock
        label="Text gradient"
        gradient={layers.text}
        isText
        onAdd={(): void => applyLayers({ ...layers, text: defaultGradient() })}
        onEdit={(g): void => applyLayers({ ...layers, text: g })}
        onRemove={(): void => applyLayers({ ...layers, text: null })}
      />
    </div>
  );
}

function LayerBlock(props: {
  label: string;
  gradient: Gradient | null;
  isText?: boolean;
  onAdd(): void;
  onEdit(g: Gradient): void;
  onRemove(): void;
}): JSX.Element {
  return (
    <div>
      <div style={{ ...SECTION_LABEL, display: "flex", alignItems: "center", gap: 8 }}>
        <span>{props.label}</span>
        {props.gradient && (
          <button
            type="button"
            onClick={props.onRemove}
            style={{ ...MINI_BTN, marginLeft: "auto", padding: "2px 7px" }}
          >
            Remove
          </button>
        )}
      </div>

      {props.gradient ? (
        <>
          {props.isText && (
            <p style={{ fontSize: 10, color: "var(--color-muted)", margin: "0 0 8px" }}>
              This text is painted by a gradient — the Color field above has no visible effect.
            </p>
          )}
          <GradientEditor
            value={serializeGradient(props.gradient)}
            onChange={(css): void => {
              const g = parseGradient(css);
              if (g) props.onEdit(g);
            }}
          />
        </>
      ) : (
        <button type="button" onClick={props.onAdd} style={{ ...MINI_BTN, width: "100%" }}>
          + Add {props.isText ? "text" : "background"} gradient
        </button>
      )}
    </div>
  );
}
