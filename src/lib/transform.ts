/** Rotation/flip state behind the Rotation row of the Position controls. */
export interface TransformState {
  /** Rotation in degrees, normalized to [0, 360). */
  rotate: number;
  flipX: boolean;
  flipY: boolean;
  /**
   * Translation already on the element, carried through untouched so rotating
   * never drops a `translate` the page's own CSS put there. Empty when none.
   */
  translate: string;
}

const MATRIX_RE = /matrix(3d)?\(([^)]+)\)/;
const ROTATE_RE = /\brotate[Zz]?\(\s*(-?[\d.]+)(deg|rad|turn|grad)?\s*\)/;
const SCALE_X_RE = /\bscaleX\(\s*(-?[\d.]+)\s*\)/;
const SCALE_Y_RE = /\bscaleY\(\s*(-?[\d.]+)\s*\)/;
const SCALE_RE = /\bscale\(\s*(-?[\d.]+)\s*(?:,\s*(-?[\d.]+)\s*)?\)/;
const TRANSLATE_RE = /\btranslate(?:X|Y|Z|3d)?\([^)]*\)/g;

/** Formats a matrix translation, dropping it when it is a no-op. */
function translateOf(x: number, y: number): string {
  const px = Math.round(x * 100) / 100;
  const py = Math.round(y * 100) / 100;
  return px === 0 && py === 0 ? "" : `translate(${px}px, ${py}px)`;
}

/** Normalizes any angle into [0, 360) with one decimal of precision. */
function normalizeAngle(deg: number): number {
  const wrapped = ((deg % 360) + 360) % 360;
  return Math.round(wrapped * 10) / 10;
}

/** Converts a CSS angle to degrees; unitless values are already degrees. */
function toDegrees(value: number, unit: string | undefined): number {
  if (unit === "rad") return (value * 180) / Math.PI;
  if (unit === "turn") return value * 360;
  if (unit === "grad") return value * 0.9;
  return value;
}

/** Reads the rotation/flip/translation out of a `matrix()` or `matrix3d()` value. */
function fromMatrix(match: RegExpExecArray): TransformState {
  const idle: TransformState = {
    rotate: 0,
    flipX: false,
    flipY: false,
    translate: "",
  };
  const parts = (match[2] ?? "").split(",").map((n) => Number(n.trim()));
  if (parts.some((n) => !Number.isFinite(n))) return idle;

  // matrix3d packs the 2D basis into m11/m12 (0,1) and m21/m22 (4,5),
  // with the translation at m41/m42 (12,13).
  const is3d = match[1] === "3d";
  if (parts.length < (is3d ? 16 : 6)) return idle;

  const a = parts[0] ?? 1;
  const b = parts[1] ?? 0;
  const c = (is3d ? parts[4] : parts[2]) ?? 0;
  const d = (is3d ? parts[5] : parts[3]) ?? 1;
  const tx = (is3d ? parts[12] : parts[4]) ?? 0;
  const ty = (is3d ? parts[13] : parts[5]) ?? 0;

  const mirrored = a * d - b * c < 0;
  // `rotate(θ) scaleX(-1)` negates the first column, so undo that sign before
  // reading the angle — a flipped element still reports the rotation typed.
  const angle = mirrored ? Math.atan2(-b, -a) : Math.atan2(b, a);

  return {
    rotate: normalizeAngle((angle * 180) / Math.PI),
    flipX: mirrored,
    flipY: false,
    translate: translateOf(tx, ty),
  };
}

/**
 * Reads authored function syntax such as `rotate(90deg) scaleX(-1)` — the shape
 * this module writes back, and what the editor holds while an override is
 * pending (before any browser round-trip turns it into a matrix).
 */
function fromFunctions(value: string): TransformState {
  const rot = ROTATE_RE.exec(value);
  const rotate = rot ? normalizeAngle(toDegrees(Number(rot[1]), rot[2])) : 0;

  let flipX = (SCALE_X_RE.exec(value)?.[1] ?? "1").startsWith("-");
  let flipY = (SCALE_Y_RE.exec(value)?.[1] ?? "1").startsWith("-");

  const uniform = SCALE_RE.exec(value);
  if (uniform) {
    const x = Number(uniform[1]);
    const y = uniform[2] === undefined ? x : Number(uniform[2]);
    flipX = flipX || x < 0;
    flipY = flipY || y < 0;
  }

  const translate = (value.match(TRANSLATE_RE) ?? []).join(" ");

  return { rotate, flipX, flipY, translate };
}

/**
 * Reads a `transform` value into rotation and mirror flags, accepting both
 * shapes the editor sees: the matrix `getComputedStyle` reports for the page's
 * own styles, and the authored `rotate(90deg) scaleX(-1)` this module writes
 * back (which is what sits in the value map while an override is pending).
 *
 * A mirrored matrix is inherently ambiguous — `scaleX(-1)` and
 * `rotate(180deg) scaleY(-1)` produce the identical matrix — so a negative
 * determinant is always reported as `flipX`. Authored syntax has no such
 * ambiguity and round-trips exactly.
 *
 * @param computed Value of `transform` (matrix, function list, or "none")
 * @returns Rotation in degrees plus horizontal/vertical mirror flags
 */
export function parseTransform(computed: string): TransformState {
  const idle: TransformState = {
    rotate: 0,
    flipX: false,
    flipY: false,
    translate: "",
  };
  if (!computed || computed === "none") return idle;

  const matrix = MATRIX_RE.exec(computed);
  if (matrix) return fromMatrix(matrix);

  return fromFunctions(computed);
}

/**
 * Builds the `transform` value written to the element from the panel state.
 *
 * @param state Rotation in degrees and mirror flags
 * @returns A transform string such as "rotate(90deg) scaleX(-1)", or "none" when idle
 */
export function buildTransform(state: TransformState): string {
  const parts: string[] = [];
  if (state.translate) parts.push(state.translate);
  const rotate = normalizeAngle(state.rotate);
  if (rotate !== 0) parts.push(`rotate(${rotate}deg)`);
  if (state.flipX) parts.push("scaleX(-1)");
  if (state.flipY) parts.push("scaleY(-1)");
  return parts.length > 0 ? parts.join(" ") : "none";
}
