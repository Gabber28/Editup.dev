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
    const fields = result.error.issues
      .slice(0, 5)
      .map((i) => (i.path.length > 0 ? i.path.join(".") : "(root)"))
      .join(", ");
    throw new SchemaValidationError(
      `EditPlan failed schema validation (fields: ${fields})`,
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
  return parseEditPlan(normalizeRawPlan(parsed));
}

const CHANGE_TYPES = [
  "target", "linked_style", "design_token", "shared_component",
  "import", "formatting", "other",
] as const;
const CHANGE_SOURCES = ["visual", "text_instruction", "both"] as const;
const CONFIDENCES = ["high", "medium", "low"] as const;
const ACTIONS = ["apply", "review_first", "consider_alternatives"] as const;

const SUMMARY_MAX = 300;
const REASON_MAX = 500;
const SIDE_EFFECT_MAX = 500;
const ALT_TEXT_MAX = 500;

function clampString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function coerceEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function coerceStringArray(value: unknown, max: number, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = clampString(item, max);
    if (s) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Coerces a loosely-structured AI response toward the strict EditPlan schema.
 * Semantically-correct plans that merely overshoot a length cap or use an
 * off-list enum value are repaired rather than rejected. Structurally missing
 * required data (e.g. no files) is left untouched so strict validation still
 * fails. Does not fabricate file entries.
 * @param input - Raw parsed JSON from the AI response.
 * @returns A normalized object ready for strict validation.
 */
export function normalizeRawPlan(input: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const raw = input as Record<string, unknown>;
  const out: Record<string, unknown> = { ...raw };

  const summary = clampString(raw.summary, SUMMARY_MAX);
  if (summary !== undefined) out.summary = summary;

  if (Array.isArray(raw.files)) {
    out.files = raw.files.map((f) => {
      if (f === null || typeof f !== "object") return f;
      const file = f as Record<string, unknown>;
      const lines = Array.isArray(file.lines_affected)
        ? file.lines_affected
            .map((n) => (typeof n === "number" ? Math.max(0, Math.floor(n)) : NaN))
            .filter((n) => Number.isFinite(n))
            .slice(0, 10_000)
        : [];
      return {
        ...file,
        reason: clampString(file.reason, REASON_MAX) ?? "visual change",
        lines_affected: lines,
        change_type: coerceEnum(file.change_type, CHANGE_TYPES, "other"),
        change_source: coerceEnum(file.change_source, CHANGE_SOURCES, "visual"),
      };
    });
  }

  out.side_effects = coerceStringArray(raw.side_effects, SIDE_EFFECT_MAX, 50);
  if (typeof raw.visual_changes_applied !== "boolean") {
    out.visual_changes_applied = true;
  }
  if (typeof raw.text_instructions_applied !== "boolean") {
    out.text_instructions_applied = false;
  }
  out.confidence = coerceEnum(raw.confidence, CONFIDENCES, "medium");
  out.recommended_action = coerceEnum(raw.recommended_action, ACTIONS, "review_first");

  if (Array.isArray(raw.alternatives)) {
    out.alternatives = raw.alternatives
      .slice(0, 10)
      .map((a) => {
        if (a === null || typeof a !== "object") return a;
        const alt = a as Record<string, unknown>;
        return {
          ...alt,
          description: clampString(alt.description, ALT_TEXT_MAX) ?? "alternative",
          pros: coerceStringArray(alt.pros, 300, 20),
          cons: coerceStringArray(alt.cons, 300, 20),
        };
      });
  }

  // Keep the low-confidence invariant satisfiable without rejecting the plan.
  if (out.confidence === "low") {
    out.recommended_action = "consider_alternatives";
    const alts = out.alternatives;
    if (!Array.isArray(alts) || alts.length === 0) {
      out.alternatives = [
        { description: "Review the change manually before applying", pros: [], cons: [] },
      ];
    }
  }

  return out;
}

function extractJsonByBraces(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
