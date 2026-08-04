import type { ReactNode } from "react";
import { ApplyBar } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", width: 420 }}>
    {children}
  </div>
);

const noop = () => {};
const handlers = {
  onApply: noop,
  onRevert: noop,
  onToggleExpress: noop,
  onReset: noop,
};

export const ReadyToApply = () => (
  <Frame>
    <ApplyBar
      phase="idle"
      hasChanges
      commitHash={null}
      error={null}
      expressMode={false}
      editsUsed={4}
      editsLimit={15}
      canApply
      canUseExpress
      {...handlers}
    />
  </Frame>
);

export const Applying = () => (
  <Frame>
    <ApplyBar
      phase="executing"
      hasChanges
      commitHash={null}
      error={null}
      expressMode
      canApply
      canUseExpress
      {...handlers}
    />
  </Frame>
);

export const AppliedWithRevert = () => (
  <Frame>
    <ApplyBar
      phase="completed"
      hasChanges={false}
      commitHash="a3f9c21"
      error={null}
      expressMode={false}
      canApply
      canUseExpress
      {...handlers}
    />
  </Frame>
);

export const ErrorState = () => (
  <Frame>
    <ApplyBar
      phase="idle"
      hasChanges
      commitHash={null}
      error={{
        title: "Verification failed",
        message: "background-color diverged from the expected value after 2 correction attempts.",
        hint: "Review the diff or revert the commit.",
        canRetry: true,
      }}
      expressMode={false}
      canApply
      canUseExpress={false}
      {...handlers}
    />
  </Frame>
);
