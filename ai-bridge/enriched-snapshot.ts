import { z } from "zod";
import type { EnrichedSnapshot } from "@/types/snapshot.js";
import { SchemaValidationError } from "@/lib/errors.js";

const StylingFrameworkSchema = z.enum([
  "tailwind",
  "css-modules",
  "styled-components",
  "css-variables",
  "plain-css",
  "mixed",
]);

const CSSRuleRefSchema = z.object({
  source_file: z.string().max(1024),
  rule_text: z.string().max(5000),
  line_number: z.number().int().nonnegative(),
});

const CSSVariableRefSchema = z.object({
  value: z.string().max(500),
  declared_in: z.string().max(1024),
});

export const ElementInfoSchema = z.object({
  tag: z.string().min(1).max(50),
  id: z.string().max(200).optional(),
  classes: z.array(z.string().max(200)).max(100),
  component_name: z.string().max(100).optional(),
  source_file: z.string().max(1024).optional(),
  source_line: z.number().int().nonnegative().optional(),
});

export const StylingInfoSchema = z.object({
  framework: StylingFrameworkSchema,
  class_to_rule_map: z.record(z.string(), CSSRuleRefSchema),
  active_css_variables: z.record(z.string(), CSSVariableRefSchema),
  tailwind_classes: z.array(z.string().max(200)).max(500).optional(),
});

const PseudoStateSchema = z.enum([
  "default",
  ":hover",
  ":focus",
  ":active",
  ":focus-visible",
  ":focus-within",
  ":visited",
  ":checked",
  ":disabled",
]);

const ChangeElementRefSchema = z.object({
  tag: z.string().min(1).max(50),
  classes: z.array(z.string().max(200)).max(100),
  source_file: z.string().max(1024).optional(),
  source_line: z.number().int().nonnegative().optional(),
});

export const CSSChangeSchema = z.object({
  property: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z-]+$/, "CSS property must be lowercase kebab-case"),
  before_computed: z.string().max(1000),
  after_computed: z.string().max(1000),
  before_source_rule: z.string().max(5000).optional(),
  expected_final_computed: z.string().max(1000),
  change_source: z.enum(["visual", "text_instruction"]).optional(),
  pseudo_state: PseudoStateSchema.optional(),
  element_ref: ChangeElementRefSchema.optional(),
});

export const EnrichedSnapshotSchema = z
  .object({
    element: ElementInfoSchema,
    styling: StylingInfoSchema,
    changes: z.array(CSSChangeSchema).max(200),
    text_instructions: z.string().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    const hasVisual = value.changes.length > 0;
    const hasText =
      value.text_instructions !== undefined &&
      value.text_instructions.trim().length > 0;
    if (!hasVisual && !hasText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "snapshot must include at least one visual change OR text_instructions",
        path: ["changes"],
      });
    }
  });

export function parseEnrichedSnapshot(input: unknown): EnrichedSnapshot {
  const result = EnrichedSnapshotSchema.safeParse(input);
  if (!result.success) {
    throw new SchemaValidationError(
      "EnrichedSnapshot failed schema validation",
      result.error.issues
    );
  }
  return result.data as EnrichedSnapshot;
}
