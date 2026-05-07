import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditUpAgent } from "@injected/agent.js";
import type { AgentConfig, AgentMessage } from "@injected/agent.js";

let sentMessages: string[] = [];
let onopenFn: (() => void) | null = null;
let onmessageFn: ((ev: MessageEvent) => void) | null = null;

function makeFakeWs(): WebSocket {
  sentMessages = [];
  onopenFn = null;
  onmessageFn = null;

  return {
    readyState: WebSocket.OPEN,
    send: vi.fn((data: string) => sentMessages.push(data)),
    close: vi.fn(),
    set onopen(fn: (() => void) | null) { onopenFn = fn; },
    set onmessage(fn: ((ev: MessageEvent) => void) | null) { onmessageFn = fn; },
    set onclose(_: unknown) { /* noop */ },
    set onerror(_: unknown) { /* noop */ },
  } as unknown as WebSocket;
}

function fireMessage(msg: AgentMessage): void {
  onmessageFn?.(new MessageEvent("message", { data: JSON.stringify(msg) }));
}

describe("agent session token — hello", () => {
  const TOKEN = "abc-session-uuid-v4";

  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("sends hello with session token on connect", () => {
    const ws = makeFakeWs();
    vi.spyOn(globalThis, "WebSocket").mockImplementation(() => ws);
    const cfg: AgentConfig = { wsUrl: "ws://127.0.0.1:9000", sessionToken: TOKEN };
    const agent = new EditUpAgent(cfg);
    agent.start();
    onopenFn?.();

    expect(sentMessages.length).toBeGreaterThanOrEqual(1);
    const hello = JSON.parse(sentMessages[0]!) as AgentMessage;
    expect(hello.type).toBe("hello");
    expect(hello.token).toBe(TOKEN);
  });

  it("includes token field on every outgoing message", () => {
    const ws = makeFakeWs();
    vi.spyOn(globalThis, "WebSocket").mockImplementation(() => ws);
    const cfg: AgentConfig = { wsUrl: "ws://127.0.0.1:9000", sessionToken: TOKEN };
    const agent = new EditUpAgent(cfg);
    agent.start();
    onopenFn?.();

    // Trigger a snapshot by selecting an element
    const el = document.createElement("div");
    document.body.appendChild(el);
    (agent as unknown as { selectedEl: Element }).selectedEl = el;

    fireMessage({ type: "request_snapshot" });

    for (const raw of sentMessages) {
      const parsed = JSON.parse(raw) as AgentMessage;
      expect(parsed.token).toBe(TOKEN);
    }
  });
});

describe("agent session token — incoming validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("processes valid messages from server", () => {
    const ws = makeFakeWs();
    vi.spyOn(globalThis, "WebSocket").mockImplementation(() => ws);
    const cfg: AgentConfig = { wsUrl: "ws://127.0.0.1:9000", sessionToken: "tok" };
    const agent = new EditUpAgent(cfg);
    agent.start();
    onopenFn?.();

    const el = document.createElement("div");
    document.body.appendChild(el);
    (agent as unknown as { selectedEl: HTMLElement }).selectedEl = el;

    fireMessage({ type: "preview_style", payload: { property: "color", value: "red" } });
    expect(el.style.getPropertyValue("color")).toBe("red");
  });

  it("ignores malformed (non-JSON) messages", () => {
    const ws = makeFakeWs();
    vi.spyOn(globalThis, "WebSocket").mockImplementation(() => ws);
    const cfg: AgentConfig = { wsUrl: "ws://127.0.0.1:9000", sessionToken: "tok" };
    const agent = new EditUpAgent(cfg);
    agent.start();
    onopenFn?.();

    expect(() => {
      onmessageFn?.(new MessageEvent("message", { data: "not-json{{{" }));
    }).not.toThrow();
  });

  it("ignores messages with unknown type without crashing", () => {
    const ws = makeFakeWs();
    vi.spyOn(globalThis, "WebSocket").mockImplementation(() => ws);
    const cfg: AgentConfig = { wsUrl: "ws://127.0.0.1:9000", sessionToken: "tok" };
    const agent = new EditUpAgent(cfg);
    agent.start();
    onopenFn?.();

    expect(() => {
      fireMessage({ type: "unknown_command" });
    }).not.toThrow();
  });
});
