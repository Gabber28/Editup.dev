import { offsetAfterDrag, type GestureChange } from "./drag-target.js";

type Movable = HTMLElement | SVGElement;

/**
 * Free positioning: the element ends wherever it is dropped. Writes `left`/`top`
 * — the same properties the X/Y fields in the Position panel write — promoting a
 * static element to `relative` first, since insets do nothing otherwise.
 */
export class FreeMove {
  private el: Movable | null = null;
  private baseLeft = "";
  private baseTop = "";
  private promoted = false;

  /**
   * Captures the starting insets and promotes the element when it is static.
   *
   * @param el Element being dragged
   */
  start(el: Element): void {
    if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return;
    const computed = getComputedStyle(el);
    this.el = el;
    this.baseLeft = computed.left;
    this.baseTop = computed.top;
    this.promoted = computed.position === "static";
    if (this.promoted) el.style.setProperty("position", "relative");
  }

  /**
   * Follows the pointer.
   *
   * @param dx Horizontal movement since the gesture started
   * @param dy Vertical movement since the gesture started
   */
  move(dx: number, dy: number): void {
    if (!this.el) return;
    this.el.style.setProperty("left", offsetAfterDrag(this.baseLeft, dx));
    this.el.style.setProperty("top", offsetAfterDrag(this.baseTop, dy));
  }

  /** @returns The changes to record, including the position promotion if any */
  commit(): GestureChange[] {
    if (!this.el) return [];
    const changes: GestureChange[] = [];
    if (this.promoted) changes.push({ property: "position", value: "relative" });
    changes.push({ property: "left", value: this.el.style.left });
    changes.push({ property: "top", value: this.el.style.top });
    return changes;
  }

  reset(): void {
    this.el = null;
    this.promoted = false;
  }
}
