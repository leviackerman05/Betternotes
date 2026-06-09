#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$ROOT/.vite-dev.log"
VITE_PID=""

cleanup() {
  if [[ -n "$VITE_PID" ]] && kill -0 "$VITE_PID" 2>/dev/null; then
    kill "$VITE_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "$ROOT"
npm run dev > "$LOG_FILE" 2>&1 &
VITE_PID="$!"

for _ in {1..80}; do
  if curl -fsS "http://localhost:1420" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo "Vite failed to start. See $LOG_FILE"
    exit 1
  fi

  sleep 0.25
done

if ! curl -fsS "http://localhost:1420" >/dev/null 2>&1; then
  echo "Timed out waiting for Vite. See $LOG_FILE"
  exit 1
fi

(cd "$ROOT/src-tauri" && cargo build)
bash "$ROOT/scripts/sync-dev-app-bundle.sh" --open

echo "Betternote is running from the .app bundle. Press Ctrl+C here to stop Vite."
wait "$VITE_PID"
