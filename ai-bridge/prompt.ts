import type { EnrichedSnapshot } from "@/types/snapshot.js";
import { escapeXml, sanitizeForPrompt } from "@/lib/sanitize.js";

const PLAN_INSTRUCTION = `You are EditUp's planning assistant. The developer made visual CSS changes to an element in their running app. You have READ-ONLY access to their project.

Your job: read the project, understand the architecture (design system, shared components, styling conventions), and produce a JSON EditPlan describing exactly what files would be modified and why. DO NOT edit any file.

Respect priorities:
1. <visual_changes> are EXACT CSS values. Apply them faithfully — do not reinterpret.
2. Changes with a "state" attribute (e.g. state=":hover") must be applied to the corresponding CSS pseudo-class selector, not to the default rule.
3. Changes inside an <element_changes> block target THAT block's element (see its target/source attributes), not the main <element>. Never merge them into the main element.
4. <text_instructions> are free-form requests. Interpret them in the context of the project's conventions.
5. If <visual_changes> and <text_instructions> conflict, visual_changes win.

BE FAST. The context below already gives you the element, its source location (<source>), and the CSS rules that currently style it (<class_rules>, with rule text). Trust it: open ONLY the specific files referenced there (plus a design-token file if clearly involved). Do not list directories or scan the project. Aim for at most 3 file reads before answering.

Return ONLY a JSON object matching this shape:
{
  "summary": string (1-300 chars),
  "files": [{ "path": string, "lines_affected": number[], "reason": string, "change_type": "target|linked_style|design_token|shared_component|import|formatting|other", "change_source": "visual|text_instruction|both" }],
  "visual_changes_applied": boolean,
  "text_instructions_applied": boolean,
  "side_effects": string[],
  "confidence": "high|medium|low",
  "recommended_action": "apply|review_first|consider_alternatives",
  "alternatives": [{ "description": string, "pros": string[], "cons": string[] }] (optional)
}

CONSTRAINTS:
- "files" must contain at least one entry.
- If confidence is "low", then recommended_action MUST be "consider_alternatives" AND alternatives MUST have at least one entry.
- If confidence is "high" or "medium", alternatives is optional.`;

const EXECUTE_INSTRUCTION = `You are EditUp's execution assistant. The developer approved the plan below. Edit the listed files now.

Rules:
- Edit ONLY the files listed in <approved_plan>. If you discover you must touch another file, do so but record the reason.
- Preserve formatting and import order unless the change requires otherwise.
- For visual changes, apply EXACT values from <visual_changes>.
- Changes with a "state" attribute must be applied to the matching CSS pseudo-class selector (e.g. state=":hover" → .selector:hover { ... }).
- Changes inside an <element_changes> block target THAT block's element (see its target/source attributes), not the main <element>.
- For text instructions, apply them respecting the project's conventions.
- After all edits, return a one-line summary of what you changed.`;

