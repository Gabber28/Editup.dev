import { useState, type JSX, type ReactNode } from "react";

export interface SectionGroupProps {
  id: string;
  title: string;
  /** Open state on first ever open (no persisted value yet). */
  defaultOpen?: boolean;
  children: ReactNode;
}

function readOpen(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * A collapsible inspector section (Figma-style header + chevron). Its open
 * state is persisted per section id in localStorage, so it is remembered
 * across selections.
 *
 * @param props Section id, title, and body content
 * @returns The collapsible section
 */
export function SectionGroup(props: SectionGroupProps): JSX.Element {
  const key = `editup.section.${props.id}`;
  const [open, setOpen] = useState<boolean>(() => readOpen(key, props.defaultOpen ?? true));

  const toggle = (): void => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // storage unavailable — keep in-memory state only
      }
      return next;
    });
  };

  return (
    <div className="section-group">
      <button type="button" className="section-group__header" onClick={toggle}>
        <span className="section-group__chevron">{open ? "▾" : "▸"}</span>
        <span>{props.title}</span>
      </button>
      {open && <div className="section-group__body">{props.children}</div>}
    </div>
  );
}
