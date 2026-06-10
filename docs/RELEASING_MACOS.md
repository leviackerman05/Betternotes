# macOS releases

Releases are **unsigned** (no Apple Developer Program). Users open the app once via **right-click → Open** or [`scripts/install-macos.sh`](../scripts/install-macos.sh). See the [README](../README.md) Download section.

## Cut a release

```bash
git tag v0.1.1
git push origin v0.1.1
```

The [Release workflow](../.github/workflows/release.yml) builds a DMG and uploads:

- `Betternote_*.dmg`
- `install-macos.sh`

## Optional: signed & notarized builds

If you later join the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year), you can add signing secrets to GitHub Actions and extend the workflow to:

1. Import a **Developer ID Application** certificate
2. Set `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_CONTENT`, `APPLE_TEAM_ID`
3. Notarize with Apple so users skip the first-open steps

Environment variables are documented in the [Tauri macOS signing guide](https://v2.tauri.app/distribute/sign/macos/).
