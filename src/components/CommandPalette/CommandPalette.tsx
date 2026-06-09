import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import clsx from "clsx";
import { api } from "../../lib/api";
import { useAppStore } from "../../store/appStore";
import type { Note } from "../../types";
import styles from "./CommandPalette.module.css";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  group: string;
}

interface SearchItem {
  id: string;
  label: string;
  sublabel?: string;
  group: string;
  action: () => void;
}

interface CommandPaletteProps {
  onAddNote: () => void;
}

export function CommandPalette({ onAddNote }: CommandPaletteProps) {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const query = useAppStore((s) => s.paletteQuery);
  const setQuery = useAppStore((s) => s.setPaletteQuery);
  const setView = useAppStore((s) => s.setView);
  const setSelectedNoteId = useAppStore((s) => s.setSelectedNoteId);
  const setSelectedFolderId = useAppStore((s) => s.setSelectedFolderId);
  const setNotesPane = useAppStore((s) => s.setNotesPane);
  const folders = useAppStore((s) => s.folders);
  const inputRef = useRef<HTMLInputElement>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedRef = useRef(0);

  const commands = useMemo<Command[]>(
    () => [
      { id: "notes", label: "Go to Notes", shortcut: "G N", group: "Navigate", action: () => setView("notes") },
      { id: "settings", label: "Go to Settings", shortcut: "G S", group: "Navigate", action: () => setView("settings") },
      { id: "add-note", label: "Quick capture: new note", shortcut: "⌘N", group: "Actions", action: onAddNote },
    ],
    [setView, onAddNote]
  );

  useEffect(() => {
    if (open) {
      setSelectedIndex(0);
      selectedRef.current = 0;
      api.listNotes().then(setAllNotes);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const folderName = useCallback(
    (folderId?: string) =>
      folders.find((f) => f.id === folderId)?.name ?? "Workspace",
    [folders]
  );

  const items = useMemo((): SearchItem[] => {
    const q = query.trim().toLowerCase();
    const results: SearchItem[] = [];

    for (const cmd of commands) {
      if (!q || cmd.label.toLowerCase().includes(q)) {
        results.push({
          id: `cmd-${cmd.id}`,
          label: cmd.label,
          group: cmd.group,
          action: cmd.action,
        });
      }
    }

    const stripHtml = (html: string) =>
      html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

    for (const note of allNotes) {
      const title = note.title || "Untitled";
      const contentText = stripHtml(note.content || "");
      if (!q || title.toLowerCase().includes(q) || contentText.includes(q)) {
        results.push({
          id: `note-${note.id}`,
          label: title,
          sublabel: folderName(note.folder_id),
          group: "Notes",
          action: () => {
            if (note.folder_id) setSelectedFolderId(note.folder_id);
            setSelectedNoteId(note.id);
            setNotesPane("editor");
            setView("notes");
          },
        });
      }
    }

    return results;
  }, [
    query,
    allNotes,
    commands,
    folderName,
    setSelectedFolderId,
    setSelectedNoteId,
    setNotesPane,
    setView,
  ]);

  const groups = [...new Set(items.map((i) => i.group))];

  useEffect(() => {
    setSelectedIndex(0);
    selectedRef.current = 0;
  }, [query]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const run = useCallback(
    (item: SearchItem) => {
      item.action();
      close();
    },
    [close]
  );

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedRef.current = (selectedRef.current + 1) % items.length;
        setSelectedIndex(selectedRef.current);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedRef.current = (selectedRef.current - 1 + items.length) % items.length;
        setSelectedIndex(selectedRef.current);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[selectedRef.current];
        if (item) run(item);
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, items, run, close]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <Search size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Search notes and commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className={styles.kbd}>⌘F</kbd>
        </div>
        <div className={clsx(styles.results, "hide-scrollbar")}>
          {groups.map((group) => (
            <div key={group}>
              <p className={styles.groupLabel}>{group}</p>
              {items
                .filter((i) => i.group === group)
                .map((item) => {
                  const index = flatIndex++;
                  const isActive = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      className={clsx(styles.item, isActive && styles.itemActive)}
                      onMouseEnter={() => {
                        selectedRef.current = index;
                        setSelectedIndex(index);
                      }}
                      onClick={() => run(item)}
                    >
                      <div className={styles.itemText}>
                        <span>{item.label}</span>
                        {item.sublabel && (
                          <span className={styles.itemSub}>{item.sublabel}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          ))}
          {items.length === 0 && (
            <p className={styles.noResults}>No results found</p>
          )}
        </div>
      </div>
    </div>
  );
}
