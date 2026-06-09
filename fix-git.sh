#!/bin/bash
set -euo pipefail

BETTERNOTES="/Users/aditidubey/Desktop/betternotes"

echo "=== BetterNotes git fix ==="
cd "$BETTERNOTES"

# Remove local cargo cache (build artifact, not part of the project)
if [ -d ".cargo-home" ]; then
  echo "Removing .cargo-home/ cache ($(du -sh .cargo-home | cut -f1))..."
  rm -rf .cargo-home
fi

# Remove vendor workaround folder if present
if [ -d "src-tauri/vendor" ]; then
  echo "Removing src-tauri/vendor/..."
  rm -rf src-tauri/vendor
fi

# Wipe git entirely and start fresh (clears any bad index from prior runs)
echo "Reinitializing git repo..."
rm -rf .git
git init -b main

# Verify .gitignore is correct before staging
if ! grep -q '.cargo-home' .gitignore; then
  echo "ERROR: .gitignore missing .cargo-home entry"
  exit 1
fi

git add -A

FILE_COUNT=$(git status --short | wc -l | tr -d ' ')
echo ""
echo "Files staged: $FILE_COUNT (should be ~50-80, NOT thousands)"

if [ "$FILE_COUNT" -gt 500 ]; then
  echo ""
  echo "ERROR: Too many files staged. Top-level breakdown:"
  git status --short | sed 's/^.. //' | cut -d/ -f1 | sort | uniq -c | sort -rn | head -10
  exit 1
fi

echo ""
echo "Staged files:"
git status --short

git commit -m "$(cat <<'EOF'
Initial BetterNotes scaffold

Local-first Tauri app with tasks (Inbox/Today/Upcoming), Apple Notes-style
notes with slash commands, Jira MCP agent via Ollama, and Calm Clarity design.
EOF
)"

echo ""
echo "=== Success ==="
echo "Git root: $(git rev-parse --show-toplevel)"
echo "Commit:   $(git log -1 --oneline)"
echo ""
echo "In GitHub Desktop: File → Add Local Repository →"
echo "  $BETTERNOTES"
