import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { JiraIssue } from "../../types";
import { statusDotColor } from "../../lib/jiraKeys";
import styles from "./JiraTicketPicker.module.css";

export type JiraPickerMode = "single" | "multi" | "search";

export interface JiraPickerState {
  mode: JiraPickerMode;
  issues: JiraIssue[];
  filter: string;
  statusLabel?: string;
  searching?: boolean;
  hasSearched?: boolean;
  usedAi?: boolean;
}

interface JiraTicketPickerProps {
  state: JiraPickerState;
  position: { top: number; left: number };
  pickerRef?: React.RefObject<HTMLDivElement | null>;
  onFilterChange: (filter: string) => void;
  onSearch: (query: string) => void;
  onSelect: (issues: JiraIssue[], withDetails: boolean) => void;
  onFetchKey: (key: string) => void;
  onClose: () => void;
}

export function JiraTicketPicker({
  state,
  position,
  pickerRef,
  onFilterChange,
  onSearch,
  onSelect,
  onFetchKey,
  onClose,
}: JiraTicketPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const localRef = useRef<HTMLDivElement>(null);
  const ref = pickerRef ?? localRef;

  const filtered = useMemo(() => {
    if (state.mode === "search") return state.issues;
    const q = state.filter.trim().toLowerCase();
    if (!q) return state.issues;
    return state.issues.filter(
      (issue) =>
        issue.key.toLowerCase().includes(q) ||
        issue.summary.toLowerCase().includes(q) ||
        issue.status.toLowerCase().includes(q) ||
        issue.description?.toLowerCase().includes(q)
    );
  }, [state.filter, state.issues, state.mode]);

  useEffect(() => {
    setIndex(0);
    setSelected(new Set());
  }, [state.filter, state.mode, state.issues]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) =>
          filtered.length ? (i - 1 + filtered.length) % filtered.length : 0
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const keyCandidate = state.filter.trim();
        if (/^[A-Za-z][A-Za-z0-9]+-\d+$/i.test(keyCandidate) && filtered.length === 0) {
          onFetchKey(keyCandidate.toUpperCase());
          return;
        }
        if (state.mode === "search" && state.filter.trim() && filtered.length === 0) {
          onSearch(state.filter.trim());
          return;
        }
        const issue = filtered[index];
        if (!issue) {
          if (state.mode === "search" && state.filter.trim()) {
            onSearch(state.filter.trim());
          }
          return;
        }
        if (state.mode === "single" || state.mode === "search") {
          onSelect([issue], e.shiftKey);
        } else {
          const next = new Set(selected);
          if (next.has(issue.key)) next.delete(issue.key);
          else next.add(issue.key);
          setSelected(next);
        }
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [
    filtered,
    index,
    onClose,
    onFetchKey,
    onSearch,
    onSelect,
    selected,
    state.filter,
    state.mode,
  ]);

  const title =
    state.mode === "search"
      ? "Find ticket"
      : state.mode === "multi"
        ? state.statusLabel
          ? `Pick ${state.statusLabel} tickets`
          : "Pick tickets"
        : "Insert Jira ticket";

  const placeholder =
    state.mode === "search"
      ? "e.g. assigned to Alex, login bug"
      : "Search or type PROJ-123…";

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  return (
    <div
      ref={ref}
      className={styles.picker}
      style={{ top: position.top, left: position.left }}
    >
      <p className={styles.title}>{title}</p>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          value={state.filter}
          onChange={(e) => onFilterChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && state.filter.trim()) {
              e.preventDefault();
              e.stopPropagation();
              if (state.mode === "search" || filtered.length === 0) {
                onSearch(state.filter.trim());
              }
            }
          }}
          placeholder={placeholder}
          autoFocus
        />
        {(state.mode === "search" || state.filter.trim()) && (
          <button
            type="button"
            className={styles.searchBtn}
            disabled={!state.filter.trim() || state.searching}
            onMouseDown={(e) => {
              e.preventDefault();
              if (state.filter.trim()) onSearch(state.filter.trim());
            }}
          >
            {state.searching ? "…" : "Search"}
          </button>
        )}
      </div>
      {state.mode === "search" && (
        <p className={styles.hint}>
          {state.searching
            ? state.usedAi
              ? "Understanding with Ollama…"
              : "Searching Jira…"
            : "Rules first, then Ollama if needed · + details for full ticket"}
        </p>
      )}
      <div className={styles.list}>
        {state.searching ? (
          <p className={styles.empty}>Searching…</p>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>
            {/^[A-Za-z][A-Za-z0-9]+-\d+$/i.test(state.filter.trim())
              ? "Press Enter or Search to fetch ticket"
              : state.mode === "search" && state.hasSearched
                ? "No tickets found. Try different words or an assignee name."
                : state.mode === "search"
                  ? "Describe the ticket, then press Search"
                  : "No matching tickets"}
          </p>
        ) : (
          filtered.map((issue, i) => (
            <div
              key={issue.key}
              className={clsx(
                styles.item,
                i === index && styles.itemActive,
                state.mode === "multi" && selected.has(issue.key) && styles.itemSelected
              )}
              onMouseEnter={() => setIndex(i)}
            >
              <button
                type="button"
                className={styles.itemMain}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (state.mode === "single" || state.mode === "search") {
                    onSelect([issue], e.shiftKey);
                  } else {
                    toggle(issue.key);
                  }
                }}
              >
                <span
                  className={styles.dot}
                  style={{ background: statusDotColor(issue.status_category) }}
                />
                <span className={styles.key}>{issue.key}</span>
                <span className={styles.summary}>{issue.summary}</span>
                <span className={styles.status}>{issue.status}</span>
              </button>
              {(state.mode === "single" || state.mode === "search") && (
                <button
                  type="button"
                  className={styles.detailBtn}
                  title="Insert with full details"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect([issue], true);
                  }}
                >
                  + details
                </button>
              )}
            </div>
          ))
        )}
      </div>
      {state.mode === "multi" && filtered.length > 0 && (
        <button
          type="button"
          className={styles.insertBtn}
          disabled={selected.size === 0}
          onMouseDown={(e) => {
            e.preventDefault();
            const picks = state.issues.filter((i) => selected.has(i.key));
            if (picks.length) onSelect(picks, false);
          }}
        >
          Insert {selected.size || ""} ticket{selected.size === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
