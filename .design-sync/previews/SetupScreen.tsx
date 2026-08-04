import { SetupScreen } from "editup";

const noopAsync = async () => {};
const noop = () => {};

export const ConnectPrompt = () => (
  <div style={{ height: 420, background: "var(--color-bg)", color: "var(--color-fg)" }}>
    <SetupScreen
      proxyPort={4400}
      agentConnected={false}
      onConnect={noopAsync}
      onReady={noop}
      error={null}
      loading={false}
      targetOrigin={null}
    />
  </div>
);

export const WaitingForAgent = () => (
  <div style={{ height: 420, background: "var(--color-bg)", color: "var(--color-fg)" }}>
    <SetupScreen
      proxyPort={4400}
      agentConnected={false}
      onConnect={noopAsync}
      onReady={noop}
      error={null}
      loading={false}
      targetOrigin="http://localhost:3000"
    />
  </div>
);

export const AgentConnected = () => (
  <div style={{ height: 420, background: "var(--color-bg)", color: "var(--color-fg)" }}>
    <SetupScreen
      proxyPort={4400}
      agentConnected
      onConnect={noopAsync}
      onReady={noop}
      error={null}
      loading={false}
      targetOrigin="http://localhost:3000"
    />
  </div>
);
