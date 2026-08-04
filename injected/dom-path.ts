const TEXT_PREVIEW_MAX = 60;
const ANCESTOR_LEVELS = 3;

/**
 * A CSS path that selects this exact element and no other, disambiguating
 * siblings with `:nth-of-type`. It is what makes "the second card" different
 * from "a card" — for the app's per-instance state and for the AI, which
 * otherwise sees three identical `div.icon`s.
 *
 * @param el Element to describe
 * @returns A unique selector rooted at an id when one is available
 */
export function buildDomPath(el: Element): string {
  if (el.id) return `#${cssEscape(el.id)}`;
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    let seg = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`#${cssEscape(current.id)}`);
      break;
    }
    const parent: Element | null = current.parentElement;
    if (parent) {
      const tagName = current.tagName;
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === tagName
      );
      if (siblings.length > 1) {
        seg += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }
    parts.unshift(seg);
    current = parent;
  }
  return parts.join(" > ");
}

/** Position among element siblings, 1-based — how the AI locates it in markup. */
export function domIndex(el: Element): number {
  const parent = el.parentElement;
  if (!parent) return 1;
  return Array.from(parent.children).indexOf(el) + 1;
}

/** The element's own visible text, trimmed — often the fastest way to find it. */
export function textPreview(el: Element): string {
  const own = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const text = own || (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return text.length > TEXT_PREVIEW_MAX
    ? `${text.slice(0, TEXT_PREVIEW_MAX)}…`
    : text;
}

/** Nearest ancestors as `tag.class`, outermost first — context for the AI. */
export function ancestorPath(el: Element): string[] {
  const out: string[] = [];
  let current = el.parentElement;
  while (current && out.length < ANCESTOR_LEVELS && current !== document.documentElement) {
    const classes = Array.from(current.classList).slice(0, 2);
    out.unshift(
      classes.length > 0
        ? `${current.tagName.toLowerCase()}.${classes.join(".")}`
        : current.tagName.toLowerCase()
    );
    current = current.parentElement;
  }
  return out;
}

/** Minimal escaping for ids used inside a selector. */
function cssEscape(value: string): string {
  return value.replace(/([^\w-])/g, "\\$1");
}
