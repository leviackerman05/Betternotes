import type { AgentMessage } from "../types";
import { getIntegrationGuide, type IntegrationId } from "./integrationGuides";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ");
}

function scoreMatch(query: string, target: string): number {
  const q = normalize(query);
  const t = normalize(target);
  if (t.includes(q) || q.includes(t)) return 10;
  const qWords = q.split(/\s+/).filter((w) => w.length > 3);
  return qWords.filter((w) => t.includes(w)).length;
}

export function localSetupReply(
  integrationId: IntegrationId,
  prompt: string,
  history: AgentMessage[]
): string {
  const guide = getIntegrationGuide(integrationId);
  const q = normalize(prompt);

  if (guide.comingSoon) {
    return `${guide.title} is coming soon. ${guide.summary} When it launches, return to Settings → Integrations → ${guide.title} and follow the steps here. For now, use Ollama and Jira if you need integrations today.`;
  }

  if (q.includes("local only") || q.includes("privacy") || q.includes("blocked")) {
    return "Turn off Local Only Mode under Settings → Privacy. Integrations need network access (Jira API, MCP servers). Ollama still runs locally. Save settings after changing.";
  }

  let bestFaq = guide.troubleshooting[0];
  let bestScore = 0;
  for (const item of guide.troubleshooting) {
    const s = Math.max(scoreMatch(prompt, item.question), scoreMatch(prompt, item.answer));
    if (s > bestScore) {
      bestScore = s;
      bestFaq = item;
    }
  }
  if (bestScore >= 2 && bestFaq) {
    return bestFaq.answer;
  }

  if (
    integrationId === "jira" &&
    (q.includes("site url") || q.includes("atlassian") || q.includes("where do i add"))
  ) {
    return "Paste your site URL in Settings → Integrations → Jira → Manage → Site URL (e.g. https://levi05.atlassian.net, no trailing slash). Same screen has Email and API Token. Click Save settings at the bottom. For /agent with Jira MCP, also enable MCP Server. Betternote passes credentials to the MCP server automatically.";
  }

  if (
    integrationId === "jira" &&
    (q.includes("api token") || q.includes("token") || q.includes("password"))
  ) {
    return "Create a Jira API token at id.atlassian.com → Security → API tokens. In Betternote Settings → Jira, paste it in API Token (not your login password). Use the same email you use for Atlassian. Site URL looks like https://yourcompany.atlassian.net.";
  }

  if (integrationId === "mcp" && (q.includes("command") || q.includes("args") || q.includes("npx"))) {
    return "For most MCP servers: Command = npx. Args = comma-separated, e.g. -y, mcp-server-jira-cloud. The second value is the npm package from that server's docs. Save settings, enable Ollama, then test with /agent in a note.";
  }

  if (integrationId === "mcp" && q.includes("what is") && q.includes("mcp")) {
    return "MCP is a standard protocol so AI can call external tools. You install an MCP server (a small program). Betternote starts it when you use /agent. It is not Jira itself. For Jira you also save credentials under Settings → Jira.";
  }

  if (
    integrationId === "ollama" &&
    (q.includes("install") || q.includes("download") || q.includes("detect"))
  ) {
    return "Install from ollama.com, open the app, then run ollama pull qwen2.5:7b in Terminal. In Settings → Ollama, endpoint should be http://localhost:11434. Click Save settings.";
  }

  const userTurns = history.filter((m) => m.role === "user").length;
  const stepIndex = Math.min(userTurns, guide.steps.length - 1);
  const step = guide.steps[stepIndex];
  if (step) {
    const prefix =
      userTurns === 0
        ? `Here is how to connect ${guide.title}:`
        : `Next step for ${guide.title}:`;
    return `${prefix}\n\n**${step.title}**\n${step.body}\n\nAsk about a specific step if you are stuck (e.g. API token, MCP args, or Ollama not detected).`;
  }

  return `${guide.summary}\n\nOpen the numbered steps above, or ask a specific question like one of the suggested prompts below.`;
}
