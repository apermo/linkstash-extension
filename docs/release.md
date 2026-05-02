# Release Process

How to ship a new version of LinkStash for Chrome.

## Versioning

`package.json` is the single source of truth. `vite.config.ts` reads
its `version` field and overrides `manifest.json` at build time, so
bumping one file is enough.

```bash
npm version 0.1.0 --no-git-tag-version
```

(`--no-git-tag-version` because the GitHub release reusable workflow
is the thing that creates the tag.)

## Local sanity check

```bash
npm ci
npm run lint
npm run test:coverage
npm run build           # produces dist/
npm run package         # → releases/linkstash-extension-vX.Y.Z.zip
```

Load `dist/` via `chrome://extensions → Load unpacked` and click
through the popup, options, and a context-menu save against a real
LinkStash before tagging.

## Tagging a release

1. Edit `CHANGELOG.md`: add a `## [X.Y.Z] - YYYY-MM-DD` heading with
   the changes for this version under it. The `pr-validation`
   reusable workflow blocks merges without a valid heading.
2. Bump `package.json` (see above).
3. Open a PR with both changes, merge it.
4. The `release` reusable workflow on `apermo/reusable-workflows`
   spots the new version heading on `main`, creates the `vX.Y.Z`
   tag, and opens a GitHub Release with auto-generated notes.
5. The `release-asset.yml` workflow attaches
   `linkstash-extension-vX.Y.Z.zip` to the release.
6. The `publish.yml` workflow (see below) uploads + auto-publishes
   to the Chrome Web Store.

> **GitHub gotcha:** the `release` reusable workflow runs under
> `GITHUB_TOKEN`, and GitHub doesn't fire downstream workflows for
> events created by `GITHUB_TOKEN` (loop-prevention). Both
> `release-asset.yml` and `publish.yml` therefore listen on
> `release: [created, published]` **and** `push: tags: ['v*']` **and**
> `workflow_dispatch`. The tag-push trigger fires regardless of who
> created the tag; the `workflow_dispatch` form takes a `tag` input
> so you can rerun by hand if needed (Actions tab → workflow → Run
> workflow → enter `vX.Y.Z`).

## First-time Chrome Web Store setup

The first version has to be uploaded manually because publishing
needs an existing listing for the API to target.

1. Sign in at <https://chrome.google.com/webstore/devconsole> with
   the developer account that paid the one-time $5 fee.
2. Click **New item** and upload
   `releases/linkstash-extension-v0.1.0.zip`.
3. Fill in the listing fields from
   [`docs/store/listing.md`](store/listing.md):
   - Name, short description, detailed description.
   - Single-purpose statement.
   - Per-permission justifications.
   - Category (Productivity), language (English).
   - Screenshots from
     [`docs/store/screenshots/`](store/screenshots/) — drop the two
     1280×800 PNGs in.
   - Privacy policy URL: the GitHub-hosted
     [`PRIVACY.md`](../PRIVACY.md) is the default; replace if you
     prefer a self-hosted page.
   - Distribution: Public.
4. Submit for review. First reviews typically come back within a
   few business days.
5. Once published, copy the extension ID (the long random-looking
   string in the listing URL) — you'll need it for automation.

## Automating subsequent releases

After the listing exists, every later version can be auto-published
by `.github/workflows/publish.yml`. One-time prep:

1. **Google Cloud OAuth client** —
   <https://console.cloud.google.com/apis/credentials>:
   - Create a new project (or pick an existing one).
   - Enable the **Chrome Web Store API**.
   - Create an **OAuth 2.0 Client ID** of type **Desktop app**.
   - Note the **client ID** and **client secret**.
2. **Refresh token** — generate once via the OAuth playground or
   `chrome-webstore-upload-cli`'s `auth` command:
   ```bash
   npx chrome-webstore-upload-cli@3 auth \
       --client-id "<CLIENT_ID>" \
       --client-secret "<CLIENT_SECRET>"
   ```
   Sign in with the developer account, accept the consent screen,
   copy the refresh token from the redirect URL.
3. **Repo secrets** —
   `Settings → Secrets and variables → Actions → New repository
   secret`:
   - `CWS_EXTENSION_ID` — the listing ID from step 5 above.
   - `CWS_CLIENT_ID` — from step 1.
   - `CWS_CLIENT_SECRET` — from step 1.
   - `CWS_REFRESH_TOKEN` — from step 2.

After those secrets are set, the next time `release` creates a
non-prerelease, `publish.yml` will package, upload, and submit for
auto-publish without further intervention.

The `--auto-publish` flag tells the API to push the new version live
as soon as it passes review. To run a staged rollout instead, drop
that flag from the workflow — the upload will land in the dev
console for manual approval.

## Rolling back

The store doesn't support direct rollback. To revert:

1. Tag a hotfix version (`vX.Y.Z+1`) that re-applies the previous
   build's behaviour.
2. Push as a normal release. Auto-publish handles the rest.

For an emergency, **Pause** in the dev console removes the listing
from search until you re-publish.
