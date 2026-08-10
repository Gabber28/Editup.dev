import { useId, useState, type JSX, type ReactNode } from "react";

export interface SectionGroupProps {
  id: string;
  title: string;
  /**
   * Open state when nothing has been persisted yet. Once the developer toggles
   * the section their choice is stored and wins, so this is the place to put
   * "open it because this element has something worth seeing".
   */
  defaultOpen?: boolean;
  /**
   * Shown on the header row while collapsed — so a section can stay closed
   * without hiding that it holds active values.
   */
  summary?: ReactNode;
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
 * across selections — including across the remount that a new selection causes.
 *
 * The body is mounted and unmounted rather than hidden with `display:none`:
 * content that measures itself (the box-model rectangle) lays out wrong when it
 * is first rendered inside a collapsed container.
 *
 * @param props Section id, title, optional collapsed summary, and body content
 * @returns The collapsible section
 */
export function SectionGroup(props: SectionGroupProps): JSX.Element {
  const key = `editup.section.${props.id}`;
  const panelId = useId();
  const [open, setOpen] = useState<boolean>(() =>
    readOpen(key, props.defaultOpen ?? true)
  );

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
      <button
        type="button"
        className="section-group__header"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <span>{props.title}</span>
        {!open && props.summary !== undefined && (
          <span className="section-group__summary">{props.summary}</span>
        )}
        <span className="section-group__chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div id={panelId} className="section-group__body">
          {props.children}
        </div>
      )}
    </div>
  );
}
