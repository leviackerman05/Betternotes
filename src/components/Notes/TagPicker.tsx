import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import clsx from "clsx";
import type { Tag } from "../../types";
import styles from "./TagPicker.module.css";

interface TagPickerProps {
  open: boolean;
  noteTags: string[];
  allTags: Tag[];
  onClose: () => void;
  onSave: (tags: string[]) => void;
}

export function TagPicker({ open, noteTags, allTags, onClose, onSave }: TagPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSelected([...noteTags]);
  }, [open, noteTags]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  };

  const addNew = () => {
    const trimmed = newTag.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    setSelected((prev) => [...prev, trimmed]);
    setNewTag("");
  };

  const allNames = [...new Set([...allTags.map((t) => t.name), ...selected])];

  return (
    <div className={styles.overlay}>
      <div ref={ref} className={styles.picker}>
        <div className={styles.header}>
          <span>Tags</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.tags}>
          {allNames.map((name) => (
            <button
              key={name}
              className={clsx(styles.tag, selected.includes(name) && styles.tagOn)}
              onClick={() => toggle(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            placeholder="New tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNew()}
          />
          <button className={styles.addBtn} onClick={addNew}><Plus size={16} /></button>
        </div>
        <button className={styles.saveBtn} onClick={() => onSave(selected)}>
          Save tags
        </button>
      </div>
    </div>
  );
}
