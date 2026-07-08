import { describe, it, expect } from "vitest";
import { buildMultiSnapshot } from "@/hooks/useApplyFlow.js";
import { parseEnrichedSnapshot } from "@bridge/enriched-snapshot.js";
import type { AgentSnapshot } from "@/hooks/useAgentConnection.js";

function makeAgentSnapshot(
  overrides: Partial<AgentSnapshot["element"]> = {},
  extra: Partial<AgentSnapshot> = {}
): AgentSnapshot {
  return {
    element: {
      tag: "button",
      classes: ["btn"],
      source_file: "src/Button.tsx",
      source_line: 10,
      ...overrides,
    },
    styling: {
      framework: "plain-css",
      class_to_rule_map: {},
      active_css_variables: {},
    },
    computed_style: { "background-color": "rgb(10, 20, 30)", color: "rgb(0, 0, 0)" },
    ...extra,
  };
}

describe("buildMultiSnapshot", () => {
  it("throws when there are no edits", () => {
    expect(() => buildMultiSnapshot({}, {}, "")).toThrow("No changes to apply");
  });

  it("single element: changes carry no element_ref and user text is preserved", () => {
    const cache = { k1: makeAgentSnapshot() };
    const overrides = { k1: { default: { "background-color": "rgb(1, 2, 3)" } } };

    const snap = buildMultiSnapshot(cache, overrides, "make it pop");

    expect(snap.changes).toHaveLength(1);
    expect(snap.changes[0]?.element_ref).toBeUndefined();
    expect(snap.changes[0]?.before_computed).toBe("rgb(10, 20, 30)");
    expect(snap.changes[0]?.after_computed).toBe("rgb(1, 2, 3)");
    expect(snap.text_instructions).toBe("make it pop");
  });

  it("multi element: secondary changes get element_ref, primary does not", () => {
    const cache = {
      k1: makeAgentSnapshot(),
      k2: makeAgentSnapshot({ tag: "a", classes: ["nav"], source_file: "src/Nav.tsx", source_line: 5 }),
    };
    const overrides = {
      k1: { default: { "background-color": "rgb(1, 2, 3)" } },
      k2: { default: { color: "rgb(9, 9, 9)" } },
    };

    const snap = buildMultiSnapshot(cache, overrides, "");

    const primary = snap.changes.find((c) => c.property === "background-color");
    const secondary = snap.changes.find((c) => c.property === "color");
    expect(primary?.element_ref).toBeUndefined();
    expect(secondary?.element_ref).toEqual({
      tag: "a",
      classes: ["nav"],
      source_file: "src/Nav.tsx",
      source_line: 5,
    });
    // no synthetic text is fabricated anymore
    expect(snap.text_instructions).toBeUndefined();
  });

  it("pseudo-state edits set pseudo_state and read before from pseudo_rules", () => {
    const cache = {
      k1: makeAgentSnapshot({}, {
        styling: {
          framework: "plain-css",
          class_to_rule_map: {},
          active_css_variables: {},
          pseudo_rules: [
            {
              pseudo: ":hover",
              selector: ".btn:hover",
              properties: { "background-color": "rgb(50, 50, 50)" },
              source_file: "src/styles.css",
              line_number: 0,
            },
          ],
        },
      }),
    };
    const overrides = { k1: { ":hover": { "background-color": "rgb(90, 20, 200)" } } };

    const snap = buildMultiSnapshot(cache, overrides, "");

    expect(snap.changes[0]?.pseudo_state).toBe(":hover");
    expect(snap.changes[0]?.before_computed).toBe("rgb(50, 50, 50)");
  });

  it("survives strict schema validation without losing pseudo_state or element_ref", () => {
    const cache = {
      k1: makeAgentSnapshot(),
      k2: makeAgentSnapshot({ tag: "a", classes: [] }),
    };
    const overrides = {
      k1: { ":hover": { color: "rgb(1, 1, 1)" } },
      k2: { default: { color: "rgb(2, 2, 2)" } },
    };

    const snap = buildMultiSnapshot(cache, overrides, "");
    const parsed = parseEnrichedSnapshot(snap);

    expect(parsed.changes.find((c) => c.pseudo_state === ":hover")).toBeDefined();
    expect(parsed.changes.find((c) => c.element_ref?.tag === "a")).toBeDefined();
  });
});
