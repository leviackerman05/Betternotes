import type { Task } from "../types";

export interface JiraTaskMeta {
  status: string;
  issueType?: string;
}

const STATUS_ORDER = ["To Do", "In Progress", "In Review", "Blocked", "Open", "Reopened"];

export function parseJiraMeta(task: Task): JiraTaskMeta {
  const desc = task.description?.trim() ?? "";
  if (!desc) return { status: "Open" };
  const parts = desc.split(" · ").map((p) => p.trim());
  if (parts.length >= 2) {
    return { status: parts[0], issueType: parts[parts.length - 1] };
  }
  return { status: parts[0] };
}

export function jiraTasksOnly(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.source === "jira" && !t.completed);
}

export function groupJiraTasksByStatus(tasks: Task[]): { status: string; tasks: Task[] }[] {
  const jira = jiraTasksOnly(tasks);
  const groups = new Map<string, Task[]>();

  for (const task of jira) {
    const { status } = parseJiraMeta(task);
    const list = groups.get(status) ?? [];
    list.push(task);
    groups.set(status, list);
  }

  const ordered = [...groups.entries()].sort(([a], [b]) => {
    const ai = STATUS_ORDER.findIndex((s) => a.toLowerCase().includes(s.toLowerCase()));
    const bi = STATUS_ORDER.findIndex((s) => b.toLowerCase().includes(s.toLowerCase()));
    const ar = ai === -1 ? STATUS_ORDER.length : ai;
    const br = bi === -1 ? STATUS_ORDER.length : bi;
    if (ar !== br) return ar - br;
    return a.localeCompare(b);
  });

  return ordered.map(([status, items]) => ({ status, tasks: items }));
}

export function statusTone(status: string): "todo" | "progress" | "review" | "default" {
  const s = status.toLowerCase();
  if (s.includes("progress") || s.includes("doing")) return "progress";
  if (s.includes("review") || s.includes("qa")) return "review";
  if (s.includes("to do") || s.includes("open") || s.includes("backlog")) return "todo";
  return "default";
}
