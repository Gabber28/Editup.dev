import { describe, it, expect } from "vitest";
import { parseEditPlan } from "@bridge/edit-plan.js";
import { SchemaValidationError } from "@/lib/errors.js";
import type { EditPlan, EditPlanFile } from "@/types/edit-plan.js";

const CHANGE_TYPES = [
  "target", "linked_style", "design_token",
  "shared_component", "import", "formatting", "other",
] as const;

const CHANGE_SOURCES = ["visual", "text_instruction", "both"] as const;
const CONFIDENCES = ["high", "medium", "low"] as const;
const ACTIONS = ["apply", "review_first", "consider_alternatives"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randString(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz-_/";
  return Array.from({ length: len }, () => pick([...chars])).join("");
}

function generateValidFile(): EditPlanFile {
  return {
    path: `src/${randString(8)}.tsx`,
    lines_affected: Array.from({ length: randInt(1, 5) }, () => randInt(1, 200)),
    reason: randString(randInt(5, 30)),
    change_type: pick(CHANGE_TYPES),
    change_source: pick(CHANGE_SOURCES),
  };
}

function generateValidPlan(): EditPlan {
  const confidence = pick(CONFIDENCES);
  const plan: EditPlan = {
    summary: randString(randInt(5, 50)),
    files: Array.from({ length: randInt(1, 5) }, generateValidFile),
    visual_changes_applied: Math.random() > 0.5,
    text_instructions_applied: Math.random() > 0.5,
    side_effects: Array.from(
      { length: randInt(0, 3) },
      () => randString(randInt(5, 20))
    ),
    confidence,
    recommended_action:
      confidence === "low" ? "consider_alternatives" : pick(ACTIONS),
  };
  if (confidence === "low") {
    plan.alternatives = [
      {
        description: randString(20),
        pros: [randString(10)],
        cons: [randString(10)],
      },
    ];
  }
  return plan;
}

describe("EditPlan — property-based: random valid plans", () => {
  const VALID_COUNT = 50;

  it.each(Array.from({ length: VALID_COUNT }, (_, i) => [i]))(
    "random valid plan #%i passes schema",
    () => {
      const plan = generateValidPlan();
      expect(() => parseEditPlan(plan)).not.toThrow();
    }
  );
});

describe("EditPlan — property-based: random invalid plans", () => {
  it("rejects plan with empty summary", () => {
    const plan = generateValidPlan();
    const bad = { ...plan, summary: "" };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects plan with empty files array", () => {
    const plan = generateValidPlan();
    const bad = { ...plan, files: [] };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects plan with invalid confidence enum", () => {
    const plan = generateValidPlan();
    const bad = { ...plan, confidence: "super" };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects plan with numeric summary", () => {
    const plan = generateValidPlan();
    const bad = { ...plan, summary: 12345 };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects plan with negative line numbers", () => {
    const plan = generateValidPlan();
    const bad = {
      ...plan,
      files: [{ ...plan.files[0]!, lines_affected: [-1] }],
    };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects confidence:'low' without alternatives", () => {
    const plan = generateValidPlan();
    const bad = {
      ...plan,
      confidence: "low" as const,
      recommended_action: "consider_alternatives" as const,
      alternatives: undefined,
    };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects confidence:'low' with wrong recommended_action", () => {
    const plan = generateValidPlan();
    const bad = {
      ...plan,
      confidence: "low" as const,
      recommended_action: "apply" as const,
      alternatives: [
        { description: "alt", pros: ["p"], cons: ["c"] },
      ],
    };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects file with empty path string", () => {
    const plan = generateValidPlan();
    const bad = {
      ...plan,
      files: [{ ...plan.files[0]!, path: "" }],
    };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects boolean where string expected for summary", () => {
    const plan = generateValidPlan();
    const bad = { ...plan, summary: true };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects extra-long summary beyond max", () => {
    const plan = generateValidPlan();
    const bad = { ...plan, summary: "x".repeat(301) };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });
});
