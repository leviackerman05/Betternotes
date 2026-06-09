import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { htmlToPlainText } from "../lib/noteExport";
import { showNativeNotification } from "../lib/notifications";
import { advanceReminder } from "../lib/reminderSchedule";
import { useAppStore } from "../store/appStore";
import type { Note, ReminderRepeat } from "../types";

const POLL_MS = 5_000;

function reminderKey(note: Note): string {
  return `${note.id}:${note.reminder_at}`;
}

async function fireReminder(note: Note, firedRef: Set<string>) {
  if (!note.reminder_at) return;

  const key = reminderKey(note);
  if (firedRef.has(key)) return;
  firedRef.add(key);

  const preview = htmlToPlainText(note.content).trim().slice(0, 120);
  try {
    await showNativeNotification(
      note.title?.trim() || "Reminder",
      preview || "You have a note reminder"
    );
  } catch (err) {
    console.error("Failed to show reminder notification:", err);
    firedRef.delete(key);
    return;
  }

  const repeat = (note.reminder_repeat ?? "never") as ReminderRepeat;
  const nextAt = advanceReminder(note.reminder_at, repeat);
  const updated = await api.updateNoteMeta(note.id, {
    reminder_at: nextAt,
    reminder_repeat: repeat,
  });

  const { notes, setNotes } = useAppStore.getState();
  if (notes.some((n) => n.id === note.id)) {
    setNotes(notes.map((n) => (n.id === note.id ? { ...n, ...updated } : n)));
  }
}

export function useReminders() {
  const firedRef = useRef(new Set<string>());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const checkingRef = useRef(false);

  useEffect(() => {
    const clearTimers = () => {
      for (const id of timersRef.current) clearTimeout(id);
      timersRef.current = [];
    };

    const scheduleUpcoming = (notes: Note[]) => {
      clearTimers();
      const now = Date.now();

      for (const note of notes) {
        if (!note.reminder_at) continue;
        const due = new Date(note.reminder_at).getTime();
        const delay = due - now;
        if (delay <= 0 || delay > 86_400_000) continue;

        const key = reminderKey(note);
        if (firedRef.current.has(key)) continue;

        const timer = setTimeout(() => {
          void fireReminder(note, firedRef.current);
        }, delay);
        timersRef.current.push(timer);
      }
    };

    const check = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const dueNotes = await api.listNotes({ reminderOnly: true });
        const now = Date.now();

        scheduleUpcoming(dueNotes);

        for (const note of dueNotes) {
          if (!note.reminder_at) continue;
          if (new Date(note.reminder_at).getTime() > now) continue;
          await fireReminder(note, firedRef.current);
        }
      } finally {
        checkingRef.current = false;
      }
    };

    void check();

    const interval = setInterval(() => void check(), POLL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      clearTimers();
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}
