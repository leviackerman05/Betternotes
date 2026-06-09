import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Loader2, Send, X } from "lucide-react";
import { api } from "../../lib/api";
import { isAgentEnabled } from "../../lib/integrations";
import { extractJiraTickets, type JiraTicketLink } from "../../lib/jiraAgent";
import { useAppStore } from "../../store/appStore";
import type { AgentMessage } from "../../types";
import styles from "./AgentBlock.module.css";

interface AgentBlockProps {
  messages: AgentMessage[];
  status: "idle" | "running" | "done" | "error";
  error?: string;
  onUpdate: (updates: {
    messages?: AgentMessage[];
    status?: "idle" | "running" | "done" | "error";
    error?: string | null;
  }) => void;
  onRemove: () => void;
  onInsertTickets: (tickets: JiraTicketLink[]) => void;
}

export function AgentBlock({
  messages,
  status,
  error,
  onUpdate,
  onRemove,
  onInsertTickets,
}: AgentBlockProps) {
  const settings = useAppStore((s) => s.settings);
  const agentReady = isAgentEnabled(settings);
  const [prompt, setPrompt] = useState("");
  const [jiraSiteUrl, setJiraSiteUrl] = useState("");
  const insertedKeysRef = useRef(new Set<string>());
  const runIdRef = useRef(0);

  const AGENT_TIMEOUT_MS = 130_000;

  useEffect(() => {
    api.getJiraCredentials().then((creds) => {
      if (creds?.site_url) setJiraSiteUrl(creds.site_url);
    });
  }, []);

  const cancelRun = () => {
    runIdRef.current += 1;
    onUpdate({ status: "idle", error: "Cancelled." });
  };

  const run = async () => {
    const text = prompt.trim();
    if (!text || status === "running") return;

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    const userMsg: AgentMessage = { role: "user", content: text };
    const history = [...messages, userMsg];
    setPrompt("");
    onUpdate({ status: "running", messages: history, error: null });

    try {
      const result = await Promise.race([
        api.runAgent(text, messages),
        new Promise<AgentMessage[]>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("Timed out. Try a shorter question.")),
            AGENT_TIMEOUT_MS
          );
        }),
      ]);

      if (runIdRef.current !== runId) return;

      if (result.length === 0) {
        onUpdate({
          status: "idle",
          error:
            "Agent returned no response. Try a smaller model with tool support (e.g. qwen2.5:7b) or check Ollama is running.",
        });
        return;
      }
      const allMessages = [...history, ...result];
      onUpdate({
        messages: allMessages,
        status: "idle",
        error: null,
      });

      const tickets = extractJiraTickets(allMessages, jiraSiteUrl);
      const newTickets = tickets.filter((t) => !insertedKeysRef.current.has(t.key));
      if (newTickets.length > 0) {
        onInsertTickets(newTickets);
        newTickets.forEach((t) => insertedKeysRef.current.add(t.key));
      }
    } catch (e) {
      if (runIdRef.current !== runId) return;
      onUpdate({ status: "idle", error: String(e) });
    }
  };

  const stopEditorCapture = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={styles.block}
      contentEditable={false}
      onMouseDown={stopEditorCapture}
      onClick={stopEditorCapture}
    >
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.badge}>/agent</span>
          <span className="label-sm">MCP Agent</span>
        </div>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={onRemove}
          title="Remove agent"
          aria-label="Remove agent"
        >
          <X size={14} />
        </button>
      </div>

      <div className={styles.messages}>
        {!agentReady && status !== "running" && !error && messages.length === 0 && (
          <p className={styles.hint}>
            Enable <strong>Local AI (Ollama)</strong> in Settings and save to run this agent.
          </p>
        )}
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <p key={i} className={styles.userQuery}>
                {msg.content}
              </p>
            );
          }
          if (msg.role === "assistant") {
            const text = msg.content.trim();
            return (
              <div key={i} className={styles.assistant}>
                {text || "No text response from the model."}
              </div>
            );
          }
          if (msg.role === "tool") {
            return (
              <pre key={i} className={styles.toolResult}>
                {msg.content}
              </pre>
            );
          }
          return null;
        })}
        {status === "running" && (
          <div className={styles.loading}>
            <Loader2 size={16} className={styles.spinner} /> Running…
            <button type="button" className={styles.cancelBtn} onClick={cancelRun}>
              Cancel
            </button>
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
        {status === "idle" &&
          messages.length > 0 &&
          !messages.some((m) => m.role === "assistant") && (
            <p className={styles.hint}>Finished without a summary. Check tool output above.</p>
          )}
      </div>

      <div className={styles.inputRow} onMouseDown={stopEditorCapture}>
        <input
          className={styles.input}
          placeholder="Ask the agent…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onMouseDown={stopEditorCapture}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              void run();
            }
          }}
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={(e) => {
            e.stopPropagation();
            void run();
          }}
          disabled={status === "running" || !agentReady || !prompt.trim()}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
