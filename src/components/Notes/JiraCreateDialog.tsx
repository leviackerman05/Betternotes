import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { inferJiraProjectKey } from "../../lib/jiraKeys";
import type { JiraCreateRequest, JiraSprint, JiraUser } from "../../types";
import styles from "./JiraCreateDialog.module.css";

const ISSUE_TYPES = ["Task", "Story", "Bug", "Epic"];

interface JiraCreateDialogProps {
  open: boolean;
  defaultSummary?: string;
  noteHtml?: string;
  defaultProjectKey?: string;
  onCreated: (key: string) => void;
  onClose: () => void;
}

export function JiraCreateDialog({
  open,
  defaultSummary = "",
  noteHtml = "",
  defaultProjectKey = "",
  onCreated,
  onClose,
}: JiraCreateDialogProps) {
  const [summary, setSummary] = useState(defaultSummary);
  const [description, setDescription] = useState("");
  const [issueType, setIssueType] = useState("Task");
  const [storyPoints, setStoryPoints] = useState("");
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [assignee, setAssignee] = useState<JiraUser | null>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<JiraUser[]>([]);
  const [reporterQuery, setReporterQuery] = useState("");
  const [reporter, setReporter] = useState<JiraUser | null>(null);
  const [reporterOptions, setReporterOptions] = useState<JiraUser[]>([]);
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [sprintId, setSprintId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projectKeyInput, setProjectKeyInput] = useState("");
  const inferredKey = inferJiraProjectKey(noteHtml, defaultProjectKey);
  const projectKey = projectKeyInput.trim().toUpperCase() || inferredKey;

  useEffect(() => {
    if (!open) return;
    setSummary(defaultSummary);
    setDescription("");
    setIssueType("Task");
    setStoryPoints("");
    setAssignee(null);
    setAssigneeQuery("");
    setReporter(null);
    setReporterQuery("");
    setSprintId("");
    setError(null);
    setProjectKeyInput(inferredKey);
    if (inferredKey) {
      void api.jiraListSprints(inferredKey).then(setSprints).catch(() => setSprints([]));
    } else {
      setSprints([]);
    }
    void api.getJiraCredentials().then((creds) => {
      if (creds?.email) setReporterQuery(creds.email);
    });
  }, [open, defaultSummary, projectKey]);

  useEffect(() => {
    if (!open || assigneeQuery.trim().length < 2) {
      setAssigneeOptions([]);
      return;
    }
    const t = setTimeout(() => {
      void api.jiraSearchUsers(assigneeQuery).then(setAssigneeOptions).catch(() => setAssigneeOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [assigneeQuery, open]);

  useEffect(() => {
    if (!open || reporterQuery.trim().length < 2) {
      setReporterOptions([]);
      return;
    }
    const t = setTimeout(() => {
      void api.jiraSearchUsers(reporterQuery).then(setReporterOptions).catch(() => setReporterOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [reporterQuery, open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!summary.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const req: JiraCreateRequest = {
        project_key: projectKey,
        summary: summary.trim(),
        description: description.trim() || null,
        issue_type: issueType,
        assignee_account_id: assignee?.account_id ?? null,
        reporter_account_id: reporter?.account_id ?? null,
        sprint_id: sprintId === "" ? null : sprintId,
        story_points: storyPoints ? Number(storyPoints) : null,
      };
      const issue = await api.jiraCreateIssue(req);
      onCreated(issue.key);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Create Jira ticket</h3>
        <label className={styles.label}>Project key</label>
        <input
          className={styles.input}
          value={projectKeyInput}
          onChange={(e) => setProjectKeyInput(e.target.value.toUpperCase())}
          placeholder="e.g. PROJ"
        />

        <label className={styles.label}>Summary</label>
        <input
          className={styles.input}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          autoFocus
        />

        <label className={styles.label}>Description</label>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Type</label>
            <select
              className={styles.select}
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
            >
              {ISSUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Story points</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              step="0.5"
              value={storyPoints}
              onChange={(e) => setStoryPoints(e.target.value)}
              placeholder="None"
            />
          </div>
        </div>

        <label className={styles.label}>Assignee</label>
        <input
          className={styles.input}
          value={assignee ? assignee.display_name : assigneeQuery}
          onChange={(e) => {
            setAssignee(null);
            setAssigneeQuery(e.target.value);
          }}
          placeholder="Search by name or email…"
        />
        {assigneeOptions.length > 0 && !assignee && (
          <div className={styles.suggestions}>
            {assigneeOptions.map((u) => (
              <button
                key={u.account_id}
                type="button"
                className={styles.suggestion}
                onClick={() => {
                  setAssignee(u);
                  setAssigneeQuery(u.display_name);
                  setAssigneeOptions([]);
                }}
              >
                {u.display_name}
                {u.email ? ` · ${u.email}` : ""}
              </button>
            ))}
          </div>
        )}

        <label className={styles.label}>Reporter</label>
        <input
          className={styles.input}
          value={reporter ? reporter.display_name : reporterQuery}
          onChange={(e) => {
            setReporter(null);
            setReporterQuery(e.target.value);
          }}
          placeholder="Search by name or email…"
        />
        {reporterOptions.length > 0 && !reporter && (
          <div className={styles.suggestions}>
            {reporterOptions.map((u) => (
              <button
                key={u.account_id}
                type="button"
                className={styles.suggestion}
                onClick={() => {
                  setReporter(u);
                  setReporterQuery(u.display_name);
                  setReporterOptions([]);
                }}
              >
                {u.display_name}
                {u.email ? ` · ${u.email}` : ""}
              </button>
            ))}
          </div>
        )}

        <label className={styles.label}>Sprint</label>
        <select
          className={styles.select}
          value={sprintId}
          onChange={(e) =>
            setSprintId(e.target.value ? Number(e.target.value) : "")
          }
        >
          <option value="">Backlog (no sprint)</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.state})
            </option>
          ))}
        </select>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            disabled={saving || !summary.trim()}
            onClick={() => void handleSubmit()}
          >
            {saving ? "Creating…" : "Create ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
