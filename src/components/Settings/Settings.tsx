import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
  Loader2,
  Moon,
  Settings2,
  Shield,
  Sun,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { api } from "../../lib/api";
import { withDefaultIntegrations } from "../../lib/integrations";
import {
  createSettingsBaseline,
  isSettingsDirty,
  type SettingsBaseline,
} from "../../lib/settingsDirty";
import { useAppStore } from "../../store/appStore";
import type { JiraCredentials, McpServerConfig } from "../../types";
import {
  AnthropicIcon,
  GitHubIcon,
  GoogleSheetsIcon,
  HacknPlanIcon,
  JiraIcon,
  LinearIcon,
  NotionIcon,
  OllamaIcon,
  OpenAIIcon,
  TrelloIcon,
} from "./IntegrationIcons";
import { IntegrationSetupInline } from "./IntegrationSetupInline";
import styles from "./Settings.module.css";

type ExpandPanel = "ollama" | "mcp" | "jira" | null;

interface ComingSoonRowProps {
  icon: ReactNode;
  title: string;
  description: string;
}

function IntegrationConfigSection({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <section className={styles.configZone} aria-label="Configuration">
      <header className={styles.configHeader}>
        <Settings2 size={14} className={styles.configHeaderIcon} />
        <div>
          <p className={styles.configLabel}>Configuration</p>
          {hint && <p className={styles.configHint}>{hint}</p>}
        </div>
      </header>
      <div className={styles.configBody}>{children}</div>
    </section>
  );
}

function ComingSoonRow({ icon, title, description }: ComingSoonRowProps) {
  return (
    <div className={clsx(styles.row, styles.rowDisabled)}>
      <div className={clsx(styles.rowIcon, styles.rowIconBrand)}>{icon}</div>
      <div className={styles.rowBody}>
        <p className={styles.rowTitle}>{title}</p>
        <p className={styles.rowDesc}>{description}</p>
      </div>
      <div className={styles.rowActions}>
        <span className={styles.badgeSoon}>Coming soon</span>
      </div>
    </div>
  );
}

