import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export interface ColorPopoverProps {
  /** Trigger element the popover attaches to. */
  anchor: HTMLElement | null;
  onClose(): void;
  children: ReactNode;
}

const WIDTH = 216;
const MARGIN = 8;

/**
 * Floating panel attached to a trigger element. Rendered through a portal so
 * it is never clipped by the panel's overflow, and closes on outside-click or
 * Escape.
 *
 * @param props Anchor element, close handler, and content
 * @returns The portaled popover, or null when there is no anchor
 */
export function ColorPopover(props: ColorPopoverProps): JSX.Element | null {
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;

  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = props.anchor;
    const card = cardRef.current;
    if (!anchor || !card) return;
    const a = anchor.getBoundingClientRect();
    const ch = card.offsetHeight;

    let left = a.left;
    if (left + WIDTH + MARGIN > window.innerWidth) {
      left = window.innerWidth - WIDTH - MARGIN;
    }
    if (left < MARGIN) left = MARGIN;

    let top = a.bottom + 6;
    if (top + ch + MARGIN > window.innerHeight) {
      const above = a.top - ch - 6;
      top = above < MARGIN ? MARGIN : above;
    }
    setPos({ top, left });
  }, [props.anchor]);

  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      const card = cardRef.current;
      const target = e.target as Node;
      if (
        card &&
        !card.contains(target) &&
        props.anchor &&
        !props.anchor.contains(target)
      ) {
        onCloseRef.current();
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return (): void => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [props.anchor]);

  return createPortal(
    <div
      ref={cardRef}
      style={{
        position: "fixed",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: WIDTH,
        visibility: pos ? "visible" : "hidden",
        zIndex: 1000,
        padding: "10px 12px",
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
      }}
    >
      {props.children}
    </div>,
    document.body,
  );
}
