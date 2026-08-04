import { useState, type JSX } from "react";
import type { ElementInfo } from "@/types/snapshot.js";
import { parseTransform, buildTransform, type TransformState } from "@/lib/transform.js";
import {
  resolveAlign,
  verticalAlignSupported,
  coordOf,
  type AlignAxis,
  type AlignMode,
} from "./position-align.js";
import { AlignIcon, RotateIcon, FlipXIcon, FlipYIcon, AngleIcon } from "./position-icons.js";
import {
  POS_ROW,
  POS_LABEL,
  POS_INPUT,
  POS_FIELD,
  POS_BTN,
  POS_GROUP,
  POS_HINT,
  activeBtn,
} from "./position-styles.js";

export interface PositionControlsProps {
  element?: ElementInfo | null;
  values: Record<string, string>;
  onChange(property: string, value: string): void;
}

const MODES: AlignMode[] = ["start", "center", "end"];
const TITLES: Record<AlignAxis, Record<AlignMode, string>> = {
  h: { start: "Align left", center: "Align horizontal center", end: "Align right" },
  v: { start: "Align top", center: "Align vertical center", end: "Align bottom" },
};

function AlignmentRow(props: PositionControlsProps): JSX.Element {
  const vOk = verticalAlignSupported(props.element, props.values);
  const click = (axis: AlignAxis, mode: AlignMode): void => {
    for (const [prop, value] of resolveAlign(axis, mode, props.element, props.values)) {
      props.onChange(prop, value);
    }
  };

  const group = (axis: AlignAxis): JSX.Element => (
    <div style={POS_GROUP}>
      {MODES.map((mode) => (
        <button
          key={`${axis}-${mode}`}
          type="button"
          aria-label={TITLES[axis][mode]}
          title={
            axis === "v" && !vOk ? "Requires a flex or grid parent" : TITLES[axis][mode]
          }
          disabled={axis === "v" && !vOk}
          onClick={(): void => click(axis, mode)}
          style={{ ...POS_BTN, opacity: axis === "v" && !vOk ? 0.35 : 1 }}
        >
          <AlignIcon axis={axis} mode={mode} />
        </button>
      ))}
    </div>
  );

  return (
    <div style={POS_ROW}>
      <span style={POS_LABEL}>Alignment</span>
      <div style={{ display: "flex", gap: 10 }}>
        {group("h")}
        {group("v")}
      </div>
    </div>
  );
}

function XYRow(props: PositionControlsProps): JSX.Element {
  const offset = props.element?.layout?.offset ?? { left: 0, top: 0 };
  const isStatic = (props.values["position"] ?? "static") === "static";
  const [promoted, setPromoted] = useState(false);

  const commit = (prop: "left" | "top", raw: string, current: string): void => {
    const n = parseFloat(raw);
    // Leaving the field untouched must not write anything — otherwise a stray
    // focus would silently promote a static element to relative.
    if (!Number.isFinite(n) || raw.trim() === current) return;
    if (isStatic) {
      props.onChange("position", "relative");
      setPromoted(true);
    }
    props.onChange(prop, `${n}px`);
  };

  const field = (label: string, prop: "left" | "top", fallback: number): JSX.Element => {
    const current = coordOf(props.values, prop, fallback);
    return (
      <label style={POS_FIELD}>
        <span style={{ ...POS_LABEL, minWidth: 0 }}>{label}</span>
        <input
          type="text"
          defaultValue={current}
          key={`${prop}-${current}`}
          onKeyDown={(ev): void => {
            if (ev.key === "Enter") commit(prop, ev.currentTarget.value, current);
          }}
          onBlur={(ev): void => commit(prop, ev.currentTarget.value, current)}
          style={POS_INPUT}
        />
      </label>
    );
  };

  return (
    <div style={POS_ROW}>
      <span style={POS_LABEL}>Position</span>
      <div style={{ display: "flex", gap: 8, flex: 1 }}>
        {field("X", "left", offset.left)}
        {field("Y", "top", offset.top)}
      </div>
      {promoted && <div style={POS_HINT}>position changed to relative</div>}
    </div>
  );
}

function RotationRow(props: PositionControlsProps): JSX.Element {
  // Derived, never mirrored into local state: the value map is the single
  // source of truth, so a click always builds on what the element actually has.
  const state = parseTransform(props.values["transform"] ?? "none");

  const push = (next: TransformState): void => {
    props.onChange("transform", buildTransform(next));
  };

  return (
    <div style={POS_ROW}>
      <span style={POS_LABEL}>Rotation</span>
      <label style={{ ...POS_FIELD, flex: 1 }}>
        <AngleIcon />
        <input
          type="text"
          key={state.rotate}
          defaultValue={`${state.rotate}°`}
          onKeyDown={(ev): void => {
            if (ev.key !== "Enter") return;
            const n = parseFloat(ev.currentTarget.value);
            if (Number.isFinite(n)) push({ ...state, rotate: n });
          }}
          onBlur={(ev): void => {
            const n = parseFloat(ev.currentTarget.value);
            if (Number.isFinite(n) && n !== state.rotate) push({ ...state, rotate: n });
          }}
          style={POS_INPUT}
        />
      </label>
      <div style={POS_GROUP}>
        <button
          type="button"
          aria-label="Rotate 90°"
          title="Rotate 90°"
          onClick={(): void => push({ ...state, rotate: state.rotate + 90 })}
          style={POS_BTN}
        >
          <RotateIcon />
        </button>
        <button
          type="button"
          aria-label="Flip horizontal"
          title="Flip horizontal"
          onClick={(): void => push({ ...state, flipX: !state.flipX })}
          style={activeBtn(state.flipX)}
        >
          <FlipXIcon />
        </button>
        <button
          type="button"
          aria-label="Flip vertical"
          title="Flip vertical"
          onClick={(): void => push({ ...state, flipY: !state.flipY })}
          style={activeBtn(state.flipY)}
        >
          <FlipYIcon />
        </button>
      </div>
    </div>
  );
}

/**
 * Figma-style position block: alignment within the parent, X/Y coordinates, and
 * rotation/flip. Every control writes plain CSS through the normal change
 * handler, so edits flow to the AI like any other visual change.
 *
 * @param props Selected element, current computed values, and the change handler
 * @returns The alignment, X/Y, and rotation rows
 */
export function PositionControls(props: PositionControlsProps): JSX.Element {
  return (
    <div>
      <AlignmentRow {...props} />
      <XYRow {...props} />
      <RotationRow {...props} />
    </div>
  );
}
