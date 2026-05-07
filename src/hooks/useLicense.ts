import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger.js";
import type { LicenseStatus, RateLimitState } from "@/types/license.js";

/** Public interface returned by the useLicense hook */
export interface LicenseHook {
  status: LicenseStatus | null;
  rateLimit: RateLimitState | null;
  loading: boolean;
  error: string | null;
  activate(key: string): Promise<void>;
  refresh(): Promise<void>;
  canApply(): boolean;
  canUseExpress(): boolean;
}

const RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * React hook that manages the license state for the UI.
 * Fetches license status and rate limit on mount, re-checks every 24h.
 * @returns LicenseHook with current status, actions, and computed flags
 */
export function useLicense(): LicenseHook {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await invoke<LicenseStatus>("get_license_status");
      setStatus(result);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug("No license found", { reason: msg });
      setStatus(null);
    }
  }, []);

  const fetchRateLimit = useCallback(async () => {
    try {
      const result = await invoke<RateLimitState>("get_rate_limit_state");
      setRateLimit(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("Failed to fetch rate limit", { reason: msg });
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke<LicenseStatus>("check_license");
      setStatus(result);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("License recheck failed", { reason: msg });
    }
    await fetchRateLimit();
  }, [fetchRateLimit]);

  const activate = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<LicenseStatus>("save_license_key", { key });
      setStatus(result);
      await fetchRateLimit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      logger.error("License activation failed", { reason: msg });
    } finally {
      setLoading(false);
    }
  }, [fetchRateLimit]);

  const canApply = useCallback((): boolean => {
    if (!status || !status.valid) return false;
    if (rateLimit && rateLimit.blocked) return false;
    return true;
  }, [status, rateLimit]);

  const canUseExpress = useCallback((): boolean => {
    if (!status || !status.valid) return false;
    return status.plan === "pro" || status.plan === "founders";
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    async function init(): Promise<void> {
      setLoading(true);
      await fetchStatus();
      await fetchRateLimit();
      if (!cancelled) setLoading(false);
    }

    void init();

    intervalRef.current = setInterval(() => {
      void refresh();
    }, RECHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchStatus, fetchRateLimit, refresh]);

  return {
    status,
    rateLimit,
    loading,
    error,
    activate,
    refresh,
    canApply,
    canUseExpress,
  };
}
