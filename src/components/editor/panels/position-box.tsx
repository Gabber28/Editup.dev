import { useId, type JSX } from "react";
import type { ElementInfo, MatchingRule } from "@/types/snapshot.js";
import { resolveField, isSet, type FieldValue } from "./position-provenance.js";
import { PositionField } from "./position-field.js";
import { PinIcon } from "./position-icons.js";
import {
  BOX_GRID,
  BOX_CENTER,
  BOX_CENTER_LABEL,
} from "./position-box-styles.js";

/** Offsets in CSS shorthand order — which is also the DOM order, and so the tab order. */
const SIDES = ["top", "right", "bottom", "left"] as const;
export type Side = (typeof SIDES)[number];

const INITIALS: Record<Side, string> = {
  top: "T",
  right: "R",
  bottom: "B",
  left: "L",
};

/** `24px` reads as `24`; any other unit is kept, since it is the informative part. */
function compact(value: string): string {
  return value.trim().replace(/px$/, "");
}

/**
 * One-line digest of the offsets that carry a value, e.g. `R 24 · B 24`.
 *
 * Lets the section stay collapsed without hiding that it holds live values —
 * the reason a plain "Advanced" row would be a trap.
 *
 * @param overrides This session's edits
 * @param rules Rules governing the element
 * @param computed Browser-resolved values
 * @returns The digest, or an empty string when no side is set
 */
export function offsetSummary(
  overrides: Record<string, string>,
  rules: readonly MatchingRule[] | undefined,
  computed: Record<string, string>
): string {
  return SIDES.map((side) => ({
    side,
    field: resolveField(side, overrides, rules, computed),
  }))
    .filter(({ field }) => isSet(field))
    .map(({ side, field }) => `${INITIALS[side]} ${compact(field.value)}`)
    .join(" · ");
}

export interface PositionBoxProps {
  mode: string;
  element?: ElementInfo | null;
  overrides: Record<string, string>;
  rules?: readonly MatchingRule[];
  computed: Record<string, string>;
  onCommit(property: Side, value: string): void;
  onClear(property: Side): void;
}

/**
 * Names the box the offsets are measured against.
 *
 * Without this the panel asks for `right: 24px` while staying silent about
 * 24px from what — the viewport, an ancestor, or the element's own flow slot.
 *
 * @param mode Computed `position`
 * @param element Selected element, for its captured containing block
 * @returns Short label for the centre of the diagram
 */
export function containingBlockLabel(
  mode: string,
  element?: ElementInfo | null
): string {
  const captured = element?.layout?.containing_block;
  switch (mode) {
    case "fixed":
      return "viewport";
    case "relative":
      return "self";
    case "absolute":
      return captured?.label ?? "document";
    case "sticky":
      return captured?.label ?? "scroll";
    default:
      return "flow";
  }
}

/**
 * The offsets as a box model rather than four labelled rows.
 *
 * Each field sits on the edge it controls, so its position *is* its label — the
 * same diagram DevTools uses, read pre-attentively instead of word by word. The
 * fields are laid out with grid areas so the DOM keeps shorthand order while the
 * eye gets the spatial one.
 *
 * @param props Mode, element, values, and the commit/clear handlers
 * @returns The spatial offset editor
 */
export function PositionBox(props: PositionBoxProps): JSX.Element {
  const describedBy = useId();
  const label = containingBlockLabel(props.mode, props.element);

  const field = (side: Side): FieldValue =>
    resolveField(side, props.overrides, props.rules, props.computed);

  return (
    <div role="group" aria-label="Offsets" aria-describedby={describedBy}>
      <div style={BOX_GRID}>
        {SIDES.map((side) => (
          <div key={side} style={{ gridArea: side }}>
            <PositionField
              label={`${side} offset`}
              field={field(side)}
              describedBy={describedBy}
              onCommit={(v): void => props.onCommit(side, v)}
              onClear={(): void => props.onClear(side)}
            />
          </div>
        ))}
        {/* Decorative: the description below is what a screen reader reads. */}
        <div style={{ ...BOX_CENTER, gridArea: "center" }} aria-hidden="true">
          <PinIcon />
          <span style={BOX_CENTER_LABEL}>{label}</span>
        </div>
      </div>

      <span id={describedBy} hidden>
        Offsets are measured from {label}
      </span>
    </div>
  );
}

export const OFFSET_ORDER = SIDES;
