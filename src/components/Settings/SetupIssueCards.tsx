import { useState } from "react";
import { HelpCircle } from "lucide-react";
import clsx from "clsx";
import type { GuideTroubleshooting } from "../../lib/integrationGuides";
import styles from "./SetupIssueCards.module.css";

interface SetupIssueCardsProps {
  items: GuideTroubleshooting[];
}

export function SetupIssueCards({ items }: SetupIssueCardsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <div className={styles.root}>
      <p className={styles.label}>
        <HelpCircle size={13} />
        Common issues
      </p>
      <div className={styles.grid}>
        {items.map((item, index) => {
          const open = openIndex === index;
          return (
            <button
              key={item.question}
              type="button"
              className={clsx(styles.card, open && styles.cardOpen)}
              onClick={() => setOpenIndex(open ? null : index)}
              aria-expanded={open}
            >
              {item.question}
            </button>
          );
        })}
      </div>
      {openIndex !== null && (
        <p className={styles.answer}>{items[openIndex].answer}</p>
      )}
    </div>
  );
}
