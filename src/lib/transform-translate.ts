import type { TransformState } from "./transform.js";

const TRANSLATE_PAIR_RE = /\btranslate\(\s*([^,)]+?)\s*(?:,\s*([^)]+?)\s*)?\)/;
const TRANSLATE_X_RE = /\btranslateX\(\s*([^)]+?)\s*\)/;
const TRANSLATE_Y_RE = /\btranslateY\(\s*([^)]+?)\s*\)/;

/** A translation component that contributes nothing, so it is not written out. */
function isZero(value: string): boolean {
  return (
    value === "" || /^[+-]?0(?:\.0+)?(?:px|%|em|rem|vh|vw)?$/.test(value.trim())
  );
}

/**
 * Splits the carried translation into its X and Y components.
 *
 * Accepts every shape the value can arrive in: the `translate(x, y)` this module
 * writes, the separate `translateX()`/`translateY()` a page may author, and the
 * pair recovered from a computed matrix.
 *
 * @param state Parsed transform state
 * @returns X and Y as CSS strings, empty when unset
 */
export function translateParts(state: TransformState): {
  x: string;
  y: string;
} {
  const source = state.translate;
  if (!source) return { x: "", y: "" };

  const pair = TRANSLATE_PAIR_RE.exec(source);
  if (pair) return { x: pair[1] ?? "", y: pair[2] ?? "" };

  return {
    x: TRANSLATE_X_RE.exec(source)?.[1] ?? "",
    y: TRANSLATE_Y_RE.exec(source)?.[1] ?? "",
  };
}

/**
 * Replaces the translation, dropping it entirely when both axes are zero.
 *
 * @param state Current transform state
 * @param x New X component ("" clears it)
 * @param y New Y component ("" clears it)
 * @returns State carrying the new translation
 */
export function withTranslate(
  state: TransformState,
  x: string,
  y: string
): TransformState {
  if (isZero(x) && isZero(y)) return { ...state, translate: "" };
  const px = isZero(x) ? "0" : x.trim();
  const py = isZero(y) ? "0" : y.trim();
  return { ...state, translate: `translate(${px}, ${py})` };
}
