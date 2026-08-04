export type DragAxis = "x" | "y";

/** One property/value pair produced by a finished drag. */
export interface GestureChange {
  property: string;
  value: string;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Center of a box along one axis. */
export function centerOf(box: Box, axis: DragAxis): number {
  return axis === "x" ? box.left + box.width / 2 : box.top + box.height / 2;
}

/**
 * Picks the axis the siblings are laid out along by looking at where they
 * actually sit, not at the parent's CSS. Geometry covers flex row, flex column,
 * a grid row, and normal block flow with one rule, and stays right when the
 * parent's `display` says little (e.g. wrapped inline-block).
 *
 * @param boxes Sibling boxes in DOM order
 * @returns "x" when they spread mostly side by side, "y" when stacked
 */
export function axisFromBoxes(boxes: Box[]): DragAxis {
  if (boxes.length < 2) return "y";
  const xs = boxes.map((b) => centerOf(b, "x"));
  const ys = boxes.map((b) => centerOf(b, "y"));
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  return spreadX > spreadY ? "x" : "y";
}

/**
 * Index the dragged element should be inserted at, counting how many siblings
 * the pointer has already passed along the axis.
 *
 * The boxes must NOT include the element being dragged — the returned index
 * addresses that same filtered list, so `siblings[index] ?? null` is the node to
 * insert before (null meaning append at the end).
 *
 * @param boxes Sibling boxes in DOM order, excluding the dragged element
 * @param point Current pointer position in viewport coordinates
 * @param axis Layout axis from {@link axisFromBoxes}
 * @returns Insertion index in the range [0, boxes.length]
 */
export function resolveDropIndex(boxes: Box[], point: Point, axis: DragAxis): number {
  const at = axis === "x" ? point.x : point.y;
  let index = 0;
  for (const box of boxes) {
    if (centerOf(box, axis) < at) index += 1;
  }
  return index;
}

/**
 * Where to draw the insertion line for a given drop index: along the leading
 * edge of the sibling at that index, or the trailing edge of the last one when
 * dropping at the end.
 *
 * @param boxes Sibling boxes in DOM order, excluding the dragged element
 * @param index Insertion index from {@link resolveDropIndex}
 * @param axis Layout axis
 * @returns Line geometry, or null when there is nothing to anchor to
 */
export function insertionLineOf(
  boxes: Box[],
  index: number,
  axis: DragAxis,
): { left: number; top: number; length: number; axis: DragAxis } | null {
  if (boxes.length === 0) return null;
  const atEnd = index >= boxes.length;
  const box = atEnd ? boxes[boxes.length - 1] : boxes[index];
  if (!box) return null;

  if (axis === "x") {
    return {
      left: atEnd ? box.left + box.width : box.left,
      top: box.top,
      length: box.height,
      axis,
    };
  }
  return {
    left: box.left,
    top: atEnd ? box.top + box.height : box.top,
    length: box.width,
    axis,
  };
}

/** Reads a computed inset into a number; `auto` and empty count as 0. */
export function parseOffsetPx(value: string | undefined): number {
  if (!value || value === "auto") return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Inset value after dragging by a delta, matching what the X/Y fields write.
 *
 * @param base Computed `left`/`top` when the gesture started
 * @param delta Pointer movement along that axis, in pixels
 * @returns The new value in px, rounded to whole pixels
 */
export function offsetAfterDrag(base: string | undefined, delta: number): string {
  return `${Math.round(parseOffsetPx(base) + delta)}px`;
}
