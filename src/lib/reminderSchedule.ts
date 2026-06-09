import type { ReminderRepeat } from "../types";

/** Advance a due reminder to the next occurrence, or null to clear one-time reminders. */
export function advanceReminder(
  reminderAt: string,
  repeat: ReminderRepeat
): string | null {
  if (repeat === "never") return null;

  const now = Date.now();
  const d = new Date(reminderAt);

  while (d.getTime() <= now) {
    if (repeat === "daily") d.setDate(d.getDate() + 1);
    else if (repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
    else return null;
  }

  return d.toISOString();
}
