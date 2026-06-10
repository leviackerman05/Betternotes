import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import { ArrowLeft, Bell, Lock } from "lucide-react";
import clsx from "clsx";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import { BetternoteTaskItem } from "../../extensions/BetternoteTaskItem";
import type { Note, NoteColor, JiraIssue } from "../../types";
import { AgentBlockExtension } from "../../extensions/AgentBlockExtension";
import { FindInNoteExtension } from "../../extensions/FindInNoteExtension";
import { FlatListItem } from "../../extensions/FlatListItem";
import { JiraChipExtension } from "../../extensions/JiraChipExtension";
import { NoNestedLists } from "../../extensions/NoNestedLists";
import { WikiLinkExtension } from "../../extensions/WikiLinkExtension";
import { api } from "../../lib/api";
import {
  filterIssuesByStatus,
  getListContext,
  insertJiraIssues,
  JIRA_STATUS_COMMANDS,
  parseSlashJiraKey,
} from "../../lib/jiraInsert";
import { JiraCreateDialog } from "./JiraCreateDialog";
import { JiraTicketPicker, type JiraPickerMode, type JiraPickerState } from "./JiraTicketPicker";
import { getNoteColorStyle } from "../../lib/noteColors";
import { findMatchesInNote } from "../../lib/findInNote";
import { findNoteByTitle, getBacklinks } from "../../lib/noteLinks";
import { positionMenuInViewport } from "../../lib/menuPosition";
import { noAutocorrectAttrs, noAutocorrectProps } from "../../lib/noAutocorrect";
import { openExternal } from "../../lib/openExternal";
import {
  isJiraEnabled,
  isLocalAiEnabled,
  isMcpEnabled,
} from "../../lib/integrations";
import { useAppStore } from "../../store/appStore";
import { PromptDialog } from "../ui/Dialog";
import { NoteEmptyState } from "./NoteEmptyState";
import { NoteToolbar } from "./NoteToolbar";
import { ReminderBadge } from "./ReminderBadge";
import { FindInNoteBar, scrollToFindMatch } from "./FindInNoteBar";
import { SelectionFormatBar } from "./SelectionFormatBar";
import styles from "./NoteEditor.module.css";

interface NoteEditorProps {
  note: Note | null;
  notes: Note[];
  onUpdate: (id: string, title: string, content: string) => void;
  onNavigateToNote: (id: string) => void;
  onQuickWrite: () => void;
  onQuickChecklist: () => void;
  onQuickSprint: () => void;
  onTags: () => void;
  onReminder: () => void;
  onShare: () => void;
  onColor: (color: NoteColor) => void;
  showColorPicker: boolean;
  onToggleColorPicker: () => void;
  onBack?: () => void;
  showBack?: boolean;
  isLocked?: boolean;
  onUnlock?: () => void;
}

interface SlashItem {
  title: string;
  command: string;
}

const CORE_SLASH_ITEMS: SlashItem[] = [
  { title: "Heading 1", command: "h1" },
  { title: "Heading 2", command: "h2" },
  { title: "Bullet list", command: "bullet" },
  { title: "Numbered list", command: "ordered" },
  { title: "To-do list", command: "todo" },
  { title: "Reminder", command: "reminder" },
];

const AGENT_SLASH_ITEMS: SlashItem[] = [{ title: "Agent", command: "agent" }];

const JIRA_SLASH_ITEMS: SlashItem[] = [
  { title: "Jira ticket", command: "ticket" },
  { title: "Find Jira ticket", command: "ticket-find" },
  { title: "Jira tickets in progress", command: "ticket-in-progress" },
  { title: "Jira tickets to do", command: "ticket-todo" },
  { title: "Jira tickets in review", command: "ticket-review" },
  { title: "My sprint", command: "sprint" },
];

