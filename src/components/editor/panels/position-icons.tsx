import type { JSX } from "react";
import type { AlignAxis, AlignMode } from "./position-align.js";

const SVG = {
  width: 14,
  height: 14,
  viewBox: "0 0 14 14",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Edge line + two bars, mirroring Figma's align glyphs. */
const ALIGN_GEOMETRY: Record<
  AlignAxis,
  Record<AlignMode, { line: string; bars: number[][] }>
> = {
  h: {
    start: {
      line: "M1.5 1.5V12.5",
      bars: [
        [3.5, 3, 8, 3],
        [3.5, 8, 5, 3],
      ],
    },
    center: {
      line: "M7 1.5V12.5",
      bars: [
        [2, 3, 10, 3],
        [4, 8, 6, 3],
      ],
    },
    end: {
      line: "M12.5 1.5V12.5",
      bars: [
        [2.5, 3, 8, 3],
        [5.5, 8, 5, 3],
      ],
    },
  },
  v: {
    start: {
      line: "M1.5 1.5H12.5",
      bars: [
        [3, 3.5, 3, 8],
        [8, 3.5, 3, 5],
      ],
    },
    center: {
      line: "M1.5 7H12.5",
      bars: [
        [3, 2, 3, 10],
        [8, 4, 3, 6],
      ],
    },
    end: {
      line: "M1.5 12.5H12.5",
      bars: [
        [3, 2.5, 3, 8],
        [8, 5.5, 3, 5],
      ],
    },
  },
};

export function AlignIcon(props: {
  axis: AlignAxis;
  mode: AlignMode;
}): JSX.Element {
  const g = ALIGN_GEOMETRY[props.axis][props.mode];
  return (
    <svg {...SVG}>
      <path d={g.line} />
      {g.bars.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx={0.8} />
      ))}
    </svg>
  );
}

export function RotateIcon(): JSX.Element {
  return (
    <svg {...SVG}>
      <path d="M11.5 6a4.75 4.75 0 1 1-1.6-3.3" />
      <path d="M10.2 0.9v2.2H8" />
    </svg>
  );
}

export function FlipXIcon(): JSX.Element {
  return (
    <svg {...SVG}>
      <path d="M7 1.5v11" strokeDasharray="2 1.5" />
      <path d="M5 3.5 1.5 7 5 10.5z" />
      <path d="M9 3.5 12.5 7 9 10.5z" />
    </svg>
  );
}

export function FlipYIcon(): JSX.Element {
  return (
    <svg {...SVG}>
      <path d="M1.5 7h11" strokeDasharray="2 1.5" />
      <path d="M3.5 5 7 1.5 10.5 5z" />
      <path d="M3.5 9 7 12.5 10.5 9z" />
    </svg>
  );
}

export function AngleIcon(): JSX.Element {
  return (
    <svg {...SVG} style={{ color: "var(--color-muted)", flexShrink: 0 }}>
      <path d="M2.5 2.5v9h9" />
      <path d="M11 8.2a6 6 0 0 0-5.2-5.2" />
    </svg>
  );
}

/** Marks the containing block at the centre of the box-model diagram. */
export function PinIcon(): JSX.Element {
  return (
    <svg {...SVG} style={{ color: "var(--color-accent-light)" }}>
      <path d="M7 8.5v4" />
      <path d="M4.2 2h5.6l-.8 3.2 1.5 1.6H3.5L5 5.2z" />
    </svg>
  );
}

/** Layer stepper arrows: send backward / bring forward. */
export function ArrowDownIcon(): JSX.Element {
  return (
    <svg {...SVG}>
      <path d="M7 2.5v9" />
      <path d="M3.5 8 7 11.5 10.5 8" />
    </svg>
  );
}

export function ArrowUpIcon(): JSX.Element {
  return (
    <svg {...SVG}>
      <path d="M7 11.5v-9" />
      <path d="M3.5 6 7 2.5 10.5 6" />
    </svg>
  );
}
