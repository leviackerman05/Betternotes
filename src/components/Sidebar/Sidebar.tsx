import {
  Calendar,
  CalendarDays,
  ChevronDown,
  FileText,
  Inbox,
  Moon,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "../../store/appStore";
import { useTheme } from "../../hooks/useTheme";
import type { AppView, TaskView } from "../../types";
import styles from "./Sidebar.module.css";

const TASK_VIEWS: { id: TaskView; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "today", label: "Today", icon: Calendar },
  { id: "upcoming", label: "Upcoming", icon: CalendarDays },
];

interface SidebarProps {
  taskCounts: Record<TaskView, number>;
  onAddTask: () => void;
  onAddNote: () => void;
  onAddFolder: () => void;
}

export function Sidebar({
  taskCounts,
  onAddTask,
  onAddNote,
  onAddFolder,
}: SidebarProps) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const folders = useAppStore((s) => s.folders);
  const selectedFolderId = useAppStore((s) => s.selectedFolderId);
  const setSelectedFolderId = useAppStore((s) => s.setSelectedFolderId);
  const { theme, toggleTheme } = useTheme();

  const nav = (v: AppView, folderId?: string | null) => {
    setView(v);
    if (v === "notes") setSelectedFolderId(folderId ?? null);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.brand}>BetterNotes</span>
        <button className={styles.iconBtn} onClick={toggleTheme} title="Toggle theme">
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      <button className={styles.addTask} onClick={onAddTask}>
        <Plus size={18} className={styles.addIcon} />
        Add task
      </button>

      <nav className={styles.section}>
        <p className={styles.sectionLabel}>Tasks</p>
        {TASK_VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={clsx(styles.navItem, view === id && styles.navItemActive)}
            onClick={() => nav(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {taskCounts[id] > 0 && (
              <span className={styles.count}>{taskCounts[id]}</span>
            )}
          </button>
        ))}
      </nav>

      <nav className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>Notes</p>
          <button className={styles.iconBtn} onClick={onAddFolder} title="New folder">
            <Plus size={14} />
          </button>
        </div>
        <button
          className={clsx(
            styles.navItem,
            view === "notes" && !selectedFolderId && styles.navItemActive
          )}
          onClick={() => nav("notes", null)}
        >
          <FileText size={18} />
          <span>All Notes</span>
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            className={clsx(
              styles.navItem,
              view === "notes" &&
                selectedFolderId === folder.id &&
                styles.navItemActive
            )}
            onClick={() => nav("notes", folder.id)}
          >
            <ChevronDown size={14} />
            <span>{folder.name}</span>
          </button>
        ))}
        <button className={styles.addNote} onClick={onAddNote}>
          <Plus size={14} />
          New note
        </button>
      </nav>

      <div className={styles.footer}>
        <button
          className={clsx(
            styles.navItem,
            view === "settings" && styles.navItemActive
          )}
          onClick={() => nav("settings")}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
