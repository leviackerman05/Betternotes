import { useEffect } from "react";
import { useAppStore } from "../store/appStore";

export function useKeyboard() {
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setView = useAppStore((s) => s.setView);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        // Simple go-to shortcuts: g then i/t/u/n/s
        const goHandler = (ev: KeyboardEvent) => {
          const map: Record<string, () => void> = {
            i: () => setView("inbox"),
            t: () => setView("today"),
            u: () => setView("upcoming"),
            n: () => setView("notes"),
            s: () => setView("settings"),
          };
          if (map[ev.key]) {
            ev.preventDefault();
            map[ev.key]();
          }
          document.removeEventListener("keydown", goHandler);
        };
        document.addEventListener("keydown", goHandler, { once: true });
        setTimeout(() => document.removeEventListener("keydown", goHandler), 1000);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCommandPaletteOpen, setView]);
}
