# macOS releases

Releases are **unsigned** (no Apple Developer Program). Users download the **DMG** from GitHub Releases and install normally. If macOS blocks first launch, they **right-click Betternote → Open** once. See the [README](../README.md) Download section.

## Cut a release

```bash
git tag v0.1.1
git push origin v0.1.1
```

The [Release workflow](../.github/workflows/release.yml) builds and uploads `Betternote.dmg` (stable filename for the README direct-download link).

Optional [`scripts/install-macos.sh`](../scripts/install-macos.sh) lives in the repo for terminal users but is not attached to releases.

## Optional: signed & notarized builds

If you later join the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year), you can add signing secrets to GitHub Actions and notarize builds so users skip the first-open step.

Environment variables are documented in the [Tauri macOS signing guide](https://v2.tauri.app/distribute/sign/macos/).
