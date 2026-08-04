import type { ReactNode } from "react";
import { ElementIdentity } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", width: 420 }}>
    {children}
  </div>
);

export const SelectedElement = () => (
  <Frame>
    <ElementIdentity
      element={{
        tag: "button",
        classes: ["btn-primary", "cta"],
        source_file: "src/components/pricing-card.tsx",
        source_line: 42,
      }}
    />
  </Frame>
);

export const NoSelection = () => (
  <Frame>
    <ElementIdentity element={null} />
  </Frame>
);
