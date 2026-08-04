import type { ReactNode } from "react";
import { PropRow } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 280 }}>
    {children}
  </div>
);

export const TextValue = () => (
  <Frame>
    <PropRow label="Font Size" value="16px" onChange={() => {}} />
  </Frame>
);

export const LongValue = () => (
  <Frame>
    <PropRow
      label="Box Shadow"
      value="0 4px 12px rgba(124, 58, 237, 0.4)"
      onChange={() => {}}
    />
  </Frame>
);
