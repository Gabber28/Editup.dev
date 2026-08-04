import type { DragAxis } from "./drag-target.js";

const THICKNESS = 2;
const COLOR = "rgba(168, 85, 247, 1)";
const CAP = 6;

export interface LineGeometry {
  left: number;
  top: number;
  length: number;
  axis: DragAxis;
}

/**
 * The line that shows where a dragged element will land between its siblings.
 * Lives in its own fixed-position layer so it never affects the page's layout.
 */
export class InsertionLine {
  private readonly root: HTMLDivElement;

  constructor() {
    this.root = document.createElement("div");
    this.root.id = "editup-insertion-line";
    Object.assign(this.root.style, {
      position: "fixed",
      display: "none",
      background: COLOR,
      borderRadius: `${THICKNESS}px`,
      boxShadow: `0 0 0 1px rgba(0, 0, 0, 0.25), 0 0 8px ${COLOR}`,
      pointerEvents: "none",
      zIndex: "2147483647",
    });
  }

  attach(target: HTMLElement = document.body): void {
    target.appendChild(this.root);
  }

  detach(): void {
    this.root.remove();
  }

  /**
   * Positions the line, or hides it when there is no valid drop target.
   *
   * @param geometry Where the line should sit, or null to hide it
   */
  set(geometry: LineGeometry | null): void {
    if (!geometry) {
      this.root.style.display = "none";
      return;
    }
    const horizontal = geometry.axis === "y";
    Object.assign(this.root.style, {
      display: "block",
      left: `${horizontal ? geometry.left : geometry.left - THICKNESS / 2}px`,
      top: `${horizontal ? geometry.top - THICKNESS / 2 : geometry.top}px`,
      width: `${horizontal ? geometry.length : THICKNESS}px`,
      height: `${horizontal ? THICKNESS : geometry.length}px`,
      // Small overhang past the sibling's edge reads as a caret, like Figma.
      marginLeft: horizontal ? `${-CAP}px` : "0",
      marginTop: horizontal ? "0" : `${-CAP}px`,
      paddingRight: "0",
    });
    if (horizontal) {
      this.root.style.width = `${geometry.length + CAP * 2}px`;
    } else {
      this.root.style.height = `${geometry.length + CAP * 2}px`;
    }
  }
}
