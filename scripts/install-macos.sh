#!/usr/bin/env bash
# Install Betternote from a release DMG, or clear quarantine on an existing copy.
#
# Usage:
#   ./scripts/install-macos.sh ~/Downloads/Betternote_0.1.0_aarch64.dmg
#   ./scripts/install-macos.sh /Applications/Betternote.app
#
set -euo pipefail

APP_NAME="Betternote.app"
INSTALL_DIR="/Applications"

die() {
  echo "Error: $*" >&2
  exit 1
}

clear_quarantine() {
  local app_path="$1"
  echo "Clearing macOS quarantine on $app_path …"
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
  echo "Betternote is installed. Open it from Applications or Spotlight."
  echo "You only need this script once per download."
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
  echo "Done. You can open Betternote from Applications."
}

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path-to.dmg | path-to/Betternote.app>"
  exit 1
fi

target="$1"
case "$target" in
  *.dmg) install_from_dmg "$target" ;;
  *.app) install_from_app "$target" ;;
  *) die "Pass a .dmg file or Betternote.app bundle" ;;
esac
