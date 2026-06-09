import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import styles from "./SetupAccordion.module.css";

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

interface SetupAccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string | null;
  allowMultiple?: boolean;
}

export function SetupAccordion({
  items,
  defaultOpenId = null,
  allowMultiple = false,
}: SetupAccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    defaultOpenId ? new Set([defaultOpenId]) : new Set()
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (!allowMultiple) next.clear();
      next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.root}>
      {items.map((item) => {
        const open = openIds.has(item.id);
        return (
          <div key={item.id} className={clsx(styles.item, open && styles.itemOpen)}>
            <button
              type="button"
              className={styles.trigger}
              onClick={() => toggle(item.id)}
              aria-expanded={open}
            >
              <span className={styles.triggerTitle}>{item.title}</span>
              <ChevronDown size={14} className={styles.chevron} />
            </button>
            {open && <div className={styles.content}>{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
