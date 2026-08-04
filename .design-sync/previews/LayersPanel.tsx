import type { ReactNode } from "react";
import { LayersPanel } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 220 }}>
    {children}
  </div>
);

export const DomTree = () => (
  <Frame>
    <LayersPanel
      activeId="cta"
      onSelect={() => {}}
      nodes={[
        { id: "body", tag: "body", depth: 0 },
        { id: "main", tag: "main", depth: 1 },
        { id: "hero", tag: "section", className: "hero", depth: 2, edited: true },
        { id: "h1", tag: "h1", className: "hero-title", depth: 3 },
        { id: "cta", tag: "button", className: "btn-primary", depth: 3, edited: true },
        { id: "features", tag: "section", className: "features", depth: 2 },
        { id: "card", tag: "div", className: "feature-card", depth: 3 },
      ]}
    />
  </Frame>
);
