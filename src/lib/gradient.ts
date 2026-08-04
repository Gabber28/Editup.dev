/** Parse & serialize CSS gradients for the gradient editor. */

import { formatColor, parseAlpha, parseColor } from "./color.js";

export interface GradientStop {
  /** Hex color (#RRGGBB). */
  color: string;
  /** Position along the gradient, 0–100. */
  pos: number;
}

export interface Gradient {
  type: "linear" | "radial";
  /** Angle in degrees (linear only). */
  angle: number;
  stops: GradientStop[];
}

const ANGLE_KEYWORDS: Record<string, number> = {
  "to top": 0,
  "to right": 90,
  "to bottom": 180,
  "to left": 270,
  "to top right": 45,
  "to bottom right": 135,
  "to bottom left": 225,
  "to top left": 315,
};

/** Splits a gradient's argument list on top-level commas (ignores commas inside `rgb(...)`). */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Parses one "<color> [pos%]" stop token. */
function parseStop(token: string): GradientStop | null {
  const posMatch = /\s(-?\d+(?:\.\d+)?)%\s*$/.exec(token);
  const pos = posMatch ? Number(posMatch[1]) : Number.NaN;
  const colorPart = posMatch ? token.slice(0, posMatch.index).trim() : token.trim();
  const rgb = parseColor(colorPart);
  if (!rgb) return null;
  return { color: formatColor(rgb, parseAlpha(colorPart)), pos };
}

/**
 * Parses a CSS `linear-gradient()`/`radial-gradient()` string (including the
 * `rgb()`-normalized form `getComputedStyle` returns). Missing stop positions
 * are distributed evenly.
 *
 * @param css Gradient string (may be a full `background-image` value)
 * @returns Parsed gradient, or null when not a gradient
 */
export function parseGradient(css: string): Gradient | null {
  const m = /(linear|radial)-gradient\(([\s\S]*)\)/i.exec(css.trim());
  if (!m) return null;
  const type = (m[1] ?? "linear").toLowerCase() as "linear" | "radial";
  const args = splitTopLevel(m[2] ?? "");
  if (args.length === 0) return null;

  let angle = type === "linear" ? 180 : 0;
  let firstStopIdx = 0;
  const head = (args[0] ?? "").toLowerCase();
  const degMatch = /^(-?\d+(?:\.\d+)?)deg$/.exec(head);
  if (degMatch) {
    angle = Number(degMatch[1]);
    firstStopIdx = 1;
  } else if (head in ANGLE_KEYWORDS) {
    angle = ANGLE_KEYWORDS[head] ?? angle;
    firstStopIdx = 1;
  } else if (type === "radial" && !parseColor(head.split(/\s/)[0] ?? "")) {
    // radial shape/position preamble (e.g. "circle at center") — skip it
    firstStopIdx = 1;
  }

  const stops: GradientStop[] = [];
  for (const token of args.slice(firstStopIdx)) {
    const stop = parseStop(token);
    if (stop) stops.push(stop);
  }
  if (stops.length < 2) return null;

  // Fill in any missing positions, spread evenly across 0–100.
  stops.forEach((s, i) => {
    if (Number.isNaN(s.pos)) {
      s.pos = Math.round((i / (stops.length - 1)) * 100);
    }
  });

  return { type, angle, stops };
}

/**
 * Serializes a gradient back to a CSS string.
 *
 * @param g Gradient model
 * @returns `linear-gradient(...)` or `radial-gradient(...)`
 */
export function serializeGradient(g: Gradient): string {
  const stops = g.stops
    .map((s) => `${s.color} ${Math.round(s.pos)}%`)
    .join(", ");
  if (g.type === "radial") {
    return `radial-gradient(circle, ${stops})`;
  }
  return `linear-gradient(${Math.round(g.angle)}deg, ${stops})`;
}

/** A sensible default gradient for the "Add gradient" action. */
export function defaultGradient(): Gradient {
  return {
    type: "linear",
    angle: 90,
    stops: [
      { color: "#7C3AED", pos: 0 },
      { color: "#3B82F6", pos: 100 },
    ],
  };
}

export interface GradientLayers {
  /** Gradient painting the element background (clip: border-box). */
  background: Gradient | null;
  /** Gradient painting the text glyphs (clip: text). */
  text: Gradient | null;
}

export interface ComposedGradients {
  "background-image": string;
  "background-clip": string;
  "-webkit-background-clip": string;
  "-webkit-text-fill-color": string;
}

/**
 * Splits a computed `background-image` (which may hold several gradient layers)
 * and pairs each with its `background-clip` token to tell the text layer
 * (clip: text) from the background layer.
 *
 * @param bgImage The `background-image` value (top-level, comma-separated layers)
 * @param clip The `background-clip` (or `-webkit-background-clip`) value
 * @returns The background and text gradient layers, either possibly null
 */
/**
 * A fully-transparent gradient layer we insert so an element's own
 * `background-color` keeps its border-box clip while the text layer is clipped
 * to the glyphs. It is invisible and must not surface as a real gradient.
 */
const PLACEHOLDER_LAYER = "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0))";

/** True when every color in a gradient layer is transparent (a placeholder). */
function isTransparentLayer(layer: string): boolean {
  const colors = layer.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b|transparent/g) ?? [];
  if (colors.length === 0) return false;
  return colors.every((c) => {
    const s = c.toLowerCase();
    if (s === "transparent") return true;
    if (/rgba?\([^)]*,\s*(?:0|0?\.0+)\s*\)$/.test(s)) return true;
    return /^#[0-9a-f]{6}00$/.test(s) || /^#[0-9a-f]{3}0$/.test(s);
  });
}

export function parseGradientLayers(bgImage: string, clip: string): GradientLayers {
  const layers = splitTopLevel(bgImage).filter((l) => /gradient\(/i.test(l));
  const clips = splitTopLevel(clip);
  const result: GradientLayers = { background: null, text: null };

  layers.forEach((layer, i) => {
    if (isTransparentLayer(layer)) return; // skip the border-box placeholder
    const g = parseGradient(layer);
    if (!g) return;
    // background-clip may be a single token (applies to all) or per-layer.
    const token = (clips[i] ?? clips[0] ?? "").toLowerCase();
    if (token.includes("text")) result.text = g;
    else result.background = g;
  });

  return result;
}

/**
 * Composes the CSS properties for the given layers. The text layer is listed
 * first so it paints over the background layer.
 *
 * @param l Background and/or text gradient layers
 * @returns The four CSS properties to emit (background-image, both clips, text-fill)
 */
export function composeGradients(l: GradientLayers): ComposedGradients {
  const images: string[] = [];
  const clips: string[] = [];
  if (l.text) {
    images.push(serializeGradient(l.text));
    clips.push("text");
  }
  if (l.background) {
    images.push(serializeGradient(l.background));
    clips.push("border-box");
  } else if (l.text) {
    // Border-box placeholder so the element's background-color survives the
    // text clip (see isTransparentLayer / empirical bg-clip test).
    images.push(PLACEHOLDER_LAYER);
    clips.push("border-box");
  }

  if (images.length === 0) {
    return {
      "background-image": "none",
      "background-clip": "border-box",
      "-webkit-background-clip": "border-box",
      "-webkit-text-fill-color": "currentcolor",
    };
  }

  const clipValue = clips.join(", ");
  return {
    "background-image": images.join(", "),
    "background-clip": clipValue,
    "-webkit-background-clip": clipValue,
    "-webkit-text-fill-color": l.text ? "transparent" : "currentcolor",
  };
}
