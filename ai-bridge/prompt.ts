import type { EnrichedSnapshot } from "@/types/snapshot.js";
import { escapeXml, sanitizeForPrompt } from "@/lib/sanitize.js";

const PLAN_INSTRUCTION = `You are EditUp's planning assistant. The developer made visual CSS changes to an element in their running app. You have READ-ONLY access to their project.

Your job: read the project, understand the architecture (design system, shared components, styling conventions), and produce a JSON EditPlan describing exactly what files would be modified and why. DO NOT edit any file.

Respect priorities:
1. <visual_changes> are EXACT CSS values. Apply them faithfully — do not reinterpret.
2. <text_instructions> are free-form requests. Interpret them in the context of the project's conventions.
3. If <visual_changes> and <text_instructions> conflict, visual_changes win.

Return ONLY a JSON object matching this shape:
{
  "summary": string,
  "files": [{ "path": string, "lines_affected": number[], "reason": string, "change_type": "target|linked_style|design_token|shared_component|import|formatting|other", "change_source": "visual|text_instruction|both" }],
  "visual_changes_applied": boolean,
  "text_instructions_applied": boolean,
  "side_effects": string[],
  "confidence": "high|medium|low",
  "recommended_action": "apply|review_first|consider_alternatives",
  "alternatives": [{ "description": string, "pros": string[], "cons": string[] }]
}`;

const EXECUTE_INSTRUCTION = `You are EditUp's execution assistant. The developer approved the plan below. Edit the listed files now.

Rules:
- Edit ONLY the files listed in <approved_plan>. If you discover you must touch another file, do so but record the reason.
- Preserve formatting and import order unless the change requires otherwise.
- For visual changes, apply EXACT values from <visual_changes>.
- For text instructions, apply them respecting the project's conventions.
- After all edits, return a one-line summary of what you changed.`;

export interface PromptInputs {
  snapshot: EnrichedSnapshot;
  projectRoot: string;
}

export interface ExecutePromptInputs extends PromptInputs {
  approvedPlanJson: string;
}

function renderElement(snapshot: EnrichedSnapshot): string {
  const { element } = snapshot;
  const parts = [
    `<tag>${escapeXml(element.tag)}</tag>`,
    element.id ? `<id>${escapeXml(element.id)}</id>` : null,
    `<classes>${element.classes.map(escapeXml).join(" ")}</classes>`,
    element.component_name
      ? `<component>${escapeXml(element.component_name)}</component>`
      : null,
    element.source_file
      ? `<source>${escapeXml(element.source_file)}:${element.source_line ?? "?"}</source>`
      : null,
  ].filter((x): x is string => x !== null);
  return `<element>\n  ${parts.join("\n  ")}\n</element>`;
}

function renderVisualChanges(snapshot: EnrichedSnapshot): string {
  const lines = snapshot.changes.map((c) => {
    const before = escapeXml(c.before_computed);
    const after = escapeXml(c.after_computed);
    const prop = escapeXml(c.property);
    return `  <change property="${prop}" from="${before}" to="${after}" />`;
  });
  return `<visual_changes>\n${lines.join("\n")}\n</visual_changes>`;
}

function renderTextInstructions(snapshot: EnrichedSnapshot): string {
  if (!snapshot.text_instructions) return "";
  return `<text_instructions>${sanitizeForPrompt(snapshot.text_instructions)}</text_instructions>`;
}

function renderStyling(snapshot: EnrichedSnapshot): string {
  const { styling } = snapshot;
  const ruleEntries = Object.entries(styling.class_to_rule_map)
    .slice(0, 30)
    .map(([cls, rule]) => {
      return `  <class name="${escapeXml(cls)}" file="${escapeXml(rule.source_file)}" line="${rule.line_number}" />`;
    });
  return [
    `<framework>${styling.framework}</framework>`,
    ruleEntries.length > 0
      ? `<class_rules>\n${ruleEntries.join("\n")}\n</class_rules>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPlanPrompt(input: PromptInputs): string {
  const { snapshot, projectRoot } = input;
  return [
    PLAN_INSTRUCTION,
    "",
    `<project_root>${escapeXml(projectRoot)}</project_root>`,
    renderElement(snapshot),
    renderStyling(snapshot),
    renderVisualChanges(snapshot),
    renderTextInstructions(snapshot),
    "",
    "Output the JSON EditPlan now. No prose, no markdown fences.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildExecutePrompt(input: ExecutePromptInputs): string {
  const { snapshot, projectRoot, approvedPlanJson } = input;
  return [
    EXECUTE_INSTRUCTION,
    "",
    `<project_root>${escapeXml(projectRoot)}</project_root>`,
    renderElement(snapshot),
    renderVisualChanges(snapshot),
    renderTextInstructions(snapshot),
    `<approved_plan>${sanitizeForPrompt(approvedPlanJson)}</approved_plan>`,
    "",
    "Apply the plan now. Edit the listed files. Reply with a one-line summary.",
  ]
    .filter(Boolean)
    .join("\n");
}
