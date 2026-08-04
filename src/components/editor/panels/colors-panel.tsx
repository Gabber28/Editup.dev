import { useRef, useState, type JSX } from "react";
import { ColorPicker } from "./color-picker.js";
import { ColorPopover } from "./color-popover.js";
import { GradientSection } from "./gradient-section.js";
import { parseColor, rgbToHex } from "@/lib/color.js";

export interface ColorsPanelProps {
  values: Record<string, string>;
  onChange(property: string, value: string): void;
}

function displayHex(value: string): string {
  const rgb = parseColor(value);
  return rgb ? rgbToHex(rgb) : value || "—";
}

function ColorField(props: {
  label: string;
  cssProp: string;
  value: string;
  open: boolean;
  onToggle(): void;
  onClose(): void;
  onChange(property: string, value: string): void;
}): JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={props.onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "4px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: "1px solid var(--color-border)",
            background: props.value || "transparent",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "var(--color-muted)",
          }}
        >
          {props.label}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-fg)",
          }}
        >
          {displayHex(props.value)}
        </span>
      </button>

      {props.open && (
        <ColorPopover anchor={buttonRef.current} onClose={props.onClose}>
          <ColorPicker
            value={props.value}
            onChange={(hex): void => props.onChange(props.cssProp, hex)}
          />
        </ColorPopover>
      )}
    </div>
  );
}

export function ColorsPanel(props: ColorsPanelProps): JSX.Element {
  const [openProp, setOpenProp] = useState<string | null>(null);

  const toggle = (cssProp: string): void =>
    setOpenProp((cur) => (cur === cssProp ? null : cssProp));
  const close = (): void => setOpenProp(null);

  return (
    <div>
      <ColorField
        label="Background"
        cssProp="background-color"
        value={props.values["background-color"] ?? ""}
        open={openProp === "background-color"}
        onToggle={(): void => toggle("background-color")}
        onClose={close}
        onChange={props.onChange}
      />
      <ColorField
        label="Color"
        cssProp="color"
        value={props.values["color"] ?? ""}
        open={openProp === "color"}
        onToggle={(): void => toggle("color")}
        onClose={close}
        onChange={props.onChange}
      />
      <GradientSection values={props.values} onChange={props.onChange} />
    </div>
  );
}
