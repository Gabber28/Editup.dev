import type { JSX } from "react";
import type { ElementInfo, MatchingRule } from "@/types/snapshot.js";
import {
  ColorsPanel,
  SpacingPanel,
  TypographyPanel,
  BorderPanel,
  LayoutPanel,
  EffectsPanel,
  ImagePanel,
  LinkPanel,
} from "./panels/index.js";

export interface SectionContext {
  element: ElementInfo | null;
  /** Effective values: computed, then authored, then this session's edits. */
  values: Record<string, string>;
  onChange(property: string, value: string): void;
  /**
   * Only this element+state's own edits. Panels that must distinguish an
   * authored value from a browser-computed one need both, not the merged map.
   */
  overrides?: Record<string, string>;
  /** Rules governing the element, for the same distinction. */
  rules?: readonly MatchingRule[];
  /** Removes a declaration entirely, rather than writing a literal `auto`. */
  onClear?(property: string): void;
}

export interface EditorSection {
  id: string;
  title: string;
  group: "universal" | "contextual" | "interaction";
  /** Whether this section is applicable to the selected element. */
  applies(el: ElementInfo | null): boolean;
  render(ctx: SectionContext): JSX.Element;
}

/** Replaced media elements can't take a background/text color (Webflow rule). */
const REPLACED_MEDIA = ["img", "video", "iframe", "canvas", "embed", "object"];
const isReplacedMedia = (tag?: string): boolean =>
  tag !== undefined && REPLACED_MEDIA.includes(tag);

/**
 * The editor's section registry — single source of truth for order and
 * contextual visibility. Universal sections first (fixed order), then
 * contextual, then interaction. Order in this array is the display order.
 */
export const SECTIONS: EditorSection[] = [
  {
    id: "layout",
    title: "Layout",
    group: "universal",
    applies: () => true,
    render: ({ element, values, onChange, overrides, rules, onClear }) => (
      <LayoutPanel
        element={element}
        values={values}
        onChange={onChange}
        {...(overrides ? { overrides } : {})}
        {...(rules ? { rules } : {})}
        {...(onClear ? { onClear } : {})}
      />
    ),
  },
  {
    id: "spacing",
    title: "Spacing",
    group: "universal",
    applies: () => true,
    render: ({ values, onChange }) => (
      <SpacingPanel values={values} onChange={onChange} />
    ),
  },
  {
    id: "effects",
    title: "Effects",
    group: "universal",
    applies: () => true,
    render: ({ values, onChange }) => (
      <EffectsPanel values={values} onChange={onChange} />
    ),
  },
  {
    id: "colors",
    title: "Colors",
    group: "universal",
    applies: (el) => !isReplacedMedia(el?.tag),
    render: ({ values, onChange }) => (
      <ColorsPanel values={values} onChange={onChange} />
    ),
  },
  {
    id: "borders",
    title: "Borders",
    group: "universal",
    applies: () => true,
    render: ({ values, onChange }) => (
      <BorderPanel values={values} onChange={onChange} />
    ),
  },
  {
    id: "typography",
    title: "Typography",
    group: "contextual",
    applies: (el) => el?.has_text === true,
    render: ({ values, onChange }) => (
      <TypographyPanel values={values} onChange={onChange} />
    ),
  },
  {
    id: "image",
    title: "Image",
    group: "contextual",
    applies: (el) => (el?.media?.kind ?? "none") !== "none",
    render: ({ element, onChange }) => (
      <ImagePanel element={element} onChange={onChange} />
    ),
  },
  {
    id: "link",
    title: "Link",
    group: "interaction",
    applies: () => true,
    render: ({ element, onChange }) => (
      <LinkPanel element={element} onChange={onChange} />
    ),
  },
];
