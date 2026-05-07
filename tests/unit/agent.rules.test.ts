import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captureMatchingRules } from "@injected/style-capture.js";

function makeCSSStyleRule(
  selectorText: string,
  cssText: string
): CSSStyleRule {
  return {
    selectorText,
    cssText,
    type: CSSRule.STYLE_RULE,
  } as unknown as CSSStyleRule;
}

function makeCSSRuleList(rules: CSSRule[]): CSSRuleList {
  const list = rules as unknown as CSSRuleList;
  Object.defineProperty(list, "length", { value: rules.length });
  (list as unknown as Record<string, unknown>)[Symbol.iterator] =
    (): Iterator<CSSRule> => rules[Symbol.iterator]();
  return list;
}

function makeStyleSheet(
  rules: CSSRule[],
  href: string | null = null
): CSSStyleSheet {
  return {
    href,
    cssRules: makeCSSRuleList(rules),
  } as unknown as CSSStyleSheet;
}

describe("captureMatchingRules", () => {
  let originalStyleSheets: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalStyleSheets = Object.getOwnPropertyDescriptor(
      document,
      "styleSheets"
    );
  });

  afterEach(() => {
    if (originalStyleSheets) {
      Object.defineProperty(document, "styleSheets", originalStyleSheets);
    } else {
      // Restore default by deleting override
      const proto = Object.getPrototypeOf(document);
      delete (document as unknown as Record<string, unknown>)["styleSheets"];
    }
  });

  it("returns rules whose selector matches the element", () => {
    const el = document.createElement("button");
    el.classList.add("btn");

    const matchRule = makeCSSStyleRule(
      ".btn",
      ".btn { color: red; }"
    );
    const noMatchRule = makeCSSStyleRule(
      ".other",
      ".other { color: blue; }"
    );

    const sheet = makeStyleSheet([matchRule, noMatchRule], "/styles.css");
    Object.defineProperty(document, "styleSheets", {
      value: [sheet],
      configurable: true,
    });

    const result = captureMatchingRules(el);
    expect(result).toHaveLength(1);
    expect(result[0].selector).toBe(".btn");
    expect(result[0].rule_text).toBe(".btn { color: red; }");
    expect(result[0].source_file).toBe("/styles.css");
  });

  it("excludes rules that do not match the element", () => {
    const el = document.createElement("div");
    el.classList.add("container");

    const noMatch = makeCSSStyleRule(
      ".sidebar",
      ".sidebar { width: 200px; }"
    );
    const sheet = makeStyleSheet([noMatch], "/app.css");
    Object.defineProperty(document, "styleSheets", {
      value: [sheet],
      configurable: true,
    });

    const result = captureMatchingRules(el);
    expect(result).toHaveLength(0);
  });

  it("uses <inline> as source when sheet has no href", () => {
    const el = document.createElement("p");

    const rule = makeCSSStyleRule("p", "p { margin: 0; }");
    const sheet = makeStyleSheet([rule], null);
    Object.defineProperty(document, "styleSheets", {
      value: [sheet],
      configurable: true,
    });

    const result = captureMatchingRules(el);
    expect(result).toHaveLength(1);
    expect(result[0].source_file).toBe("<inline>");
  });

  it("handles cross-origin sheets gracefully (cssRules throws)", () => {
    const el = document.createElement("div");
    el.classList.add("x");

    const crossOriginSheet = {
      href: "https://cdn.example.com/styles.css",
      get cssRules(): CSSRuleList {
        throw new DOMException("Cannot access", "SecurityError");
      },
    } as unknown as CSSStyleSheet;

    const localRule = makeCSSStyleRule(".x", ".x { padding: 4px; }");
    const localSheet = makeStyleSheet([localRule], "/local.css");

    Object.defineProperty(document, "styleSheets", {
      value: [crossOriginSheet, localSheet],
      configurable: true,
    });

    const result = captureMatchingRules(el);
    expect(result).toHaveLength(1);
    expect(result[0].selector).toBe(".x");
  });

  it("collects rules from multiple stylesheets", () => {
    const el = document.createElement("a");
    el.classList.add("link");

    const rule1 = makeCSSStyleRule("a", "a { text-decoration: none; }");
    const rule2 = makeCSSStyleRule(".link", ".link { color: blue; }");

    const sheet1 = makeStyleSheet([rule1], "/base.css");
    const sheet2 = makeStyleSheet([rule2], "/theme.css");

    Object.defineProperty(document, "styleSheets", {
      value: [sheet1, sheet2],
      configurable: true,
    });

    const result = captureMatchingRules(el);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.selector)).toContain("a");
    expect(result.map((r) => r.selector)).toContain(".link");
  });
});
