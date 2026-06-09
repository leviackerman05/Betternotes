export type TaskView = "inbox" | "today" | "upcoming";
export type AppView = TaskView | "notes" | "settings";

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
}

export interface Note {
  id: string;
  folder_id?: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface JiraCredentials {
  site_url: string;
  email: string;
  api_token: string;
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
