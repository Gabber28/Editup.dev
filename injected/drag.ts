import { InsertionLine } from "./insertion-line.js";
import { FreeMove } from "./drag-free.js";
import { SnapMove } from "./drag-snap.js";
import type { GestureChange } from "./drag-target.js";

export type DragMode = "snap" | "free";
export type { GestureChange };

export interface DragCallbacks {
  /** Currently selected element — the only one that can be dragged. */
  getSelected(): Element | null;
  /** Reports a finished gesture; the effect is already applied in the page. */
  onCommit(changes: GestureChange[]): void;
  onStatus(text: string, color: string): void;
}

/** Movement needed before a press turns into a drag instead of a click. */
const THRESHOLD = 4;

/**
 * Pointer-driven repositioning of the selected element, in two modes: "snap"
 * slots it between its siblings, "free" leaves it wherever it is dropped.
 */
export class DragController {
  private mode: DragMode = "snap";
  private readonly line = new InsertionLine();
  private readonly free = new FreeMove();
  private readonly snap = new SnapMove();
  private origin: { x: number; y: number } | null = null;
  private target: Element | null = null;
  private dragging = false;
  private suppressClick = false;
  private userSelect = "";

  constructor(private readonly cb: DragCallbacks) {}

  attach(): void {
    this.line.attach();
    document.addEventListener("pointerdown", (ev) => this.onDown(ev), true);
    document.addEventListener("pointermove", (ev) => this.onMove(ev), true);
    document.addEventListener("pointerup", (ev) => this.onUp(ev), true);
    document.addEventListener("pointercancel", () => this.cancel(), true);
  }

  setMode(mode: DragMode): void {
    this.mode = mode;
  }

  /** True right after a drag, so the trailing click does not re-select. */
  shouldSuppressClick(): boolean {
    if (!this.suppressClick) return false;
    this.suppressClick = false;
    return true;
  }

  /** Undoes every reorder this controller applied. */
  restoreOriginals(): void {
    this.snap.restoreAll();
  }

  private onDown(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    const selected = this.cb.getSelected();
    if (!selected) return;
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!hit || (hit !== selected && !selected.contains(hit))) return;
    this.origin = { x: ev.clientX, y: ev.clientY };
    this.target = selected;
  }

  private onMove(ev: PointerEvent): void {
    if (!this.origin || !this.target) return;
    const dx = ev.clientX - this.origin.x;
    const dy = ev.clientY - this.origin.y;

    if (!this.dragging) {
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      this.begin(ev);
    }

    ev.preventDefault();
    ev.stopPropagation();
    if (this.mode === "free") {
      this.free.move(dx, dy);
    } else {
      this.line.set(this.snap.move({ x: ev.clientX, y: ev.clientY }));
    }
  }

  private onUp(ev: PointerEvent): void {
    if (!this.dragging) {
      this.origin = null;
      this.target = null;
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    const changes = this.mode === "free" ? this.free.commit() : this.snap.commit();
    this.finish();
    if (changes.length > 0) this.cb.onCommit(changes);
  }

  private begin(ev: PointerEvent): void {
    if (!this.target) return;
    this.dragging = true;
    this.suppressClick = true;
    this.userSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    try {
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
    } catch {
      // Capture is a nicety; the document listeners already cover the gesture.
    }
    if (this.mode === "free") {
      this.free.start(this.target);
      this.cb.onStatus("moving freely...", "#3b82f6");
    } else {
      this.snap.start(this.target);
      this.cb.onStatus("reordering...", "#3b82f6");
    }
  }

  private finish(): void {
    this.line.set(null);
    document.body.style.userSelect = this.userSelect;
    this.free.reset();
    this.snap.reset();
    this.dragging = false;
    this.origin = null;
    this.target = null;
  }

  private cancel(): void {
    if (this.dragging) this.finish();
    this.origin = null;
    this.target = null;
  }
}
