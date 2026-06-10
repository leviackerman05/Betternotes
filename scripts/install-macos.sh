#!/usr/bin/env bash
# Install Betternote on macOS (download, copy to Applications, clear quarantine).
#
# One command (recommended):
#   curl -fsSL https://github.com/leviackerman05/Betternotes/releases/latest/download/install-macos.sh | bash
#
# Or with a local DMG / existing app:
#   ./install-macos.sh ~/Downloads/Betternote.dmg
#   ./install-macos.sh /Applications/Betternote.app
#
set -euo pipefail

GITHUB_REPO="leviackerman05/Betternotes"
APP_NAME="Betternote.app"
INSTALL_DIR="/Applications"

die() {
  echo "Error: $*" >&2
  exit 1
}

machine_arch() {
  case "$(uname -m)" in
    arm64) echo "aarch64" ;;
    x86_64) echo "x86_64" ;;
    *) echo "aarch64" ;;
  esac
}

clear_quarantine() {
  local app_path="$1"
  echo "Clearing macOS quarantine …"
  xattr -cr "$app_path"
}

install_from_dmg() {
  local dmg_path="$1"
  [[ -f "$dmg_path" ]] || die "DMG not found: $dmg_path"

  hdiutil attach "$dmg_path" -nobrowse -quiet >/dev/null
  local source_app
  source_app=$(find /Volumes -maxdepth 2 -name "$APP_NAME" -print -quit 2>/dev/null || true)
  [[ -n "$source_app" && -d "$source_app" ]] || die "Could not find $APP_NAME in mounted DMG"

  local mount_dir
  mount_dir=$(dirname "$(dirname "$source_app")")
  trap 'hdiutil detach "$mount_dir" -quiet 2>/dev/null || true' EXIT

  echo "Installing to $INSTALL_DIR …"
  rm -rf "$INSTALL_DIR/$APP_NAME"
  cp -R "$source_app" "$INSTALL_DIR/"
  clear_quarantine "$INSTALL_DIR/$APP_NAME"

  echo ""
  echo "Done. Open Betternote from Applications or Spotlight."
}

install_from_app() {
  local app_path="$1"
  [[ -d "$app_path" ]] || die "App bundle not found: $app_path"
  [[ "$app_path" == */Betternote.app ]] || die "Expected path ending in Betternote.app"

  if [[ "$app_path" != "$INSTALL_DIR/$APP_NAME" ]]; then
    echo "Copying to $INSTALL_DIR …"
    rm -rf "$INSTALL_DIR/$APP_NAME"
    cp -R "$app_path" "$INSTALL_DIR/"
    app_path="$INSTALL_DIR/$APP_NAME"
  fi

  clear_quarantine "$app_path"
  echo ""
  echo "Done. Open Betternote from Applications."
}

pick_dmg_url() {
  local arch="$1"
  local api_url="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
  local json
  json=$(curl -fsSL "$api_url") || die "Could not fetch latest release from GitHub"

  local url
  url=$(printf '%s' "$json" | grep -oE '"browser_download_url":\s*"[^"]+"' \
    | grep -i "${arch}" | grep -i '\.dmg"' | head -1 \
    | sed -E 's/.*"(https[^"]+)"/\1/') || true

  if [[ -z "$url" ]]; then
    url=$(printf '%s' "$json" | grep -oE '"browser_download_url":\s*"[^"]+Betternote[^"]*\.dmg"' \
      | head -1 | sed -E 's/.*"(https[^"]+)"/\1/') || true
  fi

  [[ -n "$url" ]] || die "No DMG found in latest release for ${arch}"
  echo "$url"
}

install_latest() {
  local arch
  arch=$(machine_arch)
  echo "Fetching latest Betternote release (${arch}) …"

  local dmg_url
  dmg_url=$(pick_dmg_url "$arch")

  local tmp_dmg
  tmp_dmg=$(mktemp -t betternote).dmg
  trap 'rm -f "$tmp_dmg"' RETURN

  echo "Downloading …"
  curl -fsSL -o "$tmp_dmg" "$dmg_url"
  install_from_dmg "$tmp_dmg"
}

if [[ $# -eq 0 ]]; then
  install_latest
  exit 0
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: $0"
  echo "   or: $0 <path-to.dmg | path-to/Betternote.app>"
  exit 1
fi

target="$1"
case "$target" in
  *.dmg) install_from_dmg "$target" ;;
  *.app) install_from_app "$target" ;;
  *) die "Pass a .dmg file, Betternote.app bundle, or run with no arguments" ;;
esac
