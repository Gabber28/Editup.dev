import type { EnrichedSnapshot } from "@/types/snapshot.js";

export interface ElementSnapshot {
  selector: string;
  classes: string[];
  componentSource?: string;
  preEditComputed: Record<string, string>;
  postEditComputed: Record<string, string>;
}

export interface ScopeCheckInput {
  snapshot: EnrichedSnapshot;
  declaredSideEffects: string[];
  relatedElements: ElementSnapshot[];
}

export interface ScopeCheckResult {
  status: "pass" | "warn" | "fail";
  expectedChanges: ElementSnapshot[];
  unexpectedChanges: ElementSnapshot[];
}

export function checkScope(input: ScopeCheckInput): ScopeCheckResult {
  const watchedProps = new Set(
    input.snapshot.changes.map((c) => c.property)
  );

  const changed = input.relatedElements.filter((el) => {
    for (const prop of watchedProps) {
      const before = el.preEditComputed[prop];
      const after = el.postEditComputed[prop];
      if (before !== after) return true;
    }
    return false;
  });

  const sideEffectKeywords = input.declaredSideEffects
    .map((se) => se.toLowerCase())
    .join(" ");

  const expected: ElementSnapshot[] = [];
  const unexpected: ElementSnapshot[] = [];

  for (const el of changed) {
    const matchesDeclared = elementMentionedInSideEffects(
      el,
      sideEffectKeywords
    );
    if (matchesDeclared) {
      expected.push(el);
    } else {
      unexpected.push(el);
    }
  }

  const status: ScopeCheckResult["status"] =
    unexpected.length > 0 ? "fail" : "pass";

  return {
    status,
    expectedChanges: expected,
    unexpectedChanges: unexpected,
  };
}

function elementMentionedInSideEffects(
  el: ElementSnapshot,
  sideEffectsText: string
): boolean {
  if (!sideEffectsText) return false;
  for (const cls of el.classes) {
    if (sideEffectsText.includes(cls.toLowerCase())) return true;
  }
  if (
    el.componentSource &&
    sideEffectsText.includes(el.componentSource.toLowerCase())
  ) {
    return true;
  }
  return false;
}
