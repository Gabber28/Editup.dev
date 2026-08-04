import type { ReactNode } from "react";
import { TypographyPanel } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 280 }}>
    {children}
  </div>
);

export const HeadingStyles = () => (
  <Frame>
    <TypographyPanel
      values={{
        "font-family": "Geist Sans, sans-serif",
        "font-size": "32px",
        "font-weight": "700",
        "line-height": "1.2",
        "letter-spacing": "-0.02em",
        "text-align": "center",
      }}
      onChange={() => {}}
    />
  </Frame>
);
