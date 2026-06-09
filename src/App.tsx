import { useCallback, useEffect, useMemo } from "react";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TaskList } from "./components/Tasks/TaskList";
import { NoteList } from "./components/Notes/NoteList";
import { NoteEditor } from "./components/Notes/NoteEditor";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { Settings } from "./components/Settings/Settings";
import { api } from "./lib/api";
import { parseQuickAdd, isToday, isUpcoming } from "./lib/taskParser";
import { useAppStore } from "./store/appStore";
import { useKeyboard } from "./hooks/useKeyboard";
import { useTheme } from "./hooks/useTheme";
import type { TaskView } from "./types";
import styles from "./App.module.css";

function App() {
  const view = useAppStore((s) => s.view);
  const tasks = useAppStore((s) => s.tasks);
  const notes = useAppStore((s) => s.notes);
  const folders = useAppStore((s) => s.folders);
  const selectedNoteId = useAppStore((s) => s.selectedNoteId);
  const selectedFolderId = useAppStore((s) => s.selectedFolderId);
  const setTasks = useAppStore((s) => s.setTasks);
  const setNotes = useAppStore((s) => s.setNotes);
  const setFolders = useAppStore((s) => s.setFolders);
  const setSettings = useAppStore((s) => s.setSettings);
  const setView = useAppStore((s) => s.setView);
  const setSelectedNoteId = useAppStore((s) => s.setSelectedNoteId);

  useTheme();
  useKeyboard();

  const loadData = useCallback(async () => {
    const [taskList, folderList, settings] = await Promise.all([
      api.listTasks(),
      api.listFolders(),
      api.getSettings(),
    ]);
    setTasks(taskList);
    setFolders(folderList);
    setSettings(settings);
  }, [setTasks, setFolders, setSettings]);

  const loadNotes = useCallback(async () => {
    const noteList = await api.listNotes(selectedFolderId ?? undefined);
    setNotes(noteList);
  }, [selectedFolderId, setNotes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (view === "notes") loadNotes();
  }, [view, loadNotes]);

  const taskCounts = useMemo(() => {
    const active = tasks.filter((t) => !t.completed);
    return {
      inbox: active.filter((t) => !t.due_date).length,
      today: active.filter((t) => isToday(t.due_date) || (t.due_date && t.due_date < new Date().toISOString().split("T")[0])).length,
      upcoming: active.filter((t) => isUpcoming(t.due_date)).length,
    } satisfies Record<TaskView, number>;
  }, [tasks]);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  const handleAddTask = async (input: string) => {
    const parsed = parseQuickAdd(input);
    const task = await api.createTask({
      title: parsed.title,
      due_date: parsed.dueDate,
      priority: parsed.priority,
      completed: false,
      source: "manual",
    });
    setTasks([...tasks, task]);
  };

  const handleAddJiraTask = async (
    title: string,
    jiraKey?: string,
    jiraUrl?: string
  ) => {
    const task = await api.createTask({
      title,
      priority: 4,
      completed: false,
      source: "jira",
      jira_key: jiraKey,
      jira_url: jiraUrl,
    });
    setTasks([...tasks, task]);
  };

  const handleToggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const updated = await api.updateTask(id, { completed: !task.completed });
    setTasks(tasks.map((t) => (t.id === id ? updated : t)));
  };

  const handleDeleteTask = async (id: string) => {
    await api.deleteTask(id);
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const handleAddNote = async () => {
    const note = await api.createNote("Untitled", selectedFolderId ?? undefined);
    setNotes([note, ...notes]);
    setSelectedNoteId(note.id);
    setView("notes");
  };

  const handleAddFolder = async () => {
    const name = prompt("Folder name:");
    if (!name?.trim()) return;
    const folder = await api.createFolder(name.trim());
    setFolders([...folders, folder]);
  };

  const handleUpdateNote = async (id: string, title: string, content: string) => {
    const updated = await api.updateNote(id, title, content);
    setNotes(notes.map((n) => (n.id === id ? updated : n)));
  };

  const handleDeleteNote = async (id: string) => {
    await api.deleteNote(id);
    setNotes(notes.filter((n) => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
  };

  const focusAddTask = () => {
    const views: TaskView[] = ["inbox", "today", "upcoming"];
    if (!views.includes(view as TaskView)) setView("inbox");
  };

  return (
    <div className={styles.app}>
      <Sidebar
        taskCounts={taskCounts}
        onAddTask={focusAddTask}
        onAddNote={handleAddNote}
        onAddFolder={handleAddFolder}
      />
      <main className={styles.main}>
        {(["inbox", "today", "upcoming"] as TaskView[]).includes(view as TaskView) && (
          <TaskList
            view={view as TaskView}
            tasks={tasks}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            onAdd={handleAddTask}
          />
        )}
        {view === "notes" && (
          <div className={styles.notesLayout}>
            <NoteList
              notes={notes}
              selectedId={selectedNoteId}
              onSelect={setSelectedNoteId}
              onDelete={handleDeleteNote}
            />
            <NoteEditor
              note={selectedNote}
              onUpdate={handleUpdateNote}
              onAddTask={handleAddJiraTask}
            />
          </div>
        )}
        {view === "settings" && <Settings />}
      </main>
      <CommandPalette onAddTask={focusAddTask} onAddNote={handleAddNote} />
    </div>
  );
}

export default App;
