import { useEffect, useState, type JSX } from "react";
import type { ElementInfo } from "@/types/snapshot.js";
import { MEDIA_INPUT, MEDIA_HINT, MEDIA_LABEL, MEDIA_BTN } from "./image-panel.js";

export interface IconControlsProps {
  element: ElementInfo;
  onChange(property: string, value: string): void;
}

const QUICK_EMOJI = ["🎨", "⚡", "🤖", "🚀", "🔥", "⭐", "❤️", "✅", "💡", "📦"];

/** Replaces the icon token in a class list, appending it when not present. */
function swapToken(classes: string[], oldToken: string, newToken: string): string {
  const out = classes.map((c) => (c === oldToken ? newToken : c));
  if (newToken && !out.includes(newToken)) out.push(newToken);
  return out.filter(Boolean).join(" ");
}

/** Pulls the inner markup out of a pasted `<svg>…</svg>`, else returns as-is. */
function extractSvgInner(input: string): string {
  const m = /<svg[^>]*>([\s\S]*)<\/svg>/i.exec(input.trim());
  return m?.[1] ?? input.trim();
}

/**
 * Icon-specific replacement controls for emoji, icon-font, inline SVG, and
 * `<use>` sprite elements. Each edit previews live and flows to the AI as a
 * pseudo-property change (`__text__`, `__class__`, `__svg_inner__`, `__use_href__`).
 *
 * @param props Selected element info and the change handler
 * @returns The control for the element's icon kind
 */
export function IconControls(props: IconControlsProps): JSX.Element {
  const { element, onChange } = props;
  const kind = element.media?.kind;

  if (kind === "emoji") {
    return <EmojiControl element={element} onChange={onChange} />;
  }
  if (kind === "icon-font") {
    return <IconFontControl element={element} onChange={onChange} />;
  }
  if (kind === "svg-use") {
    return <UseHrefControl element={element} onChange={onChange} />;
  }
  return <SvgMarkupControl element={element} onChange={onChange} />;
}

function EmojiControl(props: IconControlsProps): JSX.Element {
  const current = props.element.media?.text ?? "";
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);

  const set = (v: string): void => {
    setDraft(v);
    if (v.trim()) props.onChange("__text__", v.trim());
  };

  return (
    <div>
      <div style={MEDIA_LABEL}>Emoji / glyph</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 32, lineHeight: 1 }}>{draft || "—"}</span>
        <input
          type="text"
          value={draft}
          onChange={(ev): void => set(ev.currentTarget.value)}
          style={{ ...MEDIA_INPUT, fontSize: 18, textAlign: "center" }}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {QUICK_EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            onClick={(): void => set(e)}
            style={{
              width: 30,
              height: 30,
              fontSize: 16,
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: "var(--color-card)",
              cursor: "pointer",
            }}
          >
            {e}
          </button>
        ))}
      </div>
      <p style={MEDIA_HINT}>Type or pick an emoji. Applies to the element&apos;s text on Apply.</p>
    </div>
  );
}

function IconFontControl(props: IconControlsProps): JSX.Element {
  const token = props.element.media?.iconClass ?? "";
  const ligature = props.element.media?.text ?? "";
  const usesToken = token.length > 0;
  const [draft, setDraft] = useState(usesToken ? token : ligature);
  useEffect(() => setDraft(usesToken ? token : ligature), [usesToken, token, ligature]);

  const commit = (): void => {
    const v = draft.trim();
    if (!v) return;
    if (usesToken) {
      onCommitClass(props, token, v);
    } else {
      props.onChange("__text__", v);
    }
  };

  return (
    <div>
      <div style={MEDIA_LABEL}>{usesToken ? "Icon class token" : "Icon name (ligature)"}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={draft}
          spellCheck={false}
          placeholder={usesToken ? "fa-heart" : "favorite"}
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
        {usesToken
          ? "Swaps the icon-font class (e.g. fa-star → fa-heart)."
          : "Sets the icon ligature (Material Icons style)."}
      </p>
    </div>
  );
}

function onCommitClass(props: IconControlsProps, oldToken: string, newToken: string): void {
  const next = swapToken(props.element.classes, oldToken, newToken);
  props.onChange("__class__", next);
}

function UseHrefControl(props: IconControlsProps): JSX.Element {
  const current = props.element.media?.url ?? "";
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);

  const commit = (): void => {
    const v = draft.trim();
    if (v) props.onChange("__use_href__", v);
  };

  return (
    <div>
      <div style={MEDIA_LABEL}>SVG symbol reference</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={draft}
          spellCheck={false}
          placeholder="#icon-heart"
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
      <p style={MEDIA_HINT}>Points the &lt;use&gt; at another sprite symbol (e.g. #icon-heart).</p>
    </div>
  );
}

function SvgMarkupControl(props: IconControlsProps): JSX.Element {
  const current = props.element.media?.svgMarkup ?? "";
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);

  const commit = (): void => {
    if (draft.trim()) props.onChange("__svg_inner__", extractSvgInner(draft));
  };

  return (
    <div>
      <div style={MEDIA_LABEL}>Inline SVG markup</div>
      <textarea
        value={draft}
        spellCheck={false}
        placeholder="<path d='…' /> or a full <svg>…</svg>"
        onChange={(ev): void => setDraft(ev.currentTarget.value)}
        onBlur={commit}
        style={{ ...MEDIA_INPUT, width: "100%", minHeight: 96, resize: "vertical" }}
      />
      <button type="button" onClick={commit} style={{ ...MEDIA_BTN, marginTop: 6 }}>
        Apply
      </button>
      <p style={MEDIA_HINT}>
        Paste new paths or a full &lt;svg&gt; (its inner markup is used). Replaces the icon&apos;s
        contents live.
      </p>
    </div>
  );
}
