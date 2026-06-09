import { FileText, Trash2 } from "lucide-react";
import clsx from "clsx";
import type { Note } from "../../types";
import styles from "./NoteList.module.css";

interface NoteListProps {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function NoteList({ notes, selectedId, onSelect, onDelete }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className={styles.empty}>
        <FileText size={32} strokeWidth={1.5} />
        <p>No notes yet</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {notes.map((note) => (
        <div
          key={note.id}
          className={clsx(styles.item, selectedId === note.id && styles.itemActive)}
          onClick={() => onSelect(note.id)}
        >
          <span className={styles.title}>{note.title || "Untitled"}</span>
          <span className={styles.date}>
            {new Date(note.updated_at).toLocaleDateString()}
          </span>
          <button
            className={styles.delete}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
