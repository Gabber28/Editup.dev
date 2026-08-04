export interface ExecuteResult {
  files_modified: string[];
  files_extra: string[];
  duration_ms: number;
  model: string;
  token_usage: {
    input_total: number;
    output_total: number;
  };
}

/** A property the AI was asked to change that did not end up as requested. */
export interface VerificationDivergence {
  /** Human-readable element identity (tag + classes). */
  element: string;
  property: string;
  expected: string;
  actual: string;
}

export interface VerificationResult {
  /**
   * "unverified" means the page could not be observed at all — it is NOT a
   * pass, and must never be presented as one.
   */
  visual_check: "pass" | "fail" | "skipped" | "unverified";
  scope_check: "pass" | "fail" | "warn" | "skipped";
  /** "no_git" means there was no independent witness for the file audit. */
  diff_check: "pass_exact" | "pass_subset" | "warn_extras" | "fail" | "no_git";
  correction_attempts: number;
  /** Populated when the run finished without matching what the user asked for. */
  divergences?: VerificationDivergence[];
  details?: string;
}

/** True when the run finished but could not be shown to be faithful. */
export function hasVerificationWarnings(v: VerificationResult | null): boolean {
  if (!v) return false;
  return (
    v.visual_check === "fail" ||
    v.visual_check === "unverified" ||
    v.scope_check === "fail" ||
    v.diff_check === "fail" ||
    v.diff_check === "warn_extras" ||
    (v.divergences?.length ?? 0) > 0
  );
}
