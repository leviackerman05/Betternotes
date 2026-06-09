import type { AppSettings } from "../types";

export const DEFAULT_JIRA_MY_ISSUES_JQL =
  "assignee = currentUser() AND statusCategory != Done AND (sprint in openSprints() OR sprint IS EMPTY) ORDER BY updated DESC";

export type JiraMyIssuesPreset = "sprint_and_backlog" | "sprint_only" | "all_open";

const PRESET_BASE: Record<JiraMyIssuesPreset, string> = {
  sprint_and_backlog: DEFAULT_JIRA_MY_ISSUES_JQL,
  sprint_only:
    "assignee = currentUser() AND statusCategory != Done AND sprint in openSprints() ORDER BY updated DESC",
  all_open:
    "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC",
};

export function applyProjectToJql(jql: string, projectKey?: string): string {
  const key = projectKey?.trim();
  if (!key || /project\s*=/i.test(jql)) return jql;

  const orderMatch = jql.match(/\s+ORDER BY\s/i);
  if (orderMatch?.index != null) {
    const before = jql.slice(0, orderMatch.index).trimEnd();
    const after = jql.slice(orderMatch.index);
    return `${before} AND project = "${key}"${after}`;
  }
  return `${jql.trimEnd()} AND project = "${key}"`;
}

export function buildJiraMyIssuesPreset(
  preset: JiraMyIssuesPreset,
  settings: AppSettings
): string {
  return applyProjectToJql(PRESET_BASE[preset], settings.default_jira_project_key);
}

/** Effective JQL used for My Issues sync (custom query or default + optional project). */
export function jiraMyIssuesJql(settings: AppSettings): string {
  const custom = settings.jira_my_issues_jql?.trim();
  if (custom) return custom;
  return applyProjectToJql(DEFAULT_JIRA_MY_ISSUES_JQL, settings.default_jira_project_key);
}

export function activeJiraMyIssuesFilter(
  settings: AppSettings
): JiraMyIssuesPreset | "custom" {
  const stored = settings.jira_my_issues_jql?.trim() ?? "";
  if (!stored) return "sprint_and_backlog";

  const presets: JiraMyIssuesPreset[] = [
    "sprint_and_backlog",
    "sprint_only",
    "all_open",
  ];
  for (const preset of presets) {
    const built =
      preset === "sprint_and_backlog"
        ? applyProjectToJql(
            DEFAULT_JIRA_MY_ISSUES_JQL,
            settings.default_jira_project_key
          )
        : buildJiraMyIssuesPreset(preset, settings);
    if (stored === built) return preset;
  }
  return "custom";
}

export const JIRA_MY_ISSUES_FILTER_LABELS: Record<
  JiraMyIssuesPreset | "custom",
  string
> = {
  sprint_and_backlog: "Sprint & backlog",
  sprint_only: "Sprint",
  all_open: "All open",
  custom: "Custom",
};

export function jiraMyIssuesScopeLabel(settings: AppSettings): string {
  const jql = jiraMyIssuesJql(settings).toLowerCase();
  if (jql.includes("opensprints()") && jql.includes("sprint is empty")) {
    return "current sprint & backlog";
  }
  if (jql.includes("opensprints()")) return "current sprint";
  if (
    jql.includes("assignee = currentuser()") &&
    jql.includes("statuscategory != done") &&
    !jql.includes("sprint")
  ) {
    return "all open";
  }
  return "custom query";
}
