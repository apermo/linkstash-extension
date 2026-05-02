# LinkStash Browser Extension

A Chrome MV3 extension for the [LinkStash](https://github.com/apermo/linkstash)
WordPress bookmark plugin. Save the current tab to your LinkStash with one
click, see at a glance which pages you've already saved, and edit
title/description/tags/visibility without leaving the page.

## Install

Until a Chrome Web Store listing exists, load the extension unpacked:

1. Grab the latest `linkstash-extension-vX.Y.Z.zip` from
   [Releases](https://github.com/apermo/linkstash-extension/releases) and
   unzip it, **or** clone this repo and run `npm install && npm run build`
   to produce a fresh `dist/` directory.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder (or `dist/`).

## What you'll need

- A WordPress site running the LinkStash plugin (≥ v0.1.0), with the
  plugin **activated**.
- A LinkStash API token, generated from **Tools → LinkStash** in WP-Admin.
- WordPress permalinks set to anything **other than "Plain"**
  (`Settings → Permalinks`). The extension talks to
  `https://your-site/wp-json/linkstash/v1/…`, which 404s on the Plain
  permalink scheme.

## Configuration

Once installed, open the extension's options page and provide:

- The URL of your LinkStash WordPress site (e.g. `https://bookmarks.example.tld`).
- Your Bearer token (paste, never typed).
- Default visibility (public / private) for newly saved bookmarks.

The extension requests host permission for the URL you supply, scoped to
that origin only. No data leaves the extension except the calls to your
LinkStash REST API.

### Sanity check

If **Test connection** reports "Endpoint not found", verify the WP REST
API is reachable by visiting these URLs in your browser:

- `https://your-site/wp-json/` — should return a JSON listing of REST
  namespaces. If it returns the WordPress homepage, fix the permalink
  setting.
- `https://your-site/wp-json/linkstash/v1/tags?q=` — should return JSON
  (`[]` is fine). If it returns `{"code":"rest_no_route"}`, the LinkStash
  plugin isn't activated on that install.

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

## Usage

- **Click the action icon** on any tab to open the popup. New pages get a
  Save form (title pulled from the tab); already-saved pages open in
  Update mode prefilled from the API, with a Delete button.
- **Tag autocomplete** fires after you've typed a character; arrow keys
  navigate, Enter or click selects.
- **Right-click any link** and pick **Save link to LinkStash** to save
  without opening the popup. The selection text becomes the title when
  present.
- **The action badge** shows a green ✓ on tabs whose URL is already in
  your LinkStash. The check runs whenever you switch or load a tab.

## Development

```bash
npm install
npm run dev       # Vite dev server with extension HMR
npm run build     # production build to dist/
npm run lint
npm run lint:fix
npm run test
npm run test:watch
```

Stack: TypeScript (strict) + Vite + `@crxjs/vite-plugin`, Vitest with
`fetch` and `chrome.*` stubbed at the boundary, ESLint flat config +
Prettier. See [`docs/plan.md`](docs/plan.md) for the rationale and
[`CLAUDE.md`](CLAUDE.md) for the conventions.

## License

GPL-2.0-or-later. Same as the LinkStash plugin.
