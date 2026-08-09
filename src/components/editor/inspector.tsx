import { useState, type JSX } from "react";
import type { ElementInfo, PseudoState } from "@/types/snapshot.js";
import { SECTIONS } from "./sections.js";
import { PanelTabs, type PanelTab } from "./panel-tabs.js";
import { StateSelector } from "./state-selector.js";
import { CodeBox } from "./code-box.js";

const SOURCE_TAB = "source";

export interface InspectorProps {
  element: ElementInfo | null;
  values: Record<string, string>;
  onChange(property: string, value: string): void;
  pseudo: {
    availableStates: PseudoState[];
    activeState: PseudoState;
    setActiveState(state: PseudoState): void;
  };
  code: { source: string; file: string; line: number };
}

/**
 * The editor's inspector: a bar of small buttons on top (one per applicable
 * panel, derived from the section registry) and the active panel below it.
 * Only the panel area scrolls.
 *
 * @param props Element, values, change handler, pseudo-state, and source
 * @returns The button bar plus the active panel
 */
export function Inspector(props: InspectorProps): JSX.Element {
  const ctx = {
    element: props.element,
    values: props.values,
    onChange: props.onChange,
  };
  const visible = SECTIONS.filter((s) => s.applies(props.element));

  const tabs: PanelTab[] = visible.map((s) => ({ id: s.id, label: s.title }));
  if (props.code.source) tabs.push({ id: SOURCE_TAB, label: "Source" });

  const [selected, setSelected] = useState<string>(tabs[0]?.id ?? "");

  // The selected element decides which panels apply, so the active tab can
  // disappear underneath us (Image active, then a <p> is selected). Falling
  // back keeps a panel on screen instead of rendering nothing.
  const active = tabs.some((t) => t.id === selected)
    ? selected
    : (tabs[0]?.id ?? "");

  const section = visible.find((s) => s.id === active);

  return (
    <div className="inspector">
      <PanelTabs tabs={tabs} active={active} onSelect={setSelected} />
      <StateSelector
        availableStates={props.pseudo.availableStates}
        active={props.pseudo.activeState}
        onSelect={props.pseudo.setActiveState}
      />
      <div className="panel-content">
        {active === SOURCE_TAB ? (
          <CodeBox
            source={props.code.source}
            file={props.code.file}
            line={props.code.line}
          />
        ) : (
          section?.render(ctx)
        )}
      </div>
    </div>
  );
}
