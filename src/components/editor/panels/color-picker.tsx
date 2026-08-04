import { useEffect, useState, type JSX } from "react";
import { ColorWheel } from "./color-wheel.js";
import {
  formatColor,
  hsvToHex,
  hsvToRgb,
  parseAlpha,
  parseColor,
  rgbToHsv,
  type Hsv,
} from "@/lib/color.js";

export interface ColorPickerProps {
  /** Current CSS color (hex, rgb(), or rgba()). */
  value: string;
  onChange(color: string): void;
}

const DEFAULT_HSV: Hsv = { h: 0, s: 0, v: 0 };
const CHECKER =
  "repeating-conic-gradient(#7a7a7a 0% 25%, #4a4a4a 0% 50%) 0 0 / 10px 10px";

function hsvFromValue(value: string): Hsv | null {
  const rgb = parseColor(value);
  return rgb ? rgbToHsv(rgb) : null;
}

/**
 * Full color picker: HSV wheel + editable `#RRGGBB` field + saturation,
 * brightness, and transparency sliders. Emits a hex string when opaque and an
 * `rgba()` string when it carries transparency.
 *
 * @param props Current color value and change handler
 * @returns The picker UI
 */
export function ColorPicker(props: ColorPickerProps): JSX.Element {
  const [hsv, setHsv] = useState<Hsv>(() => hsvFromValue(props.value) ?? DEFAULT_HSV);
  const [alpha, setAlpha] = useState<number>(() => parseAlpha(props.value));
  const [hexText, setHexText] = useState<string>(() =>
    hsvToHex(hsvFromValue(props.value) ?? DEFAULT_HSV),
  );

  // Resync when the selected element (external value) changes, but not from
  // our own edits — guarded by comparing against the current color.
  useEffect(() => {
    const next = hsvFromValue(props.value);
    const nextAlpha = parseAlpha(props.value);
    if (next && (hsvToHex(next) !== hexText.toUpperCase() || nextAlpha !== alpha)) {
      setHsv(next);
      setAlpha(nextAlpha);
      setHexText(hsvToHex(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  const emit = (nextHsv: Hsv, nextAlpha: number): void => {
    setHsv(nextHsv);
    setAlpha(nextAlpha);
    setHexText(hsvToHex(nextHsv));
    props.onChange(formatColor(hsvToRgb(nextHsv), nextAlpha));
  };

  const onHexInput = (raw: string): void => {
    setHexText(raw);
    const rgb = parseColor(raw);
    if (rgb) emit(rgbToHsv(rgb), alpha);
  };

  const satLow = hsvToHex({ h: hsv.h, s: 0, v: hsv.v });
  const satHigh = hsvToHex({ h: hsv.h, s: 1, v: hsv.v });
  const briHigh = hsvToHex({ h: hsv.h, s: hsv.s, v: 1 });
  const opaque = hsvToHex(hsv);
  const swatch = formatColor(hsvToRgb(hsv), alpha);

  return (
    <div style={{ padding: "4px 0 8px" }}>
      <ColorWheel
        hue={hsv.h}
        sat={hsv.s}
        brightness={hsv.v}
        onChange={(h, s): void => emit({ h, s, v: hsv.v === 0 ? 1 : hsv.v }, alpha)}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 8px" }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            border: "1px solid var(--color-border)",
            background: `linear-gradient(${swatch}, ${swatch}), ${CHECKER}`,
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          value={hexText}
          spellCheck={false}
          onChange={(ev): void => onHexInput(ev.currentTarget.value)}
          style={{
            flex: 1,
            padding: "5px 8px",
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            color: "var(--color-fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: 1,
            textAlign: "center",
          }}
        />
      </div>

      <Slider
        label="Saturation"
        value={hsv.s}
        gradient={`linear-gradient(90deg, ${satLow}, ${satHigh})`}
        onChange={(s): void => emit({ ...hsv, s }, alpha)}
      />
      <Slider
        label="Brightness"
        value={hsv.v}
        gradient={`linear-gradient(90deg, #000, ${briHigh})`}
        onChange={(v): void => emit({ ...hsv, v }, alpha)}
      />
      <Slider
        label="Transparency"
        value={alpha}
        gradient={`linear-gradient(90deg, transparent, ${opaque}), ${CHECKER}`}
        onChange={(a): void => emit(hsv, a)}
      />
    </div>
  );
}

function Slider(props: {
  label: string;
  value: number;
  gradient: string;
  onChange(value: number): void;
}): JSX.Element {
  return (
    <label style={{ display: "block", marginTop: 8 }}>
      <span
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--color-muted)",
        }}
      >
        {props.label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(props.value * 100)}
        onChange={(ev): void => props.onChange(Number(ev.currentTarget.value) / 100)}
        className="color-slider"
        style={{ background: props.gradient }}
      />
    </label>
  );
}
