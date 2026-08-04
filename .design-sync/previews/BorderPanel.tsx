import type { ReactNode } from "react";
import { BorderPanel } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 280 }}>
    {children}
  </div>
);

export const RoundedCard = () => (
  <Frame>
    <BorderPanel
      values={{
        "border-top-width": "1px",
        "border-top-style": "solid",
        "border-top-color": "#27272a",
        "border-top-left-radius": "8px",
        "border-top-right-radius": "8px",
        "border-bottom-right-radius": "8px",
        "border-bottom-left-radius": "8px",
      }}
      onChange={() => {}}
    />
  </Frame>
);
