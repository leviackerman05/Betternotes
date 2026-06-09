export type AppView = "notes" | "settings" | "jira";

export type TaskSource = "manual" | "jira";

export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: 1 | 2 | 3 | 4;
  completed: boolean;
  source: TaskSource;
  jira_key?: string;
  jira_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  created_at: string;
  note_count?: number;
}

export type NoteColor = "yellow" | "blue" | "teal" | "purple" | "red" | null;
export type ReminderRepeat = "never" | "daily" | "weekly" | "monthly";
export type NotesCollection =
  | "workspace"
  | "all"
  | "favorites"
  | "reminders"
  | "tag";

export interface Tag {
  id: string;
  name: string;
  created_at: string;
  note_count?: number;
}

export interface Note {
  id: string;
  folder_id?: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  pinned?: boolean;
  favorite?: boolean;
  archived?: boolean;
  locked?: boolean;
  color?: NoteColor;
  reminder_at?: string | null;
  reminder_repeat?: ReminderRepeat;
  tags?: string[];
}

export interface ListNotesFilter {
  folderId?: string;
  favoriteOnly?: boolean;
  reminderOnly?: boolean;
  tagId?: string;
}

export interface JiraCredentials {
  site_url: string;
  email: string;
  api_token: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  status_category: string;
  assignee?: string | null;
  priority?: string | null;
  url: string;
  description?: string | null;
  issue_type?: string | null;
  reporter?: string | null;
  story_points?: number | null;
}

export interface JiraUser {
  account_id: string;
  display_name: string;
  email?: string | null;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  used_ai: boolean;
}

export interface JiraCreateRequest {
  project_key: string;
  summary: string;
  description?: string | null;
  issue_type?: string | null;
  assignee_account_id?: string | null;
  reporter_account_id?: string | null;
  sprint_id?: number | null;
  story_points?: number | null;
}

export interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface AppSettings {
  theme: "light" | "dark";
  ollama_endpoint: string;
  ollama_model: string;
  sidebar_collapsed?: boolean;
  /** When true, all external network integrations are blocked. Default: true */
  local_only_mode?: boolean;
  local_ai_enabled?: boolean;
  mcp_enabled?: boolean;
  jira_enabled?: boolean;
  github_enabled?: boolean;
  linear_enabled?: boolean;
  /** User-configured default Jira project key (e.g. PROJ) */
  default_jira_project_key?: string;
  /** Custom label for the Jira issues sidebar section (default: My issues) */
  jira_section_title?: string;
  /** Custom JQL for My Issues sync; empty uses the default sprint + backlog query */
  jira_my_issues_jql?: string;
  jira_credentials?: JiraCredentials;
  mcp_config?: McpServerConfig;
}

export interface AgentMessage {
  role: "user" | "assistant" | "tool";
  content: string;
}

export interface AgentBlockData {
  messages: AgentMessage[];
  status: "idle" | "running" | "done" | "error";
  error?: string;
}
