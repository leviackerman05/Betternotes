import type { Note } from "../types";

export function extractWikiLinks(content: string): string[] {
  const titles = new Set<string>();

  const attrRe = /data-wiki-title="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(content)) !== null) {
    titles.add(m[1].trim());
  }

  const bracketRe = /\[\[([^\]]+)\]\]/g;
  while ((m = bracketRe.exec(content)) !== null) {
    titles.add(m[1].trim());
  }

  return [...titles];
}

export function findNoteByTitle(notes: Note[], title: string): Note | undefined {
  const lower = title.toLowerCase();
  return notes.find((n) => (n.title || "Untitled").toLowerCase() === lower);
}

export function getBacklinks(notes: Note[], currentId: string, currentTitle: string): Note[] {
  const title = currentTitle || "Untitled";
  return notes.filter((n) => {
    if (n.id === currentId || n.locked) return false;
    return extractWikiLinks(n.content).some(
      (t) => t.toLowerCase() === title.toLowerCase()
    );
  });
}

export interface GraphNode {
  id: string;
  title: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export function buildNoteGraph(notes: Note[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const visible = notes.filter((n) => !n.locked);
  const titleToId = new Map(
    visible.map((n) => [(n.title || "Untitled").toLowerCase(), n.id])
  );
  const nodes = visible.map((n) => ({
    id: n.id,
    title: n.title || "Untitled",
  }));
  const links: GraphLink[] = [];

  for (const note of visible) {
    for (const targetTitle of extractWikiLinks(note.content)) {
      const targetId = titleToId.get(targetTitle.toLowerCase());
      if (targetId && targetId !== note.id) {
        links.push({ source: note.id, target: targetId });
      }
    }
  }

  return { nodes, links };
}

export function wikiLinkHtml(title: string): string {
  const safe = title.replace(/"/g, "&quot;");
  return `<span data-wiki-link="" data-wiki-title="${safe}" class="wiki-link">${title}</span>`;
}
