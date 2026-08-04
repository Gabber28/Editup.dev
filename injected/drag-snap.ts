import {
  axisFromBoxes,
  resolveDropIndex,
  insertionLineOf,
  type Box,
  type DragAxis,
  type GestureChange,
  type Point,
} from "./drag-target.js";
import type { LineGeometry } from "./insertion-line.js";
import { lookupReactFiber } from "./source-map.js";

/**
 * Reordering: the element slots between its siblings. The drop is applied to the
 * live DOM so the preview is the real result, and the original slot is kept so
 * reset can undo it.
 */
export class SnapMove {
  private el: Element | null = null;
  private siblings: Element[] = [];
  private axis: DragAxis = "y";
  private index = 0;
  private readonly originals = new Map<Element, { parent: Node; next: Node | null }>();

  /**
   * Measures the siblings the element can be dropped between.
   *
   * @param el Element being dragged
   */
  start(el: Element): void {
    const parent = el.parentElement;
    if (!parent) return;
    this.el = el;
    this.siblings = Array.from(parent.children).filter((c) => c !== el);
    this.axis = axisFromBoxes(this.siblings.map(boxOf));
    this.index = 0;
  }

  /**
   * Tracks which gap the pointer is over.
   *
   * @param point Pointer position in viewport coordinates
   * @returns Where to draw the insertion line, or null when there is no target
   */
  move(point: Point): LineGeometry | null {
    if (!this.el) return null;
    const boxes = this.siblings.map(boxOf);
    this.index = resolveDropIndex(boxes, point, this.axis);
    return insertionLineOf(boxes, this.index, this.axis);
  }

  /** Applies the reorder and describes it for the AI. */
  commit(): GestureChange[] {
    const el = this.el;
    const parent = el?.parentElement ?? null;
    if (!el || !parent) return [];

    const ref = this.siblings[this.index] ?? null;
    const anchor = ref ?? this.siblings[this.siblings.length - 1] ?? null;
    if (!anchor) return [];
    // Dropped back into the slot it already occupied — nothing to report.
    const noop = ref === null ? el.nextElementSibling === null : ref === el.nextElementSibling;
    if (noop) return [];

    if (!this.originals.has(el)) {
      this.originals.set(el, { parent, next: el.nextSibling });
    }
    parent.insertBefore(el, ref);

    return [
      {
        property: "__move__",
        value: JSON.stringify({
          position: ref ? "before" : "after",
          reference: describe(anchor),
        }),
      },
    ];
  }

  reset(): void {
    this.el = null;
    this.siblings = [];
  }

  /** Puts every reordered element back where it started. */
  restoreAll(): void {
    for (const [el, slot] of this.originals) {
      slot.parent.insertBefore(el, slot.next);
    }
    this.originals.clear();
  }
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Identity of the reference sibling, so the AI can find it in the source. */
function describe(el: Element): {
  tag: string;
  classes: string[];
  component?: string;
  source?: string;
} {
  const lookup = lookupReactFiber(el);
  return {
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList),
    ...(lookup.componentName ? { component: lookup.componentName } : {}),
    ...(lookup.source ? { source: `${lookup.source.file}:${lookup.source.line}` } : {}),
  };
}
