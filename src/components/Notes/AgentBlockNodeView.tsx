import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { AgentMessage } from "../../types";
import { jiraTicketsToEditorContent, type JiraTicketLink } from "../../lib/jiraAgent";
import { AgentBlock } from "./AgentBlock";

export function AgentBlockNodeView({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}: NodeViewProps) {
  const messages: AgentMessage[] = JSON.parse(node.attrs.messages || "[]");
  const status = (node.attrs.status || "idle") as
    | "idle"
    | "running"
    | "done"
    | "error";
  const error = node.attrs.error as string | undefined;

  const persist = (updates: {
    messages?: AgentMessage[];
    status?: typeof status;
    error?: string | null;
  }) => {
    updateAttributes({
      ...(updates.messages !== undefined
        ? { messages: JSON.stringify(updates.messages) }
        : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.error !== undefined
        ? { error: updates.error ?? "" }
        : {}),
    });
  };

  const insertTickets = (tickets: JiraTicketLink[]) => {
    if (!editor || tickets.length === 0) return;
    const pos = getPos();
    if (typeof pos !== "number") return;

    const content = jiraTicketsToEditorContent(tickets);
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, content)
      .run();
  };

  return (
    <NodeViewWrapper as="div" data-type="agent-block">
      <AgentBlock
        messages={messages}
        status={status}
        error={error}
        onUpdate={persist}
        onRemove={() => deleteNode()}
        onInsertTickets={insertTickets}
      />
    </NodeViewWrapper>
  );
}
