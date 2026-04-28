const BRACKET_SIZE = 10;
const BRACKET_OFFSET = 4;
const SELECTED_STROKE = 2;
const HOVER_STROKE = 1;
const TAG_OFFSET = 8;

const NS = "http://www.w3.org/2000/svg";

export interface OverlayState {
  hoveredEl: Element | null;
  selectedEl: Element | null;
}

interface OverlayElements {
  root: HTMLElement;
  hover: SVGSVGElement;
  selected: SVGSVGElement;
  tag: HTMLDivElement;
}

export class FloatingBracketsOverlay {
  private state: OverlayState = { hoveredEl: null, selectedEl: null };
  private dom: OverlayElements;
  private rafId: number | null = null;

  constructor() {
    this.dom = this.buildDom();
  }

  attach(target: HTMLElement = document.body): void {
    target.appendChild(this.dom.root);
    this.startTracking();
  }

  detach(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.dom.root.remove();
  }

  setHovered(el: Element | null): void {
    this.state.hoveredEl = el;
    this.render();
  }

  setSelected(el: Element | null, label?: string): void {
    this.state.selectedEl = el;
    if (label) {
      this.dom.tag.textContent = label;
      this.dom.tag.style.display = "block";
    } else {
      this.dom.tag.style.display = "none";
    }
    this.render();
  }

  private buildDom(): OverlayElements {
    const root = document.createElement("div");
    root.id = "editup-overlay-root";
    Object.assign(root.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      pointerEvents: "none",
      zIndex: "2147483647",
    });

    const hover = this.makeSvg();
    const selected = this.makeSvg();
    selected.dataset["state"] = "selected";

    const tag = document.createElement("div");
    Object.assign(tag.style, {
      position: "fixed",
      padding: "2px 8px",
      background: "rgba(124, 58, 237, 0.95)",
      color: "#fff",
      fontFamily:
        "ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace",
      fontSize: "11px",
      borderRadius: "4px",
      display: "none",
      whiteSpace: "nowrap",
    });

    root.appendChild(hover);
    root.appendChild(selected);
    root.appendChild(tag);

    return { root, hover, selected, tag };
  }

  private makeSvg(): SVGSVGElement {
    const svg = document.createElementNS(NS, "svg");
    Object.assign(svg.style, {
      position: "fixed",
      top: "0",
      left: "0",
      overflow: "visible",
      pointerEvents: "none",
    });
    return svg;
  }

  private startTracking(): void {
    const tick = (): void => {
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private render(): void {
    this.renderBrackets(
      this.dom.hover,
      this.state.hoveredEl,
      HOVER_STROKE,
      "rgba(168, 85, 247, 0.7)",
      true
    );
    this.renderBrackets(
      this.dom.selected,
      this.state.selectedEl,
      SELECTED_STROKE,
      "rgba(168, 85, 247, 1)",
      false
    );
    this.renderTag();
  }

  private renderBrackets(
    svg: SVGSVGElement,
    el: Element | null,
    stroke: number,
    color: string,
    dashed: boolean
  ): void {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const o = BRACKET_OFFSET;
    const s = BRACKET_SIZE;
    const x = rect.left - o;
    const y = rect.top - o;
    const w = rect.width + o * 2;
    const h = rect.height + o * 2;

    const corners: Array<{ d: string }> = [
      { d: `M${x} ${y + s} L${x} ${y} L${x + s} ${y}` },
      { d: `M${x + w - s} ${y} L${x + w} ${y} L${x + w} ${y + s}` },
      { d: `M${x} ${y + h - s} L${x} ${y + h} L${x + s} ${y + h}` },
      {
        d: `M${x + w - s} ${y + h} L${x + w} ${y + h} L${x + w} ${y + h - s}`,
      },
    ];

    for (const corner of corners) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", corner.d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", String(stroke));
      path.setAttribute("stroke-linecap", "round");
      if (dashed) path.setAttribute("stroke-dasharray", "3,2");
      svg.appendChild(path);
    }
  }

  private renderTag(): void {
    const el = this.state.selectedEl;
    if (!el) {
      this.dom.tag.style.display = "none";
      return;
    }
    if (this.dom.tag.style.display === "none") return;
    const rect = el.getBoundingClientRect();
    this.dom.tag.style.left = `${rect.left}px`;
    this.dom.tag.style.top = `${Math.max(0, rect.top - TAG_OFFSET - 18)}px`;
  }
}
