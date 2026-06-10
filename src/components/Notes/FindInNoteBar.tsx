import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { FindMatch } from "../../lib/findInNote";
import { noAutocorrectProps } from "../../lib/noAutocorrect";
import styles from "./FindInNoteBar.module.css";

interface FindInNoteBarProps {
  open: boolean;
  query: string;
  matches: FindMatch[];
  activeIndex: number;
  onQueryChange: (query: string) => void;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
}

export function FindInNoteBar({
  open,
  query,
  matches,
  activeIndex,
  onQueryChange,
  onActiveIndexChange,
  onClose,
}: FindInNoteBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  if (!open) return null;

  const go = (delta: number) => {
    if (matches.length === 0) return;
    onActiveIndexChange((activeIndex + delta + matches.length) % matches.length);
  };

  const countLabel =
    matches.length === 0
      ? query.trim()
        ? "No results"
        : ""
      : `${activeIndex + 1} of ${matches.length}`;

  return (
    <div
      className={styles.bar}
      role="search"
      onMouseDown={(e) => {
        if (e.target !== inputRef.current) e.preventDefault();
      }}
    >
      <input
        ref={inputRef}
        className={styles.input}
        placeholder="Find in note…"
        {...noAutocorrectProps}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            go(e.shiftKey ? -1 : 1);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <span className={styles.count}>{countLabel}</span>
      <button
        type="button"
        className={styles.btn}
        title="Previous (⇧Enter)"
        disabled={matches.length === 0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => go(-1)}
      >
        <ChevronUp size={16} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Next (Enter)"
        disabled={matches.length === 0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => go(1)}
      >
        <ChevronDown size={16} />
      </button>
      <button
        type="button"
        className={styles.btn}
        title="Close (Esc)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClose}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function scrollToFindMatch(
  match: FindMatch,
  editor: Editor | null,
  titleInputRef: React.RefObject<HTMLInputElement | null>,
  noteBodyRef: React.RefObject<HTMLDivElement | null>
) {
  if (match.source === "title") {
    titleInputRef.current?.scrollIntoView({ block: "nearest" });
    return;
  }

  if (!editor) return;
  const coords = editor.view.coordsAtPos(match.from);
  const container = noteBodyRef.current;
  if (container) {
    const containerRect = container.getBoundingClientRect();
    const offset = coords.top - containerRect.top + container.scrollTop - 80;
    container.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
  }
}
