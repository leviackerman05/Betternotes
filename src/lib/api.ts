import { invoke } from "@tauri-apps/api/core";
import type {
  AgentMessage,
  AppSettings,
  Folder,
  JiraCredentials,
  McpServerConfig,
  Note,
  Task,
} from "../types";

export const api = {
  // Tasks
  listTasks: () => invoke<Task[]>("list_tasks"),
  createTask: (task: Omit<Task, "id" | "created_at" | "updated_at">) =>
    invoke<Task>("create_task", { task }),
  updateTask: (id: string, updates: Partial<Task>) =>
    invoke<Task>("update_task", { id, updates }),
  deleteTask: (id: string) => invoke<void>("delete_task", { id }),

  // Folders
  listFolders: () => invoke<Folder[]>("list_folders"),
  createFolder: (name: string) => invoke<Folder>("create_folder", { name }),
  deleteFolder: (id: string) => invoke<void>("delete_folder", { id }),

  // Notes
  listNotes: (folderId?: string) =>
    invoke<Note[]>("list_notes", { folderId: folderId ?? null }),
  getNote: (id: string) => invoke<Note>("get_note", { id }),
  createNote: (title: string, folderId?: string) =>
    invoke<Note>("create_note", { title, folderId: folderId ?? null }),
  updateNote: (id: string, title: string, content: string) =>
    invoke<Note>("update_note", { id, title, content }),
  deleteNote: (id: string) => invoke<void>("delete_note", { id }),

  // Settings
  getSettings: () => invoke<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) =>
    invoke<void>("save_settings", { settings }),

  // Jira credentials (keychain)
  saveJiraCredentials: (creds: JiraCredentials) =>
    invoke<void>("save_jira_credentials", { creds }),
  getJiraCredentials: () =>
    invoke<JiraCredentials | null>("get_jira_credentials"),
  deleteJiraCredentials: () => invoke<void>("delete_jira_credentials"),

  // MCP config
  getMcpConfig: () => invoke<McpServerConfig>("get_mcp_config"),
  saveMcpConfig: (config: McpServerConfig) =>
    invoke<void>("save_mcp_config", { config }),

  // Agent
  runAgent: (prompt: string, history: AgentMessage[]) =>
    invoke<AgentMessage[]>("run_agent", { prompt, history }),

  checkOllama: () => invoke<{ available: boolean; models: string[] }>("check_ollama"),
};
