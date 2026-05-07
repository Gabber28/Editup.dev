import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditUpAgent } from "@injected/agent.js";
import type { AgentConfig, AgentMessage } from "@injected/agent.js";

function makeFakeWs(): {
  ws: WebSocket;
  fire: (msg: AgentMessage) => void;
} {
  let handler: ((ev: MessageEvent) => void) | null = null;
  const ws = {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    set onopen(fn: (() => void) | null) { if (fn) fn(); },
    set onmessage(fn: ((ev: MessageEvent) => void) | null) { handler = fn; },
    set onclose(_: unknown) { /* noop */ },
    set onerror(_: unknown) { /* noop */ },
  } as unknown as WebSocket;

  const fire = (msg: AgentMessage): void => {
    handler?.(new MessageEvent("message", { data: JSON.stringify(msg) }));
  };
  return { ws, fire };
}

interface AgentInternals {
  selectedEl: HTMLElement | null;
  pendingOverrides: Record<string, string>;
}

function setup(): { agent: EditUpAgent; fire: (m: AgentMessage) => void } {
  const { ws, fire } = makeFakeWs();
  vi.spyOn(globalThis, "WebSocket").mockImplementation(() => ws);
  const cfg: AgentConfig = { wsUrl: "ws://127.0.0.1:9000", sessionToken: "tok" };
  const agent = new EditUpAgent(cfg);
  agent.start();
  return { agent, fire };
}

describe("preview_style message", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("sets element.style property on preview_style", () => {
    const { agent, fire } = setup();
    const el = document.createElement("div");
    document.body.appendChild(el);
    (agent as unknown as AgentInternals).selectedEl = el;

    fire({ type: "preview_style", payload: { property: "background-color", value: "rgb(255, 0, 0)" } });

    expect(el.style.getPropertyValue("background-color")).toBe("rgb(255, 0, 0)");
  });

  it("accumulates multiple preview_style calls", () => {
    const { agent, fire } = setup();
    const el = document.createElement("button");
    document.body.appendChild(el);
    (agent as unknown as AgentInternals).selectedEl = el;

    fire({ type: "preview_style", payload: { property: "color", value: "red" } });
    fire({ type: "preview_style", payload: { property: "font-size", value: "20px" } });

    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(el.style.getPropertyValue("font-size")).toBe("20px");
  });

  it("tracks overrides in pendingOverrides", () => {
    const { agent, fire } = setup();
    const el = document.createElement("span");
    document.body.appendChild(el);
    (agent as unknown as AgentInternals).selectedEl = el;

    fire({ type: "preview_style", payload: { property: "margin", value: "10px" } });

    const pending = (agent as unknown as AgentInternals).pendingOverrides;
    expect(pending["margin"]).toBe("10px");
  });

  it("ignores preview_style when no element is selected", () => {
    const { fire } = setup();
    // No element selected — should not throw
    expect(() => {
      fire({ type: "preview_style", payload: { property: "color", value: "red" } });
    }).not.toThrow();
  });
});

describe("reset_overrides message", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("removes all style overrides applied by preview_style", () => {
    const { agent, fire } = setup();
    const el = document.createElement("div");
    document.body.appendChild(el);
    (agent as unknown as AgentInternals).selectedEl = el;

    fire({ type: "preview_style", payload: { property: "background-color", value: "blue" } });
    fire({ type: "preview_style", payload: { property: "padding", value: "20px" } });
    expect(el.style.getPropertyValue("background-color")).toBe("blue");

    fire({ type: "reset_overrides" });

    expect(el.style.getPropertyValue("background-color")).toBe("");
    expect(el.style.getPropertyValue("padding")).toBe("");
  });

  it("clears pendingOverrides record after reset", () => {
    const { agent, fire } = setup();
    const el = document.createElement("div");
    document.body.appendChild(el);
    (agent as unknown as AgentInternals).selectedEl = el;

    fire({ type: "preview_style", payload: { property: "color", value: "green" } });
    fire({ type: "reset_overrides" });

    const pending = (agent as unknown as AgentInternals).pendingOverrides;
    expect(Object.keys(pending)).toHaveLength(0);
  });
});
