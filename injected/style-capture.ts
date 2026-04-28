export interface CapturedRule {
  selector: string;
  source_file: string;
  rule_text: string;
  line_number: number;
}

export interface CapturedStyling {
  framework:
    | "tailwind"
    | "css-modules"
    | "styled-components"
    | "css-variables"
    | "plain-css"
    | "mixed";
  classToRule: Record<string, CapturedRule>;
  cssVariables: Record<string, { value: string; declared_in: string }>;
  tailwindClasses?: string[];
}

export function captureComputedStyle(el: Element): Record<string, string> {
  const computed = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (let i = 0; i < computed.length; i++) {
    const prop = computed.item(i);
    if (!prop) continue;
    out[prop] = computed.getPropertyValue(prop).trim();
  }
  return out;
}

export function captureMatchingRules(el: Element): CapturedRule[] {
  const rules: CapturedRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList | null = null;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue;
    }
    if (!cssRules) continue;
    walkRules(cssRules, sheet.href ?? "<inline>", (rule) => {
      if (!(rule instanceof CSSStyleRule)) return;
      try {
        if (el.matches(rule.selectorText)) {
          rules.push({
            selector: rule.selectorText,
            source_file: sheet.href ?? "<inline>",
            rule_text: rule.cssText,
            line_number: 0,
          });
        }
      } catch {
        // invalid selector
      }
    });
  }
  return rules;
}

function walkRules(
  list: CSSRuleList,
  source: string,
  visit: (rule: CSSRule) => void
): void {
  for (const rule of Array.from(list)) {
    visit(rule);
    if (rule instanceof CSSGroupingRule) {
      walkRules(rule.cssRules, source, visit);
    }
  }
}

export function captureCSSVariables(
  el: Element
): Record<string, { value: string; declared_in: string }> {
  const computed = getComputedStyle(el);
  const out: Record<string, { value: string; declared_in: string }> = {};
  for (let i = 0; i < computed.length; i++) {
    const prop = computed.item(i);
    if (!prop || !prop.startsWith("--")) continue;
    out[prop] = {
      value: computed.getPropertyValue(prop).trim(),
      declared_in: "<computed>",
    };
  }
  return out;
}

const TAILWIND_HEURISTIC = /^(?:[a-z]+:)?(?:!)?(?:-?[a-z]+(?:-[a-z0-9]+)*)(?:\/[0-9]+)?(?:\[[^\]]+\])?$/;

export function detectFramework(el: Element): CapturedStyling["framework"] {
  const classList = Array.from(el.classList);
  const tailwindLike = classList.filter((c) =>
    TAILWIND_HEURISTIC.test(c)
  );
  const cssModulesLike = classList.filter((c) => /_/.test(c) && /[a-zA-Z0-9]{4,}$/.test(c));

  if (tailwindLike.length >= classList.length / 2 && classList.length > 0) {
    return "tailwind";
  }
  if (cssModulesLike.length > 0) {
    return "css-modules";
  }
  if (
    document.querySelector("style[data-styled]") ||
    document.querySelector("style[data-emotion]")
  ) {
    return "styled-components";
  }
  if (Object.keys(captureCSSVariables(el)).length > 0) {
    return "css-variables";
  }
  return "plain-css";
}
