import type { MatchingRule } from "@/types/snapshot.js";

/** Where a value on screen came from — the distinction the old panel collapsed. */
export type Origin = "edited" | "authored" | "auto";

export interface FieldValue {
  /** What the field shows. Empty string when the property is unset. */
  value: string;
  origin: Origin;
  /** Browser-resolved value, offered as placeholder only. Never pre-filled. */
  computed: string;
}

/**
 * Reads a property out of a CSS rule's declaration block.
 *
 * Deliberately text-based: the agent ships `rule_text` as authored, and parsing
 * it here keeps the whole provenance question inside the panel instead of
 * widening the snapshot contract.
 *
 * @param ruleText Full rule text, e.g. `.card { top: 24px; left: 0 }`
 * @param property CSS property to look for
 * @returns The declared value, or undefined when the rule does not set it
 */
export function declaredValue(
  ruleText: string,
  property: string
): string | undefined {
  const body = ruleText.slice(
    ruleText.indexOf("{") + 1,
    ruleText.lastIndexOf("}")
  );
  // Last declaration wins inside a single block, so scan forward and keep the
  // final hit rather than returning on the first.
  let found: string | undefined;
  for (const decl of body.split(";")) {
    const colon = decl.indexOf(":");
    if (colon === -1) continue;
    if (decl.slice(0, colon).trim().toLowerCase() !== property) continue;
    const raw = decl
      .slice(colon + 1)
      .replace(/!important\s*$/i, "")
      .trim();
    if (raw) found = raw;
  }
  return found;
}

/**
 * The value the source CSS declares for a property, if any.
 *
 * `matching_rules` arrives ranked most-specific-first, so the first rule that
 * declares the property is the one that wins.
 *
 * @param rules Rules governing the element
 * @param property CSS property to resolve
 * @returns The authored value, or undefined when no rule declares it
 */
export function authoredValue(
  rules: readonly MatchingRule[] | undefined,
  property: string
): string | undefined {
  for (const rule of rules ?? []) {
    const declared = declaredValue(rule.rule_text, property);
    if (declared !== undefined) return declared;
  }
  return undefined;
}

/**
 * Resolves what a field should show and how it should look.
 *
 * The ordering is the whole point: an edit the developer just made outranks the
 * stylesheet, the stylesheet outranks nothing at all, and the computed value
 * never becomes the field's content — it only ever informs the placeholder.
 * Showing `getComputedStyle` output as if it were authored is what made the old
 * panel untrustworthy (`top: -99999px` on elements nobody had positioned).
 *
 * @param property CSS property to resolve
 * @param overrides Values edited in this session
 * @param rules Rules governing the element
 * @param computed Browser-resolved values
 * @returns The field's content, origin, and reference value
 */
export function resolveField(
  property: string,
  overrides: Record<string, string>,
  rules: readonly MatchingRule[] | undefined,
  computed: Record<string, string>
): FieldValue {
  const computedValue = computed[property] ?? "";

  const edited = overrides[property];
  if (edited !== undefined && edited !== "") {
    return { value: edited, origin: "edited", computed: computedValue };
  }

  const authored = authoredValue(rules, property);
  if (authored !== undefined && authored !== "auto") {
    return { value: authored, origin: "authored", computed: computedValue };
  }

  return { value: "", origin: "auto", computed: computedValue };
}

/** True when the field carries a real declaration, so the side reads as pinned. */
export function isSet(field: FieldValue): boolean {
  return field.origin !== "auto";
}

/**
 * Normalises typed input into a CSS length.
 *
 * A bare number means px — the unit is implied so four fields do not each repeat
 * it. Any explicit unit the developer typed is preserved verbatim.
 *
 * @param raw Text as typed
 * @returns A CSS value, or null when the field should be cleared to `auto`
 */
export function normalizeLength(raw: string): string | null {
  const text = raw.trim();
  if (text === "" || text.toLowerCase() === "auto") return null;
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(text)) return `${parseFloat(text)}px`;
  return text;
}

/**
 * Steps a numeric value, keeping whatever unit it already carries.
 *
 * @param current Current value, possibly empty or non-numeric
 * @param delta Amount to add
 * @param fallback Value to step from when the field is empty
 * @returns The stepped value as a CSS string
 */
export function stepValue(
  current: string,
  delta: number,
  fallback = "0px"
): string {
  const source = current.trim() === "" ? fallback : current.trim();
  const match = source.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(.*)$/);
  if (!match) return source;
  const n = parseFloat(match[1] ?? "0") + delta;
  const unit = (match[2] ?? "").trim() || "px";
  return `${Math.round(n * 1000) / 1000}${unit}`;
}
