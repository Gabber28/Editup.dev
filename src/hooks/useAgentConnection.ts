import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ElementInfo } from "@/types/snapshot.js";

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
  };
  computed_style: Record<string, string>;
}

export interface AgentConnection {
  connected: boolean;
  snapshot: AgentSnapshot | null;
  editing: boolean;
  startEditing: () => Promise<void>;
  stopEditing: () => Promise<void>;
  previewStyle: (property: string, value: string) => Promise<void>;
  resetOverrides: () => Promise<void>;
}

export function useAgentConnection(): AgentConnection {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null);
  const [editing, setEditing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollingRef.current = setInterval(() => {
      invoke<boolean>("get_agent_status").then(setConnected).catch((_: unknown) => {});
    }, 2000);
    return (): void => {
      if (pollingRef.current !== null) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    listen<AgentSnapshot>("agent_snapshot", (event) => {
      setSnapshot(event.payload);
    }).then((fn) => unlisteners.push(fn));

    return (): void => {
      for (const fn of unlisteners) fn();
    };
  }, []);

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
    resetOverrides,
  };
}
