import type { ReactNode } from "react";
import { SpacingPanel } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 280 }}>
    {children}
  </div>
);

export const EditedElement = () => (
  <Frame>
    <SpacingPanel
      values={{
        "margin-top": "0px",
        "margin-bottom": "24px",
        "padding-top": "12px",
        "padding-right": "20px",
        "padding-bottom": "12px",
        "padding-left": "20px",
        width: "auto",
        "max-width": "480px",
        gap: "8px",
      }}
      onChange={() => {}}
    />
  </Frame>
);
