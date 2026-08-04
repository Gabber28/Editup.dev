import type { ReactNode } from "react";
import { AIInput } from "editup";

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12, width: 420 }}>
    {children}
  </div>
);

export const DefaultPlaceholder = () => (
  <Frame>
    <AIInput onSubmit={() => {}} />
  </Frame>
);

export const CustomPlaceholder = () => (
  <Frame>
    <AIInput placeholder="Ask AI: make this section pop on mobile" onSubmit={() => {}} />
  </Frame>
);
