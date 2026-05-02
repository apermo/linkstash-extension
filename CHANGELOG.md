# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-02

Initial public release.

### Added

- Initial repo scaffold (README, CHANGELOG, LICENSE, plan).
- TypeScript + Vite + `@crxjs/vite-plugin` build toolchain with MV3
  `manifest.json`, ESLint flat config, Prettier, and Vitest. Stub
  popup, options, and service-worker entry points build green and load
  as an unpacked extension from `dist/`.
- Typed settings storage layer wrapping `chrome.storage.sync` for
  host, token, and default visibility, with a `watchSettings` change
  hook.
- Typed `LinkStashClient` covering `check`, `create`, `get`, `update`,
  `remove`, `tags`, and `testConnection`. 401/403 → auth, 404 → not
  found, 5xx → server, fetch failure → network, all surfaced through
  a `LinkStashError` union.
- Options page: host + token + default visibility form. Save requests
  host permission scoped to the entered origin before persisting.
  Test connection button pings `/tags?q=` so brand-new installs with
  zero bookmarks still validate credentials.
- Popup save / edit / delete flow against the active tab. The popup
  detects whether the URL is already saved, prefills the form, and
  switches between Save / Update / Delete actions.
- Service worker: tab-change listener calls `client.check` (debounced
  500 ms) and updates the action badge with a green ✓ when the page
  is already saved.
- Tag autocomplete in the popup: debounced `client.tags(prefix)` with
  keyboard (ArrowUp/Down/Enter/Escape) and click selection.
- Right-click context menu **Save link to LinkStash** — adds the link
  via `client.create` without opening the popup; surfaces success and
  errors via `chrome.notifications`.
- CI: a `Lint, test, build` job runs on every PR, uploads `dist/` as
  a 14-day artifact and pushes coverage to Codecov. A separate
  `Release Asset` workflow packages `dist/` into a versioned zip and
  attaches it to each GitHub Release.
- "Save page to LinkStash" context-menu entry alongside "Save link
  to LinkStash" — saves the active tab when right-clicking the page
  body or with text selected.
- `npm run package` builds and zips a Chrome Web Store-ready archive
  into `releases/linkstash-extension-vX.Y.Z.zip`.
- `publish.yml` workflow uploads + auto-publishes new releases to
  the Chrome Web Store via the publish API once the listing exists
  and the OAuth secrets are configured (see `docs/release.md`).
- `PRIVACY.md` and `docs/store/listing.md` cover the privacy
  disclosures, listing copy, and per-permission justifications the
  Chrome Web Store form requires.
