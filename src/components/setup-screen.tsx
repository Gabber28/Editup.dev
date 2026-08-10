import { useState, type JSX } from "react";
import { useProjectRootCheck } from "@/hooks/useProjectRootCheck.js";

export interface SetupScreenProps {
  proxyPort: number;
  agentConnected: boolean;
  onConnect: (url: string, proxyPort: number) => Promise<void>;
  onReady: (projectRoot: string) => void | Promise<void>;
  onCancel: () => void;
  error: string | null;
  loading: boolean;
  targetOrigin: string | null;
}

export function SetupScreen(props: SetupScreenProps): JSX.Element {
  const [url, setUrl] = useState("http://localhost:3000");
  const [projectRoot, setProjectRoot] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const root = useProjectRootCheck(projectRoot, props.targetOrigin);
  const waiting = props.targetOrigin !== null && !props.agentConnected;

  if (props.agentConnected && props.targetOrigin) {
    // The banner is the only place the root verdict can show: a folder that is
    // missing — or belongs to another project — must not read as a plain green
    // "connected" while Start Editing quietly refuses to do anything. It sits
    // right above the button it gates, and stays hidden until a root is typed.
    const typed = projectRoot.trim().length > 0;
    const rootWarn =
      !root.checking && root.check !== null && root.check.verdict !== "ok";
    const statusClass = root.checking
      ? "setup-status--busy"
      : rootWarn
        ? "setup-status--warn"
        : "setup-status--ok";
    const statusText = root.checking
      ? "Checking project root..."
      : rootWarn
        ? (root.check?.message ?? "")
        : "Agent connected";

    const start = (): void => {
      setStartError(null);
      void (async (): Promise<void> => {
        try {
          await props.onReady(projectRoot.trim());
        } catch (err: unknown) {
          setStartError(String(err));
        }
      })();
    };

    return (
      <div className="setup-screen">
        <div className="setup-card">
          <h1 className="setup-title">Project root</h1>
          <p className="setup-subtitle setup-subtitle--tight">
            Add the root folder of the project running at {props.targetOrigin}
          </p>
          <input
            className="setup-input"
            type="text"
            value={projectRoot}
            placeholder="C:\Users\you\project (project root path)"
            onChange={(ev): void => setProjectRoot(ev.currentTarget.value)}
          />
          <p className="setup-hint" style={{ margin: "6px 0 12px" }}>
            Used for git ops and AI tools
          </p>
          {typed && (
            <div className={`setup-status ${statusClass}`} role="status">
              {statusText}
            </div>
          )}
          <button
            type="button"
            className="setup-btn"
            disabled={
              !projectRoot.trim() || root.check?.verdict === "not_found"
            }
            onClick={start}
          >
            Start Editing
          </button>
          {startError && <div className="setup-error">{startError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1 className="setup-title">EditUp</h1>
        <p className="setup-subtitle">
          Enter your local dev server URL to get started.
        </p>

        <form
          className="setup-form"
          onSubmit={(ev): void => {
            ev.preventDefault();
            if (!url.trim() || props.loading) return;
            props.onConnect(url.trim(), props.proxyPort);
          }}
        >
          <input
            className="setup-input"
            type="text"
            value={url}
            placeholder="http://localhost:3000"
            onChange={(ev): void => setUrl(ev.currentTarget.value)}
            disabled={props.loading || waiting}
          />
          <button
            type="submit"
            className="setup-btn"
            disabled={props.loading || waiting || !url.trim()}
          >
            {props.loading ? "Connecting..." : "Connect"}
          </button>
        </form>

        {props.error && <div className="setup-error">{props.error}</div>}

        {waiting && (
          <div className="setup-waiting">
            <div className="setup-spinner" />
            <p>
              Open{" "}
              <code className="setup-url">
                http://localhost:{props.proxyPort}
              </code>{" "}
              in your browser
            </p>
            <p className="setup-hint">Waiting for the agent to connect...</p>
            <button
              type="button"
              className="setup-btn setup-btn--ghost"
              onClick={props.onCancel}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
