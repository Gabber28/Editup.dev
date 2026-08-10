import type { ElementInfo } from "@/types/snapshot.js";

export type AlignAxis = "h" | "v";
export type AlignMode = "start" | "center" | "end";

export type Pair = [string, string];

const FLEX = ["flex", "inline-flex"];
const GRID = ["grid", "inline-grid"];
const ABSOLUTE = ["absolute", "fixed"];

const FLEX_SELF: Record<AlignMode, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};

/** Auto-margin pairs that push a box along its parent's main axis. */
function marginPairs(axis: AlignAxis, mode: AlignMode): Pair[] {
  const from = axis === "h" ? "margin-left" : "margin-top";
  const to = axis === "h" ? "margin-right" : "margin-bottom";
  if (mode === "start")
    return [
      [from, "0px"],
      [to, "auto"],
    ];
  if (mode === "end")
    return [
      [from, "auto"],
      [to, "0px"],
    ];
  return [
    [from, "auto"],
    [to, "auto"],
  ];
}

/** Inset + auto-margin pairs that place an absolutely positioned box. */
function insetPairs(axis: AlignAxis, mode: AlignMode): Pair[] {
  const from = axis === "h" ? "left" : "top";
  const to = axis === "h" ? "right" : "bottom";
  if (mode === "start")
    return [
      [from, "0px"],
      [to, "auto"],
    ];
  if (mode === "end")
    return [
      [from, "auto"],
      [to, "0px"],
    ];
  return [[from, "0px"], [to, "0px"], ...marginPairs(axis, "center")];
}

/**
 * Maps an alignment click onto the CSS that actually moves this element, given
 * its own `position` and its parent's layout mode. Centering always goes
 * through auto margins rather than a translate, so it never fights the
 * `transform` owned by the rotation control.
 *
 * @param axis Horizontal or vertical alignment
 * @param mode Start, center, or end within the parent
 * @param element Selected element (carries the captured parent layout)
 * @param values Current computed values of the selected element
 * @returns Property/value pairs to apply, in order
 */
export function resolveAlign(
  axis: AlignAxis,
  mode: AlignMode,
  element: ElementInfo | null | undefined,
  values: Record<string, string>
): Pair[] {
  if (ABSOLUTE.includes(values["position"] ?? ""))
    return insetPairs(axis, mode);

  const parent = element?.layout?.parent ?? null;
  const display = parent?.display ?? "";

  if (GRID.includes(display)) {
    return [[axis === "h" ? "justify-self" : "align-self", mode]];
  }

  if (FLEX.includes(display)) {
    const column = (parent?.flex_direction ?? "row").startsWith("column");
    const isMainAxis = column ? axis === "v" : axis === "h";
    return isMainAxis
      ? marginPairs(axis, mode)
      : [["align-self", FLEX_SELF[mode]]];
  }

  return marginPairs(axis, mode);
}

/**
 * Vertical alignment only bites when the parent is flex/grid or the element is
 * out of flow — in normal block flow the vertical buttons stay disabled.
 *
 * @param element Selected element (carries the captured parent layout)
 * @param values Current computed values of the selected element
 * @returns Whether the vertical alignment buttons should be enabled
 */
export function verticalAlignSupported(
  element: ElementInfo | null | undefined,
  values: Record<string, string>
): boolean {
  if (ABSOLUTE.includes(values["position"] ?? "")) return true;
  const display = element?.layout?.parent?.display ?? "";
  return FLEX.includes(display) || GRID.includes(display);
}

/**
 * Reads the number shown in an X/Y field: the authored inset when the element
 * has one, otherwise the offset measured by the agent.
 *
 * @param values Current computed values of the selected element
 * @param prop Which inset backs the field (`left` for X, `top` for Y)
 * @param fallback Measured offset to show when the inset is `auto`/unset
 * @returns The field's display string
 */
export function coordOf(
  values: Record<string, string>,
  prop: "left" | "top",
  fallback: number
): string {
  const raw = values[prop];
  if (!raw || raw === "auto") return String(fallback);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? String(Math.round(n)) : raw;
}
