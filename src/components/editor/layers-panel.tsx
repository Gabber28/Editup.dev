import type { JSX } from "react";

export interface DomNode {
  id: string;
  tag: string;
  className?: string;
  depth: number;
  edited?: boolean;
}

export interface LayersPanelProps {
  nodes: DomNode[];
  activeId?: string;
  onSelect(id: string): void;
}

export function LayersPanel(props: LayersPanelProps): JSX.Element {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--color-muted)",
          marginBottom: 6,
        }}
      >
        Layers
      </div>
      {props.nodes.map((node) => {
        const isActive = node.id === props.activeId;
        return (
          <button
            key={node.id}
            type="button"
            onClick={(): void => props.onSelect(node.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "3px 6px",
              paddingLeft: `${node.depth * 8 + 6}px`,
              border: "none",
              background: isActive
                ? "rgba(124, 58, 237, 0.15)"
                : "transparent",
              color: isActive ? "var(--color-accent-light)" : "var(--color-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              borderRadius: 4,
              marginBottom: 2,
            }}
          >
            {node.tag}
            {node.className ? `.${node.className}` : ""}
            {node.edited ? " ●" : ""}
          </button>
        );
      })}
    </div>
  );
}
