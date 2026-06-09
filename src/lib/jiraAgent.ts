import type { JSONContent } from "@tiptap/core";
import type { AgentMessage } from "../types";

export interface JiraTicketLink {
  key: string;
  url: string;
}

const ISSUE_KEY_RE = /\b[A-Z][A-Z0-9]+-\d+\b/;

function browseUrl(self: string, key: string): string {
  try {
    const origin = new URL(self).origin;
    return `${origin}/browse/${key}`;
  } catch {
    return "";
  }
}

function addIssue(
  issue: unknown,
  links: JiraTicketLink[],
  seen: Set<string>
) {
  if (!issue || typeof issue !== "object") return;
  const obj = issue as Record<string, unknown>;
  const key = typeof obj.key === "string" ? obj.key : null;
  if (!key || !ISSUE_KEY_RE.test(key) || seen.has(key)) return;

  const self = typeof obj.self === "string" ? obj.self : "";
  const url = self ? browseUrl(self, key) : "";
  seen.add(key);
  links.push({ key, url });
}

function parseToolPayload(content: string): unknown | null {
  const start = content.indexOf("{");
  if (start === -1) return null;
  try {
    return JSON.parse(content.slice(start));
  } catch {
    return null;
  }
}

function collectFromPayload(data: unknown, links: JiraTicketLink[], seen: Set<string>) {
  if (!data || typeof data !== "object") return;
  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.issues)) {
    for (const issue of obj.issues) addIssue(issue, links, seen);
  }
  if (obj.issue) addIssue(obj.issue, links, seen);
  addIssue(data, links, seen);
}

export function extractJiraTickets(
  messages: AgentMessage[],
  siteUrl?: string
): JiraTicketLink[] {
  const links: JiraTicketLink[] = [];
  const seen = new Set<string>();
  const base = siteUrl?.trim().replace(/\/+$/, "") ?? "";

  for (const msg of messages) {
    if (msg.role !== "tool") continue;
    const data = parseToolPayload(msg.content);
    if (data) collectFromPayload(data, links, seen);
  }

  for (const link of links) {
    if (!link.url && base) {
      link.url = `${base}/browse/${link.key}`;
    }
  }

  return links.filter((l) => l.url);
}

export function jiraTicketsToEditorContent(tickets: JiraTicketLink[]): JSONContent[] {
  return tickets.map((ticket) => ({
    type: "paragraph",
    content: [
      {
        type: "text",
        marks: [
          {
            type: "link",
            attrs: {
              href: ticket.url,
              target: "_blank",
              rel: "noopener noreferrer",
            },
          },
        ],
        text: ticket.key,
      },
    ],
  }));
}
