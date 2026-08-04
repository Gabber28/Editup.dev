export interface CapturedRule {
  selector: string;
  source_file: string;
  rule_text: string;
  line_number: number;
  /**
   * How many elements in the document this rule styles. Above 1 the rule is
   * shared, and editing it moves every one of them — the AI has to scope the
   * change to the instance instead.
   */
  match_count: number;
  /** Rough CSS specificity, used to send the rule that actually wins. */
  specificity: number;
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

/**
 * Converts a stylesheet href into a project-relative path when possible.
 * Dev servers (Vite) serve source CSS at its real path, so
 * "http://localhost:5173/src/app.css?t=123" becomes "src/app.css" — a hint
 * the AI can open directly instead of searching the project.
 * @param href - Raw stylesheet href, or null for inline styles.
 * @returns A relative path, the original href, or "<inline>".
 */
export function normalizeSheetSource(href: string | null): string {
  // An inline <style> lives in the document itself, so name that document —
  // "<inline>" is not a file the AI can open, and it used to send it hunting
  // through the project with a grep instead.
  if (!href) return currentDocumentPath();
  try {
    const url = new URL(href, location.href);
    if (url.origin === location.origin) {
      return url.pathname.replace(/^\//, "");
    }
    return href;
  } catch {
    return href;
  }
}

/** The served path of the current document, e.g. "index.html". */
export function currentDocumentPath(): string {
  const path = location.pathname.replace(/^\//, "");
  if (!path || path.endsWith("/")) return `${path}index.html`;
  // Extension-less routes are rendered by a component, not a static file; the
  // document path is still the best anchor available.
  return path;
}

/** Counts how many elements the rule applies to, so shared rules are visible. */
function countMatches(selector: string): number {
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

/**
 * Approximate CSS specificity: ids ×100, classes/attributes/pseudo-classes ×10,
 * elements ×1. Enough to rank which of several matching rules wins.
 */
export function specificityOf(selector: string): number {
  const first = selector.split(",")[0] ?? selector;
  const ids = (first.match(/#[\w-]+/g) ?? []).length;
  const classes = (first.match(/\.[\w-]+|\[[^\]]+\]|:[a-z-]+(?![a-z-]*\()/gi) ?? []).length;
  const tags = (first.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return ids * 100 + classes * 10 + tags;
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
    walkRules(cssRules, normalizeSheetSource(sheet.href), (rule) => {
      if (!(rule instanceof CSSStyleRule)) return;
      try {
        if (el.matches(rule.selectorText)) {
          rules.push({
            selector: rule.selectorText,
            source_file: normalizeSheetSource(sheet.href),
            rule_text: rule.cssText,
            line_number: 0,
            match_count: countMatches(rule.selectorText),
            specificity: specificityOf(rule.selectorText),
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
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
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

export interface CapturedPseudoRule {
  pseudo: string;
  selector: string;
  properties: Record<string, string>;
  source_file: string;
  line_number: number;
}

const PSEUDO_RE =
  /:(hover|focus|active|focus-visible|focus-within|visited|checked|disabled)\b/;

export function capturePseudoRules(el: Element): CapturedPseudoRule[] {
  const results: CapturedPseudoRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList | null = null;
    try { cssRules = sheet.cssRules; } catch { continue; }
    if (!cssRules) continue;
    walkRules(cssRules, normalizeSheetSource(sheet.href), (rule) => {
      if (!(rule instanceof CSSStyleRule)) return;
      const sel = rule.selectorText;
      const m = PSEUDO_RE.exec(sel);
      if (!m) return;
      const pseudo = `:${m[1]}`;
      const base = sel.replace(PSEUDO_RE, "").trim();
      if (!base) return;
      try {
        if (!el.matches(base)) return;
      } catch { return; }
      const props: Record<string, string> = {};
      for (let i = 0; i < rule.style.length; i++) {
        const p = rule.style.item(i);
        if (p) props[p] = rule.style.getPropertyValue(p).trim();
      }
      if (Object.keys(props).length > 0) {
        results.push({
          pseudo,
          selector: sel,
          properties: props,
          source_file: normalizeSheetSource(sheet.href),
          line_number: 0,
        });
      }
    });
  }
  return results;
}

export function captureBaseComputedStyle(el: Element): Record<string, string> {
  const clone = el.cloneNode(false) as Element;
  clone.setAttribute("style",
    "position:fixed!important;top:-99999px!important;left:-99999px!important;" +
    "visibility:hidden!important;pointer-events:none!important;"
  );
  document.body.appendChild(clone);
  const computed = getComputedStyle(clone);
  const out: Record<string, string> = {};
  for (let i = 0; i < computed.length; i++) {
    const prop = computed.item(i);
    if (!prop) continue;
    out[prop] = computed.getPropertyValue(prop).trim();
  }
  clone.remove();
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
