import { invoke } from "@tauri-apps/api/core";
import type {
  AgentMessage,
  AppSettings,
  Folder,
  JiraCredentials,
  JiraCreateRequest,
  JiraIssue,
  JiraSearchResponse,
  JiraSprint,
  JiraUser,
  McpServerConfig,
  ListNotesFilter,
  Note,
  Tag,
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
  updateFolder: (id: string, name: string) =>
    invoke<Folder>("update_folder", { id, name }),
  deleteFolder: (id: string) => invoke<void>("delete_folder", { id }),

  // Notes
  listNotes: (filter?: ListNotesFilter) =>
    invoke<Note[]>("list_notes", {
      folderId: filter?.folderId ?? null,
      favoriteOnly: filter?.favoriteOnly ?? null,
      reminderOnly: filter?.reminderOnly ?? null,
      tagId: filter?.tagId ?? null,
    }),
  listTags: () => invoke<Tag[]>("list_tags"),
  getNote: (id: string) => invoke<Note>("get_note", { id }),
  createNote: (title: string, folderId?: string) =>
    invoke<Note>("create_note", { title, folderId: folderId ?? null }),
  updateNote: (id: string, title: string, content: string) =>
    invoke<Note>("update_note", { id, title, content }),
  deleteNote: (id: string) => invoke<void>("delete_note", { id }),
  duplicateNote: (id: string, folderId?: string) =>
    invoke<Note>("duplicate_note", { id, folderId: folderId ?? null }),
  moveNote: (id: string, folderId: string) =>
    invoke<Note>("move_note", { id, folderId }),
  updateNoteMeta: (id: string, updates: Partial<Note>) =>
    invoke<Note>("update_note_meta", { id, updates }),
  lockNote: (id: string, password: string) =>
    invoke<Note>("lock_note", { id, password }),
  unlockNote: (id: string, password: string) =>
    invoke<Note>("unlock_note", { id, password }),

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

  // Local AI & Agent
  runLocalAi: (action: string, text: string) =>
    invoke<string>("run_local_ai", { action, text }),
  runAgent: (prompt: string, history: AgentMessage[]) =>
    invoke<AgentMessage[]>("run_agent", { prompt, history }),
  runSetupAssistant: (
    integrationTitle: string,
    guideContext: string,
    prompt: string,
    history: AgentMessage[]
  ) =>
    invoke<string>("run_setup_assistant", {
      integrationTitle,
      guideContext,
      prompt,
      history,
    }),

  checkOllama: () => invoke<{ available: boolean; models: string[] }>("check_ollama"),

  getDataDir: () => invoke<string>("get_data_dir"),

  // Jira (direct REST)
  jiraGetIssue: (key: string) => invoke<JiraIssue>("jira_get_issue", { key }),
  jiraMyIssues: () => invoke<JiraIssue[]>("jira_my_issues"),
  jiraSearch: (query: string) => invoke<JiraSearchResponse>("jira_search", { query }),
  jiraSearchUsers: (query: string) => invoke<JiraUser[]>("jira_search_users", { query }),
  jiraListSprints: (projectKey: string) => invoke<JiraSprint[]>("jira_list_sprints", { projectKey }),
  jiraCreateIssue: (req: JiraCreateRequest) => invoke<JiraIssue>("jira_create_issue", { req }),
  jiraSyncTasks: () => invoke<Task[]>("jira_sync_tasks"),
};
