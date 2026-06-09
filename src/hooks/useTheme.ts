import { useEffect } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";

export function useTheme() {
  const settings = useAppStore((s) => s.settings);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const toggleTheme = async () => {
    const next = settings.theme === "light" ? "dark" : "light";
    const updated = { ...settings, theme: next as "light" | "dark" };
    useAppStore.getState().setSettings(updated);
    await api.saveSettings(updated);
  };

  return { theme: settings.theme, toggleTheme };
}
