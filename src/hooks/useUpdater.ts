import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger.js";

export interface UpdateInfo {
  available: boolean;
  version: string;
  body: string | null;
  current_version: string;
}

export interface UpdaterHook {
  update: UpdateInfo | null;
  installing: boolean;
  dismissed: boolean;
  install(): Promise<void>;
  dismiss(): void;
}

const CHECK_DELAY_MS = 5_000;

/**
 * Checks for app updates on mount and exposes install/dismiss actions.
 * @returns UpdaterHook with current update state and actions
 */
export function useUpdater(): UpdaterHook {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    const timer = setTimeout(async () => {
      try {
        const info = await invoke<UpdateInfo>("check_for_update");
        if (info.available) {
          setUpdate(info);
          logger.info("Update available", { version: info.version });
        }
      } catch (err: unknown) {
        logger.debug("Update check skipped", {
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }, CHECK_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const install = useCallback(async () => {
    setInstalling(true);
    try {
      await invoke("install_update");
    } catch (err: unknown) {
      logger.error("Update install failed", {
        reason: err instanceof Error ? err.message : String(err),
      });
      setInstalling(false);
    }
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return { update, installing, dismissed, install, dismiss };
}
