import { describe, it, expect } from "vitest";
import type { LicenseStatus } from "@/types/license.js";

function isLicenseUsable(status: LicenseStatus): boolean {
  if (status.valid) return true;
  if (
    status.grace_remaining_days !== null &&
    status.grace_remaining_days > 0 &&
    status.grace_remaining_days <= 7
  ) {
    return true;
  }
  return false;
}

describe("license — grace period", () => {
  it("valid license is usable", () => {
    const status: LicenseStatus = {
      valid: true,
      plan: "pro",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    expect(isLicenseUsable(status)).toBe(true);
  });

  it("grace_remaining_days = 5 (< 7) is usable", () => {
    const status: LicenseStatus = {
      valid: false,
      plan: "pro",
      grace_remaining_days: 5,
      last_verified: new Date().toISOString(),
    };
    expect(isLicenseUsable(status)).toBe(true);
  });

  it("grace_remaining_days = 7 is still usable", () => {
    const status: LicenseStatus = {
      valid: false,
      plan: "pro",
      grace_remaining_days: 7,
      last_verified: new Date().toISOString(),
    };
    expect(isLicenseUsable(status)).toBe(true);
  });

  it("grace_remaining_days = 0 means grace expired — blocked", () => {
    const status: LicenseStatus = {
      valid: false,
      plan: "pro",
      grace_remaining_days: 0,
      last_verified: new Date().toISOString(),
    };
    expect(isLicenseUsable(status)).toBe(false);
  });

  it("grace_remaining_days = null with invalid license — blocked", () => {
    const status: LicenseStatus = {
      valid: false,
      plan: "tester",
      grace_remaining_days: null,
      last_verified: new Date().toISOString(),
    };
    expect(isLicenseUsable(status)).toBe(false);
  });
});
