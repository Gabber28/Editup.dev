import type { JSX } from "react";

export type PanelKey =
  | "colors"
  | "spacing"
  | "typography"
  | "borders"
  | "layout"
  | "effects";

export interface PanelTabsProps {
  active: PanelKey;
  onSelect(key: PanelKey): void;
  iconsOnly?: boolean;
}

const TABS: Array<{ key: PanelKey; label: string; icon: string }> = [
  { key: "colors", label: "Colors", icon: "C" },
  { key: "spacing", label: "Spacing", icon: "S" },
  { key: "typography", label: "Type", icon: "T" },
  { key: "borders", label: "Border", icon: "B" },
  { key: "layout", label: "Layout", icon: "L" },
  { key: "effects", label: "Effects", icon: "E" },
];

export function PanelTabs(props: PanelTabsProps): JSX.Element {
  return (
    <div className="panel-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`panel-tabs__tab ${
            props.active === tab.key ? "panel-tabs__tab--active" : ""
          }`}
          onClick={(): void => props.onSelect(tab.key)}
        >
          {props.iconsOnly ? tab.icon : tab.label}
        </button>
      ))}
    </div>
  );
}
