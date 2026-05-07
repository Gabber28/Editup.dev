import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assertCommandSafety,
  assertSafeArgs,
  assertHasAllowedTools,
  spawnSafe,
} from "@/lib/ai-adapters/spawn-safe.js";
import { SecurityViolationError } from "@/lib/errors.js";

/**
 * bridge.spawn — tests the spawn flow and assertCommandSafety composition.
 * The security/ tests cover individual flag/tool validation; here we focus
 * on the combined command+args path and the spawnSafe integration.
 */

describe("assertCommandSafety — combined validation", () => {
  it("validates both forbidden flags and allowedTools in one call", () => {
    expect(() =>
      assertCommandSafety("claude", [
        "--dangerously-skip-permissions",
        "--allowedTools",
        "Read,Glob,Grep",
      ])
    ).toThrow(SecurityViolationError);
  });

  it("enforces allowedTools for 'claude' even if args are safe", () => {
    expect(() =>
      assertCommandSafety("claude", ["-p", "prompt text"])
    ).toThrow(SecurityViolationError);
  });

  it("does not require allowedTools for 'aider'", () => {
    expect(() =>
      assertCommandSafety("aider", ["--message", "hi", "--yes-always"])
    ).not.toThrow();
  });

  it("accepts plan-step args for claude (Read,Glob,Grep)", () => {
    expect(() =>
      assertCommandSafety("claude", [
        "-p", "test prompt",
        "--allowedTools", "Read,Glob,Grep",
        "--output-format", "json",
      ])
    ).not.toThrow();
  });

  it("accepts execute-step args for claude (Read,Glob,Grep,Edit)", () => {
    expect(() =>
      assertCommandSafety("claude", [
        "-p", "test prompt",
        "--allowedTools", "Read,Glob,Grep,Edit",
        "--max-turns", "15",
      ])
    ).not.toThrow();
  });

  it("rejects claude with Write in allowedTools", () => {
    expect(() =>
      assertCommandSafety("claude", [
        "-p", "test",
        "--allowedTools", "Read,Write",
      ])
    ).toThrow(SecurityViolationError);
  });

  it("rejects claude with Bash in allowedTools", () => {
    expect(() =>
      assertCommandSafety("claude", [
        "-p", "test",
        "--allowedTools", "Read,Bash",
      ])
    ).toThrow(SecurityViolationError);
  });

  it("rejects claude with WebFetch in allowedTools", () => {
    expect(() =>
      assertCommandSafety("claude", [
        "-p", "test",
        "--allowedTools", "Read,WebFetch",
      ])
    ).toThrow(SecurityViolationError);
  });
});

describe("assertSafeArgs — edge cases for spawn flow", () => {
  it("handles --allowed-tools (hyphenated variant)", () => {
    expect(() =>
      assertSafeArgs(["--allowed-tools", "Read,Write"])
    ).toThrow(SecurityViolationError);
  });

  it("handles --allowed-tools=Read,Bash (equals form)", () => {
    expect(() =>
      assertSafeArgs(["--allowed-tools=Read,Bash"])
    ).toThrow(SecurityViolationError);
  });

  it("passes with empty args array", () => {
    expect(() => assertSafeArgs([])).not.toThrow();
  });

  it("handles tools with extra whitespace in list", () => {
    expect(() =>
      assertSafeArgs(["--allowedTools", "Read , Write , Edit"])
    ).toThrow(SecurityViolationError);
  });
});

describe("spawnSafe — integration with assertCommandSafety", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects before reaching Tauri when args are unsafe", async () => {
    await expect(
      spawnSafe({
        cmd: "claude",
        args: ["--dangerously-skip-permissions"],
        cwd: "/tmp",
        timeoutMs: 5000,
      })
    ).rejects.toThrow(SecurityViolationError);
  });

  it("rejects claude without allowedTools before spawning", async () => {
    await expect(
      spawnSafe({
        cmd: "claude",
        args: ["-p", "test"],
        cwd: "/tmp",
        timeoutMs: 5000,
      })
    ).rejects.toThrow(SecurityViolationError);
  });
});
