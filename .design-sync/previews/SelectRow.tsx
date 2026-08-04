import type { ReactNode } from "react";
import { SelectRow } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 280 }}>
    {children}
  </div>
);

export const FontWeight = () => (
  <Frame>
    <SelectRow
      label="Weight"
      value="600"
      options={["100", "200", "300", "400", "500", "600", "700", "800", "900"]}
      onChange={() => {}}
    />
  </Frame>
);

export const Display = () => (
  <Frame>
    <SelectRow
      label="Display"
      value="flex"
      options={["block", "flex", "grid", "inline", "inline-block", "none"]}
      onChange={() => {}}
    />
  </Frame>
);
