import { z } from "zod";
import type { EditPlan } from "@/types/edit-plan.js";
import { SchemaValidationError } from "@/lib/errors.js";

const ChangeTypeSchema = z.enum([
  "target",
  "linked_style",
  "design_token",
  "shared_component",
  "import",
  "formatting",
  "other",
]);

const ChangeSourceSchema = z.enum(["visual", "text_instruction", "both"]);

const ConfidenceSchema = z.enum(["high", "medium", "low"]);

const RecommendedActionSchema = z.enum([
  "apply",
  "review_first",
  "consider_alternatives",
]);

export const EditPlanFileSchema = z.object({
  path: z.string().min(1).max(1024),
  lines_affected: z.array(z.number().int().nonnegative()).max(10_000),
  reason: z.string().min(1).max(500),
  change_type: ChangeTypeSchema,
  change_source: ChangeSourceSchema,
});

export const EditPlanAlternativeSchema = z.object({
  description: z.string().min(1).max(500),
  pros: z.array(z.string().max(300)).max(20),
  cons: z.array(z.string().max(300)).max(20),
});

export const EditPlanSchema = z
  .object({
    summary: z.string().min(1).max(300),
    files: z.array(EditPlanFileSchema).min(1).max(100),
    visual_changes_applied: z.boolean(),
    text_instructions_applied: z.boolean(),
    side_effects: z.array(z.string().max(500)).max(50),
    confidence: ConfidenceSchema,
    recommended_action: RecommendedActionSchema,
    alternatives: z.array(EditPlanAlternativeSchema).max(10).optional(),
  })
  .superRefine((plan, ctx) => {
    if (plan.confidence === "low") {
      if (plan.recommended_action !== "consider_alternatives") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "confidence: 'low' requires recommended_action: 'consider_alternatives'",
          path: ["recommended_action"],
        });
      }
      if (!plan.alternatives || plan.alternatives.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "confidence: 'low' requires at least one entry in alternatives",
          path: ["alternatives"],
        });
      }
    }
  });

export function parseEditPlan(input: unknown): EditPlan {
  const result = EditPlanSchema.safeParse(input);
  if (!result.success) {
    throw new SchemaValidationError(
      "EditPlan failed schema validation",
      result.error.issues
    );
  }
  return result.data as EditPlan;
}

export function tryParseEditPlan(
  input: unknown
):
  | { success: true; data: EditPlan }
  | { success: false; issues: z.ZodIssue[] } {
  const result = EditPlanSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as EditPlan };
  }
  return { success: false, issues: result.error.issues };
}

export function extractEditPlanFromText(text: string): EditPlan {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    const braceExtracted = extractJsonByBraces(trimmed);
    if (braceExtracted) {
      try {
        parsed = JSON.parse(braceExtracted);
      } catch (inner) {
        throw new SchemaValidationError(
          "EditPlan response is not valid JSON",
          [],
          inner
        );
      }
    } else {
      throw new SchemaValidationError(
        "EditPlan response is not valid JSON — no JSON object found",
        []
      );
    }
  }
  return parseEditPlan(parsed);
}

function extractJsonByBraces(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}
