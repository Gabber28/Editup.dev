/** Supported license plans for EditUp.dev */
export type LicensePlan = "tester" | "pro" | "founders";

/** License validation status returned by the Rust backend */
export interface LicenseStatus {
  valid: boolean;
  plan: LicensePlan;
  grace_remaining_days: number | null;
  last_verified: string;
}

/** Rate limit state tracking edit usage per plan */
export interface RateLimitState {
  plan: LicensePlan;
  edits_used: number;
  edits_limit: number;
  resets_at: string;
  blocked: boolean;
}
