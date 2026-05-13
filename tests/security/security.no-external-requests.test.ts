import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { join, sep } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");

const SKIP_DIRS = new Set(["node_modules", "target", "landing", "tests", ".git", "dist"]);

const ALLOWED_HOSTS = new Set([
  "api.lemonsqueezy.com",
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
  "editup.dev",
  "releases.editup.dev",
  "www.w3.org",
]);

const ALLOWLIST = new Set<string>([
  join("CLAUDE.md"),
  join("editup-planning-v3.2 (1).md"),
  join("editup-planning-v2.md"),
  join("editup-review-v2.txt"),
  join("eslint.config.js"),
]);

// Hosts used in Rust security test assertions (validate_host, validate_origin)
const TEST_ONLY_HOSTS = new Set([
  "example.com",
  "attacker.com",
  "cdn.example.com",
]);

/**
 * Matches URLs like https://example.com or http://some.api.com
 * Ignores localhost, 127.0.0.1, and api.lemonsqueezy.com
 */
const URL_PATTERN =
  /(?:https?:\/\/)([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/g;

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...(await listFiles(full)));
    } else if (entry.isFile()) {
      if (
        entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx") ||
        entry.name.endsWith(".rs")
      ) {
        out.push(full);
      }
    }
  }
  return out;
}

function extractHosts(text: string): string[] {
  const hosts: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_PATTERN.source, "g");
  while ((match = re.exec(text)) !== null) {
    const host = match[1];
    if (host) hosts.push(host.toLowerCase());
  }
  return hosts;
}

describe("security — no external requests", () => {
  it("only contacts api.lemonsqueezy.com and localhost", async () => {
    const violations: Array<{ file: string; host: string }> = [];
    const files = await listFiles(PROJECT_ROOT);
    for (const file of files) {
      const rel = file.replace(`${PROJECT_ROOT}${sep}`, "");
      if (ALLOWLIST.has(rel)) continue;
      const content = await fs.readFile(file, "utf8");
      const hosts = extractHosts(content);
      const isRustTest = rel.endsWith(".rs");
      for (const host of hosts) {
        if (ALLOWED_HOSTS.has(host)) continue;
        if (isRustTest && TEST_ONLY_HOSTS.has(host)) continue;
        violations.push({ file: rel, host });
      }
    }
    expect(violations).toEqual([]);
  });
});
