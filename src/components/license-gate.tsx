import { useState, type JSX, type ReactNode } from "react";
import type { LicenseHook } from "@/hooks/useLicense.js";

export interface LicenseGateProps {
  children: ReactNode;
  license: LicenseHook;
}

/**
 * Wraps app content and handles license activation/expiration states.
 * Shows activation screen when no license exists, expiration screen
 * when license is invalid, or renders children when valid.
 * @param props - LicenseGateProps with children and license hook
 * @returns JSX element based on license state
 */
export function LicenseGate(props: LicenseGateProps): JSX.Element {
  const { children, license } = props;

  if (license.loading) {
    return <LoadingScreen />;
  }

  if (license.status === null) {
    return (
      <ActivationScreen
        onActivate={license.activate}
        loading={license.loading}
        error={license.error}
      />
    );
  }

  if (!license.status.valid && license.status.grace_remaining_days === null) {
    return (
      <ExpiredScreen
        onRetry={license.refresh}
        onReenter={(): void => {
          /* Reset handled by parent re-render after new activation */
        }}
        error={license.error}
      />
    );
  }

  return <>{children}</>;
}

function LoadingScreen(): JSX.Element {
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-spinner" />
        <p className="setup-subtitle">Checking license...</p>
      </div>
    </div>
  );
}

interface ActivationScreenProps {
  onActivate: (key: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

function ActivationScreen(props: ActivationScreenProps): JSX.Element {
  const [key, setKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (!key.trim() || submitting) return;
    setSubmitting(true);
    await props.onActivate(key.trim());
    setSubmitting(false);
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1 className="setup-title">EditUp</h1>
        <p className="setup-subtitle">
          Enter your license key to get started.
        </p>

        <form
          className="setup-form"
          onSubmit={(ev): void => {
            ev.preventDefault();
            void handleSubmit();
          }}
        >
          <input
            className="setup-input"
            type="text"
            value={key}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            onChange={(ev): void => setKey(ev.currentTarget.value)}
            disabled={submitting}
          />
          <button
            type="submit"
            className="setup-btn"
            disabled={!key.trim() || submitting}
          >
            {submitting ? "Activating..." : "Activate"}
          </button>
        </form>

        {props.error && (
          <div className="setup-error">{props.error}</div>
        )}

        <p className="setup-hint" style={{ marginTop: 16 }}>
          Get a license key at{" "}
          <a
            href="https://editup.dev"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-accent-light)" }}
          >
            editup.dev
          </a>
        </p>
      </div>
    </div>
  );
}

interface ExpiredScreenProps {
  onRetry: () => Promise<void>;
  onReenter: () => void;
  error: string | null;
}

function ExpiredScreen(props: ExpiredScreenProps): JSX.Element {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async (): Promise<void> => {
    setRetrying(true);
    await props.onRetry();
    setRetrying(false);
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1 className="setup-title">License Expired</h1>
        <p className="setup-subtitle">
          Your license is no longer valid. Please renew or enter a new key.
        </p>

        <div className="setup-form">
          <button
            type="button"
            className="setup-btn"
            disabled={retrying}
            onClick={(): void => { void handleRetry(); }}
          >
            {retrying ? "Checking..." : "Retry Verification"}
          </button>
        </div>

        {props.error && (
          <div className="setup-error">{props.error}</div>
        )}

        <p className="setup-hint" style={{ marginTop: 16 }}>
          Need a new key?{" "}
          <a
            href="https://editup.dev"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-accent-light)" }}
          >
            Visit editup.dev
          </a>
        </p>
      </div>
    </div>
  );
}
