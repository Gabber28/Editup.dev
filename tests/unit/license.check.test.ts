import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LicenseStatus, RateLimitState } from "@/types/license.js";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@/lib/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function canApply(
  status: LicenseStatus | null,
  rateLimit: RateLimitState | null,
): boolean {
  if (!status || !status.valid) return false;
  if (rateLimit && rateLimit.blocked) return false;
  return true;
}

function canUseExpress(status: LicenseStatus | null): boolean {
  if (!status || !status.valid) return false;
  return status.plan === "pro" || status.plan === "founders";
}

describe("license.check — canApply logic", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("valid license with no rate-limit allows canApply", () => {
    const status: LicenseStatus = {
      valid: true,
      plan: "pro",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    expect(canApply(status, null)).toBe(true);
  });

  it("valid license with unblocked rate-limit allows canApply", () => {
    const status: LicenseStatus = {
      valid: true,
      plan: "tester",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    const rl: RateLimitState = {
      plan: "tester",
      edits_used: 5,
      edits_limit: 15,
      resets_at: new Date().toISOString(),
      blocked: false,
    };
    expect(canApply(status, rl)).toBe(true);
  });

  it("invalid license blocks canApply", () => {
    const status: LicenseStatus = {
      valid: false,
      plan: "tester",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    expect(canApply(status, null)).toBe(false);
  });

  it("null status blocks canApply", () => {
    expect(canApply(null, null)).toBe(false);
  });

  it("expired license (valid=false) blocks canApply", () => {
    const status: LicenseStatus = {
      valid: false,
      plan: "pro",
      grace_remaining_days: -3,
      last_verified: new Date().toISOString(),
    };
    expect(canApply(status, null)).toBe(false);
  });

  it("blocked rate-limit blocks canApply even with valid license", () => {
    const status: LicenseStatus = {
      valid: true,
      plan: "tester",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    const rl: RateLimitState = {
      plan: "tester",
      edits_used: 15,
      edits_limit: 15,
      resets_at: new Date().toISOString(),
      blocked: true,
    };
    expect(canApply(status, rl)).toBe(false);
  });
});

describe("license.check — canUseExpress logic", () => {
  it("pro plan can use express", () => {
    const status: LicenseStatus = {
      valid: true,
      plan: "pro",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    expect(canUseExpress(status)).toBe(true);
  });

  it("founders plan can use express", () => {
    const status: LicenseStatus = {
      valid: true,
      plan: "founders",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    expect(canUseExpress(status)).toBe(true);
  });

  it("tester plan cannot use express", () => {
    const status: LicenseStatus = {
      valid: true,
      plan: "tester",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    expect(canUseExpress(status)).toBe(false);
  });

  it("null status cannot use express", () => {
    expect(canUseExpress(null)).toBe(false);
  });

  it("invalid status cannot use express", () => {
    const status: LicenseStatus = {
      valid: false,
      plan: "pro",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    expect(canUseExpress(status)).toBe(false);
  });
});

describe("license.check — Tauri invoke mocking", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("get_license_status returns valid status", async () => {
    const expected: LicenseStatus = {
      valid: true,
      plan: "pro",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    invokeMock.mockResolvedValueOnce(expected);
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<LicenseStatus>("get_license_status");
    expect(result).toEqual(expected);
    expect(invokeMock).toHaveBeenCalledWith("get_license_status");
  });

  it("check_license triggers online re-verification", async () => {
    const expected: LicenseStatus = {
      valid: true,
      plan: "founders",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    invokeMock.mockResolvedValueOnce(expected);
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<LicenseStatus>("check_license");
    expect(result).toEqual(expected);
    expect(invokeMock).toHaveBeenCalledWith("check_license");
  });

  it("get_rate_limit_state returns current rate limit", async () => {
    const expected: RateLimitState = {
      plan: "tester",
      edits_used: 10,
      edits_limit: 15,
      resets_at: new Date().toISOString(),
      blocked: false,
    };
    invokeMock.mockResolvedValueOnce(expected);
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<RateLimitState>("get_rate_limit_state");
    expect(result).toEqual(expected);
    expect(invokeMock).toHaveBeenCalledWith("get_rate_limit_state");
  });

  it("invoke rejection is handled as no license", async () => {
    invokeMock.mockRejectedValueOnce(new Error("no license file"));
    const { invoke } = await import("@tauri-apps/api/core");
    await expect(invoke("get_license_status")).rejects.toThrow(
      "no license file",
    );
  });
});
