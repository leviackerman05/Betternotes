# Betternote

A **local-first notes app for developers** on macOS. Fast editor, wiki links, backlinks, quick capture, and privacy controls, with optional local AI and integrations.

No backend. No login. Your notes stay on your machine.

## Download

Get the latest macOS build from [GitHub Releases](https://github.com/leviackerman05/Betternotes/releases).

Betternote is not Apple-notarized (no paid developer certificate). macOS may show **"damaged"** or block the app the first time. Use either method below — **you only do this once**.

### Option A — Right-click Open (no terminal)

1. Download the `.dmg` from Releases and open it.
2. Drag **Betternote** into **Applications**.
3. In Applications, **right-click Betternote → Open** (do not double-click yet).
4. Click **Open** in the dialog.
5. After that, double-click works normally.

### Option B — Install script (automated)

Download the DMG, then run the script from the release (or this repo):

```bash
chmod +x install-macos.sh
./install-macos.sh ~/Downloads/Betternote.dmg
```

Already copied the app to Applications? Point the script at the app:

```bash
./install-macos.sh /Applications/Betternote.app
```

The script installs (if needed) and clears macOS quarantine so you do not need to run `xattr` yourself.

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
