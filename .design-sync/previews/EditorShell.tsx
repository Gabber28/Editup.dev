import {
  EditorShell,
  ElementIdentity,
  LayersPanel,
  PanelTabs,
  StateSelector,
  ColorsPanel,
  CodeBox,
  ProgressMarker,
  AIInput,
  ApplyBar,
} from "editup";

const noop = () => {};

// Full editor composition — the layout adapts to the card width
// (wide/medium/narrow), exactly like the real app window.
export const FullEditor = () => (
  <div style={{ height: 520, background: "var(--color-bg)", color: "var(--color-fg)" }}>
    <EditorShell
      layers={
        <LayersPanel
          activeId="cta"
          onSelect={noop}
          nodes={[
            { id: "body", tag: "body", depth: 0 },
            { id: "hero", tag: "section", className: "hero", depth: 1, edited: true },
            { id: "cta", tag: "button", className: "btn-primary", depth: 2, edited: true },
            { id: "features", tag: "section", className: "features", depth: 1 },
          ]}
        />
      }
      identity={
        <ElementIdentity
          element={{
            tag: "button",
            classes: ["btn-primary"],
            source_file: "src/components/hero.tsx",
            source_line: 27,
          }}
        />
      }
      tabs={<PanelTabs active="colors" onSelect={noop} />}
      stateSelector={
        <StateSelector
          availableStates={["default", ":hover", ":focus"]}
          active="default"
          onSelect={noop}
        />
      }
      panel={
        <ColorsPanel
          values={{ "background-color": "#7c3aed", color: "#ffffff" }}
          onChange={noop}
        />
      }
      codeBox={
        <CodeBox
          file="src/components/hero.tsx"
          line={27}
          source={`<button className="btn-primary">Get started</button>`}
        />
      }
      progress={
        <ProgressMarker
          items={[
            { label: "hero", done: true },
            { label: "cta", done: false },
          ]}
        />
      }
      aiInput={<AIInput onSubmit={noop} />}
      applyBar={
        <ApplyBar
          phase="idle"
          hasChanges
          commitHash={null}
          error={null}
          expressMode={false}
          editsUsed={4}
          editsLimit={15}
          canApply
          canUseExpress
          onApply={noop}
          onRevert={noop}
          onToggleExpress={noop}
          onReset={noop}
        />
      }
    />
  </div>
);
