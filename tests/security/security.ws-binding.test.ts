import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");
const WS_SOURCE = join(PROJECT_ROOT, "src-tauri", "src", "ws.rs");

describe("security — WS server binding", () => {
  let content: string;

  beforeAll(async () => {
    content = await fs.readFile(WS_SOURCE, "utf8");
  });

  it("binds to LOCALHOST (127.0.0.1), not 0.0.0.0", () => {
    const violations: string[] = [];
    if (/0\.0\.0\.0/.test(content)) {
      violations.push("ws.rs contains 0.0.0.0 bind address");
    }
    if (!/LOCALHOST/.test(content)) {
      violations.push("ws.rs does not reference LOCALHOST constant");
    }
    expect(violations).toEqual([]);
  });

  it("uses SocketAddr::new(LOCALHOST, ..) for listener bind", () => {
    const bindPattern = /SocketAddr::new\(\s*LOCALHOST\s*,/;
    expect(bindPattern.test(content)).toBe(true);
  });

  it("rejects non-localhost peers", () => {
    const peerCheck = /peer\.ip\(\)\s*!=\s*LOCALHOST/;
    expect(peerCheck.test(content)).toBe(true);
  });

  it("contains token validation logic", () => {
    const violations: string[] = [];
    if (!/session_token/.test(content)) {
      violations.push("ws.rs missing session_token field");
    }
    if (!/verify/.test(content)) {
      violations.push("ws.rs missing token verify call");
    }
    if (!/validate_ws_handshake/.test(content)) {
      violations.push("ws.rs missing validate_ws_handshake function");
    }
    expect(violations).toEqual([]);
  });

  it("imports security module for validation", () => {
    const importPattern = /use\s+crate::security::/;
    expect(importPattern.test(content)).toBe(true);
  });
});
