import type { ReactNode } from "react";
import { LayoutPanel } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 280 }}>
    {children}
  </div>
);

export const FlexCentered = () => (
  <Frame>
    <LayoutPanel
      values={{
        display: "flex",
        "flex-direction": "row",
        "justify-content": "center",
        "align-items": "center",
        position: "relative",
        "z-index": "10",
      }}
      onChange={() => {}}
    />
  </Frame>
);
