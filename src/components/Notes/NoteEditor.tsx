import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { Note } from "../../types";
import { AgentBlock } from "./AgentBlock";
import styles from "./NoteEditor.module.css";

interface NoteEditorProps {
  note: Note | null;
  onUpdate: (id: string, title: string, content: string) => void;
  onAddTask: (title: string, jiraKey?: string, jiraUrl?: string) => void;
}

interface SlashItem {
  title: string;
  command: string;
}

const SLASH_ITEMS: SlashItem[] = [
  { title: "Heading 1", command: "h1" },
  { title: "Heading 2", command: "h2" },
  { title: "Bullet list", command: "bullet" },
  { title: "Numbered list", command: "ordered" },
  { title: "Jira agent", command: "jira" },
];

export function NoteEditor({ note, onUpdate, onAddTask }: NoteEditorProps) {
  const [title, setTitle] = useState("");
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [agentBlocks, setAgentBlocks] = useState<{ id: string; prompt: string }[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const slashRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing, or type / for commands…" }),
    ],
    content: "",
    onUpdate: ({ editor: ed }) => {
      if (!note) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onUpdate(note.id, title, ed.getHTML());
      }, 500);

      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 20), from, "\n");
      const slashMatch = textBefore.match(/\/(\w*)$/);
      if (slashMatch) {
        setShowSlash(true);
        setSlashFilter(slashMatch[1]);
        const coords = ed.view.coordsAtPos(from);
        setSlashPos({ top: coords.bottom + 4, left: coords.left });
      } else {
        setShowSlash(false);
      }
    },
  });

  useEffect(() => {
    if (!note || !editor) return;
    setTitle(note.title);
    editor.commands.setContent(note.content || "");
    setAgentBlocks([]);
  }, [note?.id, editor]);

  const executeSlash = useCallback(
    (command: string) => {
      if (!editor) return;
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 20), from, "\n");
      const slashIdx = textBefore.lastIndexOf("/");
      if (slashIdx >= 0) {
        const deleteFrom = from - (textBefore.length - slashIdx);
        editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();
      }

      switch (command) {
        case "h1":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "h2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "bullet":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "ordered":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "jira":
          setAgentBlocks((prev) => [
            ...prev,
            { id: `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`, prompt: "" },
          ]);
          break;
      }
      setShowSlash(false);
    },
    [editor]
  );

  const filteredItems = SLASH_ITEMS.filter((item) =>
    item.title.toLowerCase().includes(slashFilter.toLowerCase())
  );

  if (!note) {
    return (
      <div className={styles.empty}>
        <p>Select a note or create a new one</p>
      </div>
    );
  }

  return (
    <div className={styles.editor}>
      <input
        className={styles.titleInput}
        placeholder="Note title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            onUpdate(note.id, e.target.value, editor?.getHTML() ?? "");
          }, 500);
        }}
      />
      <EditorContent editor={editor} className={styles.content} />

      {agentBlocks.map((block) => (
        <AgentBlock
          key={block.id}
          initialPrompt={block.prompt}
          onAddTask={onAddTask}
        />
      ))}

      {showSlash && filteredItems.length > 0 && (
        <div
          ref={slashRef}
          className={styles.slashMenu}
          style={{ top: slashPos.top, left: slashPos.left }}
        >
          {filteredItems.map((item) => (
            <button
              key={item.command}
              className={styles.slashItem}
              onMouseDown={(e) => {
                e.preventDefault();
                executeSlash(item.command);
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
