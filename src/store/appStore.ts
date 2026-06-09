import { create } from "zustand";
import type { AppSettings, AppView, Folder, Note, Task } from "../types";

interface AppState {
  view: AppView;
  selectedNoteId: string | null;
  selectedFolderId: string | null;
  tasks: Task[];
  folders: Folder[];
  notes: Note[];
  settings: AppSettings;
  commandPaletteOpen: boolean;

  setView: (view: AppView) => void;
  setSelectedNoteId: (id: string | null) => void;
  setSelectedFolderId: (id: string | null) => void;
  setTasks: (tasks: Task[]) => void;
  setFolders: (folders: Folder[]) => void;
  setNotes: (notes: Note[]) => void;
  setSettings: (settings: AppSettings) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

const defaultSettings: AppSettings = {
  theme: "light",
  ollama_endpoint: "http://localhost:11434",
  ollama_model: "qwen2.5:7b",
};

export const useAppStore = create<AppState>((set) => ({
  view: "inbox",
  selectedNoteId: null,
  selectedFolderId: null,
  tasks: [],
  folders: [],
  notes: [],
  settings: defaultSettings,
  commandPaletteOpen: false,

  setView: (view) => set({ view }),
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),
  setSelectedFolderId: (id) => set({ selectedFolderId: id }),
  setTasks: (tasks) => set({ tasks }),
  setFolders: (folders) => set({ folders }),
  setNotes: (notes) => set({ notes }),
  setSettings: (settings) => set({ settings }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));
