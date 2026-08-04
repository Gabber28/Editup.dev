import type { ReactNode } from "react";
import { UpdateBanner } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", width: 480 }}>
    {children}
  </div>
);

const noopAsync = async () => {};
const noop = () => {};

export const UpdateAvailable = () => (
  <Frame>
    <UpdateBanner
      updater={{
        update: {
          available: true,
          version: "0.2.0",
          body: "Floating brackets polish + faster plan step",
          current_version: "0.1.0",
        },
        installing: false,
        dismissed: false,
        install: noopAsync,
        dismiss: noop,
      }}
    />
  </Frame>
);

export const Installing = () => (
  <Frame>
    <UpdateBanner
      updater={{
        update: {
          available: true,
          version: "0.2.0",
          body: null,
          current_version: "0.1.0",
        },
        installing: true,
        dismissed: false,
        install: noopAsync,
        dismiss: noop,
      }}
    />
  </Frame>
);
