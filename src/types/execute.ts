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

export interface VerificationResult {
  visual_check: "pass" | "fail" | "skipped";
  scope_check: "pass" | "fail" | "warn";
  diff_check: "pass_exact" | "pass_subset" | "warn_extras" | "fail";
  correction_attempts: number;
  details?: string;
}
