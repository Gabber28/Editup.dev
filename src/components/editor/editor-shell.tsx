import { type ReactNode, type JSX } from "react";
import { useResponsiveMode } from "../../hooks/useResponsiveMode.js";

export interface EditorShellProps {
  layers: ReactNode;
  identity: ReactNode;
  tabs: ReactNode;
  panel: ReactNode;
  codeBox: ReactNode;
  progress: ReactNode;
  aiInput: ReactNode;
}

export function EditorShell(props: EditorShellProps): JSX.Element {
  const mode = useResponsiveMode();
  return (
    <div className={`editor-shell editor-shell--${mode}`} data-mode={mode}>
      <div className="editor-shell__body">
        {mode === "wide" && (
          <aside className="layers-panel">{props.layers}</aside>
        )}
        <main className="editor-main">
          {props.identity}
          {props.tabs}
          <div className="panel-content">{props.panel}</div>
          {mode !== "narrow" && props.codeBox}
          {props.progress}
          {props.aiInput}
        </main>
      </div>
    </div>
  );
}
