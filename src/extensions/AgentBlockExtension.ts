import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AgentBlockNodeView } from "../components/Notes/AgentBlockNodeView";

export const AgentBlockExtension = Node.create({
  name: "agentBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      messages: {
        default: "[]",
        parseHTML: (el) => el.getAttribute("data-messages") ?? "[]",
        renderHTML: (attrs) => ({ "data-messages": attrs.messages }),
      },
      status: {
        default: "idle",
        parseHTML: (el) => el.getAttribute("data-status") ?? "idle",
        renderHTML: (attrs) => ({ "data-status": attrs.status }),
      },
      error: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-error"),
        renderHTML: (attrs) =>
          attrs.error ? { "data-error": attrs.error } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="agent-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "agent-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AgentBlockNodeView);
  },
});
