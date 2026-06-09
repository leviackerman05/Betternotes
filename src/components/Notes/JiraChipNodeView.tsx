import { useEffect, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { api } from "../../lib/api";
import { openExternal } from "../../lib/openExternal";
import { statusDotColor } from "../../lib/jiraKeys";
import { isJiraEnabled } from "../../lib/integrations";
import { useAppStore } from "../../store/appStore";
import type { JiraIssue } from "../../types";
import styles from "./JiraChip.module.css";

export function JiraChipNodeView({ node, updateAttributes }: NodeViewProps) {
  const settings = useAppStore((s) => s.settings);
  const jiraOn = isJiraEnabled(settings);
  const key = (node.attrs.key as string) || "";
  const cachedSummary = (node.attrs.summary as string) || "";
  const [issue, setIssue] = useState<JiraIssue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!key || !jiraOn) return;
    // Offline-first: only fetch when we lack cached summary data
    if (cachedSummary) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    api
      .jiraGetIssue(key)
      .then((data) => {
        if (cancelled) return;
        setIssue(data);
        updateAttributes({
          key: data.key,
          summary: data.summary,
          status: data.status,
          statusCategory: data.status_category,
          assignee: data.assignee ?? null,
          url: data.url,
        });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, jiraOn, cachedSummary, updateAttributes]);

  const url = (node.attrs.url as string) || issue?.url;
  const status = (node.attrs.status as string) || issue?.status || "";
  const statusCategory =
    (node.attrs.statusCategory as string) || issue?.status_category || "";
  const summary = cachedSummary || issue?.summary || "";
  const assignee = (node.attrs.assignee as string) || issue?.assignee || "";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (url) void openExternal(url);
  };

  return (
    <NodeViewWrapper as="span" className={styles.wrap}>
      <button
        type="button"
        className={styles.chip}
        onClick={handleClick}
        title={
          summary
            ? `${summary}${status ? ` · ${status}` : ""}${assignee ? ` · ${assignee}` : ""}`
            : `Open ${key} in Jira`
        }
        disabled={!url && !loading}
      >
        <span
          className={styles.dot}
          style={{ background: statusDotColor(statusCategory) }}
        />
        <span className={styles.key}>{key}</span>
        {loading && <span className={styles.hint}>…</span>}
        {error && !loading && <span className={styles.hint}>!</span>}
      </button>
    </NodeViewWrapper>
  );
}
