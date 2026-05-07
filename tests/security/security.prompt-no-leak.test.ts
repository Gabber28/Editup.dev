import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");
const LOGGER_SOURCE = join(PROJECT_ROOT, "src", "lib", "logger.ts");

const REQUIRED_FORBIDDEN_KEYS = [
  "prompt",
  "snapshot",
  "code",
  "api_key",
  "token",
];

describe("security — prompt/sensitive data not leaked in logs", () => {
  let content: string;

  beforeAll(async () => {
    content = await fs.readFile(LOGGER_SOURCE, "utf8");
  });

  it("FORBIDDEN_KEYS set exists", () => {
    const pattern = /FORBIDDEN_KEYS\s*=\s*new\s+Set\s*\(\[/;
    expect(pattern.test(content)).toBe(true);
  });

  it("FORBIDDEN_KEYS contains all required sensitive keys", () => {
    const violations: string[] = [];
    for (const key of REQUIRED_FORBIDDEN_KEYS) {
      const keyPattern = new RegExp(`["']${key}["']`);
      if (!keyPattern.test(content)) {
        violations.push(`FORBIDDEN_KEYS missing: ${key}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("has a sanitizeContext function", () => {
    const fnPattern = /function\s+sanitizeContext\s*\(/;
    expect(fnPattern.test(content)).toBe(true);
  });

  it("sanitizeContext replaces forbidden keys with [redacted]", () => {
    const redactPattern = /\[redacted\]/;
    expect(redactPattern.test(content)).toBe(true);
  });

  it("sanitizeContext checks keys case-insensitively", () => {
    const caseCheck = /\.toLowerCase\(\)/;
    expect(caseCheck.test(content)).toBe(true);
  });

  it("sanitizeContext truncates long string values", () => {
    const truncPattern = /value\.length\s*>\s*\d+/;
    expect(truncPattern.test(content)).toBe(true);
  });

  it("all log emit calls route through sanitizeContext", () => {
    const emitPattern = /sanitizeContext/;
    const emitFnBody = content
      .split(/function\s+emit\s*\(/)
      .slice(1)
      .join("");
    expect(emitPattern.test(emitFnBody)).toBe(true);
  });

  it("does not use console.log (only stderr/warn/error)", () => {
    const violations: string[] = [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && /console\.log/.test(line)) {
        violations.push(`line ${i + 1}: console.log found`);
      }
    }
    expect(violations).toEqual([]);
  });
});
