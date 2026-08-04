import { useEffect, useRef, useState, type JSX } from "react";
import { ColorPicker } from "./color-picker.js";
import { ColorPopover } from "./color-popover.js";
import {
  defaultGradient,
  parseGradient,
  serializeGradient,
  type Gradient,
} from "@/lib/gradient.js";

export interface GradientEditorProps {
  value: string;
  onChange(css: string): void;
}

const MINI_BTN: React.CSSProperties = {
  fontSize: 10,
  padding: "3px 8px",
  borderRadius: 4,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  color: "var(--color-fg)",
  cursor: "pointer",
};

/**
 * Visual gradient synthesizer: type toggle, angle, and editable color stops
 * (each stop opens the color wheel). Emits a CSS gradient string on change.
 *
 * @param props Current gradient CSS and change handler
 * @returns The gradient editor UI
 */
export function GradientEditor(props: GradientEditorProps): JSX.Element {
  const [g, setG] = useState<Gradient>(() => parseGradient(props.value) ?? defaultGradient());
  const [openStop, setOpenStop] = useState<number | null>(null);
  const stopRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const parsed = parseGradient(props.value);
    if (parsed && serializeGradient(parsed) !== serializeGradient(g)) setG(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  const apply = (next: Gradient): void => {
    setG(next);
    props.onChange(serializeGradient(next));
  };

  const setStop = (i: number, patch: Partial<Gradient["stops"][number]>): void => {
    apply({ ...g, stops: g.stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  };
  const addStop = (): void => {
    const last = g.stops[g.stops.length - 1];
    apply({ ...g, stops: [...g.stops, { color: last?.color ?? "#FFFFFF", pos: 100 }] });
  };
  const removeStop = (i: number): void => {
    if (g.stops.length <= 2) return;
    apply({ ...g, stops: g.stops.filter((_, idx) => idx !== i) });
  };

  return (
    <div>
      <div
        style={{
          height: 40,
          borderRadius: 6,
          border: "1px solid var(--color-border)",
          marginBottom: 8,
          background: serializeGradient(g),
        }}
      />

      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {(["linear", "radial"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={(): void => apply({ ...g, type: t })}
            style={{
              ...MINI_BTN,
              flex: 1,
              ...(g.type === t
                ? { borderColor: "var(--color-accent)", color: "var(--color-accent-light)" }
                : {}),
            }}
          >
            {t === "linear" ? "Linear" : "Radial"}
          </button>
        ))}
      </div>

      {g.type === "linear" && (
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "var(--color-muted)" }}>
            Angle {Math.round(g.angle)}°
          </span>
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(g.angle)}
            onChange={(ev): void => apply({ ...g, angle: Number(ev.currentTarget.value) })}
            style={{ width: "100%" }}
          />
        </label>
      )}

      {g.stops.map((stop, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <button
            ref={(el): void => {
              stopRefs.current[i] = el;
            }}
            type="button"
            onClick={(): void => setOpenStop((cur) => (cur === i ? null : i))}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: "1px solid var(--color-border)",
              background: stop.color,
              cursor: "pointer",
              flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, flex: 1 }}>{stop.color}</span>
          <input
            type="number"
            min={0}
            max={100}
            value={Math.round(stop.pos)}
            onChange={(ev): void => setStop(i, { pos: Number(ev.currentTarget.value) })}
            style={{
              width: 48,
              padding: "3px 6px",
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              color: "var(--color-fg)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          />
          <span style={{ fontSize: 10, color: "var(--color-muted)" }}>%</span>
          <button
            type="button"
            onClick={(): void => removeStop(i)}
            disabled={g.stops.length <= 2}
            style={{ ...MINI_BTN, opacity: g.stops.length <= 2 ? 0.4 : 1, padding: "3px 7px" }}
          >
            ✕
          </button>

          {openStop === i && (
            <ColorPopover anchor={stopRefs.current[i] ?? null} onClose={(): void => setOpenStop(null)}>
              <ColorPicker value={stop.color} onChange={(hex): void => setStop(i, { color: hex })} />
            </ColorPopover>
          )}
        </div>
      ))}

      <button type="button" onClick={addStop} style={{ ...MINI_BTN, marginTop: 4 }}>
        + Add stop
      </button>
    </div>
  );
}
