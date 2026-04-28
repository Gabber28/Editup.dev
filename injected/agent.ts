import { FloatingBracketsOverlay } from "./overlay.js";
import {
  captureComputedStyle,
  captureMatchingRules,
  captureCSSVariables,
  detectFramework,
} from "./style-capture.js";
import { lookupElementSource } from "./source-map.js";

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
  private pendingOverrides: Record<string, string> = {};

  constructor(private readonly config: AgentConfig) {}

  start(): void {
    this.overlay.attach();
    this.installPointerListeners();
    this.connect();
  }

  private connect(): void {
    const ws = new WebSocket(this.config.wsUrl);
    this.socket = ws;
    ws.onopen = (): void => {
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
        break;
      case "preview_style": {
        const p = msg.payload as
          | { property: string; value: string }
          | undefined;
        if (p && this.selectedEl instanceof HTMLElement) {
          this.selectedEl.style.setProperty(p.property, p.value);
          this.pendingOverrides[p.property] = p.value;
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
    if (!this.editing) return;
    const target = this.elementFromPoint(ev.clientX, ev.clientY);
    if (!target) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.selectElement(target);
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
    this.resetOverrides();
    this.selectedEl = el;
    const lookup = lookupElementSource(el);
    const label =
      lookup.componentName ?? `${el.tagName.toLowerCase()}${labelOf(el)}`;
    this.overlay.setSelected(el, label);
    this.sendSnapshot();
  }

  private sendSnapshot(): void {
    if (!this.selectedEl) return;
    const el = this.selectedEl;
    const computed = captureComputedStyle(el);
    const rules = captureMatchingRules(el);
    const cssVars = captureCSSVariables(el);
    const framework = detectFramework(el);
    const source = lookupElementSource(el);

    const classToRule: Record<
      string,
      { source_file: string; rule_text: string; line_number: number }
    > = {};
    for (const cls of Array.from(el.classList)) {
      const matched = rules.find((r) => r.selector.includes(`.${cls}`));
      if (matched) {
        classToRule[cls] = {
          source_file: matched.source_file,
          rule_text: matched.rule_text,
          line_number: matched.line_number,
        };
      }
    }

    this.send({
      type: "snapshot",
      payload: {
        element: {
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          classes: Array.from(el.classList),
          component_name: source.componentName,
          source_file: source.source?.file,
          source_line: source.source?.line,
        },
        styling: {
          framework,
          class_to_rule_map: classToRule,
          active_css_variables: cssVars,
        },
        computed_style: computed,
      },
    });
  }

  private resetOverrides(): void {
    if (!(this.selectedEl instanceof HTMLElement)) return;
    for (const prop of Object.keys(this.pendingOverrides)) {
      this.selectedEl.style.removeProperty(prop);
    }
    this.pendingOverrides = {};
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
