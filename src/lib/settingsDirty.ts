import type { AppSettings, JiraCredentials, McpServerConfig } from "../types";
import { withDefaultIntegrations } from "./integrations";

export interface SettingsBaseline {
  settings: AppSettings;
  jira: JiraCredentials;
  mcp: McpServerConfig;
}

function normalizeSettings(settings: AppSettings): string {
  return JSON.stringify(withDefaultIntegrations(settings));
}

function normalizeJira(jira: JiraCredentials): string {
  return JSON.stringify({
    site_url: jira.site_url.trim(),
    email: jira.email.trim(),
    api_token: jira.api_token.trim(),
  });
}

function normalizeMcp(mcp: McpServerConfig): string {
  return JSON.stringify({
    command: mcp.command.trim(),
    args: mcp.args,
    env: mcp.env,
  });
}

export function isSettingsDirty(
  settings: AppSettings,
  jira: JiraCredentials,
  mcp: McpServerConfig,
  baseline: SettingsBaseline
): boolean {
  return (
    normalizeSettings(settings) !== normalizeSettings(baseline.settings) ||
    normalizeJira(jira) !== normalizeJira(baseline.jira) ||
    normalizeMcp(mcp) !== normalizeMcp(baseline.mcp)
  );
}

export function createSettingsBaseline(
  settings: AppSettings,
  jira: JiraCredentials,
  mcp: McpServerConfig
): SettingsBaseline {
  return {
    settings: withDefaultIntegrations(settings),
    jira: { ...jira },
    mcp: {
      command: mcp.command,
      args: [...mcp.args],
      env: { ...mcp.env },
    },
  };
}
