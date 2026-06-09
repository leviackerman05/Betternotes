import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { CollapsedRail } from "./components/Sidebar/CollapsedRail";
import { useSidebar } from "./hooks/useSidebar";
import { useBreakpoint } from "./hooks/useBreakpoint";
import { NoteList } from "./components/Notes/NoteList";
import { NoteEditor } from "./components/Notes/NoteEditor";
import { GraphView } from "./components/Notes/GraphView";
import { NoteInfoDialog } from "./components/Notes/NoteInfoDialog";
import { ReminderDialog } from "./components/Notes/ReminderDialog";
import { TagPicker } from "./components/Notes/TagPicker";
import type { NoteMenuActions } from "./components/Notes/NoteContextMenu";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { Settings } from "./components/Settings/Settings";
import { TaskList } from "./components/Tasks/TaskList";
import { ConfirmDialog, PasswordDialog, PromptDialog } from "./components/ui/Dialog";
import { api } from "./lib/api";
import { isJiraEnabled, withDefaultIntegrations } from "./lib/integrations";
import {
  copyToClipboard,
  downloadFile,
  htmlToMarkdown,
  htmlToPlainText,
} from "./lib/noteExport";
import { useAppStore } from "./store/appStore";
import { useKeyboard } from "./hooks/useKeyboard";
import { useReminders } from "./hooks/useReminders";
import { useTheme } from "./hooks/useTheme";
import type { Note, NoteColor, NotesCollection, ReminderRepeat } from "./types";
import styles from "./App.module.css";

const CHECKLIST_TEMPLATE =
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>First item</p></div></li></ul>';

const SPRINT_NOTE_TEMPLATE = "<p></p>";

type DialogState =
  | { type: "workspace-create" }
  | { type: "workspace-rename"; id: string; name: string }
  | { type: "workspace-delete"; id: string; name: string }
  | { type: "note-rename"; id: string; title: string }
  | { type: "lock-warning"; noteId: string }
  | { type: "lock-password"; noteId: string }
  | { type: "unlock-password"; noteId: string }
  | null;

