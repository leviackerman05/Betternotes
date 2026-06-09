import * as chrono from "chrono-node";

export interface ParsedTask {
  title: string;
  dueDate?: string;
  priority: 1 | 2 | 3 | 4;
}

const PRIORITY_PATTERNS = [
  { pattern: /\bp1\b/i, priority: 1 as const },
  { pattern: /\bp2\b/i, priority: 2 as const },
  { pattern: /\bp3\b/i, priority: 3 as const },
  { pattern: /\bp4\b/i, priority: 4 as const },
  { pattern: /priority\s*1/i, priority: 1 as const },
  { pattern: /priority\s*2/i, priority: 2 as const },
  { pattern: /priority\s*3/i, priority: 3 as const },
  { pattern: /priority\s*4/i, priority: 4 as const },
];

export function parseQuickAdd(input: string): ParsedTask {
  let text = input.trim();
  let priority: 1 | 2 | 3 | 4 = 4;
  let dueDate: string | undefined;

  for (const { pattern, priority: p } of PRIORITY_PATTERNS) {
    if (pattern.test(text)) {
      priority = p;
      text = text.replace(pattern, "").trim();
      break;
    }
  }

  const parsed = chrono.parse(text);
  if (parsed.length > 0) {
    const date = parsed[0].start.date();
    dueDate = date.toISOString().split("T")[0];
    text = text.replace(parsed[0].text, "").trim();
  }

  return {
    title: text || input.trim(),
    dueDate,
    priority,
  };
}

export function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return due < today;
}

export function isToday(dueDate?: string): boolean {
  if (!dueDate) return false;
  const today = new Date().toISOString().split("T")[0];
  return dueDate === today;
}

export function isUpcoming(dueDate?: string): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return due > today;
}
