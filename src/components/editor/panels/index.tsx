export { ColorsPanel } from "./colors-panel.js";

import type { JSX } from "react";

export function PlaceholderPanel({
  title,
  properties,
}: {
  title: string;
  properties: string[];
}): JSX.Element {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--color-muted)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <ul style={{ paddingLeft: 16, margin: 0, fontSize: 11 }}>
        {properties.map((p) => (
          <li key={p} style={{ color: "var(--color-muted)" }}>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