export function NoteEditor({
  note,
  notes,
  onUpdate,
  onNavigateToNote,
  onQuickWrite,
  onQuickChecklist,
  onQuickSprint,
  onTags,
  onReminder,
  onShare,
  onColor,
  showColorPicker,
  onToggleColorPicker,
  onBack,
  showBack,
  isLocked,
  onUnlock,
}: NoteEditorProps) {
  const [title, setTitle] = useState("");
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashAnchor, setSlashAnchor] = useState({ top: 0, bottom: 0, left: 0 });
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashIndex, setSlashIndex] = useState(0);
  const [showWiki, setShowWiki] = useState(false);
  const [wikiFilter, setWikiFilter] = useState("");
  const [wikiPos, setWikiPos] = useState({ top: 0, left: 0 });
  const [wikiIndex, setWikiIndex] = useState(0);
  const [selectionMenu, setSelectionMenu] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [formatBar, setFormatBar] = useState<{ x: number; y: number } | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [editorTick, setEditorTick] = useState(0);
  const [jiraCreateOpen, setJiraCreateOpen] = useState(false);
  const [jiraCreateSummary, setJiraCreateSummary] = useState("");
  const [jiraPicker, setJiraPicker] = useState<JiraPickerState | null>(null);
  const [jiraPickerPos, setJiraPickerPos] = useState({ top: 0, left: 0 });
  const settings = useAppStore((s) => s.settings);
  const jiraEnabled = isJiraEnabled(settings);
  const localAiEnabled = isLocalAiEnabled(settings);
  const mcpEnabled = isMcpEnabled(settings);
  const pendingWikiLink = useAppStore((s) => s.pendingWikiLink);
  const setPendingWikiLink = useAppStore((s) => s.setPendingWikiLink);
  const pendingSprint = useAppStore((s) => s.pendingSprint);
  const setPendingSprint = useAppStore((s) => s.setPendingSprint);
  const [aiLoading, setAiLoading] = useState(false);

  const slashItems = useMemo(() => {
    const items = [...CORE_SLASH_ITEMS];
    if (mcpEnabled) items.push(...AGENT_SLASH_ITEMS);
    if (jiraEnabled) items.push(...JIRA_SLASH_ITEMS);
    return items;
  }, [mcpEnabled, jiraEnabled]);

  const editorExtensions = useMemo(
    () => [
      StarterKit.configure({ listItem: false }),
      FlatListItem,
      NoNestedLists,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Placeholder.configure({
        placeholder: mcpEnabled
          ? jiraEnabled
            ? "Type / for commands: headings, lists, agent, Jira…"
            : "Type / for commands: headings, lists, agent…"
          : jiraEnabled
            ? "Type / for commands: headings, lists, Jira…"
            : "Type / for commands: headings, lists, reminders…",
        showOnlyCurrent: true,
      }),
      TaskList,
      BetternoteTaskItem.configure({ nested: false }),
      WikiLinkExtension,
      JiraChipExtension,
      FindInNoteExtension,
      ...(mcpEnabled ? [AgentBlockExtension] : []),
    ],
    [mcpEnabled, jiraEnabled]
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const noteBodyRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef(note);
  const titleRef = useRef(title);
  noteRef.current = note;
  titleRef.current = title;
  const slashRef = useRef<HTMLDivElement>(null);
  const wikiRef = useRef<HTMLDivElement>(null);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const jiraPickerRef = useRef<HTMLDivElement>(null);
  const slashIndexRef = useRef(0);
  const wikiIndexRef = useRef(0);

  const editor = useEditor(
    {
    extensions: editorExtensions,
    content: "",
    editable: !isLocked,
    editorProps: {
      attributes: noAutocorrectAttrs,
    },
    onUpdate: ({ editor: ed }) => {
      const currentNote = noteRef.current;
      if (!currentNote || isLocked) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onUpdate(currentNote.id, titleRef.current, ed.getHTML());
      }, 500);

      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 40), from, "\n");

      const wikiMatch = textBefore.match(/\[\[([^\]]*)$/);
      if (wikiMatch) {
        setShowWiki(true);
        setWikiFilter(wikiMatch[1]);
        setShowSlash(false);
        const coords = ed.view.coordsAtPos(from);
        setWikiPos({ top: coords.bottom + 4, left: coords.left });
        return;
      }
      setShowWiki(false);

      const slashMatch = textBefore.match(/\/([\w-]*)$/);
      if (slashMatch) {
        setShowSlash(true);
        setSlashFilter(slashMatch[1]);
        const coords = ed.view.coordsAtPos(from);
        setSlashAnchor({ top: coords.top, bottom: coords.bottom, left: coords.left });
        setSlashMenuPos({ top: coords.bottom + 4, left: coords.left });
      } else {
        setShowSlash(false);
      }
    },
  },
  [editorExtensions, isLocked]
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isLocked);
  }, [editor, isLocked]);

  useEffect(() => {
    if (!editor) return;
    const refresh = () => setEditorTick((t) => t + 1);
    editor.on("update", refresh);
    return () => {
      editor.off("update", refresh);
    };
  }, [editor]);

  useEffect(() => {
    if (!note) return;
    setTitle(note.title);
  }, [note?.id, note?.title]);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    noteBodyRef.current?.scrollTo({ top: 0 });
    setFindOpen(false);
    setFindQuery("");
    setFindIndex(0);
    editor?.commands.clearFindInNote();
  }, [note?.id, editor]);

  const findMatches = useMemo(() => {
    if (!editor || !findQuery.trim()) return [];
    return findMatchesInNote(title, editor.state.doc, findQuery);
  }, [editor, findQuery, title, editorTick]);

  useEffect(() => {
    if (!editor || !findOpen) {
      editor?.commands.clearFindInNote();
      return;
    }
    editor.commands.setFindInNote(findQuery, findIndex, title);
  }, [editor, findOpen, findQuery, findIndex, title]);

  useEffect(() => {
    if (!findOpen || !editor || !findQuery.trim()) return;
    const matches = findMatchesInNote(title, editor.state.doc, findQuery);
    if (matches.length === 0) return;
    const index = Math.min(findIndex, matches.length - 1);
    scrollToFindMatch(matches[index], editor, titleInputRef, noteBodyRef);
  }, [findOpen, findIndex, findQuery, editor, title]);

  useEffect(() => {
    if (!note || isLocked) return;
    const openFind = () => setFindOpen(true);
    window.addEventListener("betternote:find-in-note", openFind);
    return () => window.removeEventListener("betternote:find-in-note", openFind);
  }, [note, isLocked]);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    setFindQuery("");
    setFindIndex(0);
    editor?.commands.clearFindInNote();
  }, [editor]);

  // Only reload editor body when switching notes or lock state, not on autosave echoes.
  useEffect(() => {
    if (!note || !editor) return;
    const content = note.locked ? "" : note.content || "";
    editor.commands.setContent(content, false);
    setShowSlash(false);
    setShowWiki(false);
  }, [note?.id, note?.locked, editor]);

  const insertWikiLink = useCallback(
    (linkTitle: string) => {
      if (!editor) return;
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 40), from, "\n");
      const wikiMatch = textBefore.match(/\[\[([^\]]*)$/);
      if (wikiMatch) {
        const deleteFrom = from - wikiMatch[1].length - 2;
        editor
          .chain()
          .focus()
          .deleteRange({ from: deleteFrom, to: from })
          .insertContent({
            type: "text",
            marks: [{ type: "wikiLink", attrs: { title: linkTitle } }],
            text: linkTitle,
          })
          .insertContent(" ")
          .run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            marks: [{ type: "wikiLink", attrs: { title: linkTitle } }],
            text: linkTitle,
          })
          .insertContent(" ")
          .run();
      }
      setShowWiki(false);
      if (note) {
        onUpdate(note.id, title, editor.getHTML());
      }
    },
    [editor, note, onUpdate, title]
  );

  useEffect(() => {
    if (!pendingWikiLink || !editor || !note || isLocked) return;
    insertWikiLink(pendingWikiLink);
    setPendingWikiLink(null);
  }, [pendingWikiLink, editor, note, isLocked, insertWikiLink, setPendingWikiLink]);

  useEffect(() => {
    if (!jiraPicker) return;
    const dismiss = (e: MouseEvent) => {
      if (jiraPickerRef.current?.contains(e.target as Node)) return;
      setJiraPicker(null);
    };
    window.addEventListener("mousedown", dismiss);
    return () => window.removeEventListener("mousedown", dismiss);
  }, [jiraPicker]);

  useEffect(() => {
    if (!selectionMenu) return;
    const dismissMouse = (e: MouseEvent) => {
      if (selectionMenuRef.current?.contains(e.target as Node)) return;
      setSelectionMenu(null);
    };
    const dismissScroll = () => setSelectionMenu(null);
    window.addEventListener("mousedown", dismissMouse);
    window.addEventListener("scroll", dismissScroll, true);
    return () => {
      window.removeEventListener("mousedown", dismissMouse);
      window.removeEventListener("scroll", dismissScroll, true);
    };
  }, [selectionMenu]);

  useEffect(() => {
    if (!editor || isLocked) return;

    const updateFormatBar = () => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setFormatBar(null);
        return;
      }
      const text = editor.state.doc.textBetween(from, to, " ");
      if (!text.trim()) {
        setFormatBar(null);
        return;
      }
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      setFormatBar({
        x: (start.left + end.right) / 2,
        y: start.top,
      });
    };

    editor.on("selectionUpdate", updateFormatBar);
    editor.on("focus", updateFormatBar);

    const dom = editor.view.dom;
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const { from, to } = editor.state.selection;
      if (from === to) {
        setSelectionMenu(null);
        return;
      }
      const text = editor.state.doc.textBetween(from, to, " ");
      if (!text.trim()) {
        setSelectionMenu(null);
        return;
      }
      if (localAiEnabled || jiraEnabled) {
        setSelectionMenu({ x: e.clientX, y: e.clientY, text });
      }
    };
    dom.addEventListener("contextmenu", onContextMenu);

    return () => {
      editor.off("selectionUpdate", updateFormatBar);
      editor.off("focus", updateFormatBar);
      dom.removeEventListener("contextmenu", onContextMenu);
    };
  }, [editor, isLocked, localAiEnabled, jiraEnabled]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const wikiEl = target.closest("[data-wiki-link]");
      if (wikiEl) {
        e.preventDefault();
        const linkTitle =
          wikiEl.getAttribute("data-wiki-title") || wikiEl.textContent?.trim() || "";
        const match = findNoteByTitle(notes, linkTitle);
        if (match) onNavigateToNote(match.id);
        return;
      }

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !/^https?:\/\//i.test(href)) return;
      e.preventDefault();
      void openExternal(href);
    };
    dom.addEventListener("click", handler);
    return () => dom.removeEventListener("click", handler);
  }, [editor, notes, onNavigateToNote]);

  const clearSlashText = useCallback(() => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 40), from, "\n");
    const slashIdx = textBefore.lastIndexOf("/");
    if (slashIdx >= 0) {
      const deleteFrom = from - (textBefore.length - slashIdx);
      editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();
    }
  }, [editor]);

  const openJiraPicker = useCallback(
    async (
      mode: JiraPickerMode,
      opts?: { statusCommand?: keyof typeof JIRA_STATUS_COMMANDS; filter?: string }
    ) => {
      if (!editor) return;
      const { from } = editor.state.selection;
      const coords = editor.view.coordsAtPos(from);
      setJiraPickerPos({ top: coords.bottom + 4, left: coords.left });
      setShowSlash(false);

      try {
        let issues = await api.jiraMyIssues();
        let statusLabel: string | undefined;
        if (opts?.statusCommand) {
          const cfg = JIRA_STATUS_COMMANDS[opts.statusCommand];
          statusLabel = cfg.label;
          issues = filterIssuesByStatus(issues, cfg.statuses);
        }
        setJiraPicker({
          mode,
          issues: mode === "search" ? [] : issues,
          filter: opts?.filter ?? "",
          statusLabel,
        });
      } catch (err) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "paragraph",
            content: [
              {
                type: "text",
                text: `Jira: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
          })
          .run();
        if (note) onUpdate(note.id, title, editor.getHTML());
      }
    },
    [editor, note, onUpdate, title]
  );

  const handleJiraSelect = useCallback(
    (issues: JiraIssue[], withDetails: boolean) => {
      if (!editor || !note || issues.length === 0) return;
      insertJiraIssues(editor, issues, { withDetails });
      onUpdate(note.id, title, editor.getHTML());
      setJiraPicker(null);
    },
    [editor, note, onUpdate, title]
  );

  const handleJiraSearch = useCallback(async (query: string) => {
    setJiraPicker((p) =>
      p ? { ...p, searching: true, hasSearched: true, usedAi: false } : p
    );
    const aiTimer = window.setTimeout(() => {
      setJiraPicker((p) => (p?.searching ? { ...p, usedAi: true } : p));
    }, 800);
    try {
      const result = await api.jiraSearch(query);
      window.clearTimeout(aiTimer);
      setJiraPicker((p) =>
        p
          ? {
              ...p,
              issues: result.issues,
              filter: query,
              searching: false,
              hasSearched: true,
              usedAi: result.used_ai,
            }
          : p
      );
    } catch (err) {
      window.clearTimeout(aiTimer);
      setJiraPicker((p) =>
        p ? { ...p, searching: false, hasSearched: true, issues: [] } : p
      );
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleJiraFetchKey = useCallback(
    async (key: string) => {
      if (!editor || !note) return;
      try {
        const issue = await api.jiraGetIssue(key);
        insertJiraIssues(editor, [issue], { withDetails: false });
        onUpdate(note.id, title, editor.getHTML());
        setJiraPicker(null);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : String(err));
      }
    },
    [editor, note, onUpdate, title]
  );

  const insertJiraKey = useCallback(
    async (key: string) => {
      if (!editor || !note) return;
      clearSlashText();
      setShowSlash(false);
      try {
        const issue = await api.jiraGetIssue(key);
        insertJiraIssues(editor, [issue], { withDetails: false });
        onUpdate(note.id, title, editor.getHTML());
      } catch (err) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "paragraph",
            content: [
              {
                type: "text",
                text: `Jira: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
          })
          .run();
        onUpdate(note.id, title, editor.getHTML());
      }
    },
    [editor, note, clearSlashText, onUpdate, title]
  );

  const executeSlash = useCallback(
    (command: string) => {
      if (!editor) return;

      if (command.startsWith("key:")) {
        void insertJiraKey(command.slice(4));
        return;
      }

      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 40), from, "\n");
      const slashIdx = textBefore.lastIndexOf("/");
      if (slashIdx >= 0) {
        const deleteFrom = from - (textBefore.length - slashIdx);
        editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();
      }

      const listCtx = getListContext(editor);

      switch (command) {
        case "h1":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "h2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "bullet":
          if (listCtx !== "bullet") editor.chain().focus().toggleBulletList().run();
          break;
        case "ordered":
          if (listCtx !== "ordered") editor.chain().focus().toggleOrderedList().run();
          break;
        case "todo":
          if (listCtx !== "task") editor.chain().focus().toggleTaskList().run();
          break;
        case "ticket":
          void openJiraPicker("single");
          return;
        case "ticket-find":
          void openJiraPicker("search");
          return;
        case "ticket-in-progress":
          void openJiraPicker("multi", { statusCommand: "ticket-in-progress" });
          return;
        case "ticket-todo":
          void openJiraPicker("multi", { statusCommand: "ticket-todo" });
          return;
        case "ticket-review":
          void openJiraPicker("multi", { statusCommand: "ticket-review" });
          return;
        case "sprint":
          void openJiraPicker("multi");
          return;
        case "reminder":
          onReminder();
          break;
        case "agent":
          editor
            .chain()
            .focus()
            .insertContent({
              type: "agentBlock",
              attrs: { messages: "[]", status: "idle" },
            })
            .run();
          break;
      }
      setShowSlash(false);
    },
    [editor, insertJiraKey, onReminder, openJiraPicker]
  );

  const openSprintPicker = useCallback(async () => {
    if (!editor || !note) return;
    const { from } = editor.state.selection;
    const coords = editor.view.coordsAtPos(from);
    setJiraPickerPos({ top: coords.bottom + 4, left: coords.left });
    try {
      const issues = await api.jiraMyIssues();
      setJiraPicker({ mode: "multi", issues, filter: "" });
    } catch {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "paragraph",
          content: [{ type: "text", text: "Could not load Jira tickets. Check Settings." }],
        })
        .run();
      onUpdate(note.id, title, editor.getHTML());
    }
  }, [editor, note, onUpdate, title]);

  useEffect(() => {
    if (!pendingSprint || !editor || !note || isLocked) return;
    void openSprintPicker().finally(() => setPendingSprint(false));
  }, [pendingSprint, editor, note, isLocked, openSprintPicker, setPendingSprint]);

  const openCreateJiraFromSelection = useCallback(() => {
    if (!selectionMenu?.text.trim()) return;
    setJiraCreateSummary(selectionMenu.text.trim().slice(0, 255));
    setSelectionMenu(null);
    setJiraCreateOpen(true);
  }, [selectionMenu]);

  const handleJiraCreated = useCallback(
    async (key: string) => {
      if (!editor || !note) return;
      try {
        const issue = await api.jiraGetIssue(key);
        const { from, to } = editor.state.selection;
        if (from !== to) {
          editor.chain().focus().deleteRange({ from, to }).run();
        }
        insertJiraIssues(editor, [issue], { withDetails: false });
        onUpdate(note.id, title, editor.getHTML());
      } catch (err) {
        window.alert(err instanceof Error ? err.message : String(err));
      }
    },
    [editor, note, onUpdate, title]
  );

  const filteredItems = useMemo(() => {
    const q = slashFilter.toLowerCase();
    const items = slashItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.command.toLowerCase().includes(q)
    );
    if (jiraEnabled) {
      const key = parseSlashJiraKey(slashFilter);
      if (key) {
        items.unshift({ title: `Insert ${key}`, command: `key:${key}` });
      }
    }
    return items;
  }, [slashFilter, slashItems, jiraEnabled]);

  const runLocalAi = useCallback(
    async (action: string) => {
      if (!editor || !note || !selectionMenu?.text.trim()) return;
      setAiLoading(true);
      setSelectionMenu(null);
      try {
        const result = await api.runLocalAi(action, selectionMenu.text.trim());
        editor
          .chain()
          .focus()
          .insertContent({
            type: "paragraph",
            content: [{ type: "text", text: result }],
          })
          .run();
        onUpdate(note.id, title, editor.getHTML());
      } catch (err) {
        window.alert(err instanceof Error ? err.message : String(err));
      } finally {
        setAiLoading(false);
      }
    },
    [editor, note, selectionMenu, onUpdate, title]
  );

  const wikiCandidates = useMemo(() => {
    const q = wikiFilter.toLowerCase();
    return notes
      .filter((n) => !n.locked && n.id !== note?.id)
      .filter((n) => (n.title || "Untitled").toLowerCase().includes(q))
      .slice(0, 8);
  }, [notes, wikiFilter, note?.id]);

  const backlinks = useMemo(() => {
    if (!note) return [];
    return getBacklinks(notes, note.id, note.title);
  }, [notes, note]);

  useEffect(() => {
    slashIndexRef.current = 0;
    setSlashIndex(0);
  }, [slashFilter, showSlash]);

  useLayoutEffect(() => {
    if (!showSlash || !slashRef.current) return;
    const menu = slashRef.current;
    const next = positionMenuInViewport(slashAnchor, {
      width: menu.offsetWidth,
      height: menu.offsetHeight,
    });
    setSlashMenuPos((prev) =>
      prev.top === next.top && prev.left === next.left ? prev : next
    );
  }, [showSlash, slashAnchor, filteredItems.length, slashFilter]);

  useEffect(() => {
    wikiIndexRef.current = 0;
    setWikiIndex(0);
  }, [wikiFilter, showWiki]);

  useEffect(() => {
    if (jiraPicker) return;
    if (!showSlash || filteredItems.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        slashIndexRef.current = (slashIndexRef.current + 1) % filteredItems.length;
        setSlashIndex(slashIndexRef.current);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        slashIndexRef.current =
          (slashIndexRef.current - 1 + filteredItems.length) % filteredItems.length;
        setSlashIndex(slashIndexRef.current);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filteredItems[slashIndexRef.current];
        if (item) executeSlash(item.command);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowSlash(false);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [showSlash, filteredItems, executeSlash, jiraPicker]);

  useEffect(() => {
    if (!showWiki || wikiCandidates.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        wikiIndexRef.current = (wikiIndexRef.current + 1) % wikiCandidates.length;
        setWikiIndex(wikiIndexRef.current);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        wikiIndexRef.current =
          (wikiIndexRef.current - 1 + wikiCandidates.length) % wikiCandidates.length;
        setWikiIndex(wikiIndexRef.current);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = wikiCandidates[wikiIndexRef.current];
        if (item) insertWikiLink(item.title || "Untitled");
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowWiki(false);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [showWiki, wikiCandidates, insertWikiLink]);

  if (!note) {
    return (
      <NoteEmptyState
        onWrite={onQuickWrite}
        onChecklist={onQuickChecklist}
        onSprint={onQuickSprint}
        showSprint={jiraEnabled}
      />
    );
  }

  const noteColorStyle = getNoteColorStyle(note.color ?? null);

  return (
    <div className={styles.editor}>
      {!isLocked && (
        <FindInNoteBar
          open={findOpen}
          query={findQuery}
          matches={findMatches}
          activeIndex={findIndex}
          onQueryChange={(q) => {
            setFindQuery(q);
            setFindIndex(0);
          }}
          onActiveIndexChange={setFindIndex}
          onClose={closeFind}
        />
      )}
      {isLocked && (
        <div className={styles.lockOverlay}>
          <Lock size={32} />
          <p>This note is password protected</p>
          <span className={styles.lockHint}>
            Enter your password to view and edit
          </span>
          <button className={styles.unlockBtn} onClick={onUnlock}>
            Unlock
          </button>
        </div>
      )}
      {showBack && onBack && (
        <button
          className={clsx(styles.backBtn, styles.backBtnVisible)}
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          All notes
        </button>
      )}
      <div ref={noteBodyRef} className={styles.noteBody} style={noteColorStyle}>
        <div className={styles.titleRow}>
          <input
            ref={titleInputRef}
            className={styles.titleInput}
            placeholder="Note title"
            {...noAutocorrectProps}
            value={title}
            disabled={isLocked}
            onChange={(e) => {
              setTitle(e.target.value);
              if (isLocked) return;
              clearTimeout(saveTimer.current);
              saveTimer.current = setTimeout(() => {
                onUpdate(note.id, e.target.value, editor?.getHTML() ?? "");
              }, 500);
            }}
          />
          {note.reminder_at && !isLocked && (
            <button
              type="button"
              className={styles.reminderBadgeBtn}
              onClick={onReminder}
              title="Edit reminder"
            >
              <Bell size={12} />
              <ReminderBadge reminderAt={note.reminder_at} />
            </button>
          )}
        </div>
        <EditorContent editor={editor} className={styles.content} />
      </div>

      {backlinks.length > 0 && !isLocked && (
        <aside className={styles.backlinks}>
          <p className={styles.backlinksLabel}>Backlinks</p>
          <div className={styles.backlinkList}>
            {backlinks.map((b) => (
              <button
                key={b.id}
                className={styles.backlinkItem}
                onClick={() => onNavigateToNote(b.id)}
              >
                {b.title || "Untitled"}
              </button>
            ))}
          </div>
        </aside>
      )}

      {showSlash &&
        filteredItems.length > 0 &&
        createPortal(
          <div
            ref={slashRef}
            className={styles.slashMenu}
            style={{ top: slashMenuPos.top, left: slashMenuPos.left }}
          >
            {filteredItems.map((item, index) => (
              <button
                key={item.command}
                className={clsx(
                  styles.slashItem,
                  index === slashIndex && styles.slashItemActive
                )}
                onMouseEnter={() => {
                  slashIndexRef.current = index;
                  setSlashIndex(index);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  executeSlash(item.command);
                }}
              >
                {item.title}
              </button>
            ))}
          </div>,
          document.body
        )}

      {!isLocked && (
        <NoteToolbar
          note={note}
          onTags={onTags}
          onReminder={onReminder}
          onShare={onShare}
          onColor={onColor}
          showColorPicker={showColorPicker}
          onToggleColorPicker={onToggleColorPicker}
        />
      )}

      {!isLocked && formatBar && editor && (
        <SelectionFormatBar
          editor={editor}
          position={formatBar}
          onLink={() => setLinkDialogOpen(true)}
        />
      )}

      <PromptDialog
        open={linkDialogOpen}
        title="Add link"
        label="URL"
        defaultValue={
          editor?.isActive("link")
            ? (editor.getAttributes("link").href as string) || "https://"
            : "https://"
        }
        confirmLabel="Apply"
        onConfirm={(url) => {
          if (!editor) return;
          let href = url.trim();
          if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
            href = `https://${href}`;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
          setLinkDialogOpen(false);
        }}
        onCancel={() => setLinkDialogOpen(false)}
      />

      {selectionMenu && (localAiEnabled || jiraEnabled) && (
        <div
          ref={selectionMenuRef}
          className={styles.slashMenu}
          style={{ top: selectionMenu.y, left: selectionMenu.x, position: "fixed" }}
        >
          {localAiEnabled && (
            <>
              <button
                className={styles.slashItem}
                disabled={aiLoading}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void runLocalAi("summarize");
                }}
              >
                Summarize with AI
              </button>
              <button
                className={styles.slashItem}
                disabled={aiLoading}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void runLocalAi("rewrite");
                }}
              >
                Rewrite with AI
              </button>
              <button
                className={styles.slashItem}
                disabled={aiLoading}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void runLocalAi("extract_tasks");
                }}
              >
                Extract tasks with AI
              </button>
              <button
                className={styles.slashItem}
                disabled={aiLoading}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void runLocalAi("explain");
                }}
              >
                Explain with AI
              </button>
            </>
          )}
          {jiraEnabled && (
            <button
              className={styles.slashItem}
              onMouseDown={(e) => {
                e.preventDefault();
                openCreateJiraFromSelection();
              }}
            >
              Create Jira ticket…
            </button>
          )}
        </div>
      )}

      {jiraEnabled && jiraPicker && (
        <JiraTicketPicker
          state={jiraPicker}
          position={jiraPickerPos}
          pickerRef={jiraPickerRef}
          onFilterChange={(filter) => setJiraPicker((p) => (p ? { ...p, filter } : p))}
          onSearch={(query) => void handleJiraSearch(query)}
          onSelect={(issues, withDetails) => handleJiraSelect(issues, withDetails)}
          onFetchKey={(key) => void handleJiraFetchKey(key)}
          onClose={() => setJiraPicker(null)}
        />
      )}

      {jiraEnabled && (
        <JiraCreateDialog
          open={jiraCreateOpen}
          defaultSummary={jiraCreateSummary}
          noteHtml={note?.content || editor?.getHTML() || ""}
          defaultProjectKey={settings.default_jira_project_key || ""}
          onCreated={(key) => void handleJiraCreated(key)}
          onClose={() => setJiraCreateOpen(false)}
        />
      )}

      {showWiki && wikiCandidates.length > 0 && (
        <div
          ref={wikiRef}
          className={styles.slashMenu}
          style={{ top: wikiPos.top, left: wikiPos.left }}
        >
          {wikiCandidates.map((item, index) => (
            <button
              key={item.id}
              className={clsx(
                styles.slashItem,
                index === wikiIndex && styles.slashItemActive
              )}
              onMouseEnter={() => {
                wikiIndexRef.current = index;
                setWikiIndex(index);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                insertWikiLink(item.title || "Untitled");
              }}
            >
              {item.title || "Untitled"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
