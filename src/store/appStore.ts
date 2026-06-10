import { create } from "zustand";
import type { AppSettings, AppView, Folder, Note, NotesCollection, Tag, Task } from "../types";
import { DEFAULT_INTEGRATIONS } from "../lib/integrations";

export interface SettingsActions {
  save: () => Promise<boolean>;
  discard: () => Promise<void>;
}

interface AppState {
  view: AppView;
  selectedNoteId: string | null;
  selectedFolderId: string | null;
  tasks: Task[];
  folders: Folder[];
  notes: Note[];
  tags: Tag[];
  notesCollection: NotesCollection;
  selectedTagId: string | null;
  listSearchQuery: string;
  settings: AppSettings;
  commandPaletteOpen: boolean;
  paletteQuery: string;
  showArchived: boolean;
  notesPane: "editor" | "graph";
  pendingWikiLink: string | null;
  pendingSprint: boolean;
  settingsDirty: boolean;
  pendingView: AppView | null;
  settingsActions: SettingsActions | null;

  setView: (view: AppView) => void;
  setSettingsDirty: (dirty: boolean) => void;
  setSettingsActions: (actions: SettingsActions | null) => void;
  clearPendingView: () => void;
  completePendingNavigation: () => void;
  setSelectedNoteId: (id: string | null) => void;
  setSelectedFolderId: (id: string | null) => void;
  setTasks: (tasks: Task[]) => void;
  setFolders: (folders: Folder[]) => void;
  setNotes: (notes: Note[]) => void;
  setTags: (tags: Tag[]) => void;
  setNotesCollection: (collection: NotesCollection) => void;
  setSelectedTagId: (id: string | null) => void;
  setListSearchQuery: (query: string) => void;
  setSettings: (settings: AppSettings) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setPaletteQuery: (query: string) => void;
  setShowArchived: (show: boolean) => void;
  setNotesPane: (pane: "editor" | "graph") => void;
  setPendingWikiLink: (title: string | null) => void;
  setPendingSprint: (pending: boolean) => void;
}

const defaultSettings: AppSettings = {
  theme: "light",
  ollama_endpoint: "http://localhost:11434",
  ollama_model: "qwen2.5:7b",
  sidebar_collapsed: false,
  ...DEFAULT_INTEGRATIONS,
};

export const useAppStore = create<AppState>((set, get) => ({
  view: "notes",
  selectedNoteId: null,
  selectedFolderId: null,
  tasks: [],
  folders: [],
  notes: [],
  tags: [],
  notesCollection: "workspace",
  selectedTagId: null,
  listSearchQuery: "",
  settings: defaultSettings,
  commandPaletteOpen: false,
  paletteQuery: "",
  showArchived: false,
  notesPane: "editor",
  pendingWikiLink: null,
  pendingSprint: false,
  settingsDirty: false,
  pendingView: null,
  settingsActions: null,

  setView: (view) => {
    const state = get();
    if (state.view === "settings" && view !== "settings" && state.settingsDirty) {
      set({ pendingView: view });
      return;
    }
    set({ view });
  },
  setSettingsDirty: (dirty) => set({ settingsDirty: dirty }),
  setSettingsActions: (actions) => set({ settingsActions: actions }),
  clearPendingView: () => set({ pendingView: null }),
  completePendingNavigation: () => {
    const pending = get().pendingView;
    if (!pending) return;
    set({ view: pending, pendingView: null, settingsDirty: false });
  },
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),
  setSelectedFolderId: (id) => set({ selectedFolderId: id }),
  setTasks: (tasks) => set({ tasks }),
  setFolders: (folders) => set({ folders }),
  setNotes: (notes) => set({ notes }),
  setTags: (tags) => set({ tags }),
  setNotesCollection: (collection) => set({ notesCollection: collection }),
  setSelectedTagId: (id) => set({ selectedTagId: id }),
  setListSearchQuery: (query) => set({ listSearchQuery: query }),
  setSettings: (settings) => set({ settings }),
  setCommandPaletteOpen: (open) =>
    set((s) => ({
      commandPaletteOpen: open,
      paletteQuery: open ? s.paletteQuery : "",
    })),
  setPaletteQuery: (query) => set({ paletteQuery: query }),
  setShowArchived: (show) => set({ showArchived: show }),
  setNotesPane: (pane) => set({ notesPane: pane }),
  setPendingWikiLink: (title) => set({ pendingWikiLink: title }),
  setPendingSprint: (pending) => set({ pendingSprint: pending }),
}));
