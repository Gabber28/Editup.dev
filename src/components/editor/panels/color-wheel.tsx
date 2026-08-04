import { useCallback, useEffect, useRef, type JSX } from "react";
import { hsvToRgb } from "@/lib/color.js";

const SIZE = 168;
const RADIUS = SIZE / 2;

export interface ColorWheelProps {
  /** Hue in degrees [0, 360). */
  hue: number;
  /** Saturation [0, 1] — radial distance from center. */
  sat: number;
  /** Brightness [0, 1] — dims the whole wheel, matching the reference. */
  brightness: number;
  onChange(hue: number, sat: number): void;
}

/**
 * Circular HSV picker: hue is the angle, saturation the radius. The wheel is
 * rendered at the current brightness so lowering it darkens the surface.
 *
 * @param props Current hue/sat/brightness and change handler
 * @returns Canvas wheel with a draggable handle
 */
export function ColorWheel(props: ColorWheelProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { brightness, onChange } = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = ctx.createImageData(SIZE, SIZE);
    const data = image.data;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = x - RADIUS;
        const dy = y - RADIUS;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * SIZE + x) * 4;
        if (dist > RADIUS) {
          data[idx + 3] = 0;
          continue;
        }
        let h = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (h < 0) h += 360;
        const s = dist / RADIUS;
        const { r, g, b } = hsvToRgb({ h, s, v: brightness });
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, [brightness]);

  const pick = useCallback(
    (clientX: number, clientY: number) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dx = clientX - rect.left - RADIUS;
      const dy = clientY - rect.top - RADIUS;
      const dist = Math.min(RADIUS, Math.sqrt(dx * dx + dy * dy));
      let h = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (h < 0) h += 360;
      onChange(h, dist / RADIUS);
    },
    [onChange],
  );

  const handlePointerDown = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      ev.currentTarget.setPointerCapture(ev.pointerId);
      pick(ev.clientX, ev.clientY);
    },
    [pick],
  );

  const handlePointerMove = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      if (ev.buttons !== 1) return;
      pick(ev.clientX, ev.clientY);
    },
    [pick],
  );

  const angle = (props.hue * Math.PI) / 180;
  const handleX = RADIUS + Math.cos(angle) * props.sat * RADIUS;
  const handleY = RADIUS + Math.sin(angle) * props.sat * RADIUS;

  return (
    <div
      ref={wrapRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      style={{
        position: "relative",
        width: SIZE,
        height: SIZE,
        margin: "0 auto",
        cursor: "crosshair",
        touchAction: "none",
      }}
    >
      <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ borderRadius: "50%" }} />
      <div
        style={{
          position: "absolute",
          left: handleX,
          top: handleY,
          width: 14,
          height: 14,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          border: "2px solid #fff",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
