import type { CSSProperties } from "react";

export const POS_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
  flexWrap: "wrap",
};

export const POS_LABEL: CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "var(--color-muted)",
  minWidth: 80,
};

export const POS_FIELD: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flex: 1,
  padding: "0 8px",
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 4,
};

export const POS_INPUT: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "4px 0",
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--color-fg)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
};

export const POS_GROUP: CSSProperties = {
  display: "flex",
  gap: 2,
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 4,
  padding: 2,
};

export const POS_BTN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 22,
  background: "transparent",
  border: "none",
  borderRadius: 3,
  color: "var(--color-fg)",
  cursor: "pointer",
  padding: 0,
};

export const POS_HINT: CSSProperties = {
  flexBasis: "100%",
  marginLeft: 88,
  fontSize: 10,
  color: "var(--color-accent-light)",
};

/** Toggle buttons (the two flips) stay highlighted while active. */
export function activeBtn(active: boolean): CSSProperties {
  return active
    ? { ...POS_BTN, background: "var(--color-accent)", color: "#fff" }
    : POS_BTN;
}
