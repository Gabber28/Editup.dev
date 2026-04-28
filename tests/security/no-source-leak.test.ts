import { describe, it, expect } from "vitest";
import { Glob } from "../helpers/glob.js";
import { promises as fs } from "node:fs";
import { join, sep } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /--dangerously-skip-permissions/,
    message: "--dangerously-skip-permissions must never appear in source",
  },
  {
    pattern: /--skip-permissions/,
    message: "--skip-permissions must never appear in source",
  },
];

const ALLOWED_REFERENCES = new Set<string>([
  // Files where the literal appears intentionally as a forbidden token check
  join("src", "lib", "ai-adapters", "spawn-safe.ts"),
  join("tests", "security", "spawn-safe.test.ts"),
  join("tests", "security", "no-source-leak.test.ts"),
  join("tests", "security", "no-bind-zero.test.ts"),
  join("CLAUDE.md"),
  join(".claude", "plans", "wild-foraging-gosling.md"),
  join("eslint.config.js"),
  join("editup-planning-v3.2 (1).md"),
  join("editup-planning-v2.md"),
  join("editup-review-v2.txt"),
]);

const TARGET_DIRS = ["src", "ai-bridge", "verification", "injected", "src-tauri"];

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "target") continue;
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

describe("security — source-level audit", () => {
  it("no forbidden flags in production source", async () => {
    const violations: Array<{ file: string; pattern: string }> = [];
    for (const dir of TARGET_DIRS) {
      const fullDir = join(PROJECT_ROOT, dir);
      try {
        const files = await listFiles(fullDir);
        for (const file of files) {
          if (file.includes(`${sep}tests${sep}`)) continue;
          if (file.endsWith(".test.ts")) continue;
          const rel = file.replace(`${PROJECT_ROOT}${sep}`, "");
          if (ALLOWED_REFERENCES.has(rel)) continue;
          const content = await fs.readFile(file, "utf8");
          for (const { pattern, message } of FORBIDDEN_PATTERNS) {
            if (pattern.test(content)) {
              violations.push({ file: rel, pattern: message });
            }
          }
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw err;
      }
    }
    expect(violations).toEqual([]);
  });
});

export { Glob };
