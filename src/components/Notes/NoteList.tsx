import { useMemo, useRef, useState } from "react";
import {
  Archive,
  Bell,
  CheckSquare,
  GitBranch,
  Image,
  Lock,
  MoreHorizontal,
  Pin,
  Search,
  SquarePen,
  Star,
} from "lucide-react";
import clsx from "clsx";
import type { Folder, Note } from "../../types";
import { getNoteColorStyle } from "../../lib/noteColors";
import { noAutocorrectProps } from "../../lib/noAutocorrect";
import { getNotePreview } from "../../lib/notePreview";
import { useAppStore } from "../../store/appStore";
import { NoteContextMenu, type NoteMenuActions } from "./NoteContextMenu";
import { ReminderBadge } from "./ReminderBadge";
import styles from "./NoteList.module.css";

interface NoteListProps {
  collectionTitle?: string;
  notes: Note[];
  folders: Folder[];
  currentFolderId?: string;
  selectedId: string | null;
  showArchived: boolean;
  onSelect: (id: string) => void;
  onAddNote: () => void;
  onToggleArchived: () => void;
  onToggleFavorite: (note: Note) => void;
  menuActions: (note: Note) => NoteMenuActions;
  notesPane: "editor" | "graph";
  onTogglePane: (pane: "editor" | "graph") => void;
}

function PreviewIcon({ type }: { type: ReturnType<typeof getNotePreview>["type"] }) {
  if (type === "checklist") return <CheckSquare size={14} />;
  if (type === "image") return <Image size={14} />;
  if (type === "audio") return <Bell size={14} />;
  return null;
}

export function NoteList({
  collectionTitle,
  notes,
  folders,
  currentFolderId,
  selectedId,
  showArchived,
  onSelect,
  onAddNote,
  onToggleArchived,
  onToggleFavorite,
  menuActions,
  notesPane,
  onTogglePane,
}: NoteListProps) {
  const listSearchQuery = useAppStore((s) => s.listSearchQuery);
  const setListSearchQuery = useAppStore((s) => s.setListSearchQuery);
  const [menu, setMenu] = useState<{ note: Note; x: number; y: number } | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  const archivedCount = useMemo(() => notes.filter((n) => n.archived).length, [notes]);

  const visibleNotes = useMemo(() => {
    const q = listSearchQuery.trim().toLowerCase();
    return notes
      .filter((n) => (showArchived ? true : !n.archived))
      .filter((n) => {
        if (!q) return true;
        const inTitle = (n.title || "Untitled").toLowerCase().includes(q);
        const inTags = (n.tags ?? []).some((t) => t.toLowerCase().includes(q));
        return inTitle || inTags;
      });
  }, [notes, showArchived, listSearchQuery]);

  const selectedNote = notes.find((n) => n.id === selectedId);

  const openNoteMenu = (note: Note, x: number, y: number) => {
    setMenu({ note, x, y });
  };

  const handleContextMenu = (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    e.stopPropagation();
    openNoteMenu(note, e.clientX, e.clientY);
  };

  const openSelectedNoteMenu = () => {
    if (!selectedNote || !moreBtnRef.current) return;
    const rect = moreBtnRef.current.getBoundingClientRect();
    openNoteMenu(selectedNote, rect.left, rect.bottom + 4);
  };

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.workspaceName} title={collectionTitle}>
            {collectionTitle ?? "Notes"}
          </h2>
          <span className={styles.noteCount}>
            {visibleNotes.length} {visibleNotes.length === 1 ? "note" : "notes"}
          </span>
        </div>
        <div className={styles.headerActions}>
          {selectedNote && (
            <>
              <button
                className={styles.iconAction}
                onClick={() => onToggleFavorite(selectedNote)}
                title={selectedNote.favorite ? "Remove favorite" : "Favorite"}
              >
                <Star
                  size={16}
                  className={selectedNote.favorite ? styles.starOn : undefined}
                />
              </button>
              <button
                ref={moreBtnRef}
                className={styles.iconAction}
                onClick={openSelectedNoteMenu}
                title="Note actions"
                aria-haspopup="menu"
                aria-expanded={menu?.note.id === selectedNote.id}
              >
                <MoreHorizontal size={16} />
              </button>
            </>
          )}
          <button
            className={clsx(styles.viewBtn, notesPane === "graph" && styles.viewBtnActive)}
            onClick={() => onTogglePane(notesPane === "graph" ? "editor" : "graph")}
            title="Graph view"
          >
            <GitBranch size={16} />
          </button>
          {archivedCount > 0 && (
            <button
              className={clsx(styles.archiveToggle, showArchived && styles.archiveToggleOn)}
              onClick={onToggleArchived}
              title={showArchived ? "Hide archived" : "Show archived"}
            >
              <Archive size={15} />
            </button>
          )}
          <button className={styles.addBtn} onClick={onAddNote} title="New note">
            <SquarePen size={17} />
          </button>
        </div>
      </header>

      <div className={styles.listSearch}>
        <Search size={15} className={styles.listSearchIcon} />
        <input
          className={styles.listSearchInput}
          placeholder="Search notes, tags…"
          {...noAutocorrectProps}
          value={listSearchQuery}
          onChange={(e) => setListSearchQuery(e.target.value)}
        />
      </div>

      {visibleNotes.length === 0 ? (
        <div className={styles.empty}>
          <p>{listSearchQuery ? "No matching notes" : "No notes yet"}</p>
          {!listSearchQuery && (
            <button className={styles.emptyAdd} onClick={onAddNote}>
              <SquarePen size={14} />
              Create a note
            </button>
          )}
        </div>
      ) : (
        <div className={styles.cards}>
          {visibleNotes.map((note) => {
            const preview = getNotePreview(note.content);
            const colorStyle = getNoteColorStyle(note.color ?? null);
            return (
              <div
                key={note.id}
                className={clsx(
                  styles.card,
                  selectedId === note.id && styles.cardActive,
                  note.archived && styles.cardArchived
                )}
                style={colorStyle}
                onClick={() => onSelect(note.id)}
                onContextMenu={(e) => handleContextMenu(e, note)}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{note.title || "Untitled"}</span>
                  <div className={styles.cardBadges}>
                    {note.pinned && <Pin size={10} />}
                    {note.favorite && <Star size={10} />}
                    {note.locked && <Lock size={10} />}
                    {note.reminder_at && (
                      <ReminderBadge reminderAt={note.reminder_at} />
                    )}
                  </div>
                </div>
                <div className={styles.cardPreview}>
                  <PreviewIcon type={preview.type} />
                  <span>{preview.lines[0]}</span>
                </div>
                {(note.tags?.length ?? 0) > 0 && (
                  <div className={styles.cardTags}>
                    {note.tags!.slice(0, 2).map((t) => (
                      <span key={t} className={styles.cardTag}>{t}</span>
                    ))}
                  </div>
                )}
                <span className={styles.cardDate}>
                  {new Date(note.updated_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {menu && (
        <NoteContextMenu
          note={menu.note}
          folders={folders}
          currentFolderId={currentFolderId}
          position={{ x: menu.x, y: menu.y }}
          onClose={() => setMenu(null)}
          actions={menuActions(menu.note)}
        />
      )}
    </div>
  );
}
