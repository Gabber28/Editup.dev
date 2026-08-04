import { useEffect, useState, type JSX } from "react";
import type { ElementInfo } from "@/types/snapshot.js";
import { IconControls } from "./icon-controls.js";

export interface ImagePanelProps {
  element: ElementInfo | null;
  onChange(property: string, value: string): void;
}

export const MEDIA_INPUT: React.CSSProperties = {
  flex: 1,
  padding: "6px 8px",
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 4,
  color: "var(--color-fg)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
};

export const MEDIA_HINT: React.CSSProperties = {
  fontSize: 10,
  color: "var(--color-muted)",
  lineHeight: 1.5,
  marginTop: 8,
};

export const MEDIA_LABEL: React.CSSProperties = {
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--color-muted)",
  marginBottom: 4,
};

export const MEDIA_BTN: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 4,
  border: "none",
  background: "var(--color-accent)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

/**
 * Replaces the image or icon of the selected element. Dispatches to the right
 * control based on the captured media kind: URL for <img>/background, and the
 * icon-specific controls (emoji, icon-font, inline SVG, <use> sprite).
 *
 * @param props Selected element info and the change handler
 * @returns The media/icon replacement UI
 */
export function ImagePanel(props: ImagePanelProps): JSX.Element {
  const { element } = props;
  if (!element) {
    return <div style={MEDIA_HINT}>Select an element to change its image or icon.</div>;
  }
  const kind = element.media?.kind ?? "none";
  if (kind === "emoji" || kind === "icon-font" || kind === "svg" || kind === "svg-use") {
    return <IconControls element={element} onChange={props.onChange} />;
  }
  return <UrlControl element={element} onChange={props.onChange} />;
}

function UrlControl(props: {
  element: ElementInfo;
  onChange(property: string, value: string): void;
}): JSX.Element {
  const { element } = props;
  const isImg = element.media?.kind === "img";
  const property = isImg ? "src" : "background-image";
  const currentUrl = element.media?.url ?? "";

  const [draft, setDraft] = useState(currentUrl);
  useEffect(() => setDraft(currentUrl), [currentUrl]);

  const commit = (): void => {
    const url = draft.trim();
    if (!url) return;
    props.onChange(property, isImg ? url : `url("${url}")`);
  };

  const preview = draft.trim() || currentUrl;

  return (
    <div>
      <div
        style={{
          width: "100%",
          height: 120,
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: "var(--color-card)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          marginBottom: 10,
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="preview"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            onError={(e): void => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span style={{ fontSize: 10, color: "var(--color-muted)" }}>No image</span>
        )}
      </div>

      <div style={MEDIA_LABEL}>{isImg ? "Image source (src)" : "Background image"}</div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={draft}
          spellCheck={false}
          placeholder="https://… or /assets/photo.png"
          onChange={(ev): void => setDraft(ev.currentTarget.value)}
          onKeyDown={(ev): void => {
            if (ev.key === "Enter") commit();
          }}
          onBlur={commit}
          style={MEDIA_INPUT}
        />
        <button type="button" onClick={commit} style={MEDIA_BTN}>
          Apply
        </button>
      </div>

      <p style={MEDIA_HINT}>
        Paste an image URL or a path served by your app (e.g. <code>/logo.png</code>).
        Previews live and applies to your source on Apply.
      </p>
    </div>
  );
}
