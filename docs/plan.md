# LinkStash Extension — Implementation Plan

## Why this exists

LinkStash ships a token-protected REST API (`/wp-json/linkstash/v1/…`)
specifically so a browser extension can save the current tab in one
click. This repo is that extension. The MVP target is Chromium-based
browsers via Manifest V3; Firefox/Safari are on the backlog.

## Reference

- LinkStash REST namespace: `linkstash/v1`. Routes used:
  - `GET /check?url=<encoded>` → `{ saved: bool, id?: int, public?: bool }`.
  - `POST /bookmarks` — idempotent on canonical URL; returns the bookmark
    record (with `X-LinkStash-Existing: 1` if it merged into an existing
    entry).
  - `PATCH /bookmarks/{id}` — partial update of any field present in the
    request body.
  - `DELETE /bookmarks/{id}`.
  - `GET /tags?q=<prefix>` — autocomplete; respects caller's visibility.
- Auth: `Authorization: Bearer <token>`. Token issued from WP-Admin
  → Tools → LinkStash.
- CORS: LinkStash defaults to `chrome-extension://*` in the allow-list, so
  the extension's own origin works without further configuration.

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Type-safe API client; small surface, big payoff |
| Build | Vite + `@crxjs/vite-plugin` | MV3 manifest validation + HMR for popup/options |
| UI | Vanilla DOM + small helpers | Popup is ~1 form; framework would be overhead |
| Tests | Vitest | Same toolchain as Vite; fast |
| Lint | ESLint (typescript-eslint) + Prettier | Standard |
| CI | GitHub Actions | Build artefact + lint + test on PR; release zip on tag |

No CSS framework — a tiny global stylesheet is enough for popup + options.

## Permissions model

The user supplies their own LinkStash host URL. The extension does **not**
ship `host_permissions` for arbitrary origins; instead it requests origin
access at runtime via `chrome.permissions.request` after the user enters a
URL on the options page. This keeps the install warning minimal ("Read
your data on websites you visit" stays out of the install dialog) and
gives the user a clear consent moment.

Static permissions in the manifest:

- `storage` — settings (host, token, default visibility).
- `activeTab` — to read the current tab's URL/title when the popup opens.

## Storage layout

`chrome.storage.sync` (small footprint, syncs across the user's signed-in
Chrome installs):

```
{
  "host": "https://bookmarks.example.tld",
  "token": "<bearer-token>",
  "defaultVisibility": "private" | "public"
}
```

`chrome.storage.session` for transient cached state (e.g. the last
`/check` response for the active tab) — wiped when the browser quits.

## API client shape

```ts
class LinkStashClient {
  constructor(private host: string, private token: string) {}

  async check(url: string): Promise<CheckResult>;
  async create(input: BookmarkInput): Promise<Bookmark>;
  async update(id: number, patch: BookmarkPatch): Promise<Bookmark>;
  async remove(id: number): Promise<void>;
  async tags(prefix: string): Promise<Tag[]>;
  async testConnection(): Promise<{ ok: true } | { ok: false; reason: string }>;
}
```

Errors map to a discriminated union (`AuthError | NotFoundError |
NetworkError | ServerError`) so the popup can render specific messages
("Token rejected — check Tools → LinkStash") instead of generic failures.

## Service-worker behaviour

- Listen for `chrome.tabs.onActivated`, `chrome.tabs.onUpdated` (status =
  `complete`), and `chrome.windows.onFocusChanged`.
- For the active tab's URL, call `client.check(url)` (debounced 500 ms).
- Update the action badge: green "✓" if saved, empty otherwise.
- Cache the last 50 `(url → CheckResult)` pairs in
  `chrome.storage.session` so popup open is instant.

## Popup behaviour

On open:

1. Read active tab via `chrome.tabs.query({ active: true, currentWindow: true })`.
2. Pull the cached `CheckResult` (or `client.check()` if cache miss).
3. If `saved: false` → show the "Save" form (URL, title, description,
   tags, visibility, Save).
4. If `saved: true` → fetch the full bookmark via `GET /bookmarks/{id}`
   and show the "Edit" form (same fields prefilled, Save / Delete).

Tag autocomplete: on every input keystroke (debounced 200 ms), call
`client.tags(prefix)` and show suggestions in a `<datalist>`-like dropdown.

## Options page behaviour

- Three fields: host, token, default visibility.
- "Save" persists to `chrome.storage.sync`.
- "Test connection" pings `GET /bookmarks?per_page=1` with the new
  credentials and surfaces the result inline.
- After a host change, request `chrome.permissions.request({ origins: ["<host>/*"] })`
  before saving. Reject the save if the user denies.

## Testing

- Unit tests for the API client (mock `fetch`).
- Unit tests for the URL canonicalisation / prefix-tag logic if any.
- Integration: a thin Playwright test that loads the extension into a
  headless Chromium with `--load-extension`, opens the options page, and
  configures it against a mock server. Optional for the MVP.

## CI

`.github/workflows/ci.yml`:

- On every push / PR: `npm ci`, `npm run lint`, `npm run test`,
  `npm run build`. Upload the `dist/` directory as an artefact.
- On tag `v*`: package `dist/` into a `linkstash-extension-vX.Y.Z.zip`,
  attach to a GitHub Release.

## Out of scope for v0.1.0

- Omnibox keyword (`ls<space>`).
- Right-click context menu "Save link to LinkStash".
- Bulk import from `chrome.bookmarks`.
- Firefox / Edge specific manifest tweaks (Firefox requires
  `browser_specific_settings`; addressing in v0.2.0).
- Offline cache of the user's full bookmark list.
- Localisation (English-only at MVP).

## v0.1.0 issue list (12)

1. Repo bootstrap: `package.json`, `tsconfig.json`, Vite + CRXJS config,
   ESLint + Prettier, base `manifest.json`, dummy popup/options/service
   worker entry points that build green.
2. Settings storage layer: typed wrapper around `chrome.storage.sync` for
   host/token/defaultVisibility, with change-event hook.
3. Typed API client (`LinkStashClient`) with `check`/`create`/`update`/
   `remove`/`tags`/`testConnection`. Covered by Vitest with `fetch`
   stubbed.
4. Service worker: tab-change listener → `client.check()` → badge
   update. Session-cache hits.
5. Popup save flow: render form, call `client.create`, show result.
6. Popup edit flow: prefill from `GET /bookmarks/{id}`, call
   `client.update`.
7. Popup delete flow: confirm dialog → `client.remove`.
8. Tag autocomplete in the popup using `client.tags(prefix)`.
9. Public/private toggle in the popup, defaulting to the user's setting.
10. Options page: three fields, save-to-storage, host-permission request.
11. Options page: "Test connection" button.
12. README: install / configure / screenshot. CI workflow.

## Backlog (v0.2.0+)

- Omnibox keyword.
- Context-menu "Save link to LinkStash".
- Bulk import from `chrome.bookmarks`.
- Firefox + Edge manifest variants.
- Keyboard shortcut for save.
- Localisation (DE, ES, FR).
- Offline-cache list view inside the popup.
- Custom badge colours for unread / archived states.
