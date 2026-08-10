import type { CSSProperties } from "react";

export const POS_HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 8,
};

export const POS_TITLE: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--color-fg)",
};

export const POS_MODE_SELECT: CSSProperties = {
  height: 24,
  padding: "0 6px",
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 5,
  color: "var(--color-fg)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  cursor: "pointer",
};

/** Alignment buttons live in one segmented strip, with no text label. */
export const POS_SEGMENTED: CSSProperties = {
  display: "flex",
  gap: 2,
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  padding: 2,
  marginBottom: 8,
};

export const POS_TRANSFORM_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 6,
  marginBottom: 10,
};

/** Prefix sits inside the field, so no external label column is needed. */
export const POS_PREFIXED_FIELD: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  height: 26,
  padding: "0 7px",
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 5,
  minWidth: 0,
};

export const POS_PREFIX: CSSProperties = {
  fontSize: 10,
  color: "var(--color-muted)",
  fontFamily: "var(--font-mono)",
  flexShrink: 0,
};

export const POS_DIVIDER: CSSProperties = {
  height: 0.5,
  background: "var(--color-border)",
  // Bled to the panel edges, past the section's own padding.
  margin: "10px -12px",
};

/**
 * Grid areas let the DOM order be the CSS shorthand (top, right, bottom, left)
 * while the visual placement stays spatial. Tab order then follows the DOM for
 * free, with no positive tabindex hijacking the page's focus order.
 */
export const BOX_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "60px 104px 60px",
  gridTemplateRows: "24px 66px 24px",
  gridTemplateAreas: `". top ." "left center right" ". bottom ."`,
  gap: 6,
  justifyContent: "center",
  alignItems: "center",
  justifyItems: "center",
};

export const BOX_CENTER: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  width: 104,
  height: 66,
  border: "1px dashed var(--color-border)",
  borderRadius: 6,
  color: "var(--color-muted)",
  flexShrink: 0,
};

export const BOX_CENTER_LABEL: CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  color: "var(--color-muted)",
};

export const OFFSET_FIELD: CSSProperties = {
  width: 60,
  height: 24,
  padding: "0 6px",
  textAlign: "center",
  borderRadius: 5,
  outline: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
};

/**
 * A side reads as pinned or free without needing focus or hover: a declared
 * offset gets the accent border, an unset one stays flat and muted.
 *
 * @param origin Where the value came from
 * @returns Style for the offset input
 */
export function offsetFieldStyle(
  origin: "edited" | "authored" | "auto"
): CSSProperties {
  if (origin === "auto") {
    return {
      ...OFFSET_FIELD,
      background: "var(--color-card)",
      border: "1px solid transparent",
      color: "var(--color-muted)",
    };
  }
  return {
    ...OFFSET_FIELD,
    background: "var(--color-card)",
    border: "1px solid var(--color-accent)",
    color: "var(--color-fg)",
  };
}

export const LAYER_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginTop: 10,
};

export const LAYER_LABEL: CSSProperties = {
  fontSize: 11,
  color: "var(--color-muted)",
};

export const LAYER_STEPPER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

export const LAYER_VALUE: CSSProperties = {
  width: 46,
  height: 24,
  padding: "0 4px",
  textAlign: "center",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 5,
  color: "var(--color-fg)",
  outline: "none",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
};

export const LAYER_ARROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  background: "transparent",
  border: "none",
  borderRadius: 4,
  color: "var(--color-muted)",
  cursor: "pointer",
  padding: 0,
};
