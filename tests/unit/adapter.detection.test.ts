import { describe, it, expect, vi, beforeEach } from "vitest";

/** Mock the spawn-tauri module before importing adapters. */
const detectCliViaTauri = vi.fn<(name: string) => Promise<boolean>>();

vi.mock("@/lib/ai-adapters/spawn-tauri.js", () => ({
  detectCliViaTauri,
  spawnViaTauri: vi.fn(),
}));

import { ClaudeCodeAdapter } from "@/lib/ai-adapters/claude-code.js";
import { AiderAdapter } from "@/lib/ai-adapters/aider.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClaudeCodeAdapter.detect()", () => {
  it("returns true when claude CLI is available", async () => {
    detectCliViaTauri.mockResolvedValue(true);
    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.detect();
    expect(result).toBe(true);
    expect(detectCliViaTauri).toHaveBeenCalledWith("claude");
  });

  it("returns false when claude CLI is not found", async () => {
    detectCliViaTauri.mockResolvedValue(false);
    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.detect();
    expect(result).toBe(false);
  });

  it("returns false when detectCliViaTauri throws", async () => {
    detectCliViaTauri.mockRejectedValue(new Error("Tauri unavailable"));
    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.detect();
    expect(result).toBe(false);
  });

  it("has correct name and type", () => {
    const adapter = new ClaudeCodeAdapter();
    expect(adapter.name).toBe("claude-code");
    expect(adapter.type).toBe("cli");
  });
});

describe("AiderAdapter.detect()", () => {
  it("returns true when aider CLI is available", async () => {
    detectCliViaTauri.mockResolvedValue(true);
    const adapter = new AiderAdapter();
    const result = await adapter.detect();
    expect(result).toBe(true);
    expect(detectCliViaTauri).toHaveBeenCalledWith("aider");
  });

  it("returns false when aider CLI is not found", async () => {
    detectCliViaTauri.mockResolvedValue(false);
    const adapter = new AiderAdapter();
    const result = await adapter.detect();
    expect(result).toBe(false);
  });

  it("returns false when detectCliViaTauri throws", async () => {
    detectCliViaTauri.mockRejectedValue(new Error("Tauri unavailable"));
    const adapter = new AiderAdapter();
    const result = await adapter.detect();
    expect(result).toBe(false);
  });

  it("has correct name and type", () => {
    const adapter = new AiderAdapter();
    expect(adapter.name).toBe("aider");
    expect(adapter.type).toBe("cli");
  });
});
