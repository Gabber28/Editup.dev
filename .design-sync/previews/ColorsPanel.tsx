import type { ReactNode } from "react";
import { ColorsPanel } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 280 }}>
    {children}
  </div>
);

export const WithValues = () => (
  <Frame>
    <ColorsPanel
      values={{ "background-color": "#7c3aed", color: "#f5f5f5" }}
      onChange={() => {}}
    />
  </Frame>
);

export const Empty = () => (
  <Frame>
    <ColorsPanel values={{}} onChange={() => {}} />
  </Frame>
);
