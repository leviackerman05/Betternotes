import ListItem from "@tiptap/extension-list-item";

/** Bullet/numbered list items: paragraph only, no nested lists */
export const FlatListItem = ListItem.extend({
  content: "paragraph",
});
