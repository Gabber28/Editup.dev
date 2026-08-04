import type { ReactNode } from "react";
import { EffectsPanel } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 280 }}>
    {children}
  </div>
);

export const GlowingButton = () => (
  <Frame>
    <EffectsPanel
      values={{
        opacity: "1",
        "box-shadow": "0 0 24px rgba(168, 85, 247, 0.5)",
        transform: "translateY(-2px)",
        transition: "all 150ms ease",
        cursor: "pointer",
      }}
      onChange={() => {}}
    />
  </Frame>
);
