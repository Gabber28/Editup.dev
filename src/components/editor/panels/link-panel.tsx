import { useEffect, useState, type JSX } from "react";
import type { ElementInfo } from "@/types/snapshot.js";

export interface LinkPanelProps {
  element: ElementInfo | null;
  onChange(property: string, value: string): void;
}

const HINT: React.CSSProperties = {
  fontSize: 10,
  color: "var(--color-muted)",
  lineHeight: 1.5,
  marginTop: 8,
};

const BADGE: React.CSSProperties = {
  display: "inline-block",
  fontSize: 10,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: 999,
  marginBottom: 10,
};

const kindMeta: Record<
  "anchor" | "button" | "none",
  { label: string; color: string; hint: string }
> = {
  anchor: {
    label: "Already a link (<a>)",
    color: "#4ade80",
    hint: "This element is already a link — edit its destination below.",
  },
  button: {
    label: "Already a button",
    color: "#a855f7",
    hint: "This is already a button. Setting a destination makes the AI add the navigation.",
  },
  none: {
    label: "Not a button yet",
    color: "#9a9ab0",
    hint: "Set a destination to turn this element into a link (the AI wraps it in an <a>).",
  },
};

/**
 * Turns the selected element into a link/button by setting a destination URL.
 * Detects and shows whether the element is already a link or button.
 *
 * @param props Selected element info and the change handler
 * @returns The link/button editing UI
 */
export function LinkPanel(props: LinkPanelProps): JSX.Element {
  const { element } = props;
  const button = element?.button;
  const currentHref = button?.href ?? "";
  const [draft, setDraft] = useState(currentHref);
  const [newTab, setNewTab] = useState((button?.target ?? "") === "_blank");

  useEffect(() => setDraft(currentHref), [currentHref]);
  useEffect(() => setNewTab((button?.target ?? "") === "_blank"), [button?.target]);

  if (!element) {
    return <div style={HINT}>Select an element to make it a link.</div>;
  }

  const meta = kindMeta[button?.kind ?? "none"];

  const commit = (): void => {
    props.onChange("__href__", draft.trim());
  };
  const toggleTab = (checked: boolean): void => {
    setNewTab(checked);
    props.onChange("__target__", checked ? "_blank" : "");
  };
  const remove = (): void => {
    setDraft("");
    props.onChange("__href__", "");
  };

  return (
    <div>
      <span style={{ ...BADGE, color: meta.color, background: `${meta.color}22` }}>{meta.label}</span>

      <div
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--color-muted)",
          marginBottom: 4,
        }}
      >
        Destination link
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={draft}
          spellCheck={false}
          placeholder="/page or a full URL"
          onChange={(ev): void => setDraft(ev.currentTarget.value)}
          onKeyDown={(ev): void => {
            if (ev.key === "Enter") commit();
          }}
          onBlur={commit}
          style={{
            flex: 1,
            padding: "6px 8px",
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            color: "var(--color-fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        />
        <button
          type="button"
          onClick={commit}
          style={{
            padding: "6px 12px",
            borderRadius: 4,
            border: "none",
            background: "var(--color-accent)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Apply
        </button>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11 }}>
        <input
          type="checkbox"
          checked={newTab}
          onChange={(ev): void => toggleTab(ev.currentTarget.checked)}
        />
        Open in new tab
      </label>

      {(draft || currentHref) && (
        <button
          type="button"
          onClick={remove}
          style={{
            marginTop: 10,
            fontSize: 10,
            padding: "5px 8px",
            borderRadius: 4,
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
            color: "var(--color-fg)",
            cursor: "pointer",
          }}
        >
          Remove link
        </button>
      )}

      <p style={HINT}>{meta.hint}</p>
    </div>
  );
}
