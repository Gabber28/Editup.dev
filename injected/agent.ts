import { FloatingBracketsOverlay } from "./overlay.js";
import { buildSnapshotPayload } from "./snapshot-builder.js";
import { PseudoPreviewManager } from "./pseudo-preview.js";
import { lookupReactFiber } from "./source-map.js";
import { DragController, type DragMode, type GestureChange } from "./drag.js";
import { buildDomPath } from "./dom-path.js";
import { captureComputedStyle } from "./style-capture.js";

interface AgentConfig {
  wsUrl: string;
  sessionToken: string;
}

interface AgentMessage {
  type: string;
  payload?: unknown;
  token?: string;
}

/** Marks the reload requested for verification, so the snapshot after it is tagged. */
const VERIFY_FLAG = "__editup_verify__";

class EditUpAgent {
  private overlay = new FloatingBracketsOverlay();
  private socket: WebSocket | null = null;
  private selectedEl: Element | null = null;
  private editing = false;
  private overridesMap = new Map<Element, Record<string, string>>();
  private imageOriginals = new Map<HTMLImageElement, string>();
  private textOriginals = new Map<Element, string>();
  private classOriginals = new Map<Element, string>();
  private svgInnerOriginals = new Map<SVGSVGElement, string>();
  private useHrefOriginals = new Map<SVGUseElement, string>();
  private linkOriginals = new Map<Element, { href: string | null; target: string | null; cursor: string }>();
  private pseudoPreview = new PseudoPreviewManager();
  private badge: HTMLDivElement | null = null;
  private gestureSeq = 0;
  private drag = new DragController({
    getSelected: () => (this.editing ? this.selectedEl : null),
    onCommit: (changes) => this.sendGestureChanges(changes),
    onStatus: (text, color) => this.updateBadge(text, color),
  });

  constructor(private readonly config: AgentConfig) {}

  start(): void {
    this.overlay.attach();
    // Attached before the hover/click listeners so a drag in progress can stop
    // the event before it is read as a hover or a selection click.
    this.drag.attach();
    this.installPointerListeners();
    this.createBadge();
    this.connect();
  }

  /**
   * Reports a finished drag to the app. The page already shows the result, so
   * the app records these as pending changes without echoing a preview back.
   */
  private sendGestureChanges(changes: GestureChange[]): void {
    this.gestureSeq += 1;
    this.send({
      type: "gesture_change",
      payload: { id: this.gestureSeq, changes },
    });
    this.updateBadge(`moved (${changes.length})`, "#22c55e");
    this.sendSnapshot();
  }

  private createBadge(): void {
    const el = document.createElement("div");
    el.id = "editup-debug-badge";
    Object.assign(el.style, {
      position: "fixed",
      bottom: "8px",
      right: "8px",
      padding: "4px 10px",
      borderRadius: "6px",
      fontFamily: "ui-monospace, monospace",
      fontSize: "11px",
      color: "#fff",
      zIndex: "2147483646",
      pointerEvents: "none",
      opacity: "0.85",
    });
    document.body.appendChild(el);
    this.badge = el;
    this.updateBadge("connecting", "#f59e0b");
  }

  private updateBadge(text: string, bg: string): void {
    if (!this.badge) return;
    this.badge.textContent = `EditUp: ${text}`;
    this.badge.style.background = bg;
  }

  private connect(): void {
    const ws = new WebSocket(this.config.wsUrl);
    this.socket = ws;
    ws.onopen = (): void => {
      this.updateBadge("connected (waiting)", "#3b82f6");
      this.send({ type: "hello", token: this.config.sessionToken });
    };
    ws.onmessage = (ev): void => {
      try {
        const data = JSON.parse(String(ev.data)) as AgentMessage;
        this.handleMessage(data);
      } catch {
        // ignore malformed
      }
    };
    ws.onclose = (): void => {
      this.updateBadge("disconnected", "#ef4444");
      setTimeout(() => this.connect(), 1000);
    };
    ws.onerror = (): void => {
      ws.close();
    };
  }

