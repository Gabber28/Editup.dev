import type { ReactNode } from "react";
import { SectionLabel, PropRow } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 280 }}>
    {children}
  </div>
);

export const AboveRows = () => (
  <Frame>
    <SectionLabel>Margin</SectionLabel>
    <PropRow label="Top" value="8px" onChange={() => {}} />
    <PropRow label="Bottom" value="16px" onChange={() => {}} />
  </Frame>
);
