import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { join, sep } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");

const ALLOWLIST = new Set<string>([
  join("tests", "security", "no-bind-zero.test.ts"),
  join("tests", "security", "mcp-binding.test.ts"),
  join("src-tauri", "src", "security.rs"),
  join("CLAUDE.md"),
  join("eslint.config.js"),
]);

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "target" ||
        entry.name === "landing"
      )
        continue;
      out.push(...(await listFiles(full)));
    } else if (entry.isFile()) {
      if (
        entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx") ||
        entry.name.endsWith(".rs") ||
        entry.name.endsWith(".js")
      ) {
        out.push(full);
      }
    }
  }
  return out;
}

describe("security — no 0.0.0.0 bind in source", () => {
  it("never binds to 0.0.0.0", async () => {
    const violations: string[] = [];
    const files = await listFiles(PROJECT_ROOT);
    for (const file of files) {
      const rel = file.replace(`${PROJECT_ROOT}${sep}`, "");
      if (ALLOWLIST.has(rel)) continue;
      if (file.endsWith(".test.ts")) continue;
      const content = await fs.readFile(file, "utf8");
      if (/0\.0\.0\.0/.test(content)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});
