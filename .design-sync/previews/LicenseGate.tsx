import { LicenseGate } from "editup";

const noopAsync = async () => {};

const baseHook = {
  rateLimit: null,
  error: null,
  activate: noopAsync,
  refresh: noopAsync,
  canApply: () => true,
  canUseExpress: () => true,
};

export const ActivationScreen = () => (
  <div style={{ height: 380, background: "var(--color-bg)", color: "var(--color-fg)" }}>
    <LicenseGate license={{ ...baseHook, status: null, loading: false }}>
      <div />
    </LicenseGate>
  </div>
);

export const ExpiredScreen = () => (
  <div style={{ height: 380, background: "var(--color-bg)", color: "var(--color-fg)" }}>
    <LicenseGate
      license={{
        ...baseHook,
        status: {
          valid: false,
          plan: "pro",
          grace_remaining_days: null,
          last_verified: "2026-06-30T12:00:00Z",
        },
        loading: false,
        error: "License verification failed after grace period.",
      }}
    >
      <div />
    </LicenseGate>
  </div>
);

export const CheckingLicense = () => (
  <div style={{ height: 380, background: "var(--color-bg)", color: "var(--color-fg)" }}>
    <LicenseGate license={{ ...baseHook, status: null, loading: true }}>
      <div />
    </LicenseGate>
  </div>
);
