export type IntegrationId =
  | "ollama"
  | "openai"
  | "anthropic"
  | "mcp"
  | "jira"
  | "github"
  | "linear"
  | "notion"
  | "trello"
  | "hacknplan"
  | "google-sheets";

export interface GuideStep {
  title: string;
  body: string;
}

export interface GuideTroubleshooting {
  question: string;
  answer: string;
}

export interface IntegrationGuide {
  id: IntegrationId;
  title: string;
  summary: string;
  comingSoon?: boolean;
  prerequisites: string[];
  steps: GuideStep[];
  troubleshooting: GuideTroubleshooting[];
  links?: { label: string; url: string }[];
  starterQuestions: string[];
  /** Full context passed to the setup assistant (Ollama system prompt). */
  assistantContext: string;
}

function buildContext(guide: Omit<IntegrationGuide, "assistantContext">): string {
  const steps = guide.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.body}`).join("\n");
  const faq = guide.troubleshooting
    .map((t) => `Q: ${t.question}\nA: ${t.answer}`)
    .join("\n\n");
  return [
    guide.summary,
    guide.comingSoon ? "Status: Coming soon (not yet available in Betternote)." : "",
    "Prerequisites:",
    ...guide.prerequisites.map((p) => `- ${p}`),
    "Steps:",
    steps,
    "Troubleshooting:",
    faq,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const guides: Record<IntegrationId, IntegrationGuide> = {
  ollama: {
    id: "ollama",
    title: "Ollama (Local AI)",
    summary:
      "Ollama runs AI models on your Mac. Betternote uses it for note actions (summarize, rewrite) and for the /agent block when MCP is enabled.",
    prerequisites: [
      "Turn off Local Only Mode in Settings if you plan to use integrations that need network (Jira still uses network; Ollama itself is local).",
      "macOS with enough disk space for a model (about 4-8 GB for qwen2.5:7b).",
    ],
    steps: [
      {
        title: "Install Ollama",
        body: "Download from ollama.com and install. Open the Ollama app or run ollama serve in Terminal so it stays running.",
      },
      {
        title: "Pull a model",
        body: "In Terminal run: ollama pull qwen2.5:7b. This is a good default for tool use and note actions.",
      },
      {
        title: "Enable in Betternote",
        body: "Settings → Models & API → Ollama → Connect. Leave Endpoint as http://localhost:11434 unless you changed it. Pick your model from the dropdown.",
      },
      {
        title: "Save settings",
        body: "Click Save settings at the bottom. You should see Connected with the number of models available.",
      },
    ],
    troubleshooting: [
      {
        question: "Ollama not detected",
        answer:
          "Make sure the Ollama app is running. Try ollama list in Terminal. Confirm Endpoint is http://localhost:11434.",
      },
      {
        question: "Agent or note actions fail",
        answer:
          "Pull a model first (ollama pull qwen2.5:7b). Enable both Ollama and MCP if you use /agent.",
      },
    ],
    links: [{ label: "Ollama download", url: "https://ollama.com" }],
    starterQuestions: [
      "How do I install Ollama?",
      "Which model should I use?",
      "Why does Betternote say Ollama is not detected?",
    ],
    assistantContext: "",
  },
  openai: {
    id: "openai",
    title: "OpenAI",
    summary: "Cloud GPT models for note actions via your API key. Not available yet in Betternote.",
    comingSoon: true,
    prerequisites: ["An OpenAI account and API key when this ships."],
    steps: [
      {
        title: "Coming soon",
        body: "OpenAI will appear here when released. For now use Ollama for local AI in Settings → Models & API.",
      },
    ],
    troubleshooting: [],
    starterQuestions: ["When will OpenAI be supported?"],
    assistantContext: "",
  },
  anthropic: {
    id: "anthropic",
    title: "Anthropic",
    summary: "Cloud Claude models for note actions via your API key. Not available yet in Betternote.",
    comingSoon: true,
    prerequisites: ["An Anthropic account and API key when this ships."],
    steps: [
      {
        title: "Coming soon",
        body: "Anthropic will appear here when released. For now use Ollama for local AI.",
      },
    ],
    troubleshooting: [],
    starterQuestions: ["When will Anthropic be supported?"],
    assistantContext: "",
  },
  mcp: {
    id: "mcp",
    title: "MCP Server",
    summary:
      "MCP (Model Context Protocol) lets Betternote's /agent block call tools from an external server you configure. Examples: Jira MCP, filesystem, or any MCP-compatible package.",
    prerequisites: [
      "Local Only Mode turned off.",
      "Node.js installed (for npx-based MCP servers).",
      "Ollama enabled with a model that supports tool calling (e.g. qwen2.5:7b).",
      "The MCP server package for the tool you want (see that tool's docs).",
    ],
    steps: [
      {
        title: "Turn off Local Only Mode",
        body: "Settings → Privacy → disable Local Only Mode so Betternote can reach Jira and spawn MCP processes.",
      },
      {
        title: "Enable MCP Server",
        body: "Settings → Integrations → MCP Server → Connect.",
      },
      {
        title: "Set Command and Args",
        body: "Command is usually npx. Args are comma-separated flags, e.g. -y, mcp-server-jira-cloud for Jira. Use the package name from your MCP server's documentation.",
      },
      {
        title: "Enable Ollama",
        body: "Settings → Models & API → Ollama → Connect. The /agent block needs both MCP and Ollama.",
      },
      {
        title: "Save and test",
        body: "Save settings. Open a note, type /agent, and ask something your MCP server supports (e.g. list my Jira issues).",
      },
    ],
    troubleshooting: [
      {
        question: "MCP server closes immediately",
        answer:
          "Check Command and Args match the package docs. For Jira use Command npx and Args -y, mcp-server-jira-cloud. Ensure Jira credentials are saved in Settings → Jira.",
      },
      {
        question: "Agent stuck on Running",
        answer:
          "Use Cancel, then try a simpler prompt. List-tools questions should respond quickly. Ensure Ollama is running.",
      },
      {
        question: "What is MCP?",
        answer:
          "A standard way for AI apps to use external tools. You run a small MCP server program; Betternote connects to it when you use /agent.",
      },
    ],
    links: [{ label: "Model Context Protocol", url: "https://modelcontextprotocol.io" }],
    starterQuestions: [
      "What is an MCP server?",
      "How do I set up MCP for Jira?",
      "What goes in Command vs Args?",
    ],
    assistantContext: "",
  },
  jira: {
    id: "jira",
    title: "Jira",
    summary:
      "Connect Jira to sync My Issues, insert ticket chips in notes, create issues, and use the /agent block with a Jira MCP server.",
    prerequisites: [
      "Local Only Mode turned off.",
      "A Jira Cloud site (e.g. yourcompany.atlassian.net).",
      "Atlassian account email and API token.",
      "Optional for /agent: MCP Server enabled with a Jira MCP package.",
    ],
    steps: [
      {
        title: "Create an API token",
        body: "Go to id.atlassian.com → Security → API tokens → Create API token. Copy it; you will not see it again. Use the same email you use to log into Jira.",
      },
      {
        title: "Enable Jira in Betternote",
        body: "Settings → Integrations → Jira → Connect.",
      },
      {
        title: "Enter credentials",
        body: "Site URL: https://yourcompany.atlassian.net (no trailing slash). Email: your Atlassian email. API Token: paste the token. Set Default project key (e.g. SCRUM) and sidebar section name if you like.",
      },
      {
        title: "Save settings",
        body: "Click Save settings. My Issues in the sidebar should populate after sync.",
      },
      {
        title: "Optional: MCP for /agent",
        body: "Enable MCP Server with Command npx and Args -y, mcp-server-jira-cloud. Betternote injects JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN from your saved Jira credentials. Enable Ollama, then use /agent in a note.",
      },
      {
        title: "Use in notes",
        body: "Type a ticket key like PROJ-123 to get a chip, or /jira to search. Use /agent for natural-language Jira queries when MCP + Ollama are on.",
      },
    ],
    troubleshooting: [
      {
        question: "401 or authentication failed",
        answer:
          "Re-check Site URL, email, and API token. Email must match your Atlassian account. Regenerate the token if unsure.",
      },
      {
        question: "My Issues is empty",
        answer:
          "Open My Issues and adjust the JQL filter. Default shows open issues assigned to you. Click sync/refresh.",
      },
      {
        question: "MCP Jira server fails",
        answer:
          "Use mcp-server-jira-cloud (not deprecated @anthropic/mcp-server-jira). Save Jira credentials first, then MCP Command npx, Args -y, mcp-server-jira-cloud.",
      },
    ],
    links: [
      { label: "Atlassian API tokens", url: "https://id.atlassian.com/manage-profile/security/api-tokens" },
    ],
    starterQuestions: [
      "How do I get a Jira API token?",
      "What should MCP command and args be for Jira?",
      "Why is My Issues empty?",
    ],
    assistantContext: "",
  },
  github: {
    id: "github",
    title: "GitHub",
    summary: "Link issues and pull requests to notes. Coming soon.",
    comingSoon: true,
    prerequisites: ["GitHub account when this integration ships."],
    steps: [
      {
        title: "Coming soon",
        body: "GitHub linking is planned. You can track issues manually with ticket chips and wiki links for now.",
      },
    ],
    troubleshooting: [],
    starterQuestions: ["What will the GitHub integration do?"],
    assistantContext: "",
  },
  linear: {
    id: "linear",
    title: "Linear",
    summary: "Sync issues and projects from Linear. Coming soon.",
    comingSoon: true,
    prerequisites: ["Linear workspace when this integration ships."],
    steps: [
      {
        title: "Coming soon",
        body: "Linear sync is planned. Use Jira or manual notes in the meantime.",
      },
    ],
    troubleshooting: [],
    starterQuestions: ["What will Linear integration include?"],
    assistantContext: "",
  },
  notion: {
    id: "notion",
    title: "Notion",
    summary: "Import pages and sync with Notion workspaces. Coming soon.",
    comingSoon: true,
    prerequisites: ["Notion workspace when this integration ships."],
    steps: [
      {
        title: "Coming soon",
        body: "Notion import/sync is planned.",
      },
    ],
    troubleshooting: [],
    starterQuestions: ["Will Notion be two-way sync?"],
    assistantContext: "",
  },
  trello: {
    id: "trello",
    title: "Trello",
    summary: "Link cards and boards to notes. Coming soon.",
    comingSoon: true,
    prerequisites: ["Trello account when this integration ships."],
    steps: [
      {
        title: "Coming soon",
        body: "Trello linking is planned.",
      },
    ],
    troubleshooting: [],
    starterQuestions: ["What will Trello integration do?"],
    assistantContext: "",
  },
  hacknplan: {
    id: "hacknplan",
    title: "HacknPlan",
    summary: "Sync game dev tasks and milestones. Coming soon.",
    comingSoon: true,
    prerequisites: ["HacknPlan account when this integration ships."],
    steps: [
      {
        title: "Coming soon",
        body: "HacknPlan sync is planned.",
      },
    ],
    troubleshooting: [],
    starterQuestions: ["What is HacknPlan integration for?"],
    assistantContext: "",
  },
  "google-sheets": {
    id: "google-sheets",
    title: "Google Sheets",
    summary: "Export notes and task lists to spreadsheets. Coming soon.",
    comingSoon: true,
    prerequisites: ["Google account when this integration ships."],
    steps: [
      {
        title: "Coming soon",
        body: "Google Sheets export is planned. Use note export features when available.",
      },
    ],
    troubleshooting: [],
    starterQuestions: ["Can I export notes to Sheets today?"],
    assistantContext: "",
  },
};

for (const id of Object.keys(guides) as IntegrationId[]) {
  const { assistantContext: _, ...rest } = guides[id];
  guides[id].assistantContext = buildContext(rest);
}

export function getIntegrationGuide(id: IntegrationId): IntegrationGuide {
  return guides[id];
}

export const INTEGRATION_GUIDE_IDS = Object.keys(guides) as IntegrationId[];
