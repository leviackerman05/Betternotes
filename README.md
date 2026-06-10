# Betternote

A **local-first notes app for developers** on macOS. Fast editor, wiki links, backlinks, quick capture, and privacy controls, with optional local AI and integrations.

No backend. No login. Your notes stay on your machine.

## Download

1. Download the `.dmg` from [GitHub Releases](https://github.com/leviackerman05/Betternotes/releases).
2. Open it and drag **Betternote** into **Applications** (installs to `/Applications/Betternote.app`).
3. Open Betternote from Applications.

Betternote is not Apple-notarized, so macOS may block the first launch. If you see **"damaged"** or the app will not open:

- **Right-click** `/Applications/Betternote.app` → **Open** → confirm once, or
- Run in Terminal: `xattr -cr /Applications/Betternote.app`

After that, double-click works normally.

<details>
<summary>Optional: terminal install script</summary>

If you prefer the terminal, [`scripts/install-macos.sh`](scripts/install-macos.sh) can download the latest release, install to Applications, and clear quarantine for you:

```bash
curl -fsSL https://raw.githubusercontent.com/leviackerman05/Betternotes/main/scripts/install-macos.sh | bash
```

</details>

## Features

- **Local notes**: workspaces, rich editor, tags, reminders, lock, export
- **Wiki links & backlinks**: `[[Note title]]` linking between notes
- **Quick capture**: `⌘N` or command palette (`⌘K`)
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
| `⌘K` | Search notes & commands |
| `⌘F` | Find in note |
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
