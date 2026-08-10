import { describe, it, expect } from "vitest";
import type { MatchingRule } from "@/types/snapshot.js";
import {
  declaredValue,
  authoredValue,
  resolveField,
  isSet,
  normalizeLength,
  stepValue,
} from "@/components/editor/panels/position-provenance.js";

const rule = (selector: string, ruleText: string): MatchingRule => ({
  selector,
  source_file: "styles.css",
  rule_text: ruleText,
  line_number: 1,
  match_count: 1,
});

describe("declaredValue", () => {
  it("reads a property out of a rule body", () => {
    expect(declaredValue(".card { top: 24px; left: 0 }", "top")).toBe("24px");
  });

  it("returns undefined when the rule does not set it", () => {
    expect(declaredValue(".card { color: red }", "top")).toBeUndefined();
  });

  it("strips !important", () => {
    expect(declaredValue(".card { top: 8px !important }", "top")).toBe("8px");
  });

  it("takes the last declaration when a block repeats one", () => {
    expect(declaredValue(".card { top: 4px; top: 12px }", "top")).toBe("12px");
  });

  it("does not confuse a property with a longer one sharing its prefix", () => {
    expect(declaredValue(".card { top-margin: 5px }", "top")).toBeUndefined();
  });

  it("survives a value containing a colon", () => {
    expect(
      declaredValue(
        ".card { background: url(http://x/y.png); top: 3px }",
        "top"
      )
    ).toBe("3px");
  });
});

describe("authoredValue", () => {
  it("takes the first rule that declares the property", () => {
    const rules = [
      rule(".a", ".a { top: 1px }"),
      rule(".b", ".b { top: 2px }"),
    ];
    expect(authoredValue(rules, "top")).toBe("1px");
  });

  it("skips rules that do not declare it", () => {
    const rules = [
      rule(".a", ".a { color: red }"),
      rule(".b", ".b { top: 2px }"),
    ];
    expect(authoredValue(rules, "top")).toBe("2px");
  });

  it("returns undefined with no rules at all", () => {
    expect(authoredValue(undefined, "top")).toBeUndefined();
  });
});

describe("resolveField", () => {
  const computed = { top: "-99999px", left: "10px" };

  it("never presents a computed value as authored", () => {
    const field = resolveField("top", {}, [], computed);
    expect(field.value).toBe("");
    expect(field.origin).toBe("auto");
    // Still available as a reference, just not as the field's content.
    expect(field.computed).toBe("-99999px");
  });

  it("uses the authored value when a rule declares it", () => {
    const field = resolveField(
      "top",
      {},
      [rule(".a", ".a { top: 24px }")],
      computed
    );
    expect(field).toMatchObject({ value: "24px", origin: "authored" });
  });

  it("lets this session's edit outrank the stylesheet", () => {
    const field = resolveField(
      "top",
      { top: "40px" },
      [rule(".a", ".a { top: 24px }")],
      computed
    );
    expect(field).toMatchObject({ value: "40px", origin: "edited" });
  });

  it("treats an authored `auto` as unset", () => {
    const field = resolveField(
      "top",
      {},
      [rule(".a", ".a { top: auto }")],
      computed
    );
    expect(field.origin).toBe("auto");
  });

  it("marks only declared sides as set", () => {
    expect(
      isSet(resolveField("left", {}, [rule(".a", ".a { left: 0 }")], computed))
    ).toBe(true);
    expect(isSet(resolveField("right", {}, [], computed))).toBe(false);
  });
});

describe("normalizeLength", () => {
  it("assumes px for a bare number", () => {
    expect(normalizeLength("24")).toBe("24px");
    expect(normalizeLength("-8")).toBe("-8px");
    expect(normalizeLength("1.5")).toBe("1.5px");
  });

  it("preserves an explicit unit", () => {
    for (const v of ["10%", "2rem", "50vh", "1.5em"]) {
      expect(normalizeLength(v)).toBe(v);
    }
  });

  it("clears on empty or auto", () => {
    expect(normalizeLength("")).toBeNull();
    expect(normalizeLength("   ")).toBeNull();
    expect(normalizeLength("auto")).toBeNull();
    expect(normalizeLength("AUTO")).toBeNull();
  });
});

describe("stepValue", () => {
  it("steps while keeping the unit", () => {
    expect(stepValue("10px", 1)).toBe("11px");
    expect(stepValue("10%", -1)).toBe("9%");
    expect(stepValue("2rem", 10)).toBe("12rem");
  });

  it("assumes px when the value has no unit", () => {
    expect(stepValue("5", 1)).toBe("6px");
  });

  it("steps from the fallback when empty", () => {
    expect(stepValue("", 1)).toBe("1px");
    expect(stepValue("", -1, "0")).toBe("-1px");
  });

  it("leaves a non-numeric value alone", () => {
    expect(stepValue("auto", 1)).toBe("auto");
  });
});
