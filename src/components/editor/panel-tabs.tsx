import type { JSX } from "react";

export interface PanelTab {
  id: string;
  label: string;
}

export interface PanelTabsProps {
  tabs: PanelTab[];
  active: string;
  onSelect(id: string): void;
}

/**
 * The editor's top button bar — one small button per applicable panel.
 * The list is supplied by the caller (derived from the section registry),
 * so this component owns presentation only.
 *
 * @param props Tabs to show, the active tab id, and the selection handler
 * @returns The button bar
 */
export function PanelTabs(props: PanelTabsProps): JSX.Element {
  return (
    <div className="panel-tabs" role="tablist">
      {props.tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={props.active === tab.id}
          className={`panel-tabs__tab ${
            props.active === tab.id ? "panel-tabs__tab--active" : ""
          }`}
          onClick={(): void => props.onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
