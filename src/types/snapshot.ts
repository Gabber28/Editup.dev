export type StylingFramework =
  | "tailwind"
  | "css-modules"
  | "styled-components"
  | "css-variables"
  | "plain-css"
  | "mixed";

export type MediaKind =
  | "img"
  | "background"
  | "svg"
  | "svg-use"
  | "icon-font"
  | "emoji"
  | "none";

export interface ElementMedia {
  /** What kind of image/icon the element carries. */
  kind: MediaKind;
  /** URL/path for img & background, or the symbol href for svg-use. */
  url?: string;
  /** Current text glyph for emoji icons. */
  text?: string;
  /** Current icon-token class for icon-font icons (e.g. "fa-star"). */
  iconClass?: string;
  /** Inner markup of an inline <svg> (truncated for display). */
  svgMarkup?: string;
}

export interface ElementButton {
  /** Whether the element is already a link, a button, or neither. */
  kind: "anchor" | "button" | "none";
  /** Destination href when it (or an ancestor) is an anchor. */
  href: string;
  /** Link target (e.g. "_blank") when set. */
  target: string;
}

export interface ElementParentLayout {
  tag: string;
  /** Parent's computed `display` — decides which alignment property moves the child. */
  display: string;
  /** Parent's computed `flex-direction` (meaningful only for flex parents). */
  flex_direction: string;
}

export interface ElementLayout {
  /** Offset from the offset parent — the number shown in the X/Y fields. */
  offset: { left: number; top: number };
  size: { width: number; height: number };
  parent: ElementParentLayout | null;
  /**
   * The box `top/right/bottom/left` are measured against, named for display.
   * Null when the chain runs out (document) or the mode has no containing
   * block worth naming (`static`, `relative`).
   */
  containing_block?: { label: string; tag: string } | null;
}

export interface ElementInfo {
  tag: string;
  id?: string;
  classes: string[];
  component_name?: string;
  source_file?: string;
  source_line?: number;
  media?: ElementMedia;
  button?: ElementButton;
  /** True when the element has its own direct text (drives the Typography section). */
  has_text?: boolean;
  /** Measured position/size plus parent layout mode (drives the Position controls). */
  layout?: ElementLayout;
  /**
   * Selector matching this element and no other. Without it, three cards
   * sharing a class are indistinguishable — to the app's per-element state and
   * to the AI, which then edits the shared rule and moves all of them.
   */
  dom_path?: string;
  /** 1-based position among siblings. */
  dom_index?: number;
  /** The element's own visible text, trimmed. */
  text_preview?: string;
  /** Nearest ancestors as `tag.class`, outermost first. */
  ancestor_path?: string[];
}

export type PseudoState =
  | "default"
  | ":hover"
  | ":focus"
  | ":active"
  | ":focus-visible"
  | ":focus-within"
  | ":visited"
  | ":checked"
  | ":disabled";

export interface PseudoStateRule {
  pseudo: PseudoState;
  selector: string;
  properties: Record<string, string>;
  source_file: string;
  line_number: number;
}

export interface CSSRuleRef {
  source_file: string;
  rule_text: string;
  line_number: number;
  /** Elements this rule styles; above 1 it is shared and must not be edited in place. */
  match_count?: number;
}

/** A rule that styles the element, carrying its selector and reach. */
export interface MatchingRule {
  selector: string;
  source_file: string;
  rule_text: string;
  line_number: number;
  match_count: number;
}

export interface CSSVariableRef {
  value: string;
  declared_in: string;
}

export interface StylingInfo {
  framework: StylingFramework;
  class_to_rule_map: Record<string, CSSRuleRef>;
  active_css_variables: Record<string, CSSVariableRef>;
  tailwind_classes?: string[];
  pseudo_rules?: PseudoStateRule[];
  /** All rules governing the element, most specific first. */
  matching_rules?: MatchingRule[];
}

export interface ChangeElementRef {
  tag: string;
  classes: string[];
  source_file?: string;
  source_line?: number;
  /** Instance identity, so two elements with the same classes never merge. */
  dom_path?: string;
  dom_index?: number;
  text_preview?: string;
}

export interface CSSChange {
  property: string;
  before_computed: string;
  after_computed: string;
  before_source_rule?: string;
  expected_final_computed: string;
  change_source?: "visual" | "text_instruction";
  pseudo_state?: PseudoState;
  /** Set when the change targets a different element than snapshot.element (multi-element edits). */
  element_ref?: ChangeElementRef;
}

export interface EnrichedSnapshot {
  element: ElementInfo;
  styling: StylingInfo;
  changes: CSSChange[];
  text_instructions?: string;
}
