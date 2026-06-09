import { htmlToPlainText } from "./noteExport";

export type NotePreviewType = "text" | "checklist" | "image" | "audio" | "document";

export interface NotePreview {
  type: NotePreviewType;
  lines: string[];
  hasMedia: boolean;
}

export function getNotePreview(content: string): NotePreview {
  const plain = htmlToPlainText(content);
  const lines = plain
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);

  const hasChecklist =
    content.includes('data-type="taskList"') ||
    content.includes('type="checkbox"') ||
    content.includes("task-item");

  const hasImage = /<img\s/i.test(content);
  const hasAudio = /audio|waveform|microphone/i.test(content);
  const hasDoc = /pdf|document|\.pdf/i.test(content) || content.includes("data-type=\"agentBlock\"");

  let type: NotePreviewType = "text";
  if (hasChecklist && lines.length > 0) type = "checklist";
  else if (hasImage) type = "image";
  else if (hasAudio) type = "audio";
  else if (hasDoc) type = "document";

  return {
    type,
    lines: lines.length > 0 ? lines : ["No content yet"],
    hasMedia: hasImage || hasAudio || hasDoc,
  };
}
