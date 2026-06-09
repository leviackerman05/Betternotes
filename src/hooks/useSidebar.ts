import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";

export function useSidebar() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const setCollapsed = async (collapsed: boolean) => {
    const updated = { ...settings, sidebar_collapsed: collapsed };
    setSettings(updated);
    await api.saveSettings(updated);
  };

  const toggleCollapsed = async () => {
    await setCollapsed(!(settings.sidebar_collapsed ?? false));
  };

  return {
    collapsed: settings.sidebar_collapsed ?? false,
    toggleCollapsed,
    setCollapsed,
  };
}
