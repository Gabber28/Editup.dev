export type {
  EnrichedSnapshot,
  ElementInfo,
  StylingInfo,
  CSSChange,
  CSSRuleRef,
  CSSVariableRef,
  StylingFramework,
  PseudoState,
  PseudoStateRule,
} from "./snapshot.js";

export type {
  EditPlan,
  EditPlanFile,
  EditPlanAlternative,
  ChangeType,
  ChangeSource,
  Confidence,
  RecommendedAction,
} from "./edit-plan.js";

export type { ExecuteResult, VerificationResult } from "./execute.js";

export type {
  LicensePlan,
  LicenseStatus,
  RateLimitState,
} from "./license.js";
