export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}

export interface ElementSourceLookup {
  componentName?: string;
  source?: SourceLocation;
}

const REACT_FIBER_PREFIX = "__reactFiber$";
const REACT_PROPS_PREFIX = "__reactProps$";
const REACT_INTERNAL_INSTANCE = "_owner";

interface FiberLike {
  type?: { displayName?: string; name?: string } | string;
  _debugSource?: { fileName: string; lineNumber: number; columnNumber?: number };
  _debugOwner?: FiberLike;
  return?: FiberLike;
}

export function lookupReactFiber(el: Element): ElementSourceLookup {
  const fiberKey = Object.keys(el).find((k) =>
    k.startsWith(REACT_FIBER_PREFIX)
  );
  if (!fiberKey) return {};
  const fiber = (el as unknown as Record<string, FiberLike>)[fiberKey];
  if (!fiber) return {};

  let current: FiberLike | undefined = fiber;
  let componentName: string | undefined;
  let source: SourceLocation | undefined;

  while (current) {
    if (typeof current.type === "function" || typeof current.type === "object") {
      const type = current.type as { displayName?: string; name?: string };
      if (type.displayName) {
        componentName = componentName ?? type.displayName;
      } else if (type.name) {
        componentName = componentName ?? type.name;
      }
    }
    if (current._debugSource && !source) {
      source = {
        file: current._debugSource.fileName,
        line: current._debugSource.lineNumber,
        ...(current._debugSource.columnNumber !== undefined
          ? { column: current._debugSource.columnNumber }
          : {}),
      };
    }
    if (componentName && source) break;
    current = current._debugOwner ?? current.return;
  }

  return {
    ...(componentName !== undefined ? { componentName } : {}),
    ...(source !== undefined ? { source } : {}),
  };
}

export async function lookupElementSource(el: Element): Promise<ElementSourceLookup> {
  const react = lookupReactFiber(el);
  if (react.source) return react;

  try {
    const { resolveFromSourceMap } = await import("./source-map-fetch.js");
    const scripts = document.querySelectorAll("script[src]");
    for (const script of scripts) {
      const src = script.getAttribute("src");
      if (!src) continue;
      const url = new URL(src, location.href).href;
      const loc = await resolveFromSourceMap(url, 1, 0);
      if (loc) {
        return {
          componentName: react.componentName,
          source: loc,
        };
      }
    }
  } catch {
    // source map resolution unavailable
  }

  return react;
}

export { REACT_PROPS_PREFIX, REACT_INTERNAL_INSTANCE };
