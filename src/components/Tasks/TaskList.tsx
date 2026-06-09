import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import clsx from "clsx";
import type { Task } from "../../types";
import { api } from "../../lib/api";
import { openExternal } from "../../lib/openExternal";
import {
  DEFAULT_JIRA_SECTION_TITLE,
  jiraSectionTitle,
  withDefaultIntegrations,
} from "../../lib/integrations";
import {
  activeJiraMyIssuesFilter,
  buildJiraMyIssuesPreset,
  jiraMyIssuesJql,
  JIRA_MY_ISSUES_FILTER_LABELS,
  type JiraMyIssuesPreset,
} from "../../lib/jiraMyIssuesJql";
import {
  groupJiraTasksByStatus,
  jiraTasksOnly,
  parseJiraMeta,
  statusTone,
} from "../../lib/jiraTasks";
import { useAppStore } from "../../store/appStore";
import styles from "./TaskList.module.css";

const FILTER_OPTIONS: Array<JiraMyIssuesPreset | "custom"> = [
  "sprint_and_backlog",
  "sprint_only",
  "all_open",
  "custom",
];

interface TaskListProps {
  tasks: Task[];
  onSyncJira: () => Promise<unknown>;
}

export function TaskList({ tasks, onSyncJira }: TaskListProps) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const sectionTitle = jiraSectionTitle(settings);
  const savedFilter = activeJiraMyIssuesFilter(settings);

  const [syncing, setSyncing] = useState(false);
  const [filterView, setFilterView] = useState(savedFilter);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(sectionTitle);
  const [customDraft, setCustomDraft] = useState(jiraMyIssuesJql(settings));
  const titleRef = useRef<HTMLInputElement>(null);

  const jiraTasks = jiraTasksOnly(tasks);
  const groups = groupJiraTasksByStatus(tasks);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(sectionTitle);
  }, [sectionTitle, editingTitle]);

  useEffect(() => {
    setFilterView(savedFilter);
  }, [savedFilter]);

  useEffect(() => {
    if (filterView === "custom") {
      setCustomDraft(settings.jira_my_issues_jql?.trim() || jiraMyIssuesJql(settings));
    }
  }, [filterView, settings.jira_my_issues_jql, settings.default_jira_project_key]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  const handleSyncJira = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await onSyncJira();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    void handleSyncJira();
    // Sync once when the Jira issues view opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = async (patch: Partial<typeof settings>) => {
    const updated = withDefaultIntegrations({ ...settings, ...patch });
    setSettings(updated);
    await api.saveSettings(updated);
    return updated;
  };

  const saveTitle = async () => {
    const next = titleDraft.trim() || DEFAULT_JIRA_SECTION_TITLE;
    setEditingTitle(false);
    setTitleDraft(next);
    try {
      await saveSettings({ jira_section_title: next });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    }
  };

  const cancelTitleEdit = () => {
    setTitleDraft(sectionTitle);
    setEditingTitle(false);
  };

  const applyFilter = async (filter: JiraMyIssuesPreset | "custom") => {
    setSyncError(null);
    if (filter === "custom") {
      setFilterView("custom");
      setCustomDraft(settings.jira_my_issues_jql?.trim() || jiraMyIssuesJql(settings));
      if (savedFilter !== "custom") return;
    }

    try {
      const jql =
        filter === "sprint_and_backlog"
          ? ""
          : filter === "custom"
            ? customDraft.trim()
            : buildJiraMyIssuesPreset(filter, settings);

      if (filter === "custom" && !jql) return;

      setFilterView(filter);
      await saveSettings({ jira_my_issues_jql: jql });
      await handleSyncJira();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    }
  };

  const openIssue = (task: Task) => {
    if (task.jira_url) void openExternal(task.jira_url);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          {editingTitle ? (
            <input
              ref={titleRef}
              className={styles.titleField}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void saveTitle()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveTitle();
                if (e.key === "Escape") cancelTitleEdit();
              }}
              maxLength={48}
              aria-label="Section title"
            />
          ) : (
            <h1
              className={styles.title}
              onClick={() => setEditingTitle(true)}
              title="Click to rename"
            >
              {sectionTitle}
            </h1>
          )}
          <p className={styles.meta}>
            {syncing && initialLoad
              ? "Syncing…"
              : `${jiraTasks.length} ${jiraTasks.length === 1 ? "issue" : "issues"}`}
          </p>

          <div className={styles.filterRow}>
            <div className={styles.filterPills} role="tablist" aria-label="Issue filter">
              {FILTER_OPTIONS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={filterView === filter}
                  className={clsx(
                    styles.filterPill,
                    filterView === filter && styles.filterPillActive
                  )}
                  onClick={() => void applyFilter(filter)}
                >
                  {JIRA_MY_ISSUES_FILTER_LABELS[filter]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => void handleSyncJira()}
              disabled={syncing}
              title="Refresh from Jira"
            >
              <RefreshCw size={14} className={syncing ? styles.spin : undefined} />
            </button>
          </div>

          {filterView === "custom" && (
            <div className={styles.customQuery}>
              <textarea
                className={styles.customInput}
                rows={2}
                spellCheck={false}
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void applyFilter("custom");
                  }
                }}
                placeholder="assignee = currentUser() AND …"
                aria-label="Custom JQL query"
              />
              <div className={styles.customActions}>
                <button
                  type="button"
                  className={styles.applyBtn}
                  disabled={syncing || !customDraft.trim()}
                  onClick={() => void applyFilter("custom")}
                >
                  Apply
                </button>
                <span className={styles.customHint}>⌘↵ to apply</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {syncError && <p className={styles.syncError}>{syncError}</p>}

      {syncing && initialLoad && jiraTasks.length === 0 ? (
        <div className={styles.loading}>
          <RefreshCw size={20} className={styles.spin} />
          <p>Loading your Jira tickets…</p>
        </div>
      ) : groups.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No matching issues</p>
          <p className={styles.emptyDesc}>
            Try a different filter above or adjust your custom JQL.
          </p>
        </div>
      ) : (
        <div className={styles.board}>
          {groups.map(({ status, tasks: groupTasks }) => (
            <section key={status} className={styles.statusBlock}>
              <div className={styles.statusHeader}>
                <span
                  className={clsx(styles.statusPill, styles[`statusPill_${statusTone(status)}`])}
                >
                  {status}
                </span>
                <span className={styles.statusCount}>{groupTasks.length}</span>
              </div>
              <div className={styles.issueList}>
                {groupTasks.map((task) => {
                  const meta = parseJiraMeta(task);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className={styles.issueCard}
                      onClick={() => openIssue(task)}
                    >
                      <div className={styles.issueMain}>
                        <div className={styles.issueTop}>
                          <span className={styles.issueKey}>{task.jira_key}</span>
                          {meta.issueType && (
                            <span className={styles.issueType}>{meta.issueType}</span>
                          )}
                        </div>
                        <p className={styles.issueSummary}>{task.title}</p>
                      </div>
                      <ExternalLink size={14} className={styles.issueOpen} />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
