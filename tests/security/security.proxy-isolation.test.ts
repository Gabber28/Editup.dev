import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");
const PROXY_SOURCE = join(PROJECT_ROOT, "src-tauri", "src", "proxy.rs");

describe("security — proxy isolation", () => {
  let content: string;

  beforeAll(async () => {
    content = await fs.readFile(PROXY_SOURCE, "utf8");
  });

  it("binds to LOCALHOST (127.0.0.1), not 0.0.0.0", () => {
    const violations: string[] = [];
    if (/0\.0\.0\.0/.test(content)) {
      violations.push("proxy.rs contains 0.0.0.0 bind address");
    }
    if (!/LOCALHOST/.test(content)) {
      violations.push("proxy.rs does not reference LOCALHOST constant");
    }
    expect(violations).toEqual([]);
  });

  it("uses assert_localhost_bind before listening", () => {
    const assertPattern = /assert_localhost_bind/;
    expect(assertPattern.test(content)).toBe(true);
  });

  it("rejects non-localhost peers", () => {
    const peerCheck = /peer\.ip\(\)\s*!=\s*LOCALHOST/;
    expect(peerCheck.test(content)).toBe(true);
  });

  it("does not forward internal headers (host, connection, content-length)", () => {
    const headerFilter =
      /"host"\s*\|\s*"connection"\s*\|\s*"content-length"/;
    expect(headerFilter.test(content)).toBe(true);
  });

  it("strips content-length and transfer-encoding from upstream response", () => {
    const respFilter =
      /"content-length"\s*\|\s*"transfer-encoding"\s*\|\s*"content-encoding"/;
    expect(respFilter.test(content)).toBe(true);
  });

  it("validates host header on incoming requests", () => {
    const hostValidation = /validate_host_header/;
    expect(hostValidation.test(content)).toBe(true);
  });

  it("validates target origin is loopback only", () => {
    const violations: string[] = [];
    if (!/validate_target_origin/.test(content)) {
      violations.push("proxy.rs missing validate_target_origin function");
    }
    if (!/127\.0\.0\.1.*localhost/.test(content)) {
      violations.push("proxy.rs does not check for loopback hosts");
    }
    expect(violations).toEqual([]);
  });

  it("imports security module", () => {
    const importPattern = /use\s+crate::security::/;
    expect(importPattern.test(content)).toBe(true);
  });
});
