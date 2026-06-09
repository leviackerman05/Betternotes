import { InputRule, Mark, mergeAttributes } from "@tiptap/core";

export const WikiLinkExtension = Mark.create({
  name: "wikiLink",
  inclusive: false,
  attrs: {
    title: { default: null },
    noteId: { default: null },
  },
  parseHTML() {
    return [{ tag: "span[data-wiki-link]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-wiki-link": "",
        "data-wiki-title": HTMLAttributes.title,
        class: "wiki-link",
      }),
      0,
    ];
  },
  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ range, match, chain }) => {
          const title = match[1].trim();
          if (!title) return;
          chain()
            .deleteRange(range)
            .insertContent({
              type: "text",
              marks: [{ type: this.name, attrs: { title } }],
              text: title,
            })
            .run();
        },
      }),
    ];
  },
});
