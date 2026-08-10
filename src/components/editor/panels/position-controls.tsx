import type { JSX } from "react";
import type { ElementInfo, MatchingRule } from "@/types/snapshot.js";
import { AlignmentRow } from "./position-align-row.js";
import { TransformRow, FlipRow } from "./position-rows.js";
import { PositionBox, offsetSummary, type Side } from "./position-box.js";
import { PositionLayer } from "./position-layer.js";
import { SectionGroup } from "../section-group.js";
import {
  POS_HEADER,
  POS_TITLE,
  POS_MODE_SELECT,
  POS_DIVIDER,
} from "./position-box-styles.js";

/** Raw CSS keywords: the value lands in the source, so it must be recognisable in a diff. */
const POSITIONS = ["static", "relative", "absolute", "fixed", "sticky"];

export interface PositionControlsProps {
  element?: ElementInfo | null;
  /** Effective values (computed, then authored, then this session's edits). */
  values: Record<string, string>;
  /** Only this element+state's own edits — needed to tell authored from computed. */
  overrides?: Record<string, string>;
  /** Rules governing the element, for the authored/computed distinction. */
  rules?: readonly MatchingRule[];
  onChange(property: string, value: string): void;
  /** Removes a declaration entirely, rather than writing a literal `auto`. */
  onClear?(property: string): void;
}

/**
 * The Position section: mode, alignment, transform, and — unless the element is
 * `static` — the spatial offset editor and the layer stepper.
 *
 * Under `static` the offsets and z-index have no effect at all, so they are
 * removed rather than shown inert: a control that silently does nothing teaches
 * the developer to distrust the whole panel.
 *
 * @param props Selected element, values, provenance inputs, and handlers
 * @returns The Position section
 */
export function PositionControls(props: PositionControlsProps): JSX.Element {
  const mode = props.values["position"] ?? "static";
  const isStatic = mode === "static";
  const overrides = props.overrides ?? {};

  const rowProps = {
    element: props.element ?? null,
    values: props.values,
    onChange: props.onChange,
  };

  const clear = (prop: string): void => {
    if (props.onClear) props.onClear(prop);
    else props.onChange(prop, "auto");
  };

  const summary = offsetSummary(overrides, props.rules, props.values);

  return (
    <div>
      <div style={POS_HEADER}>
        <span style={POS_TITLE}>Position</span>
        <select
          aria-label="Position mode"
          value={POSITIONS.includes(mode) ? mode : "static"}
          onChange={(ev): void =>
            props.onChange("position", ev.currentTarget.value)
          }
          style={POS_MODE_SELECT}
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <AlignmentRow {...rowProps} />
      <TransformRow {...rowProps} />
      <FlipRow {...rowProps} />

      {!isStatic && (
        <>
          <div style={POS_DIVIDER} />
          <PositionLayer
            overrides={overrides}
            {...(props.rules ? { rules: props.rules } : {})}
            computed={props.values}
            onCommit={(value): void => props.onChange("z-index", value)}
            onClear={(): void => clear("z-index")}
          />
          <SectionGroup
            id="position-advanced"
            title="Advanced"
            // Collapsed by default, but an element that arrives already
            // positioned opens it — a live offset must never be silent. Once
            // the developer toggles it, their choice is stored and wins.
            defaultOpen={summary !== ""}
            {...(summary ? { summary } : {})}
          >
            <PositionBox
              mode={mode}
              element={props.element ?? null}
              overrides={overrides}
              {...(props.rules ? { rules: props.rules } : {})}
              computed={props.values}
              onCommit={(side: Side, value): void =>
                props.onChange(side, value)
              }
              onClear={(side: Side): void => clear(side)}
            />
          </SectionGroup>
        </>
      )}
    </div>
  );
}
