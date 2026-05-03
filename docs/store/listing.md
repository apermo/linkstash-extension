# Chrome Web Store Listing Copy

Drop the strings below straight into the Chrome Web Store developer
console form fields when submitting a new version.

## Name

`LinkStash`

## Short description (≤ 132 characters)

> Save the current tab to your self-hosted LinkStash WordPress
> bookmark plugin in one click. Edit, tag, and revisit later.

(126 characters)

## Category

`Productivity`

## Language

`English (United States)`

## Detailed description

```
LinkStash is the companion browser extension for the LinkStash
WordPress plugin (https://github.com/apermo/linkstash) — a
self-hosted bookmark manager that lives in your own WordPress
install instead of someone else's cloud.

Click the toolbar icon on any tab to save it to your LinkStash with
one click. The popup prefills the title and URL from the active tab,
lets you add a description, comma-separated tags (with live
autocomplete from your existing tag list), and choose between public
and private visibility. Pages you've already saved open in edit
mode, prefilled from the API — change anything, hit Update, done. A
green ✓ on the action badge tells you at a glance which tabs are
already in your LinkStash.

Right-click any link on a page and pick "Save link to LinkStash" to
bookmark it without opening the popup. Right-click on a page (or
with text selected) and pick "Save page to LinkStash" to bookmark
the page itself; selected text becomes the title.

Because LinkStash is self-hosted, the extension only ever talks to
the WordPress install you configure on the options page. No
analytics, no telemetry, no third-party services. Your bookmarks
stay on your server.

REQUIRES
• A WordPress site running the LinkStash plugin (≥ v0.1.0), with
  the plugin activated.
• A LinkStash API token, generated from Tools → LinkStash in
  WP-Admin.
• WordPress permalinks set to anything other than "Plain"
  (Settings → Permalinks).

PERMISSIONS
• storage — to remember your host, token, and default visibility.
• activeTab — to read the current tab's URL and title when you
  click the action.
• contextMenus — to register the right-click save entries.
• scripting — to show a brief in-page confirmation pill after a
  save. The pill is a fixed-position DOM element that auto-dismisses
  after ~2.6 s; nothing else on the page is touched.
• Host access (granted at runtime) — to talk to the LinkStash host
  you configure. The extension asks Chrome for the specific origin
  you enter; you can deny.

OPEN SOURCE
GPL-2.0-or-later. Source, issue tracker, and changelog at
https://github.com/apermo/linkstash-extension.
```

## Single purpose statement

> The extension saves the current browser tab (or a right-clicked
> link) to a user-configured LinkStash WordPress install via that
> install's REST API.

## Permissions justifications

These map to the dev console's "Permissions justification" form. Use
verbatim.

### `storage`

> Persists the user's LinkStash host URL, API bearer token, and
> default visibility preference between sessions.

### `activeTab`

> Reads the active tab's URL and title when the user clicks the
> extension's action so the popup can prefill the save form for the
> page they're looking at.

### `contextMenus`

> Adds two right-click entries — "Save link to LinkStash" on links
> and "Save page to LinkStash" on pages — so the user can bookmark
> without opening the popup.

### `scripting`

> Used solely to inject a transient confirmation pill (a 2.6-second
> toast at the top of the active tab) after the user saves a
> bookmark. The injected function only manipulates the DOM — it
> creates a fixed-position element, animates it in and out, and
> removes itself. It does not read page content, intercept page
> scripts, or send anything from the page anywhere. Runs in the
> default isolated world. Source: `src/background/toast.ts`
> (`renderToast` is the injected function; `chrome.scripting.executeScript`
> is called from `showToastIn` only on save success/failure).

### `host_permissions` (declared as `optional_host_permissions: https://*/*`)

> The extension is a client for self-hosted LinkStash WordPress
> installs. Each user enters a different host on the options page,
> so the extension cannot ship a fixed `host_permissions` entry. It
> declares broad optional host access and uses
> `chrome.permissions.request` at runtime to ask Chrome for the
> specific origin the user typed in. Permission for any other host
> is never requested or used. The extension never sends data to any
> server other than the user-configured LinkStash host.

### Remote code use

> The extension does not load or execute remote code. The bundled
> JavaScript (under dist/) is the entire surface; all logic ships
> in the package. Network calls are limited to the user's
> LinkStash REST API and return JSON only.

## Data usage / disclosures

| Question | Answer |
|---|---|
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | **Yes** (bearer token, stored in `chrome.storage.sync` only, sent only to the user-configured LinkStash host) |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No |

Tick the disclosure that says authentication information **is**
handled, transmitted only to the configured server, and not sold or
used for purposes unrelated to the single purpose.

## Privacy policy URL

`https://github.com/apermo/linkstash-extension/blob/main/PRIVACY.md`

(or any URL the user prefers — paste it into this file before
submitting)

## Distribution

`Public` — anyone on the Chrome Web Store can install. The extension
is useless without a LinkStash WordPress install, so a public listing
will only get installs from people who actually want it.

## Screenshots

`docs/store/screenshots/popup-1280x800.png` and
`docs/store/screenshots/options-1280x800.png` — drop in as
screenshots 1 and 2.

Optional captions for the dev console image picker:
- Popup: "Save the current tab — title, description, tags, visibility, all in one form."
- Options: "Connect to your self-hosted LinkStash WordPress install."
