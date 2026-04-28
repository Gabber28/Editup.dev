import { useState, type JSX } from "react";
import { EditorShell } from "./components/editor/editor-shell.js";
import { ElementIdentity } from "./components/editor/element-identity.js";
import {
  PanelTabs,
  type PanelKey,
} from "./components/editor/panel-tabs.js";
import { LayersPanel } from "./components/editor/layers-panel.js";
import { CodeBox } from "./components/editor/code-box.js";
import { ProgressMarker } from "./components/editor/progress-marker.js";
import { AIInput } from "./components/editor/ai-input.js";
import { ColorsPanel, PlaceholderPanel } from "./components/editor/panels/index.js";

const PANEL_PROPS: Record<Exclude<PanelKey, "colors">, string[]> = {
  spacing: ["margin", "padding", "gap", "width", "height"],
  typography: ["font-family", "font-size", "font-weight", "line-height"],
  borders: ["border-width", "border-style", "border-color", "border-radius"],
  layout: ["display", "flex-direction", "justify-content", "position"],
  effects: ["box-shadow", "transform", "transition", "filter"],
};

export function App(): JSX.Element {
  const [active, setActive] = useState<PanelKey>("colors");
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const handleChange = (prop: string, value: string): void => {
    setOverrides((prev) => ({ ...prev, [prop]: value }));
  };

  return (
    <EditorShell
      layers={
        <LayersPanel
          nodes={[
            { id: "1", tag: "main", depth: 0 },
            { id: "2", tag: "section", depth: 1 },
            { id: "3", tag: "div", className: "hero", depth: 2 },
            { id: "4", tag: "button", depth: 3, edited: true },
          ]}
          activeId="4"
          onSelect={(): void => undefined}
        />
      }
      identity={
        <ElementIdentity
          element={{
            tag: "button",
            classes: ["btn-primary"],
            source_file: "Hero.tsx",
            source_line: 42,
          }}
        />
      }
      tabs={<PanelTabs active={active} onSelect={setActive} />}
      panel={
        active === "colors" ? (
          <ColorsPanel
            background={overrides["background-color"] ?? "#7c3aed"}
            color={overrides["color"] ?? "#ffffff"}
            onChange={handleChange}
          />
        ) : (
          <PlaceholderPanel
            title={active}
            properties={PANEL_PROPS[active]}
          />
        )
      }
      codeBox={
        <CodeBox
          source='<button className="btn-primary">Get Started</button>'
          file="Hero.tsx"
          line={42}
        />
      }
      progress={
        <ProgressMarker
          items={[
            { label: "h1", done: true },
            { label: "btn", done: true },
            { label: "nav", done: false },
          ]}
        />
      }
      aiInput={<AIInput />}
    />
  );
}
