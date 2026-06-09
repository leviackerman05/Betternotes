import { Extension } from "@tiptap/core";

/** Block Tab/Shift-Tab from indenting lists into nested lists */
export const NoNestedLists = Extension.create({
  name: "noNestedLists",

  addKeyboardShortcuts() {
    return {
      Tab: () => true,
      "Shift-Tab": () => true,
      "Mod-]": () => true,
      "Mod-[": () => true,
    };
  },
});
