import {
  captureComputedStyle,
  captureBaseComputedStyle,
  captureMatchingRules,
  captureCSSVariables,
  capturePseudoRules,
  detectFramework,
} from "./style-capture.js";
import { lookupReactFiber } from "./source-map.js";

export interface SnapshotPayload {
  element: {
    tag: string;
    id: string | undefined;
    classes: string[];
    component_name: string | undefined;
    source_file: string | undefined;
    source_line: number | undefined;
  };
  styling: {
    framework: string;
    class_to_rule_map: Record<
      string,
      { source_file: string; rule_text: string; line_number: number }
    >;
    active_css_variables: Record<
      string,
      { value: string; declared_in: string }
    >;
    pseudo_rules: Array<{
      pseudo: string;
      selector: string;
      properties: Record<string, string>;
      source_file: string;
      line_number: number;
    }>;
  };
  computed_style: Record<string, string>;
  base_computed_style: Record<string, string>;
}

export function buildSnapshotPayload(el: Element): SnapshotPayload {
  const computed = captureComputedStyle(el);
  const baseComputed = captureBaseComputedStyle(el);
  const rules = captureMatchingRules(el);
  const cssVars = captureCSSVariables(el);
  const framework = detectFramework(el);
  const source = lookupReactFiber(el);
  const pseudoRules = capturePseudoRules(el);

  const classToRule: SnapshotPayload["styling"]["class_to_rule_map"] = {};
  for (const cls of Array.from(el.classList)) {
    const matched = rules.find((r) => r.selector.includes(`.${cls}`));
    if (matched) {
      classToRule[cls] = {
        source_file: matched.source_file,
        rule_text: matched.rule_text,
        line_number: matched.line_number,
      };
    }
  }

  return {
    element: {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: Array.from(el.classList),
      component_name: source.componentName,
      source_file: source.source?.file,
      source_line: source.source?.line,
    },
    styling: {
      framework,
      class_to_rule_map: classToRule,
      active_css_variables: cssVars,
      pseudo_rules: pseudoRules,
    },
    computed_style: computed,
    base_computed_style: baseComputed,
  };
}
