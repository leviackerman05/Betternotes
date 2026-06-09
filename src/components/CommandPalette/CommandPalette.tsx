import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import styles from "./CommandPalette.module.css";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  group: string;
}

interface CommandPaletteProps {
  onAddTask: () => void;
  onAddNote: () => void;
}

export function CommandPalette({ onAddTask, onAddNote }: CommandPaletteProps) {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setView = useAppStore((s) => s.setView);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: "inbox", label: "Go to Inbox", shortcut: "G I", group: "Navigate", action: () => setView("inbox") },
    { id: "today", label: "Go to Today", shortcut: "G T", group: "Navigate", action: () => setView("today") },
    { id: "upcoming", label: "Go to Upcoming", shortcut: "G U", group: "Navigate", action: () => setView("upcoming") },
    { id: "notes", label: "Go to Notes", shortcut: "G N", group: "Navigate", action: () => setView("notes") },
    { id: "settings", label: "Go to Settings", shortcut: "G S", group: "Navigate", action: () => setView("settings") },
    { id: "add-task", label: "Add task", group: "Actions", action: onAddTask },
    { id: "add-note", label: "New note", group: "Actions", action: onAddNote },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const groups = [...new Set(filtered.map((c) => c.group))];

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  const run = (cmd: Command) => {
    cmd.action();
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <Search size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Search or type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) run(filtered[0]);
            }}
          />
          <kbd className={styles.kbd}>⌘K</kbd>
        </div>
        <div className={styles.results}>
          {groups.map((group) => (
            <div key={group}>
              <p className={styles.groupLabel}>{group}</p>
              {filtered
                .filter((c) => c.group === group)
                .map((cmd) => (
                  <button
                    key={cmd.id}
                    className={styles.item}
                    onClick={() => run(cmd)}
                  >
                    <span>{cmd.label}</span>
                    {cmd.shortcut && <kbd className={styles.shortcut}>{cmd.shortcut}</kbd>}
                  </button>
                ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className={styles.noResults}>No commands found</p>
          )}
        </div>
      </div>
    </div>
  );
}
