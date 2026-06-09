import { useState } from "react";
import { Check, ExternalLink, Trash2 } from "lucide-react";
import clsx from "clsx";
import type { Task, TaskView } from "../../types";
import { isOverdue, isToday, isUpcoming } from "../../lib/taskParser";
import styles from "./TaskList.module.css";

interface TaskListProps {
  view: TaskView;
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (title: string) => void;
}

function filterTasks(tasks: Task[], view: TaskView): Task[] {
  const active = tasks.filter((t) => !t.completed);
  switch (view) {
    case "inbox":
      return active.filter((t) => !t.due_date);
    case "today":
      return active.filter((t) => isToday(t.due_date) || isOverdue(t.due_date));
    case "upcoming":
      return active.filter((t) => isUpcoming(t.due_date));
    default:
      return active;
  }
}

const VIEW_TITLES: Record<TaskView, string> = {
  inbox: "Inbox",
  today: "Today",
  upcoming: "Upcoming",
};

const PRIORITY_COLORS: Record<number, string> = {
  1: "#e34432",
  2: "#f5a623",
  3: "#4a90d9",
  4: "#c4c0bb",
};

export function TaskList({ view, tasks, onToggle, onDelete, onAdd }: TaskListProps) {
  const [input, setInput] = useState("");
  const filtered = filterTasks(tasks, view);
  const overdue = view === "today" ? filtered.filter((t) => isOverdue(t.due_date)) : [];
  const rest =
    view === "today"
      ? filtered.filter((t) => !isOverdue(t.due_date))
      : filtered;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput("");
  };

  const renderTask = (task: Task) => (
    <div key={task.id} className={styles.task}>
      <button
        className={styles.checkbox}
        onClick={() => onToggle(task.id)}
        style={{ borderColor: PRIORITY_COLORS[task.priority] }}
        aria-label="Complete task"
      >
        {task.completed && <Check size={12} />}
      </button>
      <div className={styles.taskContent}>
        <span className={clsx(styles.taskTitle, task.completed && styles.completed)}>
          {task.title}
        </span>
        <div className={styles.meta}>
          {task.due_date && (
            <span className={clsx(styles.date, isOverdue(task.due_date) && styles.overdue)}>
              {task.due_date}
            </span>
          )}
          {task.priority < 4 && (
            <span className="chip chip--primary">P{task.priority}</span>
          )}
          {task.source === "jira" && (
            <span className="chip chip--jira">
              {task.jira_key}
              {task.jira_url && (
                <a href={task.jira_url} target="_blank" rel="noreferrer">
                  <ExternalLink size={10} />
                </a>
              )}
            </span>
          )}
        </div>
      </div>
      <button className={styles.deleteBtn} onClick={() => onDelete(task.id)}>
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className="headline-md">{VIEW_TITLES[view]}</h1>
        <span className="body-sm" style={{ color: "var(--color-on-surface-muted)" }}>
          {filtered.length} {filtered.length === 1 ? "task" : "tasks"}
        </span>
      </header>

      {view === "today" && overdue.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Overdue <span className={styles.sectionCount}>{overdue.length}</span>
          </h2>
          {overdue.map(renderTask)}
        </section>
      )}

      <section className={styles.section}>
        {view === "today" && (
          <h2 className={styles.sectionTitle}>
            {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · Today
          </h2>
        )}
        {rest.length === 0 && overdue.length === 0 ? (
          <p className={styles.empty}>No tasks here. Add one below.</p>
        ) : (
          rest.map(renderTask)
        )}
      </section>

      <form className={styles.addForm} onSubmit={handleSubmit}>
        <input
          className={styles.addInput}
          placeholder="Add a task… try 'Review PR tomorrow p2'"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </form>
    </div>
  );
}
