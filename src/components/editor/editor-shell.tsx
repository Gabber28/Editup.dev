import { type ReactNode, type JSX } from "react";
import { useResponsiveMode } from "../../hooks/useResponsiveMode.js";

export interface EditorShellProps {
  banner?: ReactNode;
  layers: ReactNode;
  identity: ReactNode;
  inspector: ReactNode;
  progress: ReactNode;
  aiInput: ReactNode;
  applyBar: ReactNode;
  toast?: ReactNode;
}

export function EditorShell(props: EditorShellProps): JSX.Element {
  const mode = useResponsiveMode();
  return (
    <div className={`editor-shell editor-shell--${mode}`} data-mode={mode}>
      {props.banner}
      <div className="editor-shell__body">
        {mode === "wide" && (
          <aside className="layers-panel">{props.layers}</aside>
        )}
        <main className="editor-main">
          {props.identity}
          {props.inspector}
          <div className="editor-footer">
            {props.progress}
            {props.aiInput}
            {props.applyBar}
          </div>
        </main>
      </div>
      {props.toast}
    </div>
  );
}
