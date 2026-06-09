import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  FolderInput,
  Copy,
  FileCode,
  Info,
  Link2,
  Lock,
  LockOpen,
  Pin,
  PinOff,
  Share2,
  Star,
  StarOff,
  Trash2,
  Type,
} from "lucide-react";
import clsx from "clsx";
import type { Folder, Note } from "../../types";
import styles from "./NoteContextMenu.module.css";

export interface NoteMenuActions {
  onPin: () => void;
  onFavorite: () => void;
  onLock: () => void;
  onDuplicate: () => void;
  onDuplicateTo: (folderId: string) => void;
  onInsertLink: () => void;
  onRename: () => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onExportText: () => void;
  onShare: () => void;
  onMoveTo: (folderId: string) => void;
  onNoteInfo: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

interface NoteContextMenuProps {
  note: Note;
  folders: Folder[];
  currentFolderId?: string;
  position: { x: number; y: number };
  onClose: () => void;
  actions: NoteMenuActions;
}

type Submenu = "move" | "duplicate" | "export" | null;

export function NoteContextMenu({
  note,
  folders,
  currentFolderId,
  position,
  onClose,
  actions,
}: NoteContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<Submenu>(null);
  const [coords, setCoords] = useState(position);
  const [submenuFlip, setSubmenuFlip] = useState(false);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const maxH = window.innerHeight - pad * 2;
    let x = position.x;
    let y = position.y;

    if (rect.width + x > window.innerWidth - pad) {
      x = window.innerWidth - rect.width - pad;
    }
    if (rect.height > maxH) {
      y = pad;
    } else if (y + rect.height > window.innerHeight - pad) {
      y = window.innerHeight - rect.height - pad;
    }
    setCoords({ x: Math.max(pad, x), y: Math.max(pad, y) });
    setSubmenuFlip(x + rect.width + 180 > window.innerWidth);
  }, [position]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  const otherFolders = folders.filter((f) => f.id !== currentFolderId);

  const Item = ({
    icon: Icon,
    label,
    onClick,
    danger,
    disabled,
  }: {
    icon: typeof Pin;
    label: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
  }) => (
    <button
      className={clsx(styles.item, danger && styles.itemDanger)}
      onClick={() => !disabled && run(onClick)}
      disabled={disabled}
    >
      <Icon size={15} className={styles.icon} />
      <span>{label}</span>
    </button>
  );

  const SubmenuTrigger = ({
    id,
    icon: Icon,
    label,
  }: {
    id: Submenu;
    icon: typeof Pin;
    label: string;
  }) => (
    <button
      className={clsx(styles.item, submenu === id && styles.itemActive)}
      onMouseEnter={() => setSubmenu(id)}
      onClick={() => setSubmenu(submenu === id ? null : id)}
    >
      <Icon size={15} className={styles.icon} />
      <span>{label}</span>
      <ChevronRight size={14} className={styles.chevron} />
    </button>
  );

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ top: coords.y, left: coords.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Item
        icon={note.pinned ? PinOff : Pin}
        label={note.pinned ? "Unpin" : "Pin"}
        onClick={actions.onPin}
      />
      <Item
        icon={note.favorite ? StarOff : Star}
        label={note.favorite ? "Unfavorite" : "Favorite"}
        onClick={actions.onFavorite}
      />
      <Item
        icon={note.locked ? LockOpen : Lock}
        label={note.locked ? "Unlock" : "Lock with Password"}
        onClick={actions.onLock}
      />

      <div className={styles.divider} />

      <Item icon={Copy} label="Duplicate" onClick={actions.onDuplicate} />
      {otherFolders.length > 0 && (
        <SubmenuTrigger id="duplicate" icon={Copy} label="Duplicate to…" />
      )}
      <Item icon={Link2} label="Insert Link" onClick={actions.onInsertLink} />
      <Item icon={Type} label="Rename" onClick={actions.onRename} />

      <div className={styles.divider} />

      <Item icon={Share2} label="Share" onClick={actions.onShare} />
      <SubmenuTrigger id="export" icon={FileCode} label="Export as…" />

      {otherFolders.length > 0 && (
        <>
          <div className={styles.divider} />
          <SubmenuTrigger id="move" icon={FolderInput} label="Move to…" />
        </>
      )}

      <div className={styles.divider} />

      <Item icon={Info} label="Note Info" onClick={actions.onNoteInfo} />
      <Item
        icon={note.archived ? ArchiveRestore : Archive}
        label={note.archived ? "Unarchive" : "Archive"}
        onClick={actions.onArchive}
      />
      <Item icon={Trash2} label="Delete" onClick={actions.onDelete} danger />

      {submenu === "move" && otherFolders.length > 0 && (
        <div className={clsx(styles.submenu, submenuFlip && styles.submenuFlip)}>
          {otherFolders.map((f) => (
            <button
              key={f.id}
              className={styles.subItem}
              onClick={() => run(() => actions.onMoveTo(f.id))}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {submenu === "duplicate" && otherFolders.length > 0 && (
        <div className={clsx(styles.submenu, submenuFlip && styles.submenuFlip)}>
          {otherFolders.map((f) => (
            <button
              key={f.id}
              className={styles.subItem}
              onClick={() => run(() => actions.onDuplicateTo(f.id))}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {submenu === "export" && (
        <div className={clsx(styles.submenu, submenuFlip && styles.submenuFlip)}>
          <button className={styles.subItem} onClick={() => run(actions.onExportMarkdown)}>
            Markdown (.md)
          </button>
          <button className={styles.subItem} onClick={() => run(actions.onExportHtml)}>
            HTML (.html)
          </button>
          <button className={styles.subItem} onClick={() => run(actions.onExportText)}>
            Plain Text (.txt)
          </button>
        </div>
      )}
    </div>
  );
}
