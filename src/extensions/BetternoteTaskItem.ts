import TaskItem from "@tiptap/extension-task-item";

/** Task items with Shift+Enter for a line break inside the same to-do. */
export const BetternoteTaskItem = TaskItem.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      "Shift-Enter": () => this.editor.commands.setHardBreak(),
    };
  },
});
