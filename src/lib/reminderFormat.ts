/** Compact countdown label for reminder badges (e.g. "12m", "2h", "3d"). */
export function formatReminderCountdown(reminderAt: string, now = Date.now()): string {
  const due = new Date(reminderAt).getTime();
  const diff = due - now;

  if (diff <= 0) return "Now";

  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalMinutes < 60) return `${totalMinutes}m`;
  if (totalHours < 24) {
    const mins = totalMinutes % 60;
    return mins > 0 ? `${totalHours}h ${mins}m` : `${totalHours}h`;
  }
  if (totalDays === 1) return "1d";
  if (totalDays < 7) return `${totalDays}d`;

  return new Date(reminderAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