export interface PromptInputs {
  snapshot: EnrichedSnapshot;
  projectRoot: string;
  /** Set on retry after a schema-validation failure; rendered as a strict warning. */
  retryHint?: string;
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

function renderChangeLine(c: EnrichedSnapshot["changes"][number], indent: string): string {
  const before = escapeXml(c.before_computed);
  const after = escapeXml(c.after_computed);
  const prop = escapeXml(c.property);
  const stateAttr = c.pseudo_state ? ` state="${escapeXml(c.pseudo_state)}"` : "";
  return `${indent}<change property="${prop}" from="${before}" to="${after}"${stateAttr} />`;
}

function elementRefKey(ref: NonNullable<EnrichedSnapshot["changes"][number]["element_ref"]>): string {
  return `${ref.tag}|${ref.classes.join(".")}|${ref.source_file ?? ""}|${ref.source_line ?? ""}`;
}

function renderVisualChanges(snapshot: EnrichedSnapshot): string {
  const mainLines: string[] = [];
  const grouped = new Map<
    string,
    { ref: NonNullable<EnrichedSnapshot["changes"][number]["element_ref"]>; lines: string[] }
  >();

  for (const c of snapshot.changes) {
    if (!c.element_ref) {
      mainLines.push(renderChangeLine(c, "  "));
      continue;
    }
    const key = elementRefKey(c.element_ref);
    let group = grouped.get(key);
    if (!group) {
      group = { ref: c.element_ref, lines: [] };
      grouped.set(key, group);
    }
    group.lines.push(renderChangeLine(c, "    "));
  }

  const blocks: string[] = [...mainLines];
  for (const { ref, lines } of grouped.values()) {
    const target = `${ref.tag}${ref.classes.length > 0 ? `.${ref.classes.join(".")}` : ""}`;
    const sourceAttr = ref.source_file
      ? ` source="${escapeXml(ref.source_file)}:${ref.source_line ?? "?"}"`
      : "";
    blocks.push(
      `  <element_changes target="${escapeXml(target)}"${sourceAttr}>\n${lines.join("\n")}\n  </element_changes>`
    );
  }

  return `<visual_changes>\n${blocks.join("\n")}\n</visual_changes>`;
}

function renderTextInstructions(snapshot: EnrichedSnapshot): string {
  if (!snapshot.text_instructions) return "";
  return `<text_instructions>${sanitizeForPrompt(snapshot.text_instructions)}</text_instructions>`;
}

const RULE_TEXT_MAX = 400;

function renderStyling(snapshot: EnrichedSnapshot): string {
  const { styling } = snapshot;
  const ruleEntries = Object.entries(styling.class_to_rule_map)
    .slice(0, 30)
    .map(([cls, rule]) => {
      const text = rule.rule_text.length > RULE_TEXT_MAX
        ? `${rule.rule_text.slice(0, RULE_TEXT_MAX)}…`
        : rule.rule_text;
      return `  <class name="${escapeXml(cls)}" file="${escapeXml(rule.source_file)}" line="${rule.line_number}">${escapeXml(text)}</class>`;
    });

  const editedPseudos = new Set(
    snapshot.changes.map((c) => c.pseudo_state).filter(Boolean)
  );
  const pseudoEntries = (styling.pseudo_rules ?? [])
    .filter((r) => editedPseudos.has(r.pseudo))
    .slice(0, 10)
    .map((r) => {
      const decls = Object.entries(r.properties)
        .map(([p, v]) => `${p}: ${v}`)
        .join("; ");
      return `  <pseudo_rule state="${escapeXml(r.pseudo)}" selector="${escapeXml(r.selector)}" file="${escapeXml(r.source_file)}">${escapeXml(decls)}</pseudo_rule>`;
    });

  return [
    `<framework>${styling.framework}</framework>`,
    ruleEntries.length > 0
      ? `<class_rules>\n${ruleEntries.join("\n")}\n</class_rules>`
      : "",
    pseudoEntries.length > 0
      ? `<existing_pseudo_rules>\n${pseudoEntries.join("\n")}\n</existing_pseudo_rules>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPlanPrompt(input: PromptInputs): string {
  const { snapshot, projectRoot, retryHint } = input;
  return [
    PLAN_INSTRUCTION,
    "",
    `<project_root>${escapeXml(projectRoot)}</project_root>`,
    renderElement(snapshot),
    renderStyling(snapshot),
    renderVisualChanges(snapshot),
    renderTextInstructions(snapshot),
    retryHint
      ? `\nSTRICT MODE: a previous response failed validation (${escapeXml(retryHint)}). Return ONLY the JSON object, matching the schema exactly.`
      : "",
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
    renderStyling(snapshot),
    renderVisualChanges(snapshot),
    renderTextInstructions(snapshot),
    `<approved_plan>${sanitizeForPrompt(approvedPlanJson)}</approved_plan>`,
    "",
    "Apply the plan now. Edit the listed files. Reply with a one-line summary.",
  ]
    .filter(Boolean)
    .join("\n");
}
