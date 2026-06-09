import {
  Bell,
  FolderOpen,
  Kanban,
  Moon,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings,
  SquarePen,
  Star,
  Sun,
  Trash2,
  Files,
} from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../hooks/useTheme";
import { isJiraEnabled, jiraSectionTitle } from "../../lib/integrations";
import type { AppView, NotesCollection } from "../../types";
import { JiraIcon } from "../Settings/IntegrationIcons";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  onAddNote: () => void;
  onAddWorkspace: () => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string, name: string) => void;
  onCollapse: () => void;
  onSelectCollection: (collection: NotesCollection, tagId?: string | null) => void;
}

export function Sidebar({
  onAddNote,
  onAddWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onCollapse,
  onSelectCollection,
}: SidebarProps) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const folders = useAppStore((s) => s.folders);
  const tags = useAppStore((s) => s.tags);
  const selectedFolderId = useAppStore((s) => s.selectedFolderId);
  const notesCollection = useAppStore((s) => s.notesCollection);
  const selectedTagId = useAppStore((s) => s.selectedTagId);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const paletteQuery = useAppStore((s) => s.paletteQuery);
  const setPaletteQuery = useAppStore((s) => s.setPaletteQuery);
  const settings = useAppStore((s) => s.settings);
  const { theme, toggleTheme } = useTheme();
  const jiraEnabled = isJiraEnabled(settings);

  const nav = (v: AppView, workspaceId: string) => {
    setView(v);
    onSelectCollection("workspace");
    useAppStore.getState().setSelectedFolderId(workspaceId);
  };

  const collectionActive = (c: NotesCollection) =>
    view === "notes" && notesCollection === c && c !== "tag";

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.brand}>Betternote</span>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={toggleTheme} title="Toggle theme">
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className={styles.iconBtn} onClick={onCollapse} title="Hide sidebar">
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      <button className={styles.addNote} onClick={onAddNote}>
        <SquarePen size={18} className={styles.addIcon} />
        New note
      </button>

      <div className={styles.searchBox}>
        <Search size={15} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Search notes…"
          value={paletteQuery}
          onChange={(e) => {
            setPaletteQuery(e.target.value);
            setCommandPaletteOpen(true);
          }}
          onFocus={() => setCommandPaletteOpen(true)}
        />
        <kbd className={styles.searchKbd}>⌘F</kbd>
      </div>

      <nav className={styles.navSection}>
        <button
          className={clsx(styles.navItem, collectionActive("all") && styles.navItemActive)}
          onClick={() => {
            setView("notes");
            onSelectCollection("all");
          }}
        >
          <Files size={16} />
          <span>All Notes</span>
        </button>
        <button
          className={clsx(styles.navItem, collectionActive("favorites") && styles.navItemActive)}
          onClick={() => {
            setView("notes");
            onSelectCollection("favorites");
          }}
        >
          <Star size={16} />
          <span>Favorites</span>
        </button>
        <button
          className={clsx(styles.navItem, collectionActive("reminders") && styles.navItemActive)}
          onClick={() => {
            setView("notes");
            onSelectCollection("reminders");
          }}
        >
          <Bell size={16} />
          <span>Reminders</span>
        </button>
      </nav>

      {jiraEnabled && (
        <nav className={styles.navSection}>
          <button
            className={clsx(styles.navItem, view === "jira" && styles.navItemActive)}
            onClick={() => setView("jira")}
            title="Issues synced from Jira"
          >
            <Kanban size={16} />
            <span className={styles.navItemLabel}>{jiraSectionTitle(settings)}</span>
            <span className={styles.jiraNavBadge}>
              <JiraIcon size={12} />
              Jira
            </span>
          </button>
        </nav>
      )}

      <nav className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Workspaces</p>
          <button className={styles.iconBtn} onClick={onAddWorkspace} title="New workspace">
            <Plus size={14} />
          </button>
        </div>
        {folders.map((workspace) => (
          <div
            key={workspace.id}
            className={clsx(
              styles.folderRow,
              view === "notes" &&
                notesCollection === "workspace" &&
                selectedFolderId === workspace.id &&
                styles.folderRowActive
            )}
          >
            <button
              className={styles.folderBtn}
              onClick={() => nav("notes", workspace.id)}
            >
              <FolderOpen size={16} />
              <span className={styles.folderName} title={workspace.name}>
                {workspace.name}
              </span>
            </button>
            <div className={styles.folderActions}>
              <button
                className={styles.folderActionBtn}
                onClick={() => onRenameWorkspace(workspace.id, workspace.name)}
                title="Rename workspace"
              >
                <Pencil size={12} />
              </button>
              <button
                className={styles.folderActionBtn}
                onClick={() => onDeleteWorkspace(workspace.id, workspace.name)}
                title="Delete workspace"
                disabled={folders.length <= 1}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </nav>

      {tags.length > 0 && (
        <div className={styles.tagsSection}>
          <p className={styles.sectionLabel}>Tags</p>
          <div className={styles.tagPills}>
            {tags.map((tag) => (
              <button
                key={tag.id}
                className={clsx(
                  styles.tagPill,
                  notesCollection === "tag" &&
                    selectedTagId === tag.id &&
                    styles.tagPillActive
                )}
                onClick={() => {
                  setView("notes");
                  onSelectCollection("tag", tag.id);
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <button
          className={clsx(styles.navItem, view === "settings" && styles.navItemActive)}
          onClick={() => setView("settings")}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
