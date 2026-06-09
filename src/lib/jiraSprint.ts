import type { JSONContent } from "@tiptap/core";
import type { JiraIssue } from "../types";
import { jiraLineContent } from "./jiraInsert";

/** Inserts tickets as inline lines, not a checklist */
export function sprintTaskListContent(issues: JiraIssue[]): JSONContent[] {
  return issues.map(jiraLineContent);
}
