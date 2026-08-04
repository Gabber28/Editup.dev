import {
  captureComputedStyle,
  captureBaseComputedStyle,
  captureMatchingRules,
  captureCSSVariables,
  capturePseudoRules,
  detectFramework,
} from "./style-capture.js";
import { lookupReactFiber } from "./source-map.js";
import { buildDomPath, domIndex, textPreview, ancestorPath } from "./dom-path.js";

export interface SnapshotPayload {
  element: {
    tag: string;
    id: string | undefined;
    classes: string[];
    component_name: string | undefined;
    source_file: string | undefined;
    source_line: number | undefined;
    media: {
      kind: "img" | "background" | "svg" | "svg-use" | "icon-font" | "emoji" | "none";
      url?: string;
      text?: string;
      iconClass?: string;
      svgMarkup?: string;
    };
    button: {
      kind: "anchor" | "button" | "none";
      href: string;
      target: string;
    };
    has_text: boolean;
    /** Selector matching this element and no other — its instance identity. */
    dom_path: string;
    /** 1-based position among its siblings. */
    dom_index: number;
    /** The element's own visible text, trimmed. */
    text_preview: string;
    /** Nearest ancestors as `tag.class`, outermost first. */
    ancestor_path: string[];
    layout: {
      offset: { left: number; top: number };
      size: { width: number; height: number };
      parent: { tag: string; display: string; flex_direction: string } | null;
    };
  };
  styling: {
    framework: string;
    class_to_rule_map: Record<
      string,
      {
        source_file: string;
        rule_text: string;
        line_number: number;
        match_count?: number;
      }
    >;
    /**
     * Every rule that styles this element, most specific first — including the
     * tag/id/descendant rules that a class-keyed map cannot express.
     */
    matching_rules: Array<{
      selector: string;
      source_file: string;
      rule_text: string;
      line_number: number;
      match_count: number;
    }>;
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
  /** Set on the snapshot captured after a verification reload (no live previews). */
  verification?: boolean;
}

type MediaCapture = SnapshotPayload["element"]["media"];

// Prefixes whose "<prefix>name" class names the specific glyph (fa-star, bi-heart).
const ICON_TOKEN_PREFIXES = ["fa-", "bi-", "ph-", "icon-"];
const ICON_FONT_HINTS = ["fontawesome", "font awesome", "material icons", "material symbols", "bootstrap-icons", "phosphor", "ionicons"];
const EMOJI_RE = /\p{Extended_Pictographic}/u;

/** Finds the icon-token class (e.g. "fa-star") among the element's classes. */
function iconTokenOf(el: Element): string | undefined {
  for (const cls of Array.from(el.classList)) {
    if (ICON_TOKEN_PREFIXES.some((p) => cls.startsWith(p) && cls.length > p.length)) {
      return cls;
    }
  }
  return undefined;
}

/** True when the element is styled by a known icon font. */
function usesIconFont(el: Element): boolean {
  const fam = getComputedStyle(el).fontFamily.toLowerCase();
  return ICON_FONT_HINTS.some((h) => fam.includes(h));
}

/**
 * Detects the element's image/icon target so the Image panel can offer the
 * right "replace" control: an <img> src, CSS background, inline <svg>, a
 * <use> sprite reference, an icon-font glyph, or an emoji.
 *
 * @param el Selected element
 * @returns Media kind plus the current url/text/class/markup as applicable
 */
function captureMedia(el: Element): MediaCapture {
  if (el instanceof HTMLImageElement) {
    return { kind: "img", url: el.getAttribute("src") ?? "" };
  }

  // Resolve the nearest <svg> when an inner node (path/use) is selected.
  const svg = el instanceof SVGSVGElement ? el : el.closest("svg");
  if (svg) {
    const use = svg.querySelector("use");
    if (use) {
      const href = use.getAttribute("href") ?? use.getAttribute("xlink:href") ?? "";
      return { kind: "svg-use", url: href };
    }
    const inner = svg.innerHTML;
    return { kind: "svg", svgMarkup: inner.length > 2000 ? `${inner.slice(0, 2000)}…` : inner };
  }

  const token = iconTokenOf(el);
  if (token || usesIconFont(el)) {
    return { kind: "icon-font", iconClass: token ?? "", text: el.textContent?.trim() ?? "" };
  }

  const text = el.textContent?.trim() ?? "";
  if (el.childElementCount === 0 && text && EMOJI_RE.test(text)) {
    return { kind: "emoji", text };
  }

  const bg = getComputedStyle(el).backgroundImage;
  if (bg && bg !== "none") {
    const m = /url\((['"]?)(.*?)\1\)/.exec(bg);
    return { kind: "background", url: m?.[2] ?? "" };
  }

  return { kind: "none" };
}

/**
 * Detects whether the element is already a link/button so the Link panel can
 * reflect it instead of blindly offering to "make a button".
 *
 * @param el Selected element
 * @returns The button kind plus current href/target
 */
function captureButton(el: Element): { kind: "anchor" | "button" | "none"; href: string; target: string } {
  const anchor = el instanceof HTMLAnchorElement ? el : el.closest("a");
  if (anchor) {
    return {
      kind: "anchor",
      href: anchor.getAttribute("href") ?? "",
      target: anchor.getAttribute("target") ?? "",
    };
  }
  const isButton =
    el instanceof HTMLButtonElement ||
    el.getAttribute("role") === "button" ||
    (el instanceof HTMLInputElement && ["button", "submit", "reset"].includes(el.type)) ||
    el.closest("button") !== null;
  if (isButton) {
    return { kind: "button", href: "", target: "" };
  }
  return { kind: "none", href: "", target: "" };
}

/**
 * Measures where the element sits and how its parent lays out children, so the
 * Position controls can show real X/Y numbers and map alignment onto the
 * property that actually moves the element (align-self, justify-self, margins,
 * or inset).
 *
 * @param el Selected element
 * @returns Offset from the offset parent, box size, and the parent's layout mode
 */
function captureLayout(el: Element): SnapshotPayload["element"]["layout"] {
  const rect = el.getBoundingClientRect();
  const html = el instanceof HTMLElement ? el : null;
  const parentEl = el.parentElement;
  const parentStyle = parentEl ? getComputedStyle(parentEl) : null;

  return {
    offset: {
      left: Math.round(html?.offsetLeft ?? rect.left),
      top: Math.round(html?.offsetTop ?? rect.top),
    },
    size: { width: Math.round(rect.width), height: Math.round(rect.height) },
    parent:
      parentEl && parentStyle
        ? {
            tag: parentEl.tagName.toLowerCase(),
            display: parentStyle.display,
            flex_direction: parentStyle.flexDirection,
          }
        : null,
  };
}

/** True when the selector uses this class as a whole token (not `.icon-badge`). */
function selectorUsesClass(selector: string, cls: string): boolean {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\.${escaped}(?![\\w-])`).test(selector);
}

/** Cap on rules shipped per element, so a utility-heavy page stays in budget. */
const MAX_MATCHING_RULES = 12;

export function buildSnapshotPayload(el: Element): SnapshotPayload {
  const computed = captureComputedStyle(el);
  const baseComputed = captureBaseComputedStyle(el);
  const rules = captureMatchingRules(el);
  const cssVars = captureCSSVariables(el);
  const framework = detectFramework(el);
  const source = lookupReactFiber(el);
  const pseudoRules = capturePseudoRules(el);

  // Most specific last-wins order, so the rule that actually paints the element
  // is the one the AI sees first.
  const ranked = [...rules].sort((a, b) => b.specificity - a.specificity);

  const classToRule: SnapshotPayload["styling"]["class_to_rule_map"] = {};
  for (const cls of Array.from(el.classList)) {
    // Match the class as a whole token: `.includes(".icon")` also matched
    // `.icon-badge`, handing over a rule that styles a different element.
    const matched = ranked.find((r) => selectorUsesClass(r.selector, cls));
    if (matched) {
      classToRule[cls] = {
        source_file: matched.source_file,
        rule_text: matched.rule_text,
        line_number: matched.line_number,
        match_count: matched.match_count,
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
      media: captureMedia(el),
      button: captureButton(el),
      has_text: Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent?.trim() ?? "") !== ""
      ),
      dom_path: buildDomPath(el),
      dom_index: domIndex(el),
      text_preview: textPreview(el),
      ancestor_path: ancestorPath(el),
      layout: captureLayout(el),
    },
    styling: {
      framework,
      class_to_rule_map: classToRule,
      // Sent whole so an element without classes (or styled by a descendant or
      // tag rule) still arrives with the CSS that actually governs it.
      matching_rules: ranked.slice(0, MAX_MATCHING_RULES).map((r) => ({
        selector: r.selector,
        source_file: r.source_file,
        rule_text: r.rule_text,
        line_number: r.line_number,
        match_count: r.match_count,
      })),
      active_css_variables: cssVars,
      pseudo_rules: pseudoRules,
    },
    computed_style: computed,
    base_computed_style: baseComputed,
  };
}
