import { InputRule, Node, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { JiraChipNodeView } from "../components/Notes/JiraChipNodeView";
import { extractJiraKey, keyFromJiraUrl } from "../lib/jiraKeys";

export const JiraChipExtension = Node.create({
  name: "jiraChip",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      key: { default: null },
      summary: { default: null },
      status: { default: null },
      statusCategory: { default: null },
      assignee: { default: null },
      url: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="jira-chip"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "jira-chip",
        "data-jira-key": HTMLAttributes.key,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(JiraChipNodeView);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /(?:https?:\/\/[^\s]*atlassian\.net\/browse\/([A-Z][A-Z0-9]+-\d+)|([A-Z][A-Z0-9]+-\d+))\s$/,
        handler: ({ range, match, chain }) => {
          const key = (match[1] || match[2] || "").toUpperCase();
          if (!key) return;
          chain()
            .deleteRange(range)
            .insertContent({ type: this.name, attrs: { key } })
            .run();
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const nodeType = this.name;
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text) return false;
            const key = keyFromJiraUrl(text) ?? extractJiraKey(text);
            if (!key) return false;
            const { schema } = view.state;
            const chip = schema.nodes[nodeType]?.create({ key });
            if (!chip) return false;
            const tr = view.state.tr.replaceSelectionWith(chip, false);
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});

/** Paste handler helper: detect URL or key from pasted text */
export function pasteToJiraKey(text: string): string | null {
  return keyFromJiraUrl(text) ?? extractJiraKey(text);
}
