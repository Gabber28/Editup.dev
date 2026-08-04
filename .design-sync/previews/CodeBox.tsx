import type { ReactNode } from "react";
import { CodeBox } from "editup";

// The editor UI assumes the app's dark shell — the frame reproduces it so
// cells don't render light-on-transparent.
const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--color-bg)", color: "var(--color-fg)", padding: 12 }}>
    {children}
  </div>
);

export const WithSourceLocation = () => (
  <Frame>
    <CodeBox
      file="src/components/pricing-card.tsx"
      line={42}
      source={`<button className="btn btn-primary" onClick={onSubscribe}>
  Subscribe now
</button>`}
    />
  </Frame>
);

export const SnippetOnly = () => (
  <Frame>
    <CodeBox
      source={`.btn-primary {
  background: linear-gradient(to right, #7c3aed, #a855f7);
  border-radius: 9999px;
  padding: 8px 20px;
}`}
    />
  </Frame>
);
