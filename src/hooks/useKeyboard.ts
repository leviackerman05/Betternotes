import { useEffect } from "react";
import { useAppStore } from "../store/appStore";

export function useKeyboard() {
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setView = useAppStore((s) => s.setView);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("betternote:quick-capture"));
      }
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        const goHandler = (ev: KeyboardEvent) => {
          const map: Record<string, () => void> = {
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
