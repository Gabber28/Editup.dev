import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ElementInfo, PseudoStateRule, MatchingRule } from "@/types/snapshot.js";

/** A drag finished in the page; the effect is already applied there. */
export interface GestureChangeEvent {
  id: number;
  changes: Array<{ property: string; value: string }>;
}

export type DragMode = "snap" | "free";

export interface AgentSnapshot {
  element: ElementInfo;
  styling: {
    framework: string;
    class_to_rule_map: Record<
      string,
      {
        source_file: string;
        rule_text: string;
        line_number: number;
        match_count?: number;
      }
    >;
    active_css_variables: Record<
      string,
      { value: string; declared_in: string }
    >;
    pseudo_rules?: PseudoStateRule[];
    matching_rules?: MatchingRule[];
  };
  computed_style: Record<string, string>;
  base_computed_style?: Record<string, string>;
  /** True on the snapshot captured after a verification reload (no live previews). */
  verification?: boolean;
}

export interface AgentConnection {
  connected: boolean;
  snapshot: AgentSnapshot | null;
  editing: boolean;
  startEditing: () => Promise<void>;
  stopEditing: () => Promise<void>;
  previewStyle: (property: string, value: string) => Promise<void>;
  previewPseudoStyle: (property: string, value: string, pseudo: string) => Promise<void>;
  setDragMode: (mode: DragMode) => Promise<void>;
  resetOverrides: () => Promise<void>;
}

/**
 * Subscribes to drags finished in the page.
 *
 * @param onGesture Receives each gesture's changes, already applied in the page
 * @param enabled Whether the agent connection is live
 */
export function useGestureChanges(
  onGesture: (ev: GestureChangeEvent) => void,
  enabled: boolean,
): void {
  const handlerRef = useRef(onGesture);
  handlerRef.current = onGesture;

  useEffect(() => {
    if (!enabled) return;
    let unlisten: (() => void) | null = null;
    let disposed = false;
    let lastId = 0;

    void listen<GestureChangeEvent>("agent_gesture_change", (ev) => {
      const payload = ev.payload;
      if (!payload || payload.id <= lastId) return;
      lastId = payload.id;
      handlerRef.current(payload);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });

    return (): void => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [enabled]);
}

export function useAgentConnection(enabled = false): AgentConnection {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null);
  const [editing, setEditing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    pollingRef.current = setInterval(() => {
      invoke<boolean>("get_agent_status").then(setConnected).catch((_: unknown) => {});
    }, 2000);
    return (): void => {
      if (pollingRef.current !== null) clearInterval(pollingRef.current);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    snapshotRef.current = setInterval(() => {
      invoke<AgentSnapshot | null>("get_latest_snapshot")
        .then((snap) => {
          if (snap) setSnapshot(snap);
        })
        .catch((_: unknown) => {});
    }, 300);
    return (): void => {
      if (snapshotRef.current !== null) clearInterval(snapshotRef.current);
    };
  }, [enabled]);

  const startEditing = useCallback(async () => {
    await invoke("start_editing");
    setEditing(true);
  }, []);

  const stopEditing = useCallback(async () => {
    await invoke("stop_editing");
    setEditing(false);
  }, []);

  const previewStyle = useCallback(
    async (property: string, value: string) => {
      await invoke("preview_style", { property, value });
    },
    [],
  );

  const previewPseudoStyle = useCallback(
    async (property: string, value: string, pseudo: string) => {
      await invoke("preview_pseudo_style", { property, value, pseudo });
    },
    [],
  );

  const setDragMode = useCallback(async (mode: DragMode) => {
    await invoke("set_drag_mode", { mode });
  }, []);

  const resetOverrides = useCallback(async () => {
    await invoke("reset_overrides");
  }, []);

  return {
    connected,
    snapshot,
    editing,
    startEditing,
    stopEditing,
    previewStyle,
    previewPseudoStyle,
    setDragMode,
    resetOverrides,
  };
}
