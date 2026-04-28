export type ChangeType =
  | "target"
  | "linked_style"
  | "design_token"
  | "shared_component"
  | "import"
  | "formatting"
  | "other";

export type ChangeSource = "visual" | "text_instruction" | "both";

export type Confidence = "high" | "medium" | "low";

export type RecommendedAction =
  | "apply"
  | "review_first"
  | "consider_alternatives";

export interface EditPlanFile {
  path: string;
  lines_affected: number[];
  reason: string;
  change_type: ChangeType;
  change_source: ChangeSource;
}

export interface EditPlanAlternative {
  description: string;
  pros: string[];
  cons: string[];
}

export interface EditPlan {
  summary: string;
  files: EditPlanFile[];
  visual_changes_applied: boolean;
  text_instructions_applied: boolean;
  side_effects: string[];
  confidence: Confidence;
  recommended_action: RecommendedAction;
  alternatives?: EditPlanAlternative[];
}
