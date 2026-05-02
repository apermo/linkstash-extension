# LinkStash Browser Extension

A Chrome MV3 extension for the [LinkStash](https://github.com/apermo/linkstash)
WordPress bookmark plugin. Save the current tab to your LinkStash with one
click, see at a glance which pages you've already saved, and edit
title/description/tags/visibility without leaving the page.

## Status

Pre-MVP. The repo is bootstrapping; tracked work for the first release is
in the [v0.1.0 milestone](https://github.com/apermo/linkstash-extension/milestone/1).

## What you'll need

- A WordPress site running the LinkStash plugin (≥ v0.1.0).
- A LinkStash API token, generated from **Tools → LinkStash** in WP-Admin.

## Configuration

Once installed, open the extension's options page and provide:

- The URL of your LinkStash WordPress site (e.g. `https://bookmarks.example.tld`).
- Your Bearer token (paste, never typed).
- Default visibility (public / private) for newly saved bookmarks.

The extension requests host permission for the URL you supply, scoped to
that origin only. No data leaves the extension except the calls to your
LinkStash REST API.

## Architecture (MV3)

- **Service worker** (`src/background/`) — watches tab changes, calls
  `GET /linkstash/v1/check?url=…`, sets the action badge to indicate
  whether the page is already saved.
- **Popup** (`src/popup/`) — the save/edit form bound to the active tab;
  posts to `POST /linkstash/v1/bookmarks` (idempotent), `PATCH`-es when
  the user edits an existing entry, `DELETE`-s on demand.
- **Options page** (`src/options/`) — settings UI: host, token, default
  visibility, "Test connection" button.

The detailed implementation plan lives in
[`docs/plan.md`](docs/plan.md).

## Development

See [`docs/plan.md`](docs/plan.md) for the chosen tech stack (TypeScript,
Vite + `@crxjs/vite-plugin`, Vitest) and the build pipeline; once the
repo bootstrap issue lands, this section will document the local setup.

## License

GPL-2.0-or-later. Same as the LinkStash plugin.
