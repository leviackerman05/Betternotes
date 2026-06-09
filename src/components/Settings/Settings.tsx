import { useEffect, useState } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { useAppStore } from "../../store/appStore";
import type { JiraCredentials, McpServerConfig } from "../../types";
import styles from "./Settings.module.css";

export function Settings() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const [jira, setJira] = useState<JiraCredentials>({
    site_url: "",
    email: "",
    api_token: "",
  });
  const [mcpConfig, setMcpConfig] = useState<McpServerConfig>({
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-jira"],
    env: {},
  });
  const [ollamaStatus, setOllamaStatus] = useState<{
    available: boolean;
    models: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getJiraCredentials().then((creds) => {
      if (creds) setJira(creds);
    });
    api.getMcpConfig().then(setMcpConfig).catch(() => {});
    api.checkOllama().then(setOllamaStatus).catch(() =>
      setOllamaStatus({ available: false, models: [] })
    );
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveSettings(settings);
      if (jira.site_url && jira.email && jira.api_token) {
        await api.saveJiraCredentials(jira);
      }
      await api.saveMcpConfig(mcpConfig);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const clearJira = async () => {
    await api.deleteJiraCredentials();
    setJira({ site_url: "", email: "", api_token: "" });
  };

  return (
    <div className={styles.container}>
      <h1 className="headline-md">Settings</h1>

      <section className={styles.section}>
        <h2 className="label-md">Appearance</h2>
        <div className={styles.row}>
          <label>Theme</label>
          <select
            className="input"
            style={{ width: "auto" }}
            value={settings.theme}
            onChange={(e) =>
              setSettings({
                ...settings,
                theme: e.target.value as "light" | "dark",
              })
            }
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="label-md">Ollama (Local LLM)</h2>
        <p className={styles.hint}>
          Install Ollama and pull a tool-calling model:{" "}
          <code>ollama pull qwen2.5:7b</code>
        </p>
        {ollamaStatus && (
          <div className={styles.status}>
            {ollamaStatus.available ? (
              <span className={styles.statusOk}>
                <Check size={14} /> Connected — {ollamaStatus.models.length} models
              </span>
            ) : (
              <span className={styles.statusErr}>Ollama not detected at localhost:11434</span>
            )}
          </div>
        )}
        <div className={styles.field}>
          <label>Endpoint</label>
          <input
            className="input"
            value={settings.ollama_endpoint}
            onChange={(e) =>
              setSettings({ ...settings, ollama_endpoint: e.target.value })
            }
          />
        </div>
        <div className={styles.field}>
          <label>Model</label>
          <input
            className="input"
            value={settings.ollama_model}
            onChange={(e) =>
              setSettings({ ...settings, ollama_model: e.target.value })
            }
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="label-md">Jira Connection</h2>
        <p className={styles.hint}>
          Credentials are stored in your OS keychain. Used by the /jira agent via MCP.
        </p>
        <div className={styles.field}>
          <label>Site URL</label>
          <input
            className="input"
            placeholder="https://yourcompany.atlassian.net"
            value={jira.site_url}
            onChange={(e) => setJira({ ...jira, site_url: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={jira.email}
            onChange={(e) => setJira({ ...jira, email: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label>API Token</label>
          <input
            className="input"
            type="password"
            value={jira.api_token}
            onChange={(e) => setJira({ ...jira, api_token: e.target.value })}
          />
        </div>
        <button className="btn-secondary" onClick={clearJira}>
          <Trash2 size={14} /> Clear credentials
        </button>
      </section>

      <section className={styles.section}>
        <h2 className="label-md">MCP Server Config</h2>
        <p className={styles.hint}>
          Command used to start the Jira MCP server (like Cursor's mcp.json).
        </p>
        <div className={styles.field}>
          <label>Command</label>
          <input
            className="input"
            value={mcpConfig.command}
            onChange={(e) =>
              setMcpConfig({ ...mcpConfig, command: e.target.value })
            }
          />
        </div>
        <div className={styles.field}>
          <label>Args (comma-separated)</label>
          <input
            className="input"
            value={mcpConfig.args.join(", ")}
            onChange={(e) =>
              setMcpConfig({
                ...mcpConfig,
                args: e.target.value.split(",").map((s) => s.trim()),
              })
            }
          />
        </div>
      </section>

      <button className="btn-primary" onClick={save} disabled={saving}>
        {saving ? <Loader2 size={16} className={styles.spinner} /> : saved ? <Check size={16} /> : null}
        {saved ? "Saved" : "Save settings"}
      </button>
    </div>
  );
}
