import { useState, useRef, useEffect } from "react";
import {
  FolderOpen,
  FolderPlus,
  Moon,
  PanelLeftOpen,
  Search,
  Settings,
  SquarePen,
  Sun,
} from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../hooks/useTheme";
import { isJiraEnabled, jiraSectionTitle } from "../../lib/integrations";
import type { Folder } from "../../types";
import { JiraIcon } from "../Settings/IntegrationIcons";
import styles from "./CollapsedRail.module.css";

interface CollapsedRailProps {
  workspaces: Folder[];
  onExpand: () => void;
  onAddNote: () => void;
  onAddWorkspace: () => void;
  onSelectWorkspace: (id: string) => void;
}

export function CollapsedRail({
  workspaces,
  onExpand,
  onAddNote,
  onAddWorkspace,
  onSelectWorkspace,
}: CollapsedRailProps) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const settings = useAppStore((s) => s.settings);
  const selectedFolderId = useAppStore((s) => s.selectedFolderId);
  const jiraEnabled = isJiraEnabled(settings);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <aside className={styles.rail}>
      <button className={styles.btn} onClick={onExpand} title="Show sidebar">
        <PanelLeftOpen size={18} />
      </button>

      <button className={styles.btn} onClick={onAddNote} title="New note">
        <SquarePen size={18} />
      </button>

      <button
        className={styles.btn}
        onClick={() => setCommandPaletteOpen(true)}
        title="Search notes (⌘F)"
      >
        <Search size={18} />
      </button>

      <button className={styles.btn} onClick={onAddWorkspace} title="New workspace">
        <FolderPlus size={18} />
      </button>

      <div className={styles.menuWrap} ref={menuRef}>
        <button
          className={clsx(styles.btn, menuOpen && styles.btnActive)}
          onClick={() => setMenuOpen((o) => !o)}
          title="Switch workspace"
        >
          <FolderOpen size={18} />
        </button>
        {menuOpen && (
          <div className={styles.menu}>
            <p className={styles.menuLabel}>Workspaces</p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className={clsx(
                  styles.menuItem,
                  selectedFolderId === ws.id && styles.menuItemActive
                )}
                onClick={() => {
                  onSelectWorkspace(ws.id);
                  setMenuOpen(false);
                }}
              >
                <span className={styles.menuName} title={ws.name}>
                  {ws.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {jiraEnabled && (
        <button
          className={clsx(styles.btn, view === "jira" && styles.btnActive)}
          onClick={() => setView("jira")}
          title={`${jiraSectionTitle(settings)} (from Jira)`}
        >
          <JiraIcon size={18} />
        </button>
      )}

      <div className={styles.spacer} />

      <button className={styles.btn} onClick={toggleTheme} title="Toggle theme">
        {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <button
        className={clsx(styles.btn, view === "settings" && styles.btnActive)}
        onClick={() => setView("settings")}
        title="Settings"
      >
        <Settings size={18} />
      </button>
    </aside>
  );
}
