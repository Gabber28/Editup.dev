/** Color conversion utilities for the color-wheel picker (HSV model). */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsv {
  /** Hue in degrees [0, 360). */
  h: number;
  /** Saturation [0, 1]. */
  s: number;
  /** Value/brightness [0, 1]. */
  v: number;
}

const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));

/**
 * Parses a CSS color string into RGB. Handles `#rgb`, `#rrggbb`, and
 * `rgb()/rgba()` (the forms `getComputedStyle` and our overrides produce).
 *
 * @param input CSS color string
 * @returns RGB channels, or null when unparseable
 */
export function parseColor(input: string): Rgb | null {
  const s = input.trim();
  if (!s) return null;

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (hex) {
    let h = hex[1] ?? "";
    if (h.length === 3 || h.length === 4) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (rgb) {
    return {
      r: clamp(Math.round(Number(rgb[1])), 0, 255),
      g: clamp(Math.round(Number(rgb[2])), 0, 255),
      b: clamp(Math.round(Number(rgb[3])), 0, 255),
    };
  }

  return null;
}

/**
 * Formats RGB channels as an uppercase `#RRGGBB` hex string.
 *
 * @param rgb RGB channels (0-255)
 * @returns Hex color string
 */
export function rgbToHex({ r, g, b }: Rgb): string {
  const hex = (n: number): string =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

/**
 * Extracts the alpha channel (0–1) from a CSS color; defaults to 1 (opaque)
 * for `#rgb`/`#rrggbb`/`rgb()` forms.
 *
 * @param input CSS color string
 * @returns Alpha in [0, 1]
 */
export function parseAlpha(input: string): number {
  const s = input.trim();
  const rgba = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i.exec(s);
  if (rgba) return clamp(Number(rgba[1]), 0, 1);
  const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/i.exec(s);
  if (hex) {
    const h = hex[1] ?? "";
    const aa = h.length === 4 ? `${h[3]}${h[3]}` : h.slice(6, 8);
    return clamp(parseInt(aa, 16) / 255, 0, 1);
  }
  return 1;
}

/**
 * Formats a color with alpha: `#RRGGBB` when opaque, else `rgba(r, g, b, a)`.
 *
 * @param rgb RGB channels (0-255)
 * @param a Alpha in [0, 1]
 * @returns CSS color string
 */
export function formatColor(rgb: Rgb, a: number): string {
  if (a >= 1) return rgbToHex(rgb);
  const ch = (n: number): number => clamp(Math.round(n), 0, 255);
  const alpha = Math.round(clamp(a, 0, 1) * 100) / 100;
  return `rgba(${ch(rgb.r)}, ${ch(rgb.g)}, ${ch(rgb.b)}, ${alpha})`;
}

/**
 * Converts RGB to HSV.
 *
 * @param rgb RGB channels (0-255)
 * @returns HSV components
 */
export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/**
 * Converts HSV to RGB.
 *
 * @param hsv HSV components (h in degrees, s/v in [0,1])
 * @returns RGB channels (0-255)
 */
export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

/**
 * Converts HSV directly to an uppercase `#RRGGBB` hex string.
 *
 * @param hsv HSV components
 * @returns Hex color string
 */
export function hsvToHex(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv));
}
