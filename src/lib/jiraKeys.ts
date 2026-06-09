/** Match Jira issue keys like SCRUM-1, PROJ-42 */
export const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/;

/** Extract key from Jira browse URL */
export function keyFromJiraUrl(text: string): string | null {
  const m = text.match(/atlassian\.net\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

export function extractJiraKey(text: string): string | null {
  const fromUrl = keyFromJiraUrl(text);
  if (fromUrl) return fromUrl;
  const m = text.trim().match(/^([A-Za-z][A-Za-z0-9]+-\d+)$/i);
  return m ? m[1].toUpperCase() : null;
}

export function projectKeyFromIssueKey(key: string): string {
  const idx = key.indexOf("-");
  return idx > 0 ? key.slice(0, idx).toUpperCase() : key.toUpperCase();
}

/** Guess default project from note HTML or user-configured fallback */
export function inferJiraProjectKey(html: string, fallback = ""): string {
  const m = html.match(/data-jira-key="([A-Z][A-Z0-9]+-\d+)"/i)
    ?? html.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  if (m) return projectKeyFromIssueKey(m[1].toUpperCase());
  return fallback.trim().toUpperCase();
}

export function statusDotColor(category: string): string {
  switch (category.toLowerCase()) {
    case "done":
      return "#22c55e";
    case "indeterminate":
    case "in progress":
      return "#3b82f6";
    case "new":
    case "todo":
      return "#94a3b8";
    default:
      return "#f59e0b";
  }
}
