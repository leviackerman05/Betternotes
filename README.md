# BetterNotes

A local-first desktop app for Mac and Windows that combines:

- **Minimal todo list** — Inbox, Today, and Upcoming views with natural-language quick add
- **Apple Notes-style notes** — folders, rich-text editor, slash commands
- **Jira integration via MCP** — type `/jira` in a note to chat with your tickets using a local LLM

No backend. No login. All data stays on your machine.

## Prerequisites

1. **Node.js** (v18+) and npm
2. **Rust** — install via [rustup](https://rustup.rs)
3. **Ollama** — install from [ollama.com](https://ollama.com), then pull a tool-calling model:
   ```bash
   ollama pull qwen2.5:7b
   ```

## Development

```bash
npm install
npm run tauri dev
```

## Building

```bash
npm run tauri build
```

## Jira Setup

1. Open **Settings** in the app
2. Enter your Jira site URL, email, and API token
3. Credentials are stored in your OS keychain
4. The default MCP server config uses `npx @anthropic/mcp-server-jira`

In any note, type `/` and select **Jira agent** to start chatting with your tickets.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Command palette |
| `G` then `I` | Go to Inbox |
| `G` then `T` | Go to Today |
| `G` then `U` | Go to Upcoming |
| `G` then `N` | Go to Notes |
| `G` then `S` | Go to Settings |

## Tech Stack

- **Tauri v2** (Rust + webview)
- **React + TypeScript + Vite**
- **SQLite** (local storage)
- **TipTap** (rich-text editor)
- **Ollama** (local LLM)
- **MCP** (Jira server via stdio)

## Design

Styled with the "Calm Clarity" design system — warm neutral canvas, coral accents, Graphik/Manrope headlines, Inter body text.
