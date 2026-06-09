import { useEffect, useState } from "react";
import clsx from "clsx";
import { formatReminderCountdown } from "../../lib/reminderFormat";
import styles from "./ReminderBadge.module.css";

interface ReminderBadgeProps {
  reminderAt: string;
  className?: string;
}

export function ReminderBadge({ reminderAt, className }: ReminderBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const msUntil = new Date(reminderAt).getTime() - Date.now();
    const intervalMs = msUntil < 3600_000 ? 1000 : 30_000;
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [reminderAt]);

  const due = new Date(reminderAt).getTime() <= now;
  const label = formatReminderCountdown(reminderAt, now);

  return (
    <span
      className={clsx(styles.badge, due && styles.badgeDue, className)}
      title={new Date(reminderAt).toLocaleString()}
    >
      {label}
    </span>
  );
}
