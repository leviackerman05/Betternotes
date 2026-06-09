import type { Editor, JSONContent } from "@tiptap/core";
import type { JiraIssue } from "../types";
import { extractJiraKey } from "./jiraKeys";

export type ListContext = "task" | "bullet" | "ordered" | null;

export function getListContext(editor: Editor): ListContext {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const name = $from.node(depth).type.name;
    if (name === "taskList") return "task";
    if (name === "bulletList") return "bullet";
    if (name === "orderedList") return "ordered";
  }
  return null;
}

function chipAttrs(issue: JiraIssue) {
  return {
    key: issue.key,
    summary: issue.summary,
    status: issue.status,
    statusCategory: issue.status_category,
    assignee: issue.assignee ?? null,
    url: issue.url,
  };
}

export function jiraLineContent(issue: JiraIssue): JSONContent {
  return {
    type: "paragraph",
    content: [
      { type: "jiraChip", attrs: chipAttrs(issue) },
      { type: "text", text: ` ${issue.summary}` },
    ],
  };
}

function metaLine(label: string, value: string): JSONContent {
  return {
    type: "paragraph",
    content: [
      { type: "text", marks: [{ type: "bold" }], text: `${label}: ` },
      { type: "text", text: value },
    ],
  };
}

export function jiraDetailContent(issue: JiraIssue): JSONContent[] {
  const blocks: JSONContent[] = [jiraLineContent(issue)];

  if (issue.status) blocks.push(metaLine("Status", issue.status));
  if (issue.assignee) blocks.push(metaLine("Assignee", issue.assignee));
  if (issue.reporter) blocks.push(metaLine("Reporter", issue.reporter));
  if (issue.priority) blocks.push(metaLine("Priority", issue.priority));
  if (issue.issue_type) blocks.push(metaLine("Type", issue.issue_type));
  if (issue.story_points != null) {
    blocks.push(metaLine("Story points", String(issue.story_points)));
  }
  if (issue.description?.trim()) {
    blocks.push({
      type: "paragraph",
      content: [{ type: "text", marks: [{ type: "bold" }], text: "Description" }],
    });
    blocks.push({
      type: "paragraph",
      content: [{ type: "text", text: issue.description.trim() }],
    });
  }

  return blocks;
}

/** Always inserts inline lines, never as a to-do checklist */
export function insertJiraIssues(
  editor: Editor,
  issues: JiraIssue[],
  opts: { withDetails?: boolean } = {}
) {
  if (issues.length === 0) return;

  const withDetails = opts.withDetails ?? false;
  const ctx = getListContext(editor);
  const chain = editor.chain().focus();

  if (ctx && !withDetails) {
    for (const issue of issues) {
      chain.insertContent([
        { type: "jiraChip", attrs: chipAttrs(issue) },
        { type: "text", text: ` ${issue.summary}` },
      ]);
    }
    chain.run();
    return;
  }

  const content: JSONContent[] = [];
  for (const issue of issues) {
    if (withDetails) {
      content.push(...jiraDetailContent(issue));
    } else {
      content.push(jiraLineContent(issue));
    }
  }
  chain.insertContent(content).run();
}

export const JIRA_STATUS_COMMANDS: Record<string, { label: string; statuses: string[] }> = {
  "ticket-in-progress": { label: "In Progress", statuses: ["in progress"] },
  "ticket-todo": { label: "To Do", statuses: ["to do", "todo"] },
  "ticket-review": { label: "Code Review", statuses: ["code review", "in review", "review"] },
};

export function filterIssuesByStatus(issues: JiraIssue[], statuses: string[]): JiraIssue[] {
  const needles = statuses.map((s) => s.toLowerCase());
  return issues.filter((issue) => {
    const status = issue.status.toLowerCase();
    return needles.some((n) => status.includes(n));
  });
}

export function parseSlashJiraKey(filter: string): string | null {
  return extractJiraKey(filter.trim());
}
