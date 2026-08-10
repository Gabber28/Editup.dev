import type { JSX } from "react";
import {
  resolveAlign,
  verticalAlignSupported,
  type AlignAxis,
  type AlignMode,
} from "./position-align.js";
import { AlignIcon } from "./position-icons.js";
import { POS_BTN } from "./position-styles.js";
import { POS_SEGMENTED } from "./position-box-styles.js";
import type { PositionRowProps } from "./position-rows.js";

const MODES: AlignMode[] = ["start", "center", "end"];
const TITLES: Record<AlignAxis, Record<AlignMode, string>> = {
  h: {
    start: "Align left",
    center: "Align horizontal center",
    end: "Align right",
  },
  v: {
    start: "Align top",
    center: "Align vertical center",
    end: "Align bottom",
  },
};
/** The six alignment buttons as one segmented strip, with no text label. */
export function AlignmentRow(props: PositionRowProps): JSX.Element {
  const vOk = verticalAlignSupported(props.element, props.values);
  const click = (axis: AlignAxis, mode: AlignMode): void => {
    for (const [prop, value] of resolveAlign(
      axis,
      mode,
      props.element,
      props.values
    )) {
      props.onChange(prop, value);
    }
  };

  return (
    <div style={POS_SEGMENTED} role="group" aria-label="Alignment">
      {(["h", "v"] as AlignAxis[]).flatMap((axis) =>
        MODES.map((mode) => (
          <button
            key={`${axis}-${mode}`}
            type="button"
            aria-label={TITLES[axis][mode]}
            title={
              axis === "v" && !vOk
                ? "Requires a flex or grid parent"
                : TITLES[axis][mode]
            }
            disabled={axis === "v" && !vOk}
            onClick={(): void => click(axis, mode)}
            style={{
              ...POS_BTN,
              flex: 1,
              opacity: axis === "v" && !vOk ? 0.35 : 1,
            }}
          >
            <AlignIcon axis={axis} mode={mode} />
          </button>
        ))
      )}
    </div>
  );
}
