import type { ReactNode } from "react";
import { ProgressMarker } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", width: 420 }}>
    {children}
  </div>
);

export const MixedProgress = () => (
  <Frame>
    <ProgressMarker
      items={[
        { label: "hero", done: true },
        { label: "cta", done: true },
        { label: "pricing", done: false },
        { label: "footer", done: false },
      ]}
    />
  </Frame>
);
