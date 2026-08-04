import type { EnrichedSnapshot, CSSChange } from "@/types/snapshot.js";

const PIXEL_TOLERANCE = 5;
const RGB_CHANNEL_TOLERANCE = 15;

/** Properties whose computed value is re-normalized by the browser, making a
 * strict string comparison unreliable (gradients, background shorthands, urls). */
const GRADIENT_PRONE_PROPS = new Set([
  "background-image",
  "background",
  "background-clip",
  "-webkit-background-clip",
  "-webkit-text-fill-color",
]);

export interface VisualCheckInput {
  snapshot: EnrichedSnapshot;
  postEditComputed: Record<string, string>;
  /**
   * Post-edit computed styles of the other edited elements, keyed by dom_path.
   * Without these, every change on a non-primary element was skipped — which is
   * most of a multi-element edit.
   */
  elementStyles?: Record<string, Record<string, string>>;
}

export interface VisualCheckResult {
  status: "pass" | "fail";
  /** Number of changes actually compared. Pseudo-state and other-element changes are not observable in the default computed style of the verified element, so they are skipped. */
  checked: number;
  divergences: Array<{
    property: string;
    expected: string;
    actual: string;
    reason: string;
    /** Which element diverged, for the warning shown to the developer. */
    element?: string;
  }>;
}

/** Readable identity of the element a change targeted. */
function describeTarget(
  snapshot: EnrichedSnapshot,
  change: CSSChange
): string {
  const ref = change.element_ref;
  const tag = ref?.tag ?? snapshot.element.tag;
  const classes = ref?.classes ?? snapshot.element.classes;
  return classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
}

export function checkVisual(input: VisualCheckInput): VisualCheckResult {
  const divergences: VisualCheckResult["divergences"] = [];
  let checked = 0;

  for (const change of input.snapshot.changes) {
    // :hover/:focus/etc. never show up in a default computed style.
    if (change.pseudo_state !== undefined) continue;

    // A change on another element is checked against THAT element's styles.
    // Skipping them, as this did, left multi-element edits unverified.
    const refPath = change.element_ref?.dom_path;
    const styles = change.element_ref
      ? refPath
        ? input.elementStyles?.[refPath]
        : undefined
      : input.postEditComputed;
    if (!styles) continue;
    // Media/icon swaps (src attribute, __text__, __class__, __use_href__,
    // __svg_inner__) are not CSS properties, so getComputedStyle has nothing
    // to compare — skip them here (they get light verification via git diff).
    if (change.property === "src" || change.property.startsWith("__")) {
      continue;
    }
    // Gradient/background/url values are re-normalized by the browser (colors
    // → rgb(), relative URLs → absolute, keyword angles → deg), so a strict
    // string compare false-fails and triggers a bogus correction pass.
    if (GRADIENT_PRONE_PROPS.has(change.property)) {
      continue;
    }
    checked++;
    const actual = styles[change.property];
    if (actual === undefined) {
      divergences.push({
        property: change.property,
        expected: change.expected_final_computed,
        actual: "<missing>",
        reason: "property absent from post-edit computed style",
        element: describeTarget(input.snapshot, change),
      });
      continue;
    }

    if (change.change_source === "text_instruction") {
      if (actual === change.before_computed) {
        divergences.push({
          property: change.property,
          expected: "(any change)",
          actual,
          reason: "text instruction change: value unchanged",
          element: describeTarget(input.snapshot, change),
        });
      }
      continue;
    }

    const result = compareValues(
      change.expected_final_computed,
      actual,
      change
    );
    if (!result.matches) {
      divergences.push({
        property: change.property,
        expected: change.expected_final_computed,
        actual,
        reason: result.reason,
        element: describeTarget(input.snapshot, change),
      });
    }
  }

  return {
    status: divergences.length === 0 ? "pass" : "fail",
    checked,
    divergences,
  };
}

interface ComparisonResult {
  matches: boolean;
  reason: string;
}

function compareValues(
  expected: string,
  actual: string,
  change: CSSChange
): ComparisonResult {
  if (expected === actual) {
    return { matches: true, reason: "exact match" };
  }

  const expectedPx = parsePixels(expected);
  const actualPx = parsePixels(actual);
  if (expectedPx !== null && actualPx !== null) {
    const diff = Math.abs(expectedPx - actualPx);
    if (diff <= PIXEL_TOLERANCE) {
      return { matches: true, reason: `px diff ${diff} within tolerance` };
    }
    return {
      matches: false,
      reason: `px diff ${diff} exceeds ±${PIXEL_TOLERANCE}`,
    };
  }

  const expectedRgb = parseRgb(expected);
  const actualRgb = parseRgb(actual);
  if (expectedRgb && actualRgb) {
    const dr = Math.abs(expectedRgb.r - actualRgb.r);
    const dg = Math.abs(expectedRgb.g - actualRgb.g);
    const db = Math.abs(expectedRgb.b - actualRgb.b);
    const max = Math.max(dr, dg, db);
    if (max <= RGB_CHANNEL_TOLERANCE) {
      return {
        matches: true,
        reason: `RGB channel diff ${max} within tolerance`,
      };
    }
    return {
      matches: false,
      reason: `RGB channel diff ${max} exceeds ±${RGB_CHANNEL_TOLERANCE}`,
    };
  }

  return {
    matches: false,
    reason: `string mismatch (${change.property})`,
  };
}

function parsePixels(value: string): number | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  return match && match[1] !== undefined ? parseFloat(match[1]) : null;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseRgb(value: string): RGB | null {
  const trimmed = value.trim();
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
  );
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  const hexMatch = trimmed.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch && hexMatch[1]) {
    const hex = hexMatch[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  const shortHexMatch = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (shortHexMatch && shortHexMatch[1]) {
    const [r, g, b] = shortHexMatch[1];
    return {
      r: parseInt(`${r}${r}`, 16),
      g: parseInt(`${g}${g}`, 16),
      b: parseInt(`${b}${b}`, 16),
    };
  }
  return null;
}
