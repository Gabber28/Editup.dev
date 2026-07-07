import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ElementInfo, PseudoStateRule } from "@/types/snapshot.js";

export interface AgentSnapshot {
  element: ElementInfo;
  styling: {
    framework: string;
    class_to_rule_map: Record<
      string,
      { source_file: string; rule_text: string; line_number: number }
    >;
    active_css_variables: Record<
      string,
      { value: string; declared_in: string }
    >;
    pseudo_rules?: PseudoStateRule[];
  };
  computed_style: Record<string, string>;
  base_computed_style?: Record<string, string>;
}

export interface AgentConnection {
  connected: boolean;
  snapshot: AgentSnapshot | null;
  editing: boolean;
  startEditing: () => Promise<void>;
  stopEditing: () => Promise<void>;
  previewStyle: (property: string, value: string) => Promise<void>;
  previewPseudoStyle: (property: string, value: string, pseudo: string) => Promise<void>;
  resetOverrides: () => Promise<void>;
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
    resetOverrides,
  };
}
