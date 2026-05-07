import { useState, useEffect, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  readHistory,
  type HistoryEntry,
} from "@/lib/history-logger.js";
import { logger } from "@/lib/logger.js";

/** Badge color class by status. */
function statusClass(status: string): string {
  if (status === "completed") return "history-badge--ok";
  if (status === "failed") return "history-badge--err";
  return "history-badge--warn";
}

/** Formats an ISO timestamp to a short local representation. */
function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface EntryRowProps {
  entry: HistoryEntry;
  onRevert: (hash: string) => void;
  reverting: boolean;
}

function EntryRow({ entry, onRevert, reverting }: EntryRowProps): JSX.Element {
  const hash = entry.git_commit;
  return (
    <div className="history-row">
      <div className="history-row__header">
        <span className="history-row__time">{shortDate(entry.timestamp)}</span>
        <span className={`history-badge ${statusClass(entry.status)}`}>
          {entry.status}
        </span>
      </div>
      <p className="history-row__summary">{entry.plan_summary}</p>
      <div className="history-row__meta">
        <span>{entry.plan_files_count} file(s)</span>
        <span>{entry.ai_adapter_used}</span>
        <span>{entry.duration_ms}ms</span>
      </div>
      {hash && (
        <button
          className="history-row__revert"
          disabled={reverting}
          onClick={() => onRevert(hash)}
        >
          Revert
        </button>
      )}
    </div>
  );
}

/**
 * Panel displaying recent apply history with per-entry revert.
 * @returns History panel element
 */
export function HistoryPanel(): JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readHistory(50)
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRevert = useCallback(async (hash: string) => {
    setReverting(true);
    try {
      await invoke("git_revert");
      logger.info("Reverted commit", { hash });
      const fresh = await readHistory(50);
      setEntries(fresh);
    } catch (err: unknown) {
      setError(
        `Revert failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setReverting(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="history-panel">
        <div className="history-panel__empty">Loading history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-panel">
        <div className="history-panel__error">{error}</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="history-panel">
        <div className="history-panel__empty">No edits recorded yet.</div>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <h3 className="history-panel__title">Edit History</h3>
      <div className="history-panel__list">
        {entries.map((e, i) => (
          <EntryRow
            key={`${e.timestamp}-${i}`}
            entry={e}
            onRevert={handleRevert}
            reverting={reverting}
          />
        ))}
      </div>
    </div>
  );
}
