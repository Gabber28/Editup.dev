import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { RootCheck } from "@/types/project-root.js";

const DEBOUNCE_MS = 500;

export interface ProjectRootCheckState {
  /** Latest verdict, or null while nothing has been typed yet. */
  check: RootCheck | null;
  /** A validation is in flight for the current input. */
  checking: boolean;
}

/**
 * Validates the typed project root against the app running at `origin`, so a
 * wrong folder is caught before it becomes the root every git op and AI prompt
 * is anchored to.
 *
 * @param path project root as typed, revalidated on every change
 * @param origin connected target origin, or null when there is none yet
 * @returns the verdict for the current input and whether a check is running
 */
export function useProjectRootCheck(
  path: string,
  origin: string | null
): ProjectRootCheckState {
  const [check, setCheck] = useState<RootCheck | null>(null);
  const [checking, setChecking] = useState(false);
  // Validations resolve out of order (a missing folder answers instantly, a
  // slow dev server does not); only the newest input may write state.
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = path.trim();
    requestId.current += 1;
    const id = requestId.current;

    if (!trimmed) {
      setCheck(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    const timer = setTimeout(() => {
      invoke<RootCheck>("validate_project_root", {
        path: trimmed,
        origin,
      })
        .then((result) => {
          if (id !== requestId.current) return;
          setCheck(result);
          setChecking(false);
        })
        .catch((err: unknown) => {
          if (id !== requestId.current) return;
          setCheck({ verdict: "unverified", message: String(err) });
          setChecking(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [path, origin]);

  return { check, checking };
}
