import { CheckSquare, Kanban, PenLine } from "lucide-react";
import styles from "./NoteEmptyState.module.css";

interface NoteEmptyStateProps {
  onWrite: () => void;
  onChecklist: () => void;
  onSprint?: () => void;
  showSprint?: boolean;
}

export function NoteEmptyState({
  onWrite,
  onChecklist,
  onSprint,
  showSprint = false,
}: NoteEmptyStateProps) {
  const actions = [
    { id: "write", label: "Write", icon: PenLine, onClick: onWrite },
    { id: "checklist", label: "Checklist", icon: CheckSquare, onClick: onChecklist },
    ...(showSprint && onSprint
      ? [{ id: "sprint", label: "My sprint", icon: Kanban, onClick: onSprint }]
      : []),
  ];

  return (
    <div className={styles.empty}>
      <h2 className={styles.heading}>Jot down your ideas</h2>
      <p className={styles.sub}>
        Pick a quick action, or open a note and type <kbd>/</kbd> for commands
      </p>
      <div className={styles.panel}>
        {actions.map(({ id, label, icon: Icon, onClick }) => (
          <button key={id} className={styles.row} onClick={onClick}>
            <span className={styles.rowIcon}>
              <Icon size={18} />
            </span>
            <span className={styles.rowTitle}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
