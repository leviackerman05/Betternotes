# Betternote

A **local-first notes app for developers** on macOS. Fast editor, wiki links, backlinks, quick capture, and privacy controls, with optional local AI and integrations.

No backend. No login. Your notes stay on your machine.

## Download

Get the latest macOS build from [GitHub Releases](https://github.com/leviackerman05/Betternotes/releases).

> **Note:** Early releases may be unsigned. On first open, right-click the app → Open, or allow in System Settings → Privacy & Security.

## Features

- **Local notes**: workspaces, rich editor, tags, reminders, lock, export
- **Wiki links & backlinks**: `[[Note title]]` linking between notes
- **Quick capture**: `⌘N` or command palette (`⌘F`)
- **Search**: find notes by title or content
- **Privacy first**: Local Only Mode blocks all network integrations by default
- **Optional Local AI**: Ollama for summarize, rewrite, extract tasks, explain (opt-in)
- **Optional integrations**: Jira, generic MCP, GitHub/Linear (coming soon)

## Development

```bash
npm install
npm run tauri dev
```

For correct Dock icon sizing during dev:

```bash
npm run dev:app
```

## Building

```bash
npm run tauri build
```

Produces a `.dmg` in `src-tauri/target/release/bundle/macos/`.

## Optional: Local AI (Ollama)

1. Install [Ollama](https://ollama.com)
2. Pull a model: `ollama pull qwen2.5:7b`
3. In Settings → disable **Local Only Mode**
4. Enable **Local AI (Ollama)**

## Optional: Jira

1. Disable **Local Only Mode** in Settings
2. Enable **Jira** integration
3. Add your Atlassian site URL, email, API token, and default project key
4. Use `/ticket` slash commands in notes (when enabled)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘F` | Search notes & commands |
| `⌘N` | Quick capture: new note |
| `G` then `N` | Go to Notes |
| `G` then `S` | Go to Settings |
| `/` | Slash commands in editor |

## Tech Stack

- **Tauri v2** (Rust + webview)
- **React + TypeScript + Vite**
- **SQLite** (local storage)
- **TipTap** (rich-text editor)
- **Ollama** (optional local LLM)
- **MCP** (optional generic connector)

## Privacy

- All notes and settings stored locally on your machine (path shown in Settings → Privacy)
- **Local Only Mode** is on by default. No outbound network calls.
- Integrations require explicit opt-in in Settings
