export type StylingFramework =
  | "tailwind"
  | "css-modules"
  | "styled-components"
  | "css-variables"
  | "plain-css"
  | "mixed";

export interface ElementInfo {
  tag: string;
  id?: string;
  classes: string[];
  component_name?: string;
  source_file?: string;
  source_line?: number;
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
}

export interface CSSChange {
  property: string;
  before_computed: string;
  after_computed: string;
  before_source_rule?: string;
  expected_final_computed: string;
  change_source?: "visual" | "text_instruction";
  pseudo_state?: PseudoState;
}

export interface EnrichedSnapshot {
  element: ElementInfo;
  styling: StylingInfo;
  changes: CSSChange[];
  text_instructions?: string;
}
