import type { EnrichedSnapshot, CSSChange } from "@/types/snapshot.js";

const PIXEL_TOLERANCE = 5;
const RGB_CHANNEL_TOLERANCE = 15;

export interface VisualCheckInput {
  snapshot: EnrichedSnapshot;
  postEditComputed: Record<string, string>;
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
  }>;
}

export function checkVisual(input: VisualCheckInput): VisualCheckResult {
  const divergences: VisualCheckResult["divergences"] = [];
  let checked = 0;

  for (const change of input.snapshot.changes) {
    // :hover/:focus/etc. values and changes on other elements never show up
    // in the verified element's default computed style — comparing them
    // produces false failures and triggers bogus correction passes.
    if (change.pseudo_state !== undefined || change.element_ref !== undefined) {
      continue;
    }
    checked++;
    const actual = input.postEditComputed[change.property];
    if (actual === undefined) {
      divergences.push({
        property: change.property,
        expected: change.expected_final_computed,
        actual: "<missing>",
        reason: "property absent from post-edit computed style",
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
