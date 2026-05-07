import type { EnrichedSnapshot, ElementInfo, StylingInfo, CSSChange } from "@/types/snapshot.js";
import type { EditPlan, EditPlanFile } from "@/types/edit-plan.js";
import type { AdapterContext } from "@/lib/ai-adapters/types.js";
import type { ExecuteResult, VerificationResult } from "@/types/execute.js";

export function makeElement(overrides: Partial<ElementInfo> = {}): ElementInfo {
  return {
    tag: "button",
    classes: ["btn", "btn-primary"],
    component_name: "Button",
    source_file: "src/components/Button.tsx",
    source_line: 12,
    ...overrides,
  };
}

export function makeStyling(overrides: Partial<StylingInfo> = {}): StylingInfo {
  return {
    framework: "tailwind",
    class_to_rule_map: {
      "btn-primary": {
        source_file: "src/styles.css",
        rule_text: ".btn-primary { background: #7c3aed; }",
        line_number: 5,
      },
    },
    active_css_variables: {},
    ...overrides,
  };
}

export function makeChange(overrides: Partial<CSSChange> = {}): CSSChange {
  return {
    property: "background-color",
    before_computed: "rgb(124, 58, 237)",
    after_computed: "rgb(0, 0, 0)",
    expected_final_computed: "rgb(0, 0, 0)",
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<EnrichedSnapshot> = {}): EnrichedSnapshot {
  return {
    element: makeElement(),
    styling: makeStyling(),
    changes: [makeChange()],
    ...overrides,
  };
}

export function makePlanFile(overrides: Partial<EditPlanFile> = {}): EditPlanFile {
  return {
    path: "src/components/Button.tsx",
    lines_affected: [12, 13],
    reason: "Change background color",
    change_type: "target",
    change_source: "visual",
    ...overrides,
  };
}

export function makePlan(overrides: Partial<EditPlan> = {}): EditPlan {
  return {
    summary: "Update button background color",
    files: [makePlanFile()],
    visual_changes_applied: true,
    text_instructions_applied: false,
    side_effects: [],
    confidence: "high",
    recommended_action: "apply",
    ...overrides,
  };
}

export function makeContext(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    projectRoot: "/home/user/project",
    sessionToken: "test-token-uuid-v4",
    ...overrides,
  };
}

export function makeExecuteResult(overrides: Partial<ExecuteResult> = {}): ExecuteResult {
  return {
    files_modified: ["src/components/Button.tsx"],
    files_extra: [],
    duration_ms: 1200,
    model: "claude-sonnet-4-6",
    token_usage: { input_total: 500, output_total: 200 },
    ...overrides,
  };
}

export function makeVerificationResult(
  overrides: Partial<VerificationResult> = {}
): VerificationResult {
  return {
    visual_check: "pass",
    scope_check: "pass",
    diff_check: "pass_exact",
    correction_attempts: 0,
    ...overrides,
  };
}
