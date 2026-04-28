import type { JSX } from "react";

export interface CodeBoxProps {
  source?: string;
  file?: string;
  line?: number;
  collapsed?: boolean;
}

export function CodeBox(props: CodeBoxProps): JSX.Element | null {
  if (!props.source) return null;
  return (
    <div className="code-box">
      {props.file && (
        <div style={{ color: "var(--color-muted)", marginBottom: 4 }}>
          {props.file}:{props.line ?? "?"}
        </div>
      )}
      <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{props.source}</pre>
    </div>
  );
}
