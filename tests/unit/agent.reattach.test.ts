import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditUpAgent } from "@injected/agent.js";
import type { AgentConfig, AgentMessage } from "@injected/agent.js";

// jsdom lacks parts of CSSOM used by the real capture; the payload content
// is irrelevant here — only the reattach-then-send behavior is under test.
vi.mock("@injected/snapshot-builder.js", () => ({
  buildSnapshotPayload: vi.fn(() => ({ element: { tag: "button" } })),
}));

function makeFakeWs(): {
  ws: WebSocket;
  fire: (msg: AgentMessage) => void;
  sent: string[];
} {
  let handler: ((ev: MessageEvent) => void) | null = null;
  const sent: string[] = [];
  const ws = {
    readyState: WebSocket.OPEN,
    send: vi.fn((data: string) => { sent.push(data); }),
    close: vi.fn(),
    set onopen(fn: (() => void) | null) { if (fn) fn(); },
    set onmessage(fn: ((ev: MessageEvent) => void) | null) { handler = fn; },
    set onclose(_: unknown) { /* noop */ },
    set onerror(_: unknown) { /* noop */ },
  } as unknown as WebSocket;

  const fire = (msg: AgentMessage): void => {
    handler?.(new MessageEvent("message", { data: JSON.stringify(msg) }));
  };
  return { ws, fire, sent };
}

interface AgentInternals {
  selectedEl: Element | null;
}

describe("agent — snapshot after hot reload replaces the element", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    sessionStorage.clear();
  });

  it("re-resolves a detached selected element via the saved selector", () => {
    const { ws, fire, sent } = makeFakeWs();
    vi.spyOn(globalThis, "WebSocket").mockImplementation(() => ws);
    // the constructor spy drops WebSocket's static readyState constants
    Object.assign(globalThis.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    const agent = new EditUpAgent({ wsUrl: "ws://127.0.0.1:9000", sessionToken: "tok" } as AgentConfig);
    agent.start();

    // element that was selected, then replaced by hot reload
    const stale = document.createElement("button");
    stale.id = "cta";
    const fresh = document.createElement("button");
    fresh.id = "cta";
    document.body.appendChild(fresh);
    (agent as unknown as AgentInternals).selectedEl = stale; // detached
    sessionStorage.setItem("__editup_selected__", "#cta");

    sent.length = 0;
    fire({ type: "request_snapshot" });

    expect((agent as unknown as AgentInternals).selectedEl).toBe(fresh);
    const snapshotMsg = sent
      .map((s) => JSON.parse(s) as AgentMessage)
      .find((m) => m.type === "snapshot");
    expect(snapshotMsg).toBeDefined();
  });

  it("does not send a snapshot when the element cannot be re-resolved", () => {
    const { ws, fire, sent } = makeFakeWs();
    vi.spyOn(globalThis, "WebSocket").mockImplementation(() => ws);
    // the constructor spy drops WebSocket's static readyState constants
    Object.assign(globalThis.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    const agent = new EditUpAgent({ wsUrl: "ws://127.0.0.1:9000", sessionToken: "tok" } as AgentConfig);
    agent.start();

    const stale = document.createElement("button");
    (agent as unknown as AgentInternals).selectedEl = stale;
    sessionStorage.setItem("__editup_selected__", "#gone");

    sent.length = 0;
    fire({ type: "request_snapshot" });

    expect((agent as unknown as AgentInternals).selectedEl).toBeNull();
    const snapshotMsg = sent
      .map((s) => JSON.parse(s) as AgentMessage)
      .find((m) => m.type === "snapshot");
    expect(snapshotMsg).toBeUndefined();
  });
});
