# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-02

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
