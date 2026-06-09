import type { Note } from "../../types";
import { getNoteStats } from "../../lib/noteExport";
import styles from "./NoteInfoDialog.module.css";

interface NoteInfoDialogProps {
  note: Note;
  onClose: () => void;
}

export function NoteInfoDialog({ note, onClose }: NoteInfoDialogProps) {
  const stats = getNoteStats(note.title, note.content);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Note Info</h3>
        <dl className={styles.grid}>
          <dt>Title</dt>
          <dd>{stats.title}</dd>
          <dt>Words</dt>
          <dd>{stats.words}</dd>
          <dt>Characters</dt>
          <dd>{stats.characters}</dd>
          <dt>Created</dt>
          <dd>{formatDate(note.created_at)}</dd>
          <dt>Modified</dt>
          <dd>{formatDate(note.updated_at)}</dd>
          <dt>Tags</dt>
          <dd>{note.tags?.length ? note.tags.join(", ") : "None"}</dd>
          <dt>Reminder</dt>
          <dd>
            {note.reminder_at
              ? formatDate(note.reminder_at) +
                (note.reminder_repeat && note.reminder_repeat !== "never"
                  ? ` · ${note.reminder_repeat}`
                  : "")
              : "None"}
          </dd>
          <dt>Color</dt>
          <dd>{note.color ?? "Default"}</dd>
          <dt>Status</dt>
          <dd>
            {[
              note.pinned && "Pinned",
              note.favorite && "Favorite",
              note.locked && "Locked",
              note.archived && "Archived",
            ]
              .filter(Boolean)
              .join(", ") || "Normal"}
          </dd>
        </dl>
        <button className={styles.closeBtn} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
