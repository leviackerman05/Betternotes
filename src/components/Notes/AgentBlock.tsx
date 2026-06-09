import { useState } from "react";
import { Loader2, Plus, Send } from "lucide-react";
import { api } from "../../lib/api";
import type { AgentMessage } from "../../types";
import styles from "./AgentBlock.module.css";

interface AgentBlockProps {
  initialPrompt?: string;
  onAddTask?: (title: string, jiraKey?: string, jiraUrl?: string) => void;
}

export function AgentBlock({ initialPrompt = "", onAddTask }: AgentBlockProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string>();

  const run = async () => {
    if (!prompt.trim() || status === "running") return;
    setStatus("running");
    setError(undefined);
    const userMsg: AgentMessage = { role: "user", content: prompt };
    const history = [...messages, userMsg];
    setMessages(history);
    setPrompt("");

    try {
      const result = await api.runAgent(prompt, messages);
      setMessages([...history, ...result]);
      setStatus("done");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  };

  const extractJiraKey = (text: string): string | undefined => {
    const match = text.match(/\b([A-Z]+-\d+)\b/);
    return match?.[1];
  };

  return (
    <div className={styles.block} contentEditable={false}>
      <div className={styles.header}>
        <span className={styles.badge}>/jira</span>
        <span className="label-sm">Jira Agent</span>
      </div>

      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={styles.message} data-role={msg.role}>
            <span className={styles.role}>{msg.role}</span>
            <pre className={styles.content}>{msg.content}</pre>
            {msg.role === "assistant" && onAddTask && (
              <button
                className={styles.addTaskBtn}
                onClick={async () => {
                  const key = extractJiraKey(msg.content);
                  const firstLine = msg.content.split("\n")[0].slice(0, 120);
                  let jiraUrl: string | undefined;
                  if (key) {
                    const creds = await api.getJiraCredentials();
                    if (creds?.site_url) {
                      jiraUrl = `${creds.site_url.replace(/\/$/, "")}/browse/${key}`;
                    }
                  }
                  onAddTask(firstLine, key, jiraUrl);
                }}
              >
                <Plus size={12} /> Add as task
              </button>
            )}
          </div>
        ))}
        {status === "running" && (
          <div className={styles.loading}>
            <Loader2 size={16} className={styles.spinner} /> Running…
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          placeholder="Ask about your Jira tickets…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
        />
        <button className={styles.sendBtn} onClick={run} disabled={status === "running"}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
