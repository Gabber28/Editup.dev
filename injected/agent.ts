import { FloatingBracketsOverlay } from "./overlay.js";
import { buildSnapshotPayload } from "./snapshot-builder.js";
import { PseudoPreviewManager } from "./pseudo-preview.js";
import { lookupReactFiber } from "./source-map.js";

interface AgentConfig {
  wsUrl: string;
  sessionToken: string;
}

interface AgentMessage {
  type: string;
  payload?: unknown;
  token?: string;
}

class EditUpAgent {
  private overlay = new FloatingBracketsOverlay();
  private socket: WebSocket | null = null;
  private selectedEl: Element | null = null;
  private editing = false;
  private overridesMap = new Map<Element, Record<string, string>>();
  private pseudoPreview = new PseudoPreviewManager();
  private badge: HTMLDivElement | null = null;

  constructor(private readonly config: AgentConfig) {}

  start(): void {
    console.log("[EditUp] agent started");
    this.overlay.attach();
    this.installPointerListeners();
    this.createBadge();
    this.connect();
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
      console.log("[EditUp] ws connected, sending hello");
      this.updateBadge("connected (waiting)", "#3b82f6");
      this.send({ type: "hello", token: this.config.sessionToken });
    };
    ws.onmessage = (ev): void => {
      try {
        const data = JSON.parse(String(ev.data)) as AgentMessage;
        console.log("[EditUp] ws message:", data.type, data.payload);
        this.handleMessage(data);
      } catch {
        // ignore malformed
      }
    };
    ws.onclose = (): void => {
      console.log("[EditUp] ws closed, reconnecting in 1s");
      this.updateBadge("disconnected", "#ef4444");
      setTimeout(() => this.connect(), 1000);
    };
    ws.onerror = (err): void => {
      console.log("[EditUp] ws error:", err);
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
        console.log("[EditUp] set_editing =>", this.editing);
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
        if (p && this.selectedEl instanceof HTMLElement) {
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
    console.log("[EditUp] click, editing=", this.editing);
    if (!this.editing) return;
    this.updateBadge("click detected...", "#3b82f6");
    const target = this.elementFromPoint(ev.clientX, ev.clientY);
    console.log("[EditUp] click target:", target?.tagName, target?.className);
    if (!target) {
      this.updateBadge("no target found", "#ef4444");
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    try {
      this.selectElement(target);
    } catch (err) {
      console.error("[EditUp] selectElement error:", err);
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
    if (el.id) return `#${el.id}`;
    const parts: string[] = [];
    let current: Element | null = el;
    while (current && current !== document.documentElement) {
      let seg = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${current.id}`);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          seg += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(seg);
      current = parent;
    }
    return parts.join(" > ");
  }

  private sendSnapshot(): void {
    if (!this.selectedEl) return;
    const el = this.selectedEl;
    const tag = el.tagName.toLowerCase();
    this.updateBadge(`capturing ${tag}...`, "#a855f7");
    const payload = buildSnapshotPayload(el);
    const wsOpen = this.socket?.readyState === WebSocket.OPEN;
    this.send({ type: "snapshot", payload });
    this.updateBadge(
      wsOpen ? `sent: <${tag}>` : "WS closed, snapshot lost!",
      wsOpen ? "#22c55e" : "#ef4444"
    );
  }

  private resetOverrides(): void {
    for (const [el, overrides] of this.overridesMap) {
      if (el instanceof HTMLElement) {
        for (const prop of Object.keys(overrides)) {
          el.style.removeProperty(prop);
        }
      }
    }
    this.overridesMap.clear();
    this.pseudoPreview.resetAll();
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
