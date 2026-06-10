import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findMatchesInNote } from "../lib/findInNote";

export interface FindInNoteMeta {
  searchTerm: string;
  activeIndex: number;
  title: string;
}

export const findInNotePluginKey = new PluginKey<DecorationSet>("findInNote");

function buildDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  meta: FindInNoteMeta
): DecorationSet {
  if (!meta.searchTerm.trim()) return DecorationSet.empty;

  const allMatches = findMatchesInNote(meta.title, doc, meta.searchTerm);
  const activeMatch = allMatches[meta.activeIndex];
  const decorations: Decoration[] = [];

  for (const match of allMatches) {
    if (match.source !== "body") continue;
    const isActive =
      activeMatch?.source === "body" &&
      activeMatch.from === match.from &&
      activeMatch.to === match.to;

    decorations.push(
      Decoration.inline(match.from, match.to, {
        class: isActive ? "find-match find-match-active" : "find-match",
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    findInNote: {
      setFindInNote: (searchTerm: string, activeIndex: number, title: string) => ReturnType;
      clearFindInNote: () => ReturnType;
    };
  }
}

export const FindInNoteExtension = Extension.create({
  name: "findInNote",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: findInNotePluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, old, _oldState, newState) {
            const meta = tr.getMeta(findInNotePluginKey) as FindInNoteMeta | null | undefined;
            if (meta === null) return DecorationSet.empty;
            if (meta) {
              return buildDecorations(newState.doc, meta);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return findInNotePluginKey.getState(state);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setFindInNote:
        (searchTerm: string, activeIndex: number, title: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(findInNotePluginKey, { searchTerm, activeIndex, title });
            dispatch(tr);
          }
          return true;
        },
      clearFindInNote:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(findInNotePluginKey, null);
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
