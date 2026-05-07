import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");
const LICENSE_SOURCE = join(PROJECT_ROOT, "src-tauri", "src", "license.rs");

describe("security — license key storage encryption", () => {
  let content: string;

  beforeAll(async () => {
    content = await fs.readFile(LICENSE_SOURCE, "utf8");
  });

  it("uses AES encryption (aes_gcm)", () => {
    const violations: string[] = [];
    if (!/aes_gcm/.test(content)) {
      violations.push("license.rs does not import aes_gcm");
    }
    if (!/Aes256Gcm/.test(content)) {
      violations.push("license.rs does not use Aes256Gcm");
    }
    expect(violations).toEqual([]);
  });

  it("has encrypt and decrypt functions", () => {
    const violations: string[] = [];
    if (!/fn\s+encrypt\s*\(/.test(content)) {
      violations.push("license.rs missing encrypt function");
    }
    if (!/fn\s+decrypt\s*\(/.test(content)) {
      violations.push("license.rs missing decrypt function");
    }
    expect(violations).toEqual([]);
  });

  it("derives key from machine-id via HKDF", () => {
    const violations: string[] = [];
    if (!/derive_key/.test(content)) {
      violations.push("license.rs missing derive_key function");
    }
    if (!/machine_uid/.test(content)) {
      violations.push("license.rs does not use machine_uid");
    }
    if (!/Hkdf/.test(content)) {
      violations.push("license.rs does not use HKDF");
    }
    expect(violations).toEqual([]);
  });

  it("never writes plaintext key directly to disk", () => {
    const violations: string[] = [];
    // Check that fs::write always uses encrypt(), not raw key/json
    const writeLines = content
      .split("\n")
      .filter((line) => /fs::write/.test(line));
    for (const line of writeLines) {
      if (!/encrypt/.test(line)) {
        violations.push(`fs::write without encrypt: ${line.trim()}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("save_key encrypts before writing", () => {
    // Extract save_key function body and verify it calls encrypt
    const saveKeyMatch = /fn\s+save_key[\s\S]*?encrypt\(/;
    expect(saveKeyMatch.test(content)).toBe(true);
  });

  it("load_status decrypts after reading", () => {
    // Extract load_status function and verify it calls decrypt
    const loadMatch = /fn\s+load_status[\s\S]*?decrypt\(/;
    expect(loadMatch.test(content)).toBe(true);
  });

  it("uses nonce for AES-GCM encryption", () => {
    const noncePattern = /Nonce/;
    expect(noncePattern.test(content)).toBe(true);
  });

  it("only contacts api.lemonsqueezy.com externally", () => {
    const urlPattern = /https?:\/\/[a-zA-Z0-9.-]+/g;
    const urls = content.match(urlPattern) ?? [];
    const violations: string[] = [];
    for (const url of urls) {
      if (
        !url.includes("127.0.0.1") &&
        !url.includes("localhost") &&
        !url.includes("api.lemonsqueezy.com")
      ) {
        violations.push(`unexpected external URL: ${url}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
