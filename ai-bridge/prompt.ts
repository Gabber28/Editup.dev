import type { EnrichedSnapshot } from "@/types/snapshot.js";
import { escapeXml, sanitizeForPrompt } from "@/lib/sanitize.js";

const PLAN_INSTRUCTION = `You are EditUp's planning assistant. The developer made visual CSS changes to an element in their running app. You have READ-ONLY access to their project.

Your job: read the project, understand the architecture (design system, shared components, styling conventions), and produce a JSON EditPlan describing exactly what files would be modified and why. DO NOT edit any file.

SCOPE IS NOT OPTIONAL. The developer edited ONE element on the page, identified by <dom_path>, <sibling_position> and <text> (and by dom_path/text on each <element_changes> block). A rule tagged shared_by="N" styles N elements: writing the change into it moves all N and is WRONG. When the change must land on a shared rule:
  - Do NOT modify the shared rule. Leave it exactly as it is.
  - Create a scope for that one instance, using the project's idiom: Tailwind → add utility classes to that element's markup; CSS Modules / styled-components → a new class or variant on that element; plain CSS → a new class on the element, or a selector qualified by :nth-of-type/:nth-child matching <sibling_position>.
  - Name every element that would have been affected in "side_effects" if you cannot avoid touching a shared rule, and drop confidence to "medium" or lower.
An edit that changes elements the developer did not touch is a failed edit, even if the target looks right.

Respect priorities:
1. <visual_changes> are EXACT CSS values. Apply them faithfully — do not reinterpret.
2. Changes with a "state" attribute (e.g. state=":hover") must be applied to the corresponding CSS pseudo-class selector, not to the default rule.
3. Changes inside an <element_changes> block target THAT block's element (see its target/source attributes), not the main <element>. Never merge them into the main element.
4. <text_instructions> are free-form requests. Interpret them in the context of the project's conventions.
5. If <visual_changes> and <text_instructions> conflict, visual_changes win.
6. Some changes use non-CSS "pseudo-properties" that describe icon/media swaps, not styles — apply them to the source accordingly:
   - property="src" → the element's image src attribute.
   - property="__text__" → the element's visible text/emoji content.
   - property="__class__" → the element's full class attribute (used to swap an icon-font class, e.g. fa-star → fa-heart).
   - property="__use_href__" → the href of the SVG <use> sprite reference.
   - property="__svg_inner__" → the inner markup of the element's inline <svg>.
   - property="__href__" → make the element a link to this URL: if it is already an <a>, set its href; if it is a <button>/role=button, add navigation idiomatically (wrap/convert to <a>, or onClick/<Link> per the project); otherwise wrap the element in <a href="…"> preserving its classes and content (use Next.js/React Router <Link> when appropriate). An empty value removes the link.
   - property="__target__" → the link target ("_blank" opens a new tab; add rel="noopener noreferrer" when "_blank").
7. <structural_changes> are reorder gestures, NOT styles. Each <move> names the element that moved in its "element"/"dom_path" attributes and must end up before/after the referenced sibling in the source. Move the element's markup block itself — keep its props, classes and children intact, never duplicate it, and do NOT emulate the reorder with CSS (no "order", no absolute positioning). If the element is rendered by a .map() over an array, the markup cannot be reordered: reorder the corresponding item in the DATA array instead, and say so in the reason.
8. Gradient text: when the changes set "background-image" to a gradient together with "background-clip: text" and "-webkit-text-fill-color: transparent", the intent is a gradient-colored text — apply all of them (with the -webkit- prefixes) so the gradient paints the glyphs. "background-image" may carry TWO comma-separated gradient layers with a matching two-token "background-clip" (e.g. "text, border-box"): the first (clip:text) paints the text, the second (clip:border-box) paints the background — keep both layers and the paired clip tokens in order.

BE FAST. The context below already gives you the element, its source location (<source>), and the CSS rules that currently style it (<class_rules>, with rule text). Trust it: open ONLY the specific files referenced there (plus a design-token file if clearly involved). Do not list directories or scan the project. Aim for at most 3 file reads before answering.

Return ONLY a JSON object matching this shape:
{
  "summary": string (1-300 chars),
  "files": [{ "path": string, "lines_affected": number[], "reason": string, "change_type": "target|linked_style|design_token|shared_component|import|formatting|structural|other", "change_source": "visual|text_instruction|both" }],
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
- SCOPE: the developer edited ONE element, identified by <dom_path>, <sibling_position> and <text>. A rule tagged shared_by="N" styles N elements — do NOT write the change into it. Scope the change to that single instance instead (Tailwind → classes on that element; CSS Modules/styled-components → a new class or variant; plain CSS → a new class, or a :nth-of-type/:nth-child selector matching <sibling_position>). Changing elements the developer never touched is a failed edit.
- Edit ONLY the files listed in <approved_plan>. If you discover you must touch another file, do so but record the reason.
- Preserve formatting and import order unless the change requires otherwise.
- For visual changes, apply EXACT values from <visual_changes>.
- Changes with a "state" attribute must be applied to the matching CSS pseudo-class selector (e.g. state=":hover" → .selector:hover { ... }).
- Changes inside an <element_changes> block target THAT block's element (see its target/source attributes), not the main <element>.
- Non-CSS pseudo-properties map to source edits, not styles: "src" → img src attribute; "__text__" → text/emoji content; "__class__" → full class attribute (icon-font swap); "__use_href__" → SVG <use> href; "__svg_inner__" → inline <svg> inner markup; "__href__" → make it a link to the URL (set href if already <a>, else wrap in <a>/<Link> per the project; empty removes it); "__target__" → link target ("_blank" → new tab, add rel="noopener noreferrer"). Ignore any data-editup-* attributes (preview-only).
- <structural_changes> are reorders, not styles: move the element's markup block before/after the referenced sibling, preserving its props/classes/children, without duplicating it and without faking it in CSS ("order", absolute positioning). When the element comes from a .map(), reorder the item in the data array instead.
- Gradient text: a "background-image" gradient combined with "background-clip: text" + "-webkit-text-fill-color: transparent" means gradient-colored text — apply them together (keep the -webkit- prefixes).
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
    // Instance identity — the only thing separating this node from its
    // look-alike siblings when there is no component or source map.
    element.dom_path
      ? `<dom_path>${escapeXml(element.dom_path)}</dom_path>`
      : null,
    element.dom_index !== undefined
      ? `<sibling_position>${element.dom_index}</sibling_position>`
      : null,
    element.text_preview
      ? `<text>${escapeXml(element.text_preview)}</text>`
      : null,
    element.ancestor_path && element.ancestor_path.length > 0
      ? `<inside>${escapeXml(element.ancestor_path.join(" > "))}</inside>`
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
  // dom_path first: without it two instances of the same component collapse
  // into one block carrying contradictory values.
  if (ref.dom_path) return ref.dom_path;
  return `${ref.tag}|${ref.classes.join(".")}|${ref.source_file ?? ""}|${ref.source_line ?? ""}`;
}

/** Attributes identifying which element a block of changes belongs to. */
function refAttributes(
  ref: NonNullable<EnrichedSnapshot["changes"][number]["element_ref"]>
): string {
  const target = `${ref.tag}${ref.classes.length > 0 ? `.${ref.classes.join(".")}` : ""}`;
  return [
    `target="${escapeXml(target)}"`,
    ref.dom_path ? `dom_path="${escapeXml(ref.dom_path)}"` : "",
    ref.dom_index !== undefined ? `sibling_position="${ref.dom_index}"` : "",
    ref.text_preview ? `text="${escapeXml(ref.text_preview)}"` : "",
    ref.source_file
      ? `source="${escapeXml(ref.source_file)}:${ref.source_line ?? "?"}"`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

interface MoveValue {
  position?: string;
  reference?: {
    tag?: string;
    classes?: string[];
    component?: string;
    source?: string;
  };
}

/**
 * Renders drag-to-reorder gestures as their own block. A `__move__` change is
 * structural, not a style, so it must not look like a CSS declaration the AI
 * could write into a stylesheet.
 *
 * @param snapshot Snapshot whose changes may contain `__move__` entries
 * @returns The `<structural_changes>` block, or "" when there was no reorder
 */
function renderStructuralChanges(snapshot: EnrichedSnapshot): string {
  const lines: string[] = [];
  for (const change of snapshot.changes) {
    if (change.property !== "__move__") continue;
    let parsed: MoveValue = {};
    try {
      parsed = JSON.parse(change.after_computed) as MoveValue;
    } catch {
      continue;
    }
    const ref = parsed.reference ?? {};
    const classes = ref.classes?.length ? `.${ref.classes.join(".")}` : "";
    const target = `${ref.tag ?? "element"}${classes}`;
    // Which element moved: the main <element> unless the change names another.
    // Without this, a second element's move is read as a move of the first,
    // and two drags become contradictory instructions.
    const moved = change.element_ref
      ? refAttributes(change.element_ref).replace(/^target=/, "element=")
      : `element="${escapeXml(mainTargetLabel(snapshot))}"`;
    const attrs = [
      moved,
      `position="${escapeXml(parsed.position === "after" ? "after" : "before")}"`,
      `reference="${escapeXml(target)}"`,
      ref.component ? `reference_component="${escapeXml(ref.component)}"` : "",
      ref.source ? `reference_source="${escapeXml(ref.source)}"` : "",
    ].filter(Boolean);
    lines.push(`  <move ${attrs.join(" ")} />`);
  }
  if (lines.length === 0) return "";
  return `<structural_changes>\n${lines.join("\n")}\n</structural_changes>`;
}

/** Label for the snapshot's main element, used when a move has no element_ref. */
function mainTargetLabel(snapshot: EnrichedSnapshot): string {
  const el = snapshot.element;
  return el.classes.length > 0 ? `${el.tag}.${el.classes.join(".")}` : el.tag;
}

function renderVisualChanges(snapshot: EnrichedSnapshot): string {
  const mainLines: string[] = [];
  const grouped = new Map<
    string,
    { ref: NonNullable<EnrichedSnapshot["changes"][number]["element_ref"]>; lines: string[] }
  >();

  for (const c of snapshot.changes) {
    // Reorders are rendered by renderStructuralChanges, never as a declaration.
    if (c.property === "__move__") continue;
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
    blocks.push(
      `  <element_changes ${refAttributes(ref)}>\n${lines.join("\n")}\n  </element_changes>`
    );
  }

  if (blocks.length === 0) return "";
  return `<visual_changes>\n${blocks.join("\n")}\n</visual_changes>`;
}

function renderTextInstructions(snapshot: EnrichedSnapshot): string {
  if (!snapshot.text_instructions) return "";
  return `<text_instructions>${sanitizeForPrompt(snapshot.text_instructions)}</text_instructions>`;
}

const RULE_TEXT_MAX = 400;

function clampRule(text: string): string {
  return text.length > RULE_TEXT_MAX ? `${text.slice(0, RULE_TEXT_MAX)}…` : text;
}

/** Rules that style the element, each stating how many elements it reaches. */
function renderMatchingRules(snapshot: EnrichedSnapshot): string {
  const rules = snapshot.styling.matching_rules ?? [];
  if (rules.length === 0) return "";
  const lines = rules.map((r) => {
    const shared = r.match_count > 1 ? ` shared_by="${r.match_count}"` : "";
    return `  <rule selector="${escapeXml(r.selector)}" file="${escapeXml(r.source_file)}"${shared}>${escapeXml(clampRule(r.rule_text))}</rule>`;
  });
  return `<matching_rules>\n${lines.join("\n")}\n</matching_rules>`;
}

function renderStyling(snapshot: EnrichedSnapshot): string {
  const { styling } = snapshot;
  const ruleEntries = Object.entries(styling.class_to_rule_map)
    .slice(0, 30)
    .map(([cls, rule]) => {
      const text = clampRule(rule.rule_text);
      const shared =
        rule.match_count !== undefined && rule.match_count > 1
          ? ` shared_by="${rule.match_count}"`
          : "";
      return `  <class name="${escapeXml(cls)}" file="${escapeXml(rule.source_file)}" line="${rule.line_number}"${shared}>${escapeXml(text)}</class>`;
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
    renderMatchingRules(snapshot),
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
    renderStructuralChanges(snapshot),
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
    renderStructuralChanges(snapshot),
    renderTextInstructions(snapshot),
    `<approved_plan>${sanitizeForPrompt(approvedPlanJson)}</approved_plan>`,
    "",
    "Apply the plan now. Edit the listed files. Reply with a one-line summary.",
  ]
    .filter(Boolean)
    .join("\n");
}
