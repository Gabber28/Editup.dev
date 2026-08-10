import { useEffect, useState, type CSSProperties, type JSX } from "react";
import {
  normalizeLength,
  stepValue,
  type FieldValue,
} from "./position-provenance.js";
import { offsetFieldStyle } from "./position-box-styles.js";

export interface PositionFieldProps {
  /** Spoken name, e.g. "top offset" — the spatial layout carries no text label. */
  label: string;
  field: FieldValue;
  width?: number;
  describedBy?: string;
  /** Commits a CSS value. */
  onCommit(value: string): void;
  /** Clears the declaration, returning the side to `auto`. */
  onClear(): void;
}

/**
 * One offset input.
 *
 * Shows nothing when the property is unset — `auto` sits in the placeholder, and
 * the computed value is offered as a hint on focus without ever entering the
 * field. That separation is the point: the developer must be able to tell what
 * the stylesheet says from what the browser worked out.
 *
 * @param props Label, resolved value, and the commit/clear handlers
 * @returns The input
 */
export function PositionField(props: PositionFieldProps): JSX.Element {
  const { field } = props;
  const [draft, setDraft] = useState(field.value);
  const [focused, setFocused] = useState(false);

  // The value map is the source of truth; re-sync whenever it moves underneath
  // us (another control wrote the property, or the selection changed).
  useEffect(() => {
    if (!focused) setDraft(field.value);
  }, [field.value, focused]);

  const commit = (raw: string): void => {
    const next = normalizeLength(raw);
    if (next === null) {
      props.onClear();
      setDraft("");
      return;
    }
    props.onCommit(next);
    setDraft(next);
  };

  const step = (delta: number): void => {
    const next = stepValue(draft === "" ? field.computed : draft, delta);
    setDraft(next);
    props.onCommit(next);
  };

  const style: CSSProperties = {
    ...offsetFieldStyle(field.origin),
    ...(props.width !== undefined ? { width: props.width } : {}),
  };

  return (
    <input
      type="text"
      aria-label={props.label}
      {...(props.describedBy ? { "aria-describedby": props.describedBy } : {})}
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
      style={style}
    />
  );
}
