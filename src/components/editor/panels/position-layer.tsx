import { useEffect, useState, type JSX } from "react";
import type { MatchingRule } from "@/types/snapshot.js";
import { resolveField, stepValue } from "./position-provenance.js";
import { ArrowDownIcon, ArrowUpIcon } from "./position-icons.js";
import {
  LAYER_ROW,
  LAYER_LABEL,
  LAYER_STEPPER,
  LAYER_VALUE,
  LAYER_ARROW,
} from "./position-box-styles.js";

export interface PositionLayerProps {
  overrides: Record<string, string>;
  rules?: readonly MatchingRule[];
  computed: Record<string, string>;
  onCommit(value: string): void;
  onClear(): void;
}

/**
 * The z-index as a stepper.
 *
 * Almost nobody wants to type `z-index: 47`; they want the element in front of
 * or behind its neighbours. The arrows are the primary path, typing stays
 * available by clicking the value.
 *
 * @param props Values and the commit/clear handlers
 * @returns The layer row
 */
export function PositionLayer(props: PositionLayerProps): JSX.Element {
  const field = resolveField(
    "z-index",
    props.overrides,
    props.rules,
    props.computed
  );
  const [draft, setDraft] = useState(field.value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(field.value);
  }, [field.value, focused]);

  const commit = (raw: string): void => {
    const text = raw.trim();
    if (text === "" || text.toLowerCase() === "auto") {
      props.onClear();
      setDraft("");
      return;
    }
    const n = parseInt(text, 10);
    if (!Number.isFinite(n)) {
      setDraft(field.value);
      return;
    }
    props.onCommit(String(n));
    setDraft(String(n));
  };

  // z-index is unitless, so step from a bare number and drop any unit stepValue
  // would otherwise carry over.
  const step = (delta: number): void => {
    const from =
      draft === "" ? (field.computed === "auto" ? "0" : field.computed) : draft;
    const next = parseInt(stepValue(from, delta, "0"), 10);
    if (!Number.isFinite(next)) return;
    setDraft(String(next));
    props.onCommit(String(next));
  };

  return (
    <div style={LAYER_ROW}>
      <span style={LAYER_LABEL} id="layer-label">
        Layer
      </span>
      <div style={LAYER_STEPPER}>
        <button
          type="button"
          aria-label="Send backward"
          title="Send backward"
          onClick={(): void => step(-1)}
          style={LAYER_ARROW}
        >
          <ArrowDownIcon />
        </button>
        <input
          type="text"
          aria-label="z-index"
          value={draft}
          placeholder={focused && field.computed ? field.computed : "auto"}
          spellCheck={false}
          onChange={(ev): void => setDraft(ev.currentTarget.value)}
          onFocus={(): void => setFocused(true)}
          onBlur={(ev): void => {
            setFocused(false);
            if (ev.currentTarget.value !== field.value)
              commit(ev.currentTarget.value);
          }}
          onKeyDown={(ev): void => {
            if (ev.key === "Enter") {
              ev.currentTarget.blur();
              return;
            }
            if (ev.key === "Escape") {
              setDraft(field.value);
              ev.currentTarget.blur();
              return;
            }
            if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
              ev.preventDefault();
              const magnitude = ev.shiftKey ? 10 : 1;
              step(ev.key === "ArrowUp" ? magnitude : -magnitude);
            }
          }}
          style={{
            ...LAYER_VALUE,
            color:
              field.origin === "auto"
                ? "var(--color-muted)"
                : "var(--color-fg)",
          }}
        />
        <button
          type="button"
          aria-label="Bring forward"
          title="Bring forward"
          onClick={(): void => step(1)}
          style={LAYER_ARROW}
        >
          <ArrowUpIcon />
        </button>
      </div>
    </div>
  );
}
