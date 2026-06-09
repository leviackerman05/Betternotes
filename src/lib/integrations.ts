import type { AppSettings } from "../types";

export const DEFAULT_INTEGRATIONS = {
  local_only_mode: true,
  local_ai_enabled: false,
  mcp_enabled: false,
  jira_enabled: false,
  github_enabled: false,
  linear_enabled: false,
  default_jira_project_key: "",
  jira_section_title: "My issues",
  jira_my_issues_jql: "",
} as const;

export const DEFAULT_JIRA_SECTION_TITLE = "My issues";

export function jiraSectionTitle(settings: AppSettings): string {
  const title = settings.jira_section_title?.trim();
  return title || DEFAULT_JIRA_SECTION_TITLE;
}

export function withDefaultIntegrations(settings: AppSettings): AppSettings {
  return {
    ...DEFAULT_INTEGRATIONS,
    ...settings,
  };
}

export function isLocalOnlyMode(settings: AppSettings): boolean {
  return !!withDefaultIntegrations(settings).local_only_mode;
}

export function isLocalAiEnabled(settings: AppSettings): boolean {
  const s = withDefaultIntegrations(settings);
  return !!s.local_ai_enabled && !s.local_only_mode;
}

export function isMcpEnabled(settings: AppSettings): boolean {
  const s = withDefaultIntegrations(settings);
  return !!s.mcp_enabled && !s.local_only_mode;
}

/** MCP agent blocks need both MCP and local Ollama. */
export function isAgentEnabled(settings: AppSettings): boolean {
  return isMcpEnabled(settings) && isLocalAiEnabled(settings);
}

export function isJiraEnabled(settings: AppSettings): boolean {
  const s = withDefaultIntegrations(settings);
  return !!s.jira_enabled && !s.local_only_mode;
}

export function isGithubEnabled(settings: AppSettings): boolean {
  const s = withDefaultIntegrations(settings);
  return !!s.github_enabled && !s.local_only_mode;
}

export function isLinearEnabled(settings: AppSettings): boolean {
  const s = withDefaultIntegrations(settings);
  return !!s.linear_enabled && !s.local_only_mode;
}

export function anyIntegrationEnabled(settings: AppSettings): boolean {
  const s = withDefaultIntegrations(settings);
  if (s.local_only_mode) return false;
  return (
    !!s.local_ai_enabled ||
    !!s.mcp_enabled ||
    !!s.jira_enabled ||
    !!s.github_enabled ||
    !!s.linear_enabled
  );
}
