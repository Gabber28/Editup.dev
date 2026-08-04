import type { ReactNode } from "react";
import { StateSelector } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", width: 420 }}>
    {children}
  </div>
);

export const HoverActive = () => (
  <Frame>
    <StateSelector
      availableStates={["default", ":hover", ":focus", ":active"]}
      active=":hover"
      onSelect={() => {}}
    />
  </Frame>
);

export const ManyStates = () => (
  <Frame>
    <StateSelector
      availableStates={["default", ":hover", ":focus", ":focus-visible", ":disabled", ":checked"]}
      active="default"
      onSelect={() => {}}
    />
  </Frame>
);
