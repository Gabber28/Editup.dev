import { useState, useMemo, useEffect } from "react";
import type { PseudoState } from "@/types/snapshot.js";
import type { AgentSnapshot } from "./useAgentConnection.js";

export interface PseudoStateHook {
  activeState: PseudoState;
  setActiveState: (s: PseudoState) => void;
  availableStates: PseudoState[];
  mergedValues: Record<string, string>;
}

export function usePseudoState(
  snapshot: AgentSnapshot | null,
  cachedSnapshot: AgentSnapshot | null,
  elementOverrides: Record<string, Record<string, string>>,
): PseudoStateHook {
  const [activeState, setActiveState] = useState<PseudoState>("default");

  useEffect(() => {
    setActiveState("default");
  }, [snapshot?.element.tag, snapshot?.element.id]);

  const availableStates = useMemo<PseudoState[]>(() => {
    const states = new Set<PseudoState>(["default"]);
    const rules = snapshot?.styling.pseudo_rules ?? [];
    for (const r of rules) {
      states.add(r.pseudo as PseudoState);
    }
    return Array.from(states);
  }, [snapshot?.styling.pseudo_rules]);

  const pseudoBase = useMemo<Record<string, string>>(() => {
    if (activeState === "default") return {};
    const rules = snapshot?.styling.pseudo_rules ?? [];
    const merged: Record<string, string> = {};
    for (const r of rules) {
      if (r.pseudo === activeState) {
        Object.assign(merged, r.properties);
      }
    }
    return merged;
  }, [activeState, snapshot?.styling.pseudo_rules]);

  const currentOverrides = useMemo(
    () => elementOverrides[activeState] ?? {},
    [elementOverrides, activeState],
  );

  const mergedValues = useMemo(() => {
    const base = cachedSnapshot?.base_computed_style ?? cachedSnapshot?.computed_style ?? {};
    return { ...base, ...pseudoBase, ...currentOverrides };
  }, [cachedSnapshot?.computed_style, pseudoBase, currentOverrides]);

  return { activeState, setActiveState, availableStates, mergedValues };
}
