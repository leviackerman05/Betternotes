import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Italic,
  Link2,
  Strikethrough,
  Unlink,
} from "lucide-react";
import clsx from "clsx";
import styles from "./SelectionFormatBar.module.css";

interface SelectionFormatBarProps {
  editor: Editor;
  position: { x: number; y: number };
  onLink: () => void;
}

export function SelectionFormatBar({ editor, position, onLink }: SelectionFormatBarProps) {
  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className={styles.bar}
      style={{ top: position.y, left: position.x }}
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className={clsx(styles.btn, editor.isActive("bold") && styles.btnActive)}
        title="Bold (⌘B)"
        onMouseDown={run(() => editor.chain().focus().toggleBold().run())}
      >
        <Bold size={15} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className={clsx(styles.btn, editor.isActive("italic") && styles.btnActive)}
        title="Italic (⌘I)"
        onMouseDown={run(() => editor.chain().focus().toggleItalic().run())}
      >
        <Italic size={15} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className={clsx(styles.btn, editor.isActive("strike") && styles.btnActive)}
        title="Strikethrough"
        onMouseDown={run(() => editor.chain().focus().toggleStrike().run())}
      >
        <Strikethrough size={15} strokeWidth={2.5} />
      </button>
      <span className={styles.divider} aria-hidden />
      <button
        type="button"
        className={clsx(styles.btn, editor.isActive("code") && styles.btnActive)}
        title="Inline code"
        onMouseDown={run(() => editor.chain().focus().toggleCode().run())}
      >
        <Code size={15} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className={clsx(styles.btn, editor.isActive("link") && styles.btnActive)}
        title="Add link"
        onMouseDown={run(onLink)}
      >
        <Link2 size={15} strokeWidth={2.5} />
      </button>
      {editor.isActive("link") && (
        <button
          type="button"
          className={styles.btn}
          title="Remove link"
          onMouseDown={run(() => editor.chain().focus().unsetLink().run())}
        >
          <Unlink size={15} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
