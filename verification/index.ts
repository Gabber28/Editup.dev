export { checkVisual } from "./visual.js";
export type { VisualCheckInput, VisualCheckResult } from "./visual.js";

export { checkScope } from "./scope.js";
export type {
  ScopeCheckInput,
  ScopeCheckResult,
  ElementSnapshot,
} from "./scope.js";

export { auditDiff } from "./diff-audit.js";
export type { DiffAuditInput, DiffAuditResult } from "./diff-audit.js";

export {
  runCorrectionPass,
  summarizeVerification,
} from "./correction.js";
export type {
  CorrectionInput,
  CorrectionOutput,
} from "./correction.js";