function App() {
  const view = useAppStore((s) => s.view);
  const notes = useAppStore((s) => s.notes);
  const folders = useAppStore((s) => s.folders);
  const selectedNoteId = useAppStore((s) => s.selectedNoteId);
  const selectedFolderId = useAppStore((s) => s.selectedFolderId);
  const setNotes = useAppStore((s) => s.setNotes);
  const setFolders = useAppStore((s) => s.setFolders);
  const setSettings = useAppStore((s) => s.setSettings);
  const setView = useAppStore((s) => s.setView);
  const setSelectedNoteId = useAppStore((s) => s.setSelectedNoteId);
  const setSelectedFolderId = useAppStore((s) => s.setSelectedFolderId);
  const showArchived = useAppStore((s) => s.showArchived);
  const setShowArchived = useAppStore((s) => s.setShowArchived);
  const notesPane = useAppStore((s) => s.notesPane);
  const setNotesPane = useAppStore((s) => s.setNotesPane);
  const setPendingWikiLink = useAppStore((s) => s.setPendingWikiLink);
  const notesCollection = useAppStore((s) => s.notesCollection);
  const setNotesCollection = useAppStore((s) => s.setNotesCollection);
  const selectedTagId = useAppStore((s) => s.selectedTagId);
  const setSelectedTagId = useAppStore((s) => s.setSelectedTagId);
  const tags = useAppStore((s) => s.tags);
  const setTags = useAppStore((s) => s.setTags);
  const tasks = useAppStore((s) => s.tasks);
  const setTasks = useAppStore((s) => s.setTasks);
  const settings = useAppStore((s) => s.settings);
  const jiraEnabled = isJiraEnabled(settings);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [noteInfo, setNoteInfo] = useState<Note | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useTheme();
  useKeyboard();
  useReminders();
  const {
    collapsed: sidebarCollapsed,
    toggleCollapsed: toggleSidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebar();
  const { preferCollapsedSidebar } = useBreakpoint();
  const wasWideRef = useRef(!preferCollapsedSidebar);

  useEffect(() => {
    if (preferCollapsedSidebar && wasWideRef.current && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
    wasWideRef.current = !preferCollapsedSidebar;
  }, [preferCollapsedSidebar, sidebarCollapsed, setSidebarCollapsed]);

  const refreshFolders = useCallback(async () => {
    const folderList = await api.listFolders();
    setFolders(folderList);
    return folderList;
  }, [setFolders]);

  const refreshTags = useCallback(async () => {
    const tagList = await api.listTags();
    setTags(tagList);
  }, [setTags]);

  const refreshTasks = useCallback(async () => {
    const taskList = await api.listTasks();
    setTasks(taskList);
    return taskList;
  }, [setTasks]);

  const loadData = useCallback(async () => {
    const [folderList, appSettings, tagList, taskList] = await Promise.all([
      api.listFolders(),
      api.getSettings(),
      api.listTags(),
      api.listTasks(),
    ]);
    setFolders(folderList);
    setSettings(withDefaultIntegrations(appSettings));
    setTags(tagList);
    setTasks(taskList);

    const currentFolderId = useAppStore.getState().selectedFolderId;
    const validSelection = folderList.some((f) => f.id === currentFolderId);
    if (!validSelection && folderList.length > 0) {
      setSelectedFolderId(folderList[0].id);
    }
  }, [setFolders, setSettings, setSelectedFolderId, setTags, setTasks]);

  const loadNotes = useCallback(async () => {
    const collection = useAppStore.getState().notesCollection;
    const folderId = useAppStore.getState().selectedFolderId;
    const tagId = useAppStore.getState().selectedTagId;

    let noteList: Note[] = [];
    if (collection === "workspace") {
      if (!folderId) return;
      noteList = await api.listNotes({ folderId });
    } else if (collection === "all") {
      noteList = await api.listNotes();
    } else if (collection === "favorites") {
      noteList = await api.listNotes({ favoriteOnly: true });
    } else if (collection === "reminders") {
      noteList = await api.listNotes({ reminderOnly: true });
    } else if (collection === "tag" && tagId) {
      noteList = await api.listNotes({ tagId });
    }
    setNotes(noteList);
  }, [setNotes]);

  useEffect(() => {
    loadData();
    setView("notes");
  }, [loadData, setView]);

  useEffect(() => {
    if (view === "notes") loadNotes();
  }, [view, selectedFolderId, notesCollection, selectedTagId, loadNotes]);

  useEffect(() => {
    if (!jiraEnabled && view === "jira") setView("notes");
  }, [jiraEnabled, view, setView]);

  const syncJiraIssues = useCallback(async () => {
    await api.jiraSyncTasks();
    await refreshTasks();
  }, [refreshTasks]);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;
  const activeWorkspace = folders.find((f) => f.id === selectedFolderId) ?? null;

  const collectionTitle = useMemo(() => {
    if (notesCollection === "all") return "All Notes";
    if (notesCollection === "favorites") return "Favorites";
    if (notesCollection === "reminders") return "Reminders";
    if (notesCollection === "tag") {
      return tags.find((t) => t.id === selectedTagId)?.name ?? "Tag";
    }
    return activeWorkspace?.name ?? "Workspace";
  }, [notesCollection, selectedTagId, tags, activeWorkspace?.name]);

  const getTargetFolderId = () => {
    const folderId = useAppStore.getState().selectedFolderId;
    if (folderId) return folderId;
    return useAppStore.getState().folders[0]?.id;
  };

  const handleSelectCollection = (collection: NotesCollection, tagId?: string | null) => {
    setNotesCollection(collection);
    setSelectedTagId(tagId ?? null);
    setSelectedNoteId(null);
    if (collection === "workspace" && !selectedFolderId && folders.length > 0) {
      setSelectedFolderId(folders[0].id);
    }
  };

  const handleAddNote = async (title = "Untitled", content = "") => {
    const folderId = getTargetFolderId();
    if (!folderId) return;
    const note = await api.createNote(title, folderId);
    let created = note;
    if (content) {
      created = await api.updateNote(note.id, title, content);
    }
    await loadNotes();
    setSelectedNoteId(created.id);
    setNotesPane("editor");
    setView("notes");
    await refreshFolders();
  };

  useEffect(() => {
    const onQuickCapture = () => {
      void handleAddNote();
    };
    window.addEventListener("betternote:quick-capture", onQuickCapture);
    return () => window.removeEventListener("betternote:quick-capture", onQuickCapture);
  });

  const handleShareNote = async (note: Note) => {
    const text = `${note.title}\n\n${htmlToPlainText(note.content)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: note.title, text });
        return;
      } catch {
        /* fall through */
      }
    }
    await copyToClipboard(text);
  };

  const handleSetReminder = async (reminderAt: string | null, repeat: ReminderRepeat) => {
    if (!selectedNote) return;
    const updated = await api.updateNoteMeta(selectedNote.id, {
      reminder_at: reminderAt,
      reminder_repeat: repeat,
    });
    patchNote({ ...selectedNote, ...updated });
    setShowReminder(false);
    await loadNotes();
  };

  const handleSaveTags = async (tagNames: string[]) => {
    if (!selectedNote) return;
    const updated = await api.updateNoteMeta(selectedNote.id, { tags: tagNames });
    patchNote({ ...selectedNote, ...updated });
    setShowTagPicker(false);
    await refreshTags();
    await loadNotes();
  };

  const handleSetColor = async (color: NoteColor) => {
    if (!selectedNote) return;
    const updated = await api.updateNoteMeta(selectedNote.id, { color });
    patchNote({ ...selectedNote, ...updated });
    setShowColorPicker(false);
    await loadNotes();
  };

  const handleCreateWorkspace = async (name: string) => {
    const workspace = await api.createFolder(name);
    await refreshFolders();
    setSelectedFolderId(workspace.id);
    setNotes([]);
    setSelectedNoteId(null);
    setView("notes");
    setDialog(null);
  };

  const handleRenameWorkspace = async (id: string, name: string) => {
    await api.updateFolder(id, name);
    await refreshFolders();
    setDialog(null);
  };

  const handleDeleteWorkspace = async (id: string) => {
    try {
      await api.deleteFolder(id);
      const updated = await refreshFolders();
      if (selectedFolderId === id && updated.length > 0) {
        setSelectedFolderId(updated[0].id);
      }
      setDialog(null);
    } catch (e) {
      alert(String(e));
    }
  };

  const handleUpdateNote = async (id: string, title: string, content: string) => {
    try {
      const updated = await api.updateNote(id, title, content);
      const prev = useAppStore.getState().notes;
      setNotes(prev.map((n) => (n.id === id ? updated : n)));
      await refreshFolders();
    } catch {
      /* locked notes reject updates */
    }
  };

  const handleDeleteNote = async (id: string) => {
    await api.deleteNote(id);
    setNotes(useAppStore.getState().notes.filter((n) => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
    await refreshFolders();
  };

  const patchNote = useCallback(
    (updated: Note) => {
      const prev = useAppStore.getState().notes;
      setNotes(prev.map((n) => (n.id === updated.id ? updated : n)));
    },
    [setNotes]
  );

  const handleRenameNote = async (id: string, title: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const updated = await api.updateNoteMeta(id, { title });
    patchNote({ ...note, ...updated });
    setDialog(null);
  };

  const handleLockNote = async (noteId: string, password: string) => {
    const updated = await api.lockNote(noteId, password);
    const prev = useAppStore.getState().notes;
    const note = prev.find((n) => n.id === noteId);
    if (note) patchNote({ ...note, ...updated, locked: true, content: "" });
    setDialog(null);
    setLockError(null);
  };

  const handleUnlockNote = async (noteId: string, password: string) => {
    const updated = await api.unlockNote(noteId, password);
    patchNote({ ...updated, locked: false });
    setDialog(null);
    setLockError(null);
  };

  const insertLinkToNote = async (target: Note) => {
    const title = target.title || "Untitled";
    if (!selectedNoteId || selectedNoteId === target.id) {
      setSelectedNoteId(target.id);
      setNotesPane("editor");
      return;
    }
    const current = notes.find((n) => n.id === selectedNoteId);
    if (!current || current.locked) return;
    setNotesPane("editor");
    setPendingWikiLink(title);
  };

  const buildMenuActions = useCallback(
    (note: Note): NoteMenuActions => ({
      onPin: async () => {
        const updated = await api.updateNoteMeta(note.id, { pinned: !note.pinned });
        patchNote({ ...note, ...updated });
        await refreshFolders();
      },
      onFavorite: async () => {
        const updated = await api.updateNoteMeta(note.id, { favorite: !note.favorite });
        patchNote({ ...note, ...updated });
      },
      onLock: () => {
        setLockError(null);
        useAppStore.getState().setCommandPaletteOpen(false);
        if (note.locked) {
          setDialog({ type: "unlock-password", noteId: note.id });
        } else {
          setDialog({ type: "lock-warning", noteId: note.id });
        }
      },
      onDuplicate: async () => {
        try {
          const dup = await api.duplicateNote(note.id);
          if (dup.folder_id === selectedFolderId) {
            setNotes([dup, ...useAppStore.getState().notes]);
          }
          setSelectedNoteId(dup.id);
          await refreshFolders();
        } catch (e) {
          alert(String(e));
        }
      },
      onDuplicateTo: async (folderId: string) => {
        try {
          const dup = await api.duplicateNote(note.id, folderId);
          if (folderId === selectedFolderId) {
            setNotes([dup, ...useAppStore.getState().notes]);
          }
          setSelectedNoteId(dup.id);
          await refreshFolders();
        } catch (e) {
          alert(String(e));
        }
      },
      onInsertLink: () => insertLinkToNote(note),
      onRename: () => setDialog({ type: "note-rename", id: note.id, title: note.title }),
      onExportMarkdown: () =>
        downloadFile(
          `${note.title || "note"}.md`,
          `# ${note.title}\n\n${htmlToMarkdown(note.content)}`,
          "text/markdown"
        ),
      onExportHtml: () =>
        downloadFile(
          `${note.title || "note"}.html`,
          `<!DOCTYPE html><html><body><h1>${note.title}</h1>${note.content}</body></html>`,
          "text/html"
        ),
      onExportText: () =>
        downloadFile(
          `${note.title || "note"}.txt`,
          `${note.title}\n\n${htmlToPlainText(note.content)}`,
          "text/plain"
        ),
      onShare: async () => {
        const text = `${note.title}\n\n${htmlToPlainText(note.content)}`;
        if (navigator.share) {
          try {
            await navigator.share({ title: note.title, text });
            return;
          } catch {
            /* fall through */
          }
        }
        await copyToClipboard(text);
      },
      onMoveTo: async (folderId: string) => {
        await api.moveNote(note.id, folderId);
        setNotes(useAppStore.getState().notes.filter((n) => n.id !== note.id));
        if (selectedNoteId === note.id) setSelectedNoteId(null);
        await refreshFolders();
      },
      onNoteInfo: () => setNoteInfo(note),
      onArchive: async () => {
        const updated = await api.updateNoteMeta(note.id, { archived: !note.archived });
        patchNote({ ...note, ...updated });
        await refreshFolders();
      },
      onDelete: () => handleDeleteNote(note.id),
    }),
    [selectedFolderId, selectedNoteId, patchNote, refreshFolders, setNotes, setSelectedNoteId]
  );

  const selectWorkspace = (id: string) => {
    setSelectedFolderId(id);
    handleSelectCollection("workspace");
    setView("notes");
  };

  const lockWarningNoteId =
    dialog?.type === "lock-warning" ? dialog.noteId : null;
  const lockPasswordNoteId =
    dialog?.type === "lock-password" ? dialog.noteId : null;
  const unlockPasswordNoteId =
    dialog?.type === "unlock-password" ? dialog.noteId : null;

  return (
    <div className={styles.app}>
      {sidebarCollapsed ? (
        <CollapsedRail
          workspaces={folders}
          onExpand={toggleSidebarCollapsed}
          onAddNote={handleAddNote}
          onAddWorkspace={() => setDialog({ type: "workspace-create" })}
          onSelectWorkspace={selectWorkspace}
        />
      ) : (
        <Sidebar
          onAddNote={() => handleAddNote()}
          onAddWorkspace={() => setDialog({ type: "workspace-create" })}
          onRenameWorkspace={(id, name) =>
            setDialog({ type: "workspace-rename", id, name })
          }
          onDeleteWorkspace={(id, name) =>
            setDialog({ type: "workspace-delete", id, name })
          }
          onCollapse={toggleSidebarCollapsed}
          onSelectCollection={handleSelectCollection}
        />
      )}
      <main className={styles.main}>
        {view === "notes" && (
          <div className={styles.notesLayout}>
            <div className={styles.noteListWrap}>
              <NoteList
                collectionTitle={collectionTitle}
                notes={notes}
                folders={folders}
                currentFolderId={selectedFolderId ?? undefined}
                selectedId={selectedNoteId}
                showArchived={showArchived}
                onSelect={(id) => {
                  setSelectedNoteId(id);
                  setNotesPane("editor");
                }}
                onAddNote={() => handleAddNote()}
                onToggleArchived={() => setShowArchived(!showArchived)}
                onToggleFavorite={async (note) => {
                  const updated = await api.updateNoteMeta(note.id, {
                    favorite: !note.favorite,
                  });
                  patchNote({ ...note, ...updated });
                  await loadNotes();
                }}
                menuActions={buildMenuActions}
                notesPane={notesPane}
                onTogglePane={setNotesPane}
              />
            </div>
            <div className={styles.editorWrap}>
              {notesPane === "graph" ? (
                <GraphView
                  notes={notes}
                  selectedId={selectedNoteId}
                  onSelect={(id) => {
                    setSelectedNoteId(id);
                    setNotesPane("editor");
                  }}
                />
              ) : (
                <NoteEditor
                  note={selectedNote}
                  notes={notes}
                  onUpdate={handleUpdateNote}
                  onNavigateToNote={(id) => setSelectedNoteId(id)}
                  onQuickWrite={() => handleAddNote()}
                  onQuickChecklist={() => handleAddNote("Checklist", CHECKLIST_TEMPLATE)}
                  onQuickSprint={async () => {
                    await handleAddNote("My sprint", SPRINT_NOTE_TEMPLATE);
                    useAppStore.getState().setPendingSprint(true);
                  }}
                  onTags={() => setShowTagPicker(true)}
                  onReminder={() => setShowReminder(true)}
                  onShare={() => selectedNote && handleShareNote(selectedNote)}
                  onColor={handleSetColor}
                  showColorPicker={showColorPicker}
                  onToggleColorPicker={() => setShowColorPicker((v) => !v)}
                  isLocked={!!selectedNote?.locked}
                  onUnlock={() => {
                    if (selectedNote) {
                      setLockError(null);
                      useAppStore.getState().setCommandPaletteOpen(false);
                      setDialog({ type: "unlock-password", noteId: selectedNote.id });
                    }
                  }}
                />
              )}
            </div>
          </div>
        )}
        {view === "jira" && jiraEnabled && (
          <TaskList tasks={tasks} onSyncJira={syncJiraIssues} />
        )}
        {view === "settings" && <Settings />}
      </main>
      <CommandPalette onAddNote={handleAddNote} />

      <PromptDialog
        open={dialog?.type === "workspace-create"}
        title="New workspace"
        label="Name"
        confirmLabel="Create"
        onConfirm={handleCreateWorkspace}
        onCancel={() => setDialog(null)}
      />
      <PromptDialog
        open={dialog?.type === "workspace-rename"}
        title="Rename workspace"
        label="Name"
        defaultValue={dialog?.type === "workspace-rename" ? dialog.name : ""}
        onConfirm={(name) =>
          dialog?.type === "workspace-rename" &&
          handleRenameWorkspace(dialog.id, name)
        }
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog?.type === "workspace-delete"}
        title="Delete workspace"
        message={
          dialog?.type === "workspace-delete"
            ? `Delete "${dialog.name}"? Notes will move to another workspace.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() =>
          dialog?.type === "workspace-delete" && handleDeleteWorkspace(dialog.id)
        }
        onCancel={() => setDialog(null)}
      />
      <PromptDialog
        open={dialog?.type === "note-rename"}
        title="Rename note"
        label="Title"
        defaultValue={dialog?.type === "note-rename" ? dialog.title : ""}
        onConfirm={(title) =>
          dialog?.type === "note-rename" && handleRenameNote(dialog.id, title)
        }
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog?.type === "lock-warning"}
        title="Lock note with password"
        warning
        message="If you forget this password, the note cannot be recovered and will be lost forever. Betternote does not store your password and cannot reset it."
        confirmLabel="I understand, continue"
        onConfirm={() =>
          lockWarningNoteId &&
          setDialog({ type: "lock-password", noteId: lockWarningNoteId })
        }
        onCancel={() => setDialog(null)}
      />
      <PasswordDialog
        open={!!lockPasswordNoteId}
        title="Set password"
        message="Choose a password to encrypt this note. Minimum 4 characters."
        error={lockError ?? undefined}
        confirmLabel="Lock note"
        requireConfirm
        onConfirm={async (password) => {
          if (!lockPasswordNoteId) return;
          try {
            await handleLockNote(lockPasswordNoteId, password);
          } catch (e) {
            setLockError(String(e).replace(/^Error:?\s*/, ""));
          }
        }}
        onCancel={() => {
          setDialog(null);
          setLockError(null);
        }}
      />
      <PasswordDialog
        open={!!unlockPasswordNoteId}
        title="Unlock note"
        message="Enter the password for this note."
        error={lockError ?? undefined}
        confirmLabel="Unlock"
        onConfirm={async (password) => {
          if (!unlockPasswordNoteId) return;
          try {
            await handleUnlockNote(unlockPasswordNoteId, password);
          } catch (e) {
            setLockError(String(e).replace(/^Error:?\s*/, ""));
          }
        }}
        onCancel={() => {
          setDialog(null);
          setLockError(null);
        }}
      />
      {noteInfo && (
        <NoteInfoDialog note={noteInfo} onClose={() => setNoteInfo(null)} />
      )}
      {selectedNote && (
        <>
          <ReminderDialog
            open={showReminder}
            reminderAt={selectedNote.reminder_at}
            reminderRepeat={selectedNote.reminder_repeat}
            onConfirm={handleSetReminder}
            onCancel={() => setShowReminder(false)}
          />
          <TagPicker
            open={showTagPicker}
            noteTags={selectedNote.tags ?? []}
            allTags={tags}
            onClose={() => setShowTagPicker(false)}
            onSave={handleSaveTags}
          />
        </>
      )}
    </div>
  );
}

export default App;
