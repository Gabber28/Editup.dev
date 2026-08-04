import type { JSX } from "react";
import type { ElementInfo, PseudoState } from "@/types/snapshot.js";
import { SECTIONS } from "./sections.js";
import { SectionGroup } from "./section-group.js";
import { StateSelector } from "./state-selector.js";
import { CodeBox } from "./code-box.js";

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
 * Single scrollable inspector (Figma/Webflow style): a global pseudo-state
 * selector on top, then only the sections applicable to the selected element,
 * stacked and collapsible, followed by the read-only source.
 *
 * @param props Element, values, change handler, pseudo-state, and source
 * @returns The stacked inspector
 */
export function Inspector(props: InspectorProps): JSX.Element {
  const ctx = { element: props.element, values: props.values, onChange: props.onChange };
  const visible = SECTIONS.filter((s) => s.applies(props.element));

  return (
    <div className="inspector">
      <StateSelector
        availableStates={props.pseudo.availableStates}
        active={props.pseudo.activeState}
        onSelect={props.pseudo.setActiveState}
      />
      {visible.map((section, i) => (
        <SectionGroup
          key={section.id}
          id={section.id}
          title={section.title}
          defaultOpen={i === 0}
        >
          {section.render(ctx)}
        </SectionGroup>
      ))}
      {props.code.file && (
        <SectionGroup id="source" title="Source" defaultOpen={false}>
          <CodeBox source={props.code.source} file={props.code.file} line={props.code.line} />
        </SectionGroup>
      )}
    </div>
  );
}