  private send(msg: AgentMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      JSON.stringify({ ...msg, token: this.config.sessionToken })
    );
  }

  private handleMessage(msg: AgentMessage): void {
    switch (msg.type) {
      case "set_editing":
        this.editing = Boolean(
          (msg.payload as { editing?: boolean } | undefined)?.editing
        );
        this.updateBadge(
          this.editing ? "editing ON" : "editing OFF",
          this.editing ? "#22c55e" : "#f59e0b"
        );
        if (this.editing) this.restoreSelection();
        if (!this.editing) sessionStorage.removeItem("__editup_selected__");
        break;
      case "preview_style": {
        const p = msg.payload as
          | { property: string; value: string }
          | undefined;
        if (p && p.property === "src" && this.selectedEl instanceof HTMLImageElement) {
          // src is an attribute, not a style property — set it directly and
          // remember the original so reset can restore it.
          if (!this.imageOriginals.has(this.selectedEl)) {
            this.imageOriginals.set(
              this.selectedEl,
              this.selectedEl.getAttribute("src") ?? ""
            );
          }
          this.selectedEl.setAttribute("src", p.value);
          break;
        }
        if (p && p.property.startsWith("__") && this.selectedEl) {
          this.previewMedia(this.selectedEl, p.property, p.value);
          break;
        }
        if (
          p &&
          (this.selectedEl instanceof HTMLElement ||
            this.selectedEl instanceof SVGElement)
        ) {
          this.selectedEl.style.setProperty(p.property, p.value);
          let elOverrides = this.overridesMap.get(this.selectedEl);
          if (!elOverrides) {
            elOverrides = {};
            this.overridesMap.set(this.selectedEl, elOverrides);
          }
          elOverrides[p.property] = p.value;
        }
        break;
      }
      case "preview_pseudo_style": {
        const pp = msg.payload as
          | { property: string; value: string; pseudo: string }
          | undefined;
        if (pp && this.selectedEl) {
          this.pseudoPreview.preview(this.selectedEl, pp.pseudo, pp.property, pp.value);
        }
        break;
      }
      case "capture_elements": {
        // Verification of a multi-element edit needs each element's own styles;
        // the selected element's computed style says nothing about its siblings.
        const req = msg.payload as { paths?: string[] } | undefined;
        const styles: Record<string, Record<string, string>> = {};
        for (const path of req?.paths ?? []) {
          try {
            const found = document.querySelector(path);
            if (found) styles[path] = captureComputedStyle(found);
          } catch {
            // invalid selector — reported as missing, never as a match
          }
        }
        this.send({ type: "elements_captured", payload: { styles } });
        break;
      }
      case "verify_reload":
        // Verification must observe the page rebuilt from source: the live
        // previews are inline styles, and reading them back would confirm the
        // edit even when the AI wrote nothing.
        sessionStorage.setItem(VERIFY_FLAG, "1");
        location.reload();
        break;
      case "set_drag_mode": {
        const dm = msg.payload as { mode?: string } | undefined;
        const mode: DragMode = dm?.mode === "free" ? "free" : "snap";
        this.drag.setMode(mode);
        this.updateBadge(mode === "free" ? "free edit ON" : "snap to siblings", "#22c55e");
        break;
      }
      case "reset_overrides":
        this.resetOverrides();
        break;
      case "request_snapshot":
        this.sendSnapshot();
        break;
    }
  }

  private installPointerListeners(): void {
    document.addEventListener(
      "pointermove",
      (ev) => this.onPointerMove(ev),
      true
    );
    document.addEventListener(
      "click",
      (ev) => this.onClick(ev),
      true
    );
  }

  private onPointerMove(ev: PointerEvent): void {
    if (!this.editing) return;
    const target = this.elementFromPoint(ev.clientX, ev.clientY);
    if (target && target !== this.selectedEl) {
      this.overlay.setHovered(target);
    }
  }

  private onClick(ev: MouseEvent): void {
    if (!this.editing) return;
    // A drag ends with a click event; selecting on it would re-anchor the
    // selection to whatever the pointer landed on.
    if (this.drag.shouldSuppressClick()) {
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    this.updateBadge("click detected...", "#3b82f6");
    const target = this.elementFromPoint(ev.clientX, ev.clientY);
    if (!target) {
      this.updateBadge("no target found", "#ef4444");
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    try {
      this.selectElement(target);
    } catch (err) {
      this.updateBadge(`error: ${err}`, "#ef4444");
    }
  }

  private elementFromPoint(x: number, y: number): Element | null {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    if (el.id === "editup-overlay-root" || el.closest("#editup-overlay-root")) {
      return null;
    }
    return el;
  }

  private selectElement(el: Element): void {
    this.selectedEl = el;
    const lookup = lookupReactFiber(el);
    const label =
      lookup.componentName ?? `${el.tagName.toLowerCase()}${labelOf(el)}`;
    this.overlay.setSelected(el, label);
    sessionStorage.setItem("__editup_selected__", this.buildSelector(el));
    this.sendSnapshot();
  }

  private restoreSelection(): void {
    if (this.selectedEl) return;
    const saved = sessionStorage.getItem("__editup_selected__");
    if (!saved) return;
    const el = document.querySelector(saved);
    if (el) this.selectElement(el);
  }

  private buildSelector(el: Element): string {
    return buildDomPath(el);
  }

  private sendSnapshot(): void {
    // Hot reload replaces DOM nodes; a detached element reports empty computed
    // styles, which would make every post-edit verification falsely fail.
    if (this.selectedEl && !this.selectedEl.isConnected) {
      const saved = sessionStorage.getItem("__editup_selected__");
      let reattached: Element | null = null;
      if (saved) {
        try {
          reattached = document.querySelector(saved);
        } catch {
          reattached = null;
        }
      }
      this.selectedEl = reattached;
      if (!reattached) this.updateBadge("element lost after reload", "#ef4444");
    }
    if (!this.selectedEl) return;
    const el = this.selectedEl;
    const tag = el.tagName.toLowerCase();
    this.updateBadge(`capturing ${tag}...`, "#a855f7");
    const payload = buildSnapshotPayload(el);
    // Tag the first snapshot after a verification reload so the app knows this
    // capture reflects the source, not the live previews.
    if (sessionStorage.getItem(VERIFY_FLAG)) {
      sessionStorage.removeItem(VERIFY_FLAG);
      payload.verification = true;
    }
    const wsOpen = this.socket?.readyState === WebSocket.OPEN;
    this.send({ type: "snapshot", payload });
    this.updateBadge(
      wsOpen ? `sent: <${tag}>` : "WS closed, snapshot lost!",
      wsOpen ? "#22c55e" : "#ef4444"
    );
  }

  /**
   * Applies a non-CSS "media" change (emoji text, class swap, <use> href, or
   * inline SVG markup) and remembers the original so reset can restore it.
   */
  private previewMedia(el: Element, property: string, value: string): void {
    const svg = el instanceof SVGSVGElement ? el : el.closest("svg");
    switch (property) {
      case "__text__":
        if (!this.textOriginals.has(el)) {
          this.textOriginals.set(el, el.textContent ?? "");
        }
        el.textContent = value;
        break;
      case "__class__":
        if (!this.classOriginals.has(el)) {
          this.classOriginals.set(el, el.getAttribute("class") ?? "");
        }
        el.setAttribute("class", value);
        break;
      case "__svg_inner__":
        if (svg) {
          if (!this.svgInnerOriginals.has(svg)) {
            this.svgInnerOriginals.set(svg, svg.innerHTML);
          }
          svg.innerHTML = value;
        }
        break;
      case "__use_href__": {
        const use = svg?.querySelector("use") ?? null;
        if (use) {
          if (!this.useHrefOriginals.has(use)) {
            this.useHrefOriginals.set(
              use,
              use.getAttribute("href") ?? use.getAttribute("xlink:href") ?? ""
            );
          }
          use.setAttribute("href", value);
          use.setAttribute("xlink:href", value);
        }
        break;
      }
      case "__href__":
        this.captureLinkOriginal(el);
        if (el instanceof HTMLAnchorElement) {
          if (value) el.setAttribute("href", value);
          else el.removeAttribute("href");
        } else if (el instanceof HTMLElement) {
          // Not an anchor — preview is cosmetic; the AI wraps it in <a> in the
          // source. Show a pointer cursor and stash the intended href.
          if (value) {
            el.style.cursor = "pointer";
            el.setAttribute("data-editup-href", value);
          } else {
            el.style.removeProperty("cursor");
            el.removeAttribute("data-editup-href");
          }
        }
        break;
      case "__target__":
        this.captureLinkOriginal(el);
        if (el instanceof HTMLAnchorElement) {
          if (value) el.setAttribute("target", value);
          else el.removeAttribute("target");
        } else if (value) {
          el.setAttribute("data-editup-target", value);
        } else {
          el.removeAttribute("data-editup-target");
        }
        break;
    }
  }

  /** Records an element's original link-related state once, for reset. */
  private captureLinkOriginal(el: Element): void {
    if (this.linkOriginals.has(el)) return;
    this.linkOriginals.set(el, {
      href: el.getAttribute("href"),
      target: el.getAttribute("target"),
      cursor: el instanceof HTMLElement ? el.style.cursor : "",
    });
  }

  private resetOverrides(): void {
    for (const [el, overrides] of this.overridesMap) {
      if (el instanceof HTMLElement || el instanceof SVGElement) {
        for (const prop of Object.keys(overrides)) {
          el.style.removeProperty(prop);
        }
      }
    }
    this.overridesMap.clear();
    for (const [img, src] of this.imageOriginals) {
      if (src) img.setAttribute("src", src);
      else img.removeAttribute("src");
    }
    this.imageOriginals.clear();
    for (const [el, text] of this.textOriginals) el.textContent = text;
    this.textOriginals.clear();
    for (const [el, cls] of this.classOriginals) el.setAttribute("class", cls);
    this.classOriginals.clear();
    for (const [svg, inner] of this.svgInnerOriginals) svg.innerHTML = inner;
    this.svgInnerOriginals.clear();
    for (const [use, href] of this.useHrefOriginals) {
      use.setAttribute("href", href);
      use.setAttribute("xlink:href", href);
    }
    this.useHrefOriginals.clear();
    for (const [el, orig] of this.linkOriginals) {
      if (orig.href !== null) el.setAttribute("href", orig.href);
      else el.removeAttribute("href");
      if (orig.target !== null) el.setAttribute("target", orig.target);
      else el.removeAttribute("target");
      if (el instanceof HTMLElement) el.style.cursor = orig.cursor;
      el.removeAttribute("data-editup-href");
      el.removeAttribute("data-editup-target");
    }
    this.linkOriginals.clear();
    this.pseudoPreview.resetAll();
    this.drag.restoreOriginals();
  }
}

function labelOf(el: Element): string {
  const cls = Array.from(el.classList);
  return cls.length > 0 ? `.${cls[0]}` : "";
}

declare global {
  interface Window {
    __EDITUP_CONFIG__?: AgentConfig;
  }
}

const cfg = window.__EDITUP_CONFIG__;
if (cfg && cfg.wsUrl && cfg.sessionToken) {
  const agent = new EditUpAgent(cfg);
  agent.start();
}

export { EditUpAgent };
export type { AgentConfig, AgentMessage };
