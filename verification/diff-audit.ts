import type { EditPlan } from "@/types/edit-plan.js";

const SENSITIVE_FILE_PATTERNS = [
  /package\.json$/,
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /yarn\.lock$/,
  /\.env$/,
  /\.env\./,
  /tsconfig\.json$/,
  /vite\.config\./,
  /next\.config\./,
];

export interface DiffAuditInput {
  plan: EditPlan;
  modifiedFiles: string[];
}

export interface DiffAuditResult {
  status: "pass_exact" | "pass_subset" | "warn_extras" | "fail";
  expected: string[];
  actual: string[];
  missing: string[];
  extras: string[];
  sensitiveExtras: string[];
}

export function auditDiff(input: DiffAuditInput): DiffAuditResult {
  const expected = input.plan.files.map((f) => normalize(f.path));
  const actual = input.modifiedFiles.map(normalize);

  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  const missing = expected.filter((p) => !actualSet.has(p));
  const extras = actual.filter((p) => !expectedSet.has(p));
  const sensitiveExtras = extras.filter(isSensitive);

  let status: DiffAuditResult["status"];
  if (missing.length > 0) {
    status = "fail";
  } else if (extras.length === 0) {
    status = "pass_exact";
  } else if (sensitiveExtras.length > 0) {
    status = "warn_extras";
  } else {
    status = "pass_subset";
  }

  return { status, expected, actual, missing, extras, sensitiveExtras };
}

function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function isSensitive(filePath: string): boolean {
  const normalized = normalize(filePath);
  return SENSITIVE_FILE_PATTERNS.some((re) => re.test(normalized));
}
