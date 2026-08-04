import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface TargetOriginState {
  origin: string | null;
  loading: boolean;
  error: string | null;
  connect: (url: string, proxyPort: number) => Promise<void>;
  reset: () => void;
}

export function useTargetOrigin(): TargetOriginState {
  const [origin, setOrigin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (url: string, proxyPort: number) => {
    setLoading(true);
    setError(null);
    try {
      // Confirm a dev server is actually listening before committing to this
      // origin. Without this, an unreachable port sets the target anyway and
      // the setup screen spins on "waiting for agent" forever.
      await invoke("check_target_reachable", { origin: url });
      await invoke("set_target_origin", { origin: url });
      setOrigin(url);
      await invoke("open_in_browser", {
        url: `http://localhost:${proxyPort}`,
      });
    } catch (err: unknown) {
      setError(String(err));
      setOrigin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setOrigin(null);
    setError(null);
    setLoading(false);
  }, []);

  return { origin, loading, error, connect, reset };
}
