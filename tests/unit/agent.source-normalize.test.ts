import { describe, it, expect } from "vitest";
import { normalizeSheetSource } from "@injected/style-capture.js";

describe("normalizeSheetSource", () => {
  it("returns <inline> for null href", () => {
    expect(normalizeSheetSource(null)).toBe("<inline>");
  });

  it("strips origin and query from same-origin dev-server URLs", () => {
    const href = `${location.origin}/src/app.css?t=1699999999`;
    expect(normalizeSheetSource(href)).toBe("src/app.css");
  });

  it("resolves root-relative hrefs to relative paths", () => {
    expect(normalizeSheetSource("/styles/main.css")).toBe("styles/main.css");
  });

  it("keeps cross-origin URLs untouched", () => {
    const href = "https://cdn.example.com/lib.css";
    expect(normalizeSheetSource(href)).toBe(href);
  });
});
