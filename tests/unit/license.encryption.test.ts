import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");
const LICENSE_RS = join(PROJECT_ROOT, "src-tauri", "src", "license.rs");

describe("license — encryption source audit", () => {
  it("license.rs uses encryption primitives", async () => {
    const content = await fs.readFile(LICENSE_RS, "utf8");
    const hasEncrypt =
      /encrypt|aes|cipher|hkdf|sha256/i.test(content);
    expect(hasEncrypt).toBe(true);
  });

  it("license.rs uses key derivation from hardware ID", async () => {
    const content = await fs.readFile(LICENSE_RS, "utf8");
    const hasKeyDerivation =
      /machine.?id|hardware.?id|hkdf|derive/i.test(content);
    expect(hasKeyDerivation).toBe(true);
  });

  it("license.rs never writes plaintext license key directly", async () => {
    const content = await fs.readFile(LICENSE_RS, "utf8");
    const lines = content.split("\n");
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line.trimStart().startsWith("//")) continue;
      if (
        /fs::write.*key|write_all.*key|plaintext.*write/i.test(line) &&
        !/encrypt/i.test(line)
      ) {
        violations.push(`line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("license.rs stores to ~/.editup/license path", async () => {
    const content = await fs.readFile(LICENSE_RS, "utf8");
    const hasEditupPath = /\.editup.*license|editup.*license/i.test(content);
    expect(hasEditupPath).toBe(true);
  });
});
