import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface FindMatch {
  from: number;
  to: number;
  source: "title" | "body";
}

export function findMatchesInNote(
  title: string,
  doc: ProseMirrorNode,
  searchTerm: string
): FindMatch[] {
  const term = searchTerm.trim();
  if (!term) return [];

  const lower = term.toLowerCase();
  const matches: FindMatch[] = [];

  const titleLower = title.toLowerCase();
  let titleIdx = 0;
  while ((titleIdx = titleLower.indexOf(lower, titleIdx)) !== -1) {
    matches.push({
      from: titleIdx,
      to: titleIdx + term.length,
      source: "title",
    });
    titleIdx += term.length || 1;
  }

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const textLower = node.text.toLowerCase();
    let idx = 0;
    while ((idx = textLower.indexOf(lower, idx)) !== -1) {
      matches.push({
        from: pos + idx,
        to: pos + idx + term.length,
        source: "body",
      });
      idx += term.length || 1;
    }
  });

  return matches;
}
