import { useEffect, useState } from "react";
import type { ReminderRepeat } from "../../types";
import styles from "./ReminderDialog.module.css";

interface ReminderDialogProps {
  open: boolean;
  reminderAt?: string | null;
  reminderRepeat?: ReminderRepeat;
  onConfirm: (reminderAt: string | null, repeat: ReminderRepeat) => void;
  onCancel: () => void;
}

export function ReminderDialog({
  open,
  reminderAt,
  reminderRepeat = "never",
  onConfirm,
  onCancel,
}: ReminderDialogProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [repeat, setRepeat] = useState<ReminderRepeat>("never");

  useEffect(() => {
    if (!open) return;
    if (reminderAt) {
      const d = new Date(reminderAt);
      setDate(d.toISOString().slice(0, 10));
      setTime(d.toTimeString().slice(0, 5));
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().slice(0, 10));
      setTime("09:00");
    }
    setRepeat(reminderRepeat ?? "never");
  }, [open, reminderAt, reminderRepeat]);

  if (!open) return null;

  const handleSet = () => {
    if (!date) return;
    const iso = new Date(`${date}T${time}:00`).toISOString();
    onConfirm(iso, repeat);
  };

  const handleClear = () => onConfirm(null, "never");

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Set Reminder</h3>
        <label className={styles.label}>Remind on</label>
        <div className={styles.row}>
          <input type="date" className={styles.input} value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="time" className={styles.input} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <label className={styles.label}>Repeat</label>
        <select className={styles.select} value={repeat} onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}>
          <option value="never">Never</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <div className={styles.actions}>
          {reminderAt && (
            <button className={styles.clearBtn} onClick={handleClear}>
              Remove
            </button>
          )}
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.confirmBtn} onClick={handleSet}>
            Set
          </button>
        </div>
      </div>
    </div>
  );
}
