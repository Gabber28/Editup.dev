import { describe, it, expect } from "vitest";
import {
  assertSafeArgs,
  assertHasAllowedTools,
  assertCommandSafety,
} from "../../src/lib/ai-adapters/spawn-safe.js";
import { SecurityViolationError } from "../../src/lib/errors.js";

describe("security — spawn-safe", () => {
  it("rejects --dangerously-skip-permissions", () => {
    expect(() =>
      assertSafeArgs(["-p", "test", "--dangerously-skip-permissions"])
    ).toThrow(SecurityViolationError);
  });

  it("rejects --skip-permissions", () => {
    expect(() => assertSafeArgs(["--skip-permissions"])).toThrow(
      SecurityViolationError
    );
  });

  it("rejects Write in allowedTools", () => {
    expect(() =>
      assertSafeArgs(["--allowedTools", "Read,Write,Edit"])
    ).toThrow(SecurityViolationError);
  });

  it("rejects Bash in allowedTools", () => {
    expect(() =>
      assertSafeArgs(["--allowedTools", "Read,Bash,Edit"])
    ).toThrow(SecurityViolationError);
  });

  it("rejects WebFetch in allowedTools", () => {
    expect(() =>
      assertSafeArgs(["--allowedTools", "Read,WebFetch"])
    ).toThrow(SecurityViolationError);
  });

  it("accepts Read,Glob,Grep for plan step", () => {
    expect(() =>
      assertSafeArgs([
        "-p",
        "test",
        "--allowedTools",
        "Read,Glob,Grep",
        "--add-dir",
        "/project",
      ])
    ).not.toThrow();
  });

  it("accepts Read,Glob,Grep,Edit for execute step", () => {
    expect(() =>
      assertSafeArgs([
        "-p",
        "test",
        "--allowedTools",
        "Read,Glob,Grep,Edit",
      ])
    ).not.toThrow();
  });

  it("rejects forbidden flag inside concatenated arg", () => {
    expect(() =>
      assertSafeArgs(["foo--dangerously-skip-permissionsbar"])
    ).toThrow(SecurityViolationError);
  });

  it("rejects --dangerously-skip-permissions=true (flag=value form)", () => {
    expect(() =>
      assertSafeArgs(["--dangerously-skip-permissions=true"])
    ).toThrow(SecurityViolationError);
  });

  it("rejects forbidden tool when passed via --allowedTools=value form", () => {
    expect(() =>
      assertSafeArgs(["--allowedTools=Read,Bash,Edit"])
    ).toThrow(SecurityViolationError);
  });

  it("accepts safe tools via --allowedTools=value form", () => {
    expect(() =>
      assertSafeArgs(["--allowedTools=Read,Glob,Grep"])
    ).not.toThrow();
  });

  it("assertHasAllowedTools requires the flag to be present", () => {
    expect(() => assertHasAllowedTools(["-p", "test"])).toThrow(
      SecurityViolationError
    );
  });

  it("assertHasAllowedTools accepts when flag is present", () => {
    expect(() =>
      assertHasAllowedTools(["--allowedTools", "Read,Glob,Grep"])
    ).not.toThrow();
  });

  it("assertCommandSafety enforces allowedTools for claude", () => {
    expect(() => assertCommandSafety("claude", ["-p", "test"])).toThrow(
      SecurityViolationError
    );
  });

  it("assertCommandSafety does not require allowedTools for non-claude", () => {
    expect(() =>
      assertCommandSafety("aider", ["--message", "hi"])
    ).not.toThrow();
  });
});
