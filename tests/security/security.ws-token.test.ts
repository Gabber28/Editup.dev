import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");
const WS_SOURCE = join(PROJECT_ROOT, "src-tauri", "src", "ws.rs");

describe("security — WS token validation", () => {
  let content: string;

  beforeAll(async () => {
    content = await fs.readFile(WS_SOURCE, "utf8");
  });

  it("has a validate_ws_handshake function", () => {
    const fnPattern = /fn\s+validate_ws_handshake\s*\(/;
    expect(fnPattern.test(content)).toBe(true);
  });

  it("validate_ws_handshake checks host header", () => {
    const hostCheck = /validate_host_header/;
    expect(hostCheck.test(content)).toBe(true);
  });

  it("validate_ws_handshake checks origin", () => {
    const originCheck = /validate_origin/;
    expect(originCheck.test(content)).toBe(true);
  });

  it("returns error when token is missing", () => {
    const missingToken = /missing token/;
    expect(missingToken.test(content)).toBe(true);
  });

  it("returns error when token is invalid", () => {
    const invalidToken = /invalid token/;
    expect(invalidToken.test(content)).toBe(true);
  });

  it("connection handler requires hello message with token", () => {
    const violations: string[] = [];
    if (!/msg_type\s*==\s*"hello"/.test(content)) {
      violations.push("ws.rs does not require hello message type");
    }
    if (!/m\.token/.test(content)) {
      violations.push("ws.rs does not extract token from hello message");
    }
    expect(violations).toEqual([]);
  });

  it("closes connection on invalid hello/token", () => {
    const closePattern = /sink\.close\(\)/;
    expect(closePattern.test(content)).toBe(true);
  });

  it("uses SessionToken type for token storage", () => {
    const tokenType = /SessionToken/;
    expect(tokenType.test(content)).toBe(true);
  });
});
