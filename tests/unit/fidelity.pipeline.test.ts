import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildSnapshotPayload } from "@injected/snapshot-builder.js";
import { buildMultiSnapshot } from "@/hooks/useApplyFlow.js";
import { buildPlanPrompt, buildExecutePrompt } from "@bridge/prompt.js";
import type { AgentSnapshot } from "@/hooks/useAgentConnection.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

/**
 * The shape of the page that produced the reported failure: three cards sharing
 * one rule, all CSS in an inline <style>, no framework and no source maps.
 */
const DEMO = `
  <main>
    <section class="cards">
      <div class="card"><div class="icon">A</div><p>First card</p></div>
      <div class="card"><div class="icon">B</div><p>Second card</p></div>
      <div class="card"><div class="icon">C</div><p>Third card</p></div>
    </section>
  </main>`;

const DEMO_CSS = `
  .card { padding: 28px; border-radius: 16px; }
  .card .icon { width: 44px; height: 44px; }
  .card p { font-size: 14px; }`;

/** Mirrors how the app keys edited elements (App.tsx buildElementKey). */
function keyOf(snap: AgentSnapshot): string {
  return snap.element.dom_path ?? snap.element.tag;
}

function captureFor(selector: string, nth: number): AgentSnapshot {
  const el = document.querySelectorAll(selector)[nth] as Element;
  return buildSnapshotPayload(el) as unknown as AgentSnapshot;
}

function promptForEdit(
  snap: AgentSnapshot,
  overrides: Record<string, string>,
): string {
  const key = keyOf(snap);
  const snapshot = buildMultiSnapshot(
    { [key]: snap },
    { [key]: { default: overrides } },
    "",
  );
  return buildPlanPrompt({ snapshot, projectRoot: "/demo" });
}

beforeEach(() => {
  document.head.innerHTML = `<style>${DEMO_CSS}</style>`;
  document.body.innerHTML = DEMO;
});

describe("capture → snapshot → prompt keeps the edit faithful", () => {
  it("tells the AI which of the three cards was edited", () => {
    const prompt = promptForEdit(captureFor(".card", 1), { top: "24px" });

    // The second card, not "a div.card".
    expect(prompt).toContain("<dom_path>");
    expect(prompt).toContain("nth-of-type(2)");
    expect(prompt).toContain("<sibling_position>2</sibling_position>");
  });

  it("warns that the rule about to be edited is shared by three elements", () => {
    const prompt = promptForEdit(captureFor(".card", 1), { top: "24px" });

    const ruleLine = prompt
      .split("\n")
      .find((l) => l.includes('selector=".card"'));
    expect(ruleLine).toBeDefined();
    expect(ruleLine).toContain('shared_by="3"');
  });

  it("points at a file that exists instead of a placeholder", () => {
    const prompt = promptForEdit(captureFor(".card", 1), { top: "24px" });
    expect(prompt).not.toContain("&lt;inline&gt;");
    expect(prompt).not.toContain('line="0"><');
  });

  it("carries the CSS of an element that has no class of its own", () => {
    // The <p> in the failing run reached the AI with no rules at all.
    const prompt = promptForEdit(captureFor(".card p", 1), { top: "7px" });
    expect(prompt).toContain("<matching_rules>");
    expect(prompt).toContain(".card p");
  });

  it("identifies each instance separately when two cards are edited at once", () => {
    const first = captureFor(".card", 0);
    const third = captureFor(".card", 2);
    const snapshot = buildMultiSnapshot(
      { [keyOf(first)]: first, [keyOf(third)]: third },
      {
        [keyOf(first)]: { default: { top: "10px" } },
        [keyOf(third)]: { default: { top: "30px" } },
      },
      "",
    );
    const prompt = buildPlanPrompt({ snapshot, projectRoot: "/demo" });

    expect(keyOf(first)).not.toBe(keyOf(third));
    expect(prompt).toContain("<element_changes ");
    // The card has no text of its own, so the preview falls back to its
    // descendants' text — still enough to tell the instances apart.
    expect(prompt).toMatch(/text="[^"]*Third card[^"]*"/);
    expect(prompt).toContain("nth-of-type(3)");
  });

  it("gives the execute step the same identity and scope guardrails", () => {
    const snap = captureFor(".icon", 1);
    const key = keyOf(snap);
    const snapshot = buildMultiSnapshot(
      { [key]: snap },
      { [key]: { default: { left: "4px" } } },
      "",
    );
    const prompt = buildExecutePrompt({
      snapshot,
      projectRoot: "/demo",
      approvedPlanJson: "{}",
    });

    expect(prompt).toContain("nth-of-type(2)");
    expect(prompt).toContain("shared_by");
    expect(prompt).toMatch(/failed edit/i);
  });
});
