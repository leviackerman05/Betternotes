#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$ROOT/src-tauri"
TARGET_ROOT="$(cd "$TAURI_DIR" && cargo metadata --format-version 1 --no-deps | python3 -c 'import json,sys; print(json.load(sys.stdin)["target_directory"])')"
TARGET_DIR="$TARGET_ROOT/debug"
APP_DIR="$TARGET_DIR/Betternote.app"
BINARY="$TARGET_DIR/betternotes"
ICNS="$TAURI_DIR/icons/icon.icns"

if [[ ! -f "$BINARY" ]]; then
  echo "Missing debug binary. Run: cd src-tauri && cargo build"
  exit 1
fi

if [[ ! -f "$ICNS" ]]; then
  echo "Missing icon.icns. Run: npx tauri icon app-icon.svg"
  exit 1
fi

mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
cp "$ICNS" "$APP_DIR/Contents/Resources/icon.icns"
cp "$BINARY" "$APP_DIR/Contents/MacOS/Betternote"
chmod +x "$APP_DIR/Contents/MacOS/Betternote"

cat > "$APP_DIR/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Betternote</string>
  <key>CFBundleIconFile</key>
  <string>icon</string>
  <key>CFBundleIdentifier</key>
  <string>com.betternotes.desktop</string>
  <key>CFBundleName</key>
  <string>Betternote</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF

touch "$APP_DIR"
echo "Synced $APP_DIR"

if [[ "${1:-}" == "--open" ]]; then
  open "$APP_DIR"
fi
