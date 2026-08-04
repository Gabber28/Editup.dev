import type { ReactNode } from "react";
import { PanelTabs } from "editup";

// The editor UI assumes the app's dark shell — the frame reproduces it so
// cells don't render light-on-transparent.
const Frame = ({ children, width }: { children: ReactNode; width?: number }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width }}>
    {children}
  </div>
);

export const Labels = () => (
  <Frame>
    <PanelTabs active="colors" onSelect={() => {}} />
  </Frame>
);

export const ActiveTypography = () => (
  <Frame>
    <PanelTabs active="typography" onSelect={() => {}} />
  </Frame>
);

export const IconsOnly = () => (
  <Frame width={244}>
    <PanelTabs active="spacing" onSelect={() => {}} iconsOnly />
  </Frame>
);