export function Settings() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const setView = useAppStore((s) => s.setView);
  const setSettingsDirty = useAppStore((s) => s.setSettingsDirty);
  const setSettingsActions = useAppStore((s) => s.setSettingsActions);

  const [jira, setJira] = useState<JiraCredentials>({
    site_url: "",
    email: "",
    api_token: "",
  });
  const [mcpConfig, setMcpConfig] = useState<McpServerConfig>({
    command: "",
    args: [],
    env: {},
  });
  const [dataDir, setDataDir] = useState("");
  const [ollamaStatus, setOllamaStatus] = useState<{
    available: boolean;
    models: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandPanel>(null);
  const [baseline, setBaseline] = useState<SettingsBaseline | null>(null);

  const s = withDefaultIntegrations(settings);
  const locked = s.local_only_mode;

  useEffect(() => {
    api.getDataDir().then(setDataDir).catch(() => {});

    let cancelled = false;
    void (async () => {
      const creds = await api.getJiraCredentials();
      let mcp: McpServerConfig = { command: "", args: [], env: {} };
      try {
        mcp = await api.getMcpConfig();
      } catch {
        /* no saved MCP config */
      }
      if (cancelled) return;

      const jiraData = creds ?? { site_url: "", email: "", api_token: "" };
      setJira(jiraData);
      setMcpConfig(mcp);
      setBaseline(
        createSettingsBaseline(useAppStore.getState().settings, jiraData, mcp)
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!s.local_ai_enabled || locked) return;
    api.checkOllama().then(setOllamaStatus).catch(() =>
      setOllamaStatus({ available: false, models: [] })
    );
  }, [s.local_ai_enabled, locked]);

  const update = (patch: Partial<typeof settings>) => {
    setSettings(withDefaultIntegrations({ ...settings, ...patch }));
  };

  const connectIntegration = (
    key: "local_ai_enabled" | "mcp_enabled" | "jira_enabled",
    panel: ExpandPanel
  ) => {
    if (locked) return;
    if (!s[key]) update({ [key]: true });
    setExpanded(panel);
  };

  const toggleExpand = (panel: ExpandPanel) => {
    setExpanded((cur) => (cur === panel ? null : panel));
  };

  const refreshOllama = () => {
    if (!s.local_ai_enabled || locked) return;
    api.checkOllama().then(setOllamaStatus).catch(() =>
      setOllamaStatus({ available: false, models: [] })
    );
  };

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    try {
      const toSave = withDefaultIntegrations(settings);
      await api.saveSettings(toSave);

      if (toSave.mcp_enabled && !toSave.local_only_mode) {
        await api.saveMcpConfig(mcpConfig);
      }

      let savedJira = jira;
      if (toSave.jira_enabled && !toSave.local_only_mode) {
        const siteUrl = jira.site_url.trim().replace(/\/+$/, "");
        const email = jira.email.trim();
        const token = jira.api_token.trim();
        const hasAny = siteUrl || email || token;
        const hasAll = siteUrl && email && token;
        if (hasAny && !hasAll) {
          throw new Error("Jira requires Site URL, email, and API token.");
        }
        if (hasAll) {
          savedJira = { site_url: siteUrl, email, api_token: token };
          await api.saveJiraCredentials(savedJira);
          setJira(savedJira);
        }
      }

      setBaseline(createSettingsBaseline(toSave, savedJira, mcpConfig));
      setSettingsDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return true;
    } catch (e) {
      setSaveError(String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [settings, jira, mcpConfig, setSettingsDirty]);

  const discard = useCallback(async () => {
    const saved = withDefaultIntegrations(await api.getSettings());
    setSettings(saved);

    const creds = await api.getJiraCredentials();
    const jiraData = creds ?? { site_url: "", email: "", api_token: "" };
    setJira(jiraData);

    let mcp: McpServerConfig = { command: "", args: [], env: {} };
    try {
      mcp = await api.getMcpConfig();
    } catch {
      /* no saved MCP config */
    }
    setMcpConfig(mcp);
    setBaseline(createSettingsBaseline(saved, jiraData, mcp));
    setSettingsDirty(false);
    setSaveError(null);
  }, [setSettings, setSettingsDirty]);

  useEffect(() => {
    if (!baseline) return;
    setSettingsDirty(isSettingsDirty(settings, jira, mcpConfig, baseline));
  }, [settings, jira, mcpConfig, baseline, setSettingsDirty]);

  useEffect(() => {
    setSettingsActions({ save, discard });
    return () => setSettingsActions(null);
  }, [save, discard, setSettingsActions]);

  const clearJira = async () => {
    await api.deleteJiraCredentials();
    setJira({ site_url: "", email: "", api_token: "" });
  };

  const jiraConnected = !!(jira.site_url && jira.email && jira.api_token);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <button type="button" className={styles.backBtn} onClick={() => setView("notes")}>
          <ArrowLeft size={16} />
          Notes
        </button>
        <header className={styles.header}>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>
            Manage privacy, appearance, AI models, and optional integrations.
          </p>
        </header>

        <section className={styles.section}>
          <p className={styles.sectionLabel}>Privacy</p>
          <div className={styles.panel}>
            <div className={styles.row}>
              <div className={styles.rowIcon}>
                <Shield size={18} />
              </div>
              <div className={styles.rowBody}>
                <p className={styles.rowTitle}>Local Only Mode</p>
                <p className={styles.rowDesc}>
                  Block all external network calls. Your notes never leave this device.
                </p>
                <p className={styles.dataPath}>
                  <span className={styles.dataPathLabel}>Storage</span>
                  <code className={styles.dataPathValue}>
                    {dataDir || "…"}
                  </code>
                </p>
              </div>
              <div className={styles.rowActions}>
                {s.local_only_mode && (
                  <span className={clsx(styles.badge, styles.badgeActive)}>Active</span>
                )}
                <label className={styles.toggle} title="Toggle Local Only Mode">
                  <input
                    type="checkbox"
                    checked={s.local_only_mode}
                    onChange={(e) => update({ local_only_mode: e.target.checked })}
                  />
                  <span className={styles.toggleTrack} />
                  <span className={styles.toggleThumb} />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <p className={styles.sectionLabel}>Appearance</p>
          <div className={styles.panel}>
            <div className={styles.row}>
              <div className={styles.rowIcon}>
                <Sun size={18} />
              </div>
              <div className={styles.rowBody}>
                <p className={styles.rowTitle}>Theme</p>
                <p className={styles.rowDesc}>Choose how Betternote looks on your device.</p>
              </div>
              <div className={styles.rowActions}>
                <div className={styles.themeSegment}>
                  <button
                    type="button"
                    className={clsx(
                      styles.themeBtn,
                      settings.theme === "light" && styles.themeBtnActive
                    )}
                    onClick={() => update({ theme: "light" })}
                  >
                    <Sun size={14} />
                    Light
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      styles.themeBtn,
                      settings.theme === "dark" && styles.themeBtnActive
                    )}
                    onClick={() => update({ theme: "dark" })}
                  >
                    <Moon size={14} />
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <p className={styles.sectionLabel}>Models &amp; API</p>
          <p className={styles.sectionHint}>
            Configure AI providers for note actions like summarize, rewrite, and explain.
          </p>
          <div className={styles.panel}>
            <div className={clsx(styles.row, locked && styles.rowDisabled)}>
              <div className={clsx(styles.rowIcon, styles.rowIconBrand)}>
                <OllamaIcon />
              </div>
              <div className={styles.rowBody}>
                <p className={styles.rowTitle}>Ollama (Local)</p>
                <p className={styles.rowDesc}>
                  Run models on your machine. No data leaves your device.
                </p>
              </div>
              <div className={styles.rowActions}>
                {s.local_ai_enabled ? (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => toggleExpand("ollama")}
                  >
                    Manage
                    {expanded === "ollama" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    disabled={locked}
                    onClick={() => connectIntegration("local_ai_enabled", "ollama")}
                  >
                    Connect
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>
            </div>
            {expanded === "ollama" && s.local_ai_enabled && !locked && (
              <div className={styles.expandPanel}>
                <IntegrationSetupInline integrationId="ollama" locked={!!locked} />
                <IntegrationConfigSection hint="Enter your Ollama endpoint and model.">
                  {ollamaStatus && (
                    <p
                      className={clsx(
                        styles.statusLine,
                        ollamaStatus.available ? styles.statusOk : styles.statusErr
                      )}
                    >
                      {ollamaStatus.available ? (
                        <>
                          <Check size={14} /> Connected · {ollamaStatus.models.length} models
                          available
                        </>
                      ) : (
                        "Ollama not detected. Install from ollama.com and run: ollama pull qwen2.5:7b"
                      )}
                    </p>
                  )}
                  <div className={styles.fieldGrid}>
                    <div className={styles.field}>
                      <label>Endpoint</label>
                      <input
                        value={settings.ollama_endpoint}
                        onChange={(e) => update({ ollama_endpoint: e.target.value })}
                        onBlur={refreshOllama}
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Default model</label>
                      {ollamaStatus?.models.length ? (
                        <select
                          className={styles.select}
                          value={settings.ollama_model}
                          onChange={(e) => update({ ollama_model: e.target.value })}
                        >
                          {ollamaStatus.models.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={settings.ollama_model}
                          onChange={(e) => update({ ollama_model: e.target.value })}
                          placeholder="qwen2.5:7b"
                        />
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => {
                      update({ local_ai_enabled: false });
                      setExpanded(null);
                    }}
                  >
                    Disconnect
                  </button>
                </IntegrationConfigSection>
              </div>
            )}

            <ComingSoonRow
              icon={<OpenAIIcon />}
              title="OpenAI"
              description="Use GPT models for note actions via your API key."
            />
            <ComingSoonRow
              icon={<AnthropicIcon />}
              title="Anthropic"
              description="Use Claude models for note actions via your API key."
            />
          </div>
        </section>

        <section className={styles.section}>
          <p className={styles.sectionLabel}>Integrations</p>
          <p className={styles.sectionHint}>
            Connect external tools to link issues, sync tasks, and extend workflows.
          </p>
          <div className={styles.panel}>
            <div className={clsx(styles.row, locked && styles.rowDisabled)}>
              <div className={styles.rowIcon}>
                <Cpu size={18} />
              </div>
              <div className={styles.rowBody}>
                <p className={styles.rowTitle}>MCP Server</p>
                <p className={styles.rowDesc}>
                  Connect any MCP-compatible server for agent workflows.
                </p>
              </div>
              <div className={styles.rowActions}>
                {s.mcp_enabled ? (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => toggleExpand("mcp")}
                  >
                    Manage
                    {expanded === "mcp" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    disabled={locked}
                    onClick={() => connectIntegration("mcp_enabled", "mcp")}
                  >
                    Connect
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>
            </div>
            {expanded === "mcp" && s.mcp_enabled && !locked && (
              <div className={styles.expandPanel}>
                <IntegrationSetupInline integrationId="mcp" locked={!!locked} />
                <IntegrationConfigSection hint="Command and args for your MCP server package.">
                  <div className={styles.fieldGrid}>
                    <div className={styles.field}>
                      <label>Command</label>
                      <input
                        placeholder="npx"
                        value={mcpConfig.command}
                        onChange={(e) =>
                          setMcpConfig({ ...mcpConfig, command: e.target.value })
                        }
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Args (comma-separated)</label>
                      <input
                        placeholder="-y, your-mcp-server"
                        value={mcpConfig.args.join(", ")}
                        onChange={(e) =>
                          setMcpConfig({
                            ...mcpConfig,
                            args: e.target.value
                              .split(",")
                              .map((a) => a.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => {
                      update({ mcp_enabled: false });
                      setExpanded(null);
                    }}
                  >
                    Disconnect
                  </button>
                </IntegrationConfigSection>
              </div>
            )}

            <div className={clsx(styles.row, locked && styles.rowDisabled)}>
              <div className={clsx(styles.rowIcon, styles.rowIconBrand)}>
                <JiraIcon />
              </div>
              <div className={styles.rowBody}>
                <p className={styles.rowTitle}>Jira</p>
                <p className={styles.rowDesc}>
                  {jiraConnected && s.jira_enabled
                    ? `Connected as ${jira.email}`
                    : "Link tickets, sync tasks, and insert chips in notes."}
                </p>
              </div>
              <div className={styles.rowActions}>
                {s.jira_enabled ? (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => toggleExpand("jira")}
                  >
                    Manage
                    {expanded === "jira" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    disabled={locked}
                    onClick={() => connectIntegration("jira_enabled", "jira")}
                  >
                    Connect
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>
            </div>
            {expanded === "jira" && s.jira_enabled && !locked && (
              <div className={styles.expandPanel}>
                <IntegrationSetupInline integrationId="jira" locked={!!locked} />
                <IntegrationConfigSection hint="Credentials and defaults for Jira in Betternote.">
                  <div className={styles.fieldGrid}>
                    <div className={styles.field}>
                      <label>Sidebar section name</label>
                      <input
                        placeholder="My issues"
                        value={settings.jira_section_title ?? ""}
                        onChange={(e) => update({ jira_section_title: e.target.value })}
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Default project key</label>
                      <input
                        placeholder="e.g. PROJ"
                        value={settings.default_jira_project_key || ""}
                        onChange={(e) =>
                          update({ default_jira_project_key: e.target.value.toUpperCase() })
                        }
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Site URL</label>
                      <input
                        placeholder="https://yourcompany.atlassian.net"
                        value={jira.site_url}
                        onChange={(e) => setJira({ ...jira, site_url: e.target.value })}
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Email</label>
                      <input
                        type="email"
                        value={jira.email}
                        onChange={(e) => setJira({ ...jira, email: e.target.value })}
                      />
                    </div>
                    <div className={styles.field}>
                      <label>API Token</label>
                      <input
                        type="password"
                        value={jira.api_token}
                        onChange={(e) => setJira({ ...jira, api_token: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.configActions}>
                    <button type="button" className={styles.linkBtn} onClick={clearJira}>
                      <Trash2 size={13} /> Clear credentials
                    </button>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => {
                        update({ jira_enabled: false });
                        setExpanded(null);
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                </IntegrationConfigSection>
              </div>
            )}

            <ComingSoonRow
              icon={<GitHubIcon />}
              title="GitHub"
              description="Link issues and pull requests to notes."
            />
            <ComingSoonRow
              icon={<LinearIcon />}
              title="Linear"
              description="Sync issues and projects from Linear."
            />
            <ComingSoonRow
              icon={<NotionIcon />}
              title="Notion"
              description="Import pages and sync notes with Notion workspaces."
            />
            <ComingSoonRow
              icon={<TrelloIcon />}
              title="Trello"
              description="Link cards and boards to your notes."
            />
            <ComingSoonRow
              icon={<HacknPlanIcon />}
              title="HacknPlan"
              description="Sync game dev tasks and milestones from HacknPlan."
            />
            <ComingSoonRow
              icon={<GoogleSheetsIcon />}
              title="Google Sheets"
              description="Export notes and task lists to spreadsheets."
            />
          </div>
        </section>

        {saveError && <p className={styles.statusErr}>{saveError}</p>}

        <div className={styles.footer}>
          <button type="button" className={styles.saveBtn} onClick={save} disabled={saving}>
            {saving ? <Loader2 size={16} className={styles.spinner} /> : null}
            Save settings
          </button>
          {saved && (
            <span className={styles.savedHint}>
              <Check size={14} /> Saved
            </span>
          )}
        </div>

        <div className={styles.shortcuts}>
          <p className={styles.shortcutsTitle}>Keyboard shortcuts</p>
          <div className={styles.shortcutGrid}>
            <span className={styles.shortcutItem}>
              <kbd>⌘K</kbd> Search notes
            </span>
            <span className={styles.shortcutItem}>
              <kbd>⌘F</kbd> Find in note
            </span>
            <span className={styles.shortcutItem}>
              <kbd>⌘N</kbd> Quick capture
            </span>
            <span className={styles.shortcutItem}>
              <kbd>G</kbd> <kbd>N</kbd> Notes
            </span>
            <span className={styles.shortcutItem}>
              <kbd>G</kbd> <kbd>S</kbd> Settings
            </span>
            <span className={styles.shortcutItem}>
              <kbd>/</kbd> Slash commands
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
