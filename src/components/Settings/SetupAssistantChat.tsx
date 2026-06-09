import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import clsx from "clsx";
import { api } from "../../lib/api";
import { getIntegrationGuide, type IntegrationId } from "../../lib/integrationGuides";
import { localSetupReply } from "../../lib/setupAssistantLocal";
import type { AgentMessage } from "../../types";
import styles from "./SetupAssistantChat.module.css";

interface SetupAssistantChatProps {
  integrationId: IntegrationId;
  locked: boolean;
  compact?: boolean;
}

export function SetupAssistantChat({
  integrationId,
  locked,
  compact = false,
}: SetupAssistantChatProps) {
  const guide = getIntegrationGuide(integrationId);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "running">("idle");
  const [mode, setMode] = useState<"ollama" | "local">("local");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 96)}px`;
    }
  }, [prompt]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || status === "running") return;

    const userMsg: AgentMessage = { role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setPrompt("");
    setStatus("running");
    scrollToBottom();

    try {
      let reply: string;
      try {
        reply = await api.runSetupAssistant(
          guide.title,
          guide.assistantContext,
          trimmed,
          messages
        );
        setMode("ollama");
      } catch (e) {
        const err = String(e);
        if (err.includes("OLLAMA_UNAVAILABLE") || err.includes("Ollama")) {
          setMode("local");
          reply = localSetupReply(integrationId, trimmed, messages);
        } else {
          throw e;
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Something went wrong: ${String(e)}. Try a suggested prompt below.`,
        },
      ]);
    } finally {
      setStatus("idle");
      scrollToBottom();
      inputRef.current?.focus();
    }
  };

  return (
    <div className={clsx(styles.wrap, compact && styles.wrapCompact)}>
      <div className={clsx(styles.messages, compact && styles.messagesCompact)} ref={listRef}>
        {messages.length === 0 && !compact ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <MessageCircle size={18} />
            </div>
            <p className={styles.emptyTitle}>Ask anything about setup</p>
            <p className={styles.emptyHint}>
              Site URL, API tokens, MCP config. I&apos;ll point you to the right field.
            </p>
            <div className={styles.starters}>
              {guide.starterQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={styles.starterBtn}
                  onClick={() => void send(q)}
                  disabled={status === "running"}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : messages.length > 0 ? (
          <>
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={clsx(
                  styles.message,
                  msg.role === "user" ? styles.messageUser : styles.messageAssistant
                )}
              >
                {msg.role === "assistant" && <span className={styles.messageLabel}>Guide</span>}
                <div className={styles.bubble}>{msg.content}</div>
              </div>
            ))}
            {status === "running" && (
              <div className={clsx(styles.message, styles.messageAssistant)}>
                <span className={styles.messageLabel}>Guide</span>
                <div className={clsx(styles.bubble, styles.bubbleThinking)}>
                  <Loader2 size={13} className={styles.spinner} />
                  <span>Thinking</span>
                  <span className={styles.dots} aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className={clsx(styles.footer, compact && styles.footerCompact)}>
        {!compact && (
          <span className={clsx(styles.modePill, mode === "ollama" && styles.modePillAi)}>
            {mode === "ollama" ? "Ollama" : "Built-in"}
          </span>
        )}
        {compact && messages.length === 0 && (
          <div className={styles.startersCompact}>
            {guide.starterQuestions.map((q) => (
              <button
                key={q}
                type="button"
                className={styles.starterChip}
                onClick={() => void send(q)}
                disabled={status === "running"}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className={styles.composer}>
          <textarea
            ref={inputRef}
            className={styles.input}
            rows={1}
            placeholder={compact ? "Type your question…" : `Message about ${guide.title}…`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(prompt);
              }
            }}
            disabled={status === "running"}
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={() => void send(prompt)}
            disabled={status === "running" || !prompt.trim()}
            aria-label="Send"
          >
            <Send size={15} />
          </button>
        </div>
        {locked && (
          <p className={styles.lockedHint}>Local Only Mode blocks connections.</p>
        )}
      </div>
    </div>
  );
}
