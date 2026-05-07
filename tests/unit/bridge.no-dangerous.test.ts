import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { join, sep } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");

/** Directories whose source files must never contain the flag. */
const SCAN_DIRS = [
  join(PROJECT_ROOT, "ai-bridge"),
  join(PROJECT_ROOT, "src", "lib", "ai-adapters"),
];

const FORBIDDEN = "--dangerously-skip-permissions";

async function listTsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...(await listTsFiles(full)));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      out.push(full);
    }
  }
  return out;
}

describe("bridge — no --dangerously-skip-permissions in source", () => {
  it("ai-bridge/ contains no reference to the flag", async () => {
    const files = await listTsFiles(SCAN_DIRS[0]!);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const content = await fs.readFile(file, "utf8");
      if (content.includes(FORBIDDEN)) {
        const rel = file.replace(`${PROJECT_ROOT}${sep}`, "");
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it("src/lib/ai-adapters/ contains no reference to the flag", async () => {
    const files = await listTsFiles(SCAN_DIRS[1]!);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const content = await fs.readFile(file, "utf8");
      if (content.includes(FORBIDDEN)) {
        const rel = file.replace(`${PROJECT_ROOT}${sep}`, "");
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it("no file in ai-bridge/ or ai-adapters/ uses exec()", async () => {
    const allFiles = [
      ...(await listTsFiles(SCAN_DIRS[0]!)),
      ...(await listTsFiles(SCAN_DIRS[1]!)),
    ];

    const execPattern = /\bexec\s*\(/;
    const violations: string[] = [];
    for (const file of allFiles) {
      const content = await fs.readFile(file, "utf8");
      if (execPattern.test(content)) {
        const rel = file.replace(`${PROJECT_ROOT}${sep}`, "");
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it("no file sets shell: true in spawn options", async () => {
    const allFiles = [
      ...(await listTsFiles(SCAN_DIRS[0]!)),
      ...(await listTsFiles(SCAN_DIRS[1]!)),
    ];

    const shellTrue = /shell\s*:\s*true/;
    const violations: string[] = [];
    for (const file of allFiles) {
      const content = await fs.readFile(file, "utf8");
      if (shellTrue.test(content)) {
        const rel = file.replace(`${PROJECT_ROOT}${sep}`, "");
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});
