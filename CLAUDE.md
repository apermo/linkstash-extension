# linkstash-extension

## Project Overview

Chrome MV3 extension companion for the [LinkStash](https://github.com/apermo/linkstash)
WordPress bookmark plugin. Saves the current tab to a user-configured
LinkStash via its Bearer-authenticated REST API; shows a saved/unsaved
indicator on the action badge; supports edit/delete from the popup and
"Save link" from the right-click context menu.

The detailed implementation plan lives at [`docs/plan.md`](docs/plan.md).

## Stack

- **Language:** TypeScript (strict).
- **Build:** Vite + `@crxjs/vite-plugin` (MV3 manifest validation, HMR
  for popup/options).
- **UI:** Vanilla DOM. Popup and options page are tiny single-form
  surfaces; a framework would be overhead.
- **Tests:** Vitest with `fetch` and `chrome.*` stubbed at the boundary.
- **Lint:** ESLint (typescript-eslint) + Prettier.

## Commands

Once issue #1 (bootstrap) lands, the standard cycle is:

```bash
npm run dev       # Vite dev server with extension HMR
npm run build     # production build to dist/
npm run lint
npm run lint:fix
npm run test
npm run test:watch
```

Loading into Chrome: open `chrome://extensions`, enable Developer Mode,
"Load unpacked", point at the `dist/` directory.

## Conventions

- CHANGELOG.md follows Keep a Changelog format.
- Releases are automated via GitHub Actions based on CHANGELOG version
  headings.
- Commits follow the Conventional Commits specification (`feat`, `fix`,
  `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`).
  Subject ≤ 50 characters; body wrapped at 72.
- Branch per issue: `feat/<short-slug>` or `fix/...`. PR per issue,
  closes it.
- Test-Driven Development for everything with logic worth testing (API
  client, settings storage, service-worker cache, helpers). UI glue
  can skip TDD if the test would be vacuous.
- Atomic commits — one concern per commit; no "WIP" / "fixup" commits.

## API contract

Requests against the user-configured LinkStash host:

- Auth: `Authorization: Bearer <token>` on every call.
- `GET /linkstash/v1/check?url=<encoded>` → `{ saved, id?, public? }`.
- `GET /linkstash/v1/bookmarks/{id}` → full bookmark.
- `POST /linkstash/v1/bookmarks` — idempotent on canonical URL.
  A re-POST returns the existing record with `X-LinkStash-Existing: 1`
  and updates fields the caller sent.
- `PATCH /linkstash/v1/bookmarks/{id}` — partial update.
- `DELETE /linkstash/v1/bookmarks/{id}`.
- `GET /linkstash/v1/tags?q=<prefix>` → tag autocomplete.
- All 4xx responses return JSON `{ code, message, data: { status } }`.

LinkStash CORS already allows `chrome-extension://*` by default.

## Permissions

- Static manifest permissions: `storage`, `activeTab`, `contextMenus`,
  `notifications`.
- Host permission requested at runtime via `chrome.permissions.request`
  once the user enters a host on the options page — keeps the install
  warning minimal and gives the user an explicit consent moment.
