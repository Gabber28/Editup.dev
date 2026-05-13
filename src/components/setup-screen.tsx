import { useState, type JSX } from "react";

export interface SetupScreenProps {
  proxyPort: number;
  agentConnected: boolean;
  onConnect: (url: string, proxyPort: number) => Promise<void>;
  onReady: (projectRoot: string) => void;
  error: string | null;
  loading: boolean;
  targetOrigin: string | null;
}

export function SetupScreen(props: SetupScreenProps): JSX.Element {
  const [url, setUrl] = useState("http://localhost:3000");
  const [projectRoot, setProjectRoot] = useState("");
  const waiting = props.targetOrigin !== null && !props.agentConnected;

  if (props.agentConnected && props.targetOrigin) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <div className="setup-status setup-status--ok">Agent connected</div>
          <input
            className="setup-input"
            type="text"
            value={projectRoot}
            placeholder="C:\Users\you\project (project root path)"
            onChange={(ev): void => setProjectRoot(ev.currentTarget.value)}
          />
          <p className="setup-hint" style={{ margin: "6px 0 12px" }}>
            Path to your project for git ops and AI tools
          </p>
          <button
            type="button"
            className="setup-btn"
            disabled={!projectRoot.trim()}
            onClick={(): void => props.onReady(projectRoot.trim())}
          >
            Start Editing
          </button>
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

        {props.error && (
          <div className="setup-error">{props.error}</div>
        )}

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
            <p className="setup-hint">
              Waiting for the agent to connect...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
