export function htmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

export function htmlToMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  const lines: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) lines.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case "h1":
        lines.push(`# ${el.textContent?.trim() ?? ""}`);
        break;
      case "h2":
        lines.push(`## ${el.textContent?.trim() ?? ""}`);
        break;
      case "h3":
        lines.push(`### ${el.textContent?.trim() ?? ""}`);
        break;
      case "li": {
        const parent = el.parentElement?.tagName.toLowerCase();
        const prefix = parent === "ol" ? "1. " : "- ";
        lines.push(`${prefix}${el.textContent?.trim() ?? ""}`);
        break;
      }
      case "p":
        lines.push(el.textContent?.trim() ?? "");
        break;
      case "br":
        lines.push("");
        break;
      default:
        el.childNodes.forEach(walk);
    }
  };

  div.childNodes.forEach(walk);
  return lines.filter((l, i, arr) => l !== "" || arr[i - 1] !== "").join("\n");
}

export function getNoteStats(title: string, content: string) {
  const text = htmlToPlainText(content);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return {
    words,
    characters: text.length,
    title: title || "Untitled",
  };
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function printNote(title: string, contentHtml: string) {
  const win = window.open("", "_blank", "width=720,height=900");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;padding:40px;max-width:720px;margin:0 auto;line-height:1.6}</style>
    </head><body><h1>${title}</h1>${contentHtml}</body></html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
