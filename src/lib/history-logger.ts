import { invoke } from "@tauri-apps/api/core";

/** Mirrors the Rust `HistoryEntry` struct for Tauri IPC. */
export interface HistoryEntry {
  timestamp: string;
  project_root: string;
  element_tag: string;
  element_classes: string[];
  plan_summary: string;
  plan_files_count: number;
  plan_confidence: string;
  side_effects_count: number;
  user_approved: boolean;
  approval_mode: string;
  ai_adapter_used: string;
  files_modified: string[];
  duration_ms: number;
  verification_visual: string;
  verification_scope: string;
  verification_diff: string;
  correction_attempts: number;
  git_commit: string | null;
  status: string;
}

/**
 * Persists a completed apply flow entry to ~/.editup/history/.
 * @param entry - The history entry to record
 * @returns Resolves when the entry has been written
 */
export async function recordApply(entry: HistoryEntry): Promise<void> {
  await invoke("write_history_entry", { entry });
}

/**
 * Reads recent history entries, newest first.
 * @param limit - Maximum number of entries to return (default 50)
 * @returns Array of history entries
 */
export async function readHistory(
  limit?: number,
): Promise<HistoryEntry[]> {
  return invoke<HistoryEntry[]>("read_history", {
    limit: limit ?? null,
  });
}
