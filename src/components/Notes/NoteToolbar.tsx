import { Bell, CheckSquare, Palette, Share2, Tag } from "lucide-react";
import clsx from "clsx";
import { NOTE_COLORS } from "../../lib/noteColors";
import type { Note, NoteColor } from "../../types";
import { ReminderBadge } from "./ReminderBadge";
import styles from "./NoteToolbar.module.css";

interface NoteToolbarProps {
  note: Note;
  onTags: () => void;
  onReminder: () => void;
  onShare: () => void;
  onColor: (color: NoteColor) => void;
  showColorPicker: boolean;
  onToggleColorPicker: () => void;
}

export function NoteToolbar({
  note,
  onTags,
  onReminder,
  onShare,
  onColor,
  showColorPicker,
  onToggleColorPicker,
}: NoteToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <button className={styles.btn} onClick={onTags} title="Tags">
        <Tag size={18} />
        {note.tags && note.tags.length > 0 && (
          <span className={styles.badge}>{note.tags.length}</span>
        )}
      </button>
      <button className={styles.btn} onClick={onShare} title="Share">
        <Share2 size={18} />
      </button>
      <button
        className={clsx(
          styles.btn,
          styles.reminderBtn,
          note.reminder_at && styles.btnActive
        )}
        onClick={onReminder}
        title="Reminder"
      >
        <Bell size={18} />
        {note.reminder_at && <ReminderBadge reminderAt={note.reminder_at} />}
      </button>
      <button
        className={clsx(styles.btn, showColorPicker && styles.btnActive)}
        onClick={onToggleColorPicker}
        title="Color"
      >
        <Palette size={18} />
      </button>
      <button className={styles.btn} title="Checklist" disabled>
        <CheckSquare size={18} />
      </button>

      {showColorPicker && (
        <div className={styles.colorPicker}>
          <button className={styles.colorNone} onClick={() => onColor(null)} title="No color" />
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              className={clsx(styles.colorSwatch, note.color === c.id && styles.colorSwatchOn)}
              style={{ background: c.bg }}
              onClick={() => onColor(c.id)}
              title={c.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}
