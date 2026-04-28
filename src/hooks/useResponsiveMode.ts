import { useEffect, useState } from "react";

export type ResponsiveMode = "wide" | "medium" | "narrow";

export function useResponsiveMode(): ResponsiveMode {
  const [mode, setMode] = useState<ResponsiveMode>(() => classify(window.innerWidth));

  useEffect(() => {
    const onResize = (): void => setMode(classify(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return mode;
}

function classify(width: number): ResponsiveMode {
  if (width >= 900) return "wide";
  if (width >= 500) return "medium";
  return "narrow";
}
