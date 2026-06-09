import { useEffect, useState } from "react";

export function useBreakpoint() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    width,
    isSm: width < 640,
    isMd: width < 900,
    isLg: width < 1200,
    isCompact: width < 900,
    isNarrow: width < 640,
    preferCollapsedSidebar: width < 1024,
  };
}
