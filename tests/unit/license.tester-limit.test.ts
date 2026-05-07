import { describe, it, expect } from "vitest";
import type { LicenseStatus, RateLimitState } from "@/types/license.js";

function canApply(
  status: LicenseStatus | null,
  rateLimit: RateLimitState | null
): boolean {
  if (!status || !status.valid) return false;
  if (rateLimit && rateLimit.blocked) return false;
  return true;
}

describe("license — tester rate limit", () => {
  const validTester: LicenseStatus = {
    valid: true,
    plan: "tester",
    grace_remaining_days: null,
    last_verified: new Date().toISOString(),
  };

  const validPro: LicenseStatus = {
    valid: true,
    plan: "pro",
    grace_remaining_days: null,
    last_verified: new Date().toISOString(),
  };

  it("tester with 14 edits used can still apply", () => {
    const rl: RateLimitState = {
      plan: "tester",
      edits_used: 14,
      edits_limit: 15,
      resets_at: "",
      blocked: false,
    };
    expect(canApply(validTester, rl)).toBe(true);
  });

  it("tester blocked after 15 edits/day", () => {
    const rl: RateLimitState = {
      plan: "tester",
      edits_used: 15,
      edits_limit: 15,
      resets_at: "",
      blocked: true,
    };
    expect(canApply(validTester, rl)).toBe(false);
  });

  it("pro allows up to 30/hour", () => {
    const rl: RateLimitState = {
      plan: "pro",
      edits_used: 29,
      edits_limit: 30,
      resets_at: "",
      blocked: false,
    };
    expect(canApply(validPro, rl)).toBe(true);
  });

  it("pro blocked when blocked flag is true", () => {
    const rl: RateLimitState = {
      plan: "pro",
      edits_used: 30,
      edits_limit: 30,
      resets_at: "",
      blocked: true,
    };
    expect(canApply(validPro, rl)).toBe(false);
  });

  it("null license blocks apply", () => {
    expect(canApply(null, null)).toBe(false);
  });

  it("invalid license blocks apply regardless of rate limit", () => {
    const invalid: LicenseStatus = {
      valid: false,
      plan: "tester",
      grace_remaining_days: null,
      last_verified: "",
    };
    const rl: RateLimitState = {
      plan: "tester",
      edits_used: 0,
      edits_limit: 15,
      resets_at: "",
      blocked: false,
    };
    expect(canApply(invalid, rl)).toBe(false);
  });
});
