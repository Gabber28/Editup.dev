import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import type { SourceLocation } from "./source-map.js";

const mapCache = new Map<string, TraceMap | null>();

/**
 * Extract sourceMappingURL from raw source text.
 * Supports both inline data URIs and external file references.
 * @param sourceText - raw content of a JS or CSS file
 * @returns the sourceMappingURL value, or null
 */
function extractMappingUrl(sourceText: string): string | null {
  const pattern =
    /\/[*/][@#]\s*sourceMappingURL=([^\s*]+)\s*(?:\*\/)?$/m;
  const match = pattern.exec(sourceText);
  return match?.[1] ?? null;
}

/**
 * Resolve a potentially relative source map URL against a base URL.
 * @param base - the URL of the script or stylesheet
 * @param mapUrl - the raw sourceMappingURL value
 * @returns fully resolved URL string
 */
function resolveMapUrl(base: string, mapUrl: string): string {
  if (mapUrl.startsWith("data:")) return mapUrl;
  try {
    return new URL(mapUrl, base).href;
  } catch {
    return mapUrl;
  }
}

/**
 * Parse raw source map JSON (or data URI) into a TraceMap.
 * @param raw - JSON string or data URI containing the source map
 * @returns a TraceMap instance
 */
function parseMapContent(raw: string): TraceMap {
  if (raw.startsWith("data:")) {
    const commaIdx = raw.indexOf(",");
    const encoded = raw.slice(commaIdx + 1);
    const isBase64 = raw.slice(0, commaIdx).includes(";base64");
    const json = isBase64 ? atob(encoded) : decodeURIComponent(encoded);
    return new TraceMap(json);
  }
  return new TraceMap(raw);
}

/**
 * Fetch and parse a source map for a given script/stylesheet URL.
 * Results are cached so each URL is fetched at most once.
 * @param url - URL of the script or stylesheet
 * @returns TraceMap instance, or null if unavailable
 */
export async function fetchSourceMap(
  url: string
): Promise<TraceMap | null> {
  if (mapCache.has(url)) return mapCache.get(url) ?? null;

  try {
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) {
      mapCache.set(url, null);
      return null;
    }
    const text = await resp.text();
    const mappingUrl = extractMappingUrl(text);
    if (!mappingUrl) {
      mapCache.set(url, null);
      return null;
    }

    const resolved = resolveMapUrl(url, mappingUrl);
    let map: TraceMap;
    if (resolved.startsWith("data:")) {
      map = parseMapContent(resolved);
    } else {
      const mapResp = await fetch(resolved, { credentials: "same-origin" });
      if (!mapResp.ok) {
        mapCache.set(url, null);
        return null;
      }
      map = parseMapContent(await mapResp.text());
    }
    mapCache.set(url, map);
    return map;
  } catch {
    mapCache.set(url, null);
    return null;
  }
}

/**
 * Resolve a generated position back to its original source location.
 * @param scriptUrl - URL of the generated script
 * @param line - 1-based line number in the generated file
 * @param col - 0-based column number in the generated file
 * @returns original SourceLocation or null
 */
export async function resolveFromSourceMap(
  scriptUrl: string,
  line: number,
  col: number
): Promise<SourceLocation | null> {
  const map = await fetchSourceMap(scriptUrl);
  if (!map) return null;

  const pos = originalPositionFor(map, { line, column: col });
  if (!pos.source || pos.line == null) return null;

  return {
    file: pos.source,
    line: pos.line,
    ...(pos.column != null ? { column: pos.column } : {}),
  };
}

/**
 * Find the sourceMappingURL comment in a CSSStyleSheet.
 * Iterates cssRules to locate the last comment-like rule or
 * falls back to fetching the href and scanning the raw text.
 * @param sheet - a CSSStyleSheet from document.styleSheets
 * @returns the stylesheet URL if a source map is reachable, or null
 */
export async function findCssSourceMapUrl(
  sheet: CSSStyleSheet
): Promise<string | null> {
  if (!sheet.href) return null;
  const map = await fetchSourceMap(sheet.href);
  return map ? sheet.href : null;
}

/**
 * Check whether a TraceMap contains webpack:// sources.
 * @param url - URL of the script whose source map to inspect
 * @returns true if any source path starts with webpack://
 */
export async function isWebpackSource(url: string): Promise<boolean> {
  const map = await fetchSourceMap(url);
  if (!map) return false;
  const decoded = map as TraceMap & { sources?: string[] };
  const sources: readonly string[] =
    (decoded as unknown as { sources?: string[] }).sources ?? [];
  return sources.some((s: string) => s.startsWith("webpack://"));
}

/**
 * Clear the source map cache. Useful for testing or when
 * the user's dev server has restarted.
 */
export function clearMapCache(): void {
  mapCache.clear();
}
