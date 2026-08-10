import type { JSX } from "react";
import type { ElementInfo } from "@/types/snapshot.js";
import {
  parseTransform,
  buildTransform,
  type TransformState,
} from "@/lib/transform.js";
import { translateParts, withTranslate } from "@/lib/transform-translate.js";
import {
  RotateIcon,
  FlipXIcon,
  FlipYIcon,
  AngleIcon,
} from "./position-icons.js";
import { normalizeLength } from "./position-provenance.js";
import { POS_INPUT, POS_BTN, POS_GROUP, activeBtn } from "./position-styles.js";
import {
  POS_TRANSFORM_GRID,
  POS_PREFIXED_FIELD,
  POS_PREFIX,
} from "./position-box-styles.js";

export interface PositionRowProps {
  element?: ElementInfo | null;
  values: Record<string, string>;
  onChange(property: string, value: string): void;
}

/**
 * X, Y and rotation in one three-column strip.
 *
 * X/Y write `translate` rather than `left`/`top`: the box model below owns the
 * offsets, and having two controls edit the same property with no indication
 * was the ambiguity this redesign set out to remove.
 */
export function TransformRow(props: PositionRowProps): JSX.Element {
  // Derived, never mirrored into local state: the value map is the single
  // source of truth, so a click always builds on what the element actually has.
  const state = parseTransform(props.values["transform"] ?? "none");
  const { x, y } = translateParts(state);

  const push = (next: TransformState): void => {
    props.onChange("transform", buildTransform(next));
  };

  const axis = (
    label: string,
    current: string,
    axisKey: "x" | "y"
  ): JSX.Element => (
    <label style={POS_PREFIXED_FIELD}>
      <span style={POS_PREFIX} aria-hidden="true">
        {label}
      </span>
      <input
        type="text"
        aria-label={`translate ${label}`}
        key={`${axisKey}-${current}`}
        defaultValue={current}
        spellCheck={false}
        onKeyDown={(ev): void => {
          if (ev.key === "Enter") ev.currentTarget.blur();
          if (ev.key === "Escape") {
            ev.currentTarget.value = current;
            ev.currentTarget.blur();
          }
        }}
        onBlur={(ev): void => {
          const raw = ev.currentTarget.value;
          if (raw.trim() === current.trim()) return;
          const next = normalizeLength(raw) ?? "";
          push(
            withTranslate(
              state,
              axisKey === "x" ? next : x,
              axisKey === "y" ? next : y
            )
          );
        }}
        style={POS_INPUT}
      />
    </label>
  );

  return (
    <div style={POS_TRANSFORM_GRID}>
      {axis("X", x, "x")}
      {axis("Y", y, "y")}
      <label style={POS_PREFIXED_FIELD}>
        <AngleIcon />
        <input
          type="text"
          aria-label="rotation"
          key={state.rotate}
          defaultValue={`${state.rotate}°`}
          spellCheck={false}
          onKeyDown={(ev): void => {
            if (ev.key !== "Enter") return;
            const n = parseFloat(ev.currentTarget.value);
            if (Number.isFinite(n)) push({ ...state, rotate: n });
          }}
          onBlur={(ev): void => {
            const n = parseFloat(ev.currentTarget.value);
            if (Number.isFinite(n) && n !== state.rotate) {
              push({ ...state, rotate: n });
            }
          }}
          style={POS_INPUT}
        />
      </label>
    </div>
  );
}

/** Rotate-by-90 and the two mirror toggles. */
export function FlipRow(props: PositionRowProps): JSX.Element {
  const state = parseTransform(props.values["transform"] ?? "none");
  const push = (next: TransformState): void => {
    props.onChange("transform", buildTransform(next));
  };

  return (
    <div style={{ ...POS_GROUP, marginBottom: 8 }}>
      <button
        type="button"
        aria-label="Rotate 90°"
        title="Rotate 90°"
        onClick={(): void => push({ ...state, rotate: state.rotate + 90 })}
        style={{ ...POS_BTN, flex: 1 }}
      >
        <RotateIcon />
      </button>
      <button
        type="button"
        aria-label="Flip horizontal"
        title="Flip horizontal"
        onClick={(): void => push({ ...state, flipX: !state.flipX })}
        style={{ ...activeBtn(state.flipX), flex: 1 }}
      >
        <FlipXIcon />
      </button>
      <button
        type="button"
        aria-label="Flip vertical"
        title="Flip vertical"
        onClick={(): void => push({ ...state, flipY: !state.flipY })}
        style={{ ...activeBtn(state.flipY), flex: 1 }}
      >
        <FlipYIcon />
      </button>
    </div>
  );
}
