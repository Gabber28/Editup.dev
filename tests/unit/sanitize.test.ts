import { describe, it, expect } from "vitest";
import {
  escapeXml,
  wrapCdata,
  sanitizeForPrompt,
} from "../../src/lib/sanitize.js";

describe("sanitize", () => {
  it("escapes XML special chars", () => {
    expect(escapeXml(`<button class="x">&'`)).toBe(
      "&lt;button class=&quot;x&quot;&gt;&amp;&apos;"
    );
  });

  it("preserves non-special characters", () => {
    expect(escapeXml("normal text")).toBe("normal text");
  });

  it("wraps in CDATA", () => {
    expect(wrapCdata("hello")).toBe("<![CDATA[hello]]>");
  });

  it("escapes nested CDATA terminator", () => {
    const input = "abc]]>def";
    const wrapped = wrapCdata(input);
    expect(wrapped.startsWith("<![CDATA[")).toBe(true);
    expect(wrapped.endsWith("]]>")).toBe(true);
    expect(wrapped.includes("abc]]]]><![CDATA[>def")).toBe(true);
  });

  it("strips control characters in sanitizeForPrompt", () => {
    const withControl = `hello\x00world\x07`;
    const cleaned = sanitizeForPrompt(withControl);
    expect(cleaned).toContain("helloworld");
    expect(cleaned).not.toContain("\x00");
    expect(cleaned).not.toContain("\x07");
  });

  it("preserves newlines and tabs", () => {
    const cleaned = sanitizeForPrompt("line1\nline2\tindent");
    expect(cleaned).toContain("line1\nline2\tindent");
  });
});
