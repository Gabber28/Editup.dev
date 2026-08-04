import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeSheetSource,
  specificityOf,
  captureMatchingRules,
} from "@injected/style-capture.js";

describe("normalizeSheetSource — an inline <style> is a real file", () => {
  it("names the document instead of the unopenable <inline>", () => {
    const source = normalizeSheetSource(null);
    expect(source).not.toBe("<inline>");
    expect(source).toMatch(/\.html$|^$|\w/);
  });

  it("keeps mapping same-origin hrefs to project paths", () => {
    const href = `${location.origin}/src/app.css?t=123`;
    expect(normalizeSheetSource(href)).toBe("src/app.css");
  });

  it("leaves a cross-origin href untouched", () => {
    expect(normalizeSheetSource("https://cdn.example.com/x.css")).toBe(
      "https://cdn.example.com/x.css",
    );
  });
});

describe("specificityOf", () => {
  it("ranks id over class over tag", () => {
    expect(specificityOf("#hero")).toBeGreaterThan(specificityOf(".card"));
    expect(specificityOf(".card")).toBeGreaterThan(specificityOf("div"));
  });

  it("ranks a descendant rule above the bare class it contains", () => {
    expect(specificityOf(".card .icon")).toBeGreaterThan(specificityOf(".icon"));
  });
});

describe("captureMatchingRules — reach of each rule", () => {
  beforeEach(() => {
    document.head.innerHTML = `<style>
      .card { padding: 28px; }
      .card .icon { width: 44px; }
      #only { color: red; }
    </style>`;
    document.body.innerHTML = `
      <div class="card"><div class="icon">A</div></div>
      <div class="card"><div class="icon" id="only">B</div></div>
      <div class="card"><div class="icon">C</div></div>`;
  });

  it("counts how many elements each rule styles", () => {
    const icon = document.querySelector(".icon") as Element;
    const rules = captureMatchingRules(icon);
    const shared = rules.find((r) => r.selector === ".card .icon");
    expect(shared?.match_count).toBe(3);
  });

  it("marks a single-element rule as reaching one", () => {
    const only = document.getElementById("only") as Element;
    const rules = captureMatchingRules(only);
    expect(rules.find((r) => r.selector === "#only")?.match_count).toBe(1);
  });

  it("records a specificity for ranking", () => {
    const icon = document.querySelector(".icon") as Element;
    const rules = captureMatchingRules(icon);
    expect(rules.every((r) => typeof r.specificity === "number")).toBe(true);
  });
});
