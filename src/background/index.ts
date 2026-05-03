import { LinkStashClient, isLinkStashError } from '../lib/api';
import { fallbackTitle } from '../lib/link-title';
import { isWriteEnvelope } from '../lib/messages';
import { readSettings, watchSettings, type Settings } from '../lib/settings';
import { handleWrite } from './save';
import { showToastIn, showToastInActiveTab, toastTextFor } from './toast';

const MENU_ID_SAVE_LINK = 'linkstash:save-link';
const MENU_ID_SAVE_PAGE = 'linkstash:save-page';

const DEBOUNCE_MS = 500;

const debounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): ((...args: Args) => void) => {
  let handle: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => fn(...args), ms);
  };
};

const isHttpUrl = (url: string | undefined): url is string =>
  !!url && (url.startsWith('http://') || url.startsWith('https://'));

const setBadge = (tabId: number, saved: boolean | null) => {
  if (saved === true) {
    void chrome.action.setBadgeText({ tabId, text: '✓' });
    void chrome.action.setBadgeBackgroundColor({ tabId, color: '#1f8a4c' });
  } else {
    void chrome.action.setBadgeText({ tabId, text: '' });
  }
};

const updateBadgeForTab = async (tabId: number, url: string | undefined) => {
  if (!isHttpUrl(url)) {
    setBadge(tabId, null);
    return;
  }
  let settings: Settings | null;
  try {
    settings = await readSettings();
  } catch {
    settings = null;
  }
  if (!settings) {
    setBadge(tabId, null);
    return;
  }
  if (!(await chrome.permissions.contains({ origins: [originPattern(settings.host)] }))) {
    setBadge(tabId, null);
    return;
  }
  const client = new LinkStashClient(settings.host, settings.token);
  try {
    const result = await client.check(url);
    setBadge(tabId, result.exists);
  } catch (e) {
    if (!isLinkStashError(e)) {
      setBadge(tabId, null);
      return;
    }
    setBadge(tabId, null);
  }
};

const originPattern = (host: string): string => {
  const url = new URL(host);
  return `${url.protocol}//${url.host}/*`;
};

const debouncedUpdate = debounce(
  (tabId: number, url: string | undefined) => void updateBadgeForTab(tabId, url),
  DEBOUNCE_MS,
);

// Closed-tab races (tab dies between onActivated firing and tabs.get
// resolving) reject with "No tab with id N". Swallowing keeps Chrome's
// extension error log clean of stackless rejections that don't
// represent a real failure.
const swallow = () => {
  /* intentional */
};

const refreshActiveBadges = () => {
  chrome.tabs
    .query({ active: true })
    .then((tabs) => {
      for (const tab of tabs) {
        if (tab.id != null) debouncedUpdate(tab.id, tab.url);
      }
    })
    .catch(swallow);
};

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs
    .get(tabId)
    .then((tab) => {
      debouncedUpdate(tabId, tab.url);
    })
    .catch(swallow);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' && !changeInfo.url) return;
  debouncedUpdate(tabId, tab.url);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs
    .query({ active: true, windowId })
    .then(([tab]) => {
      if (tab?.id != null) debouncedUpdate(tab.id, tab.url);
    })
    .catch(swallow);
});

watchSettings(() => {
  refreshActiveBadges();
});

const ensureContextMenu = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID_SAVE_LINK,
      title: 'Save link to LinkStash',
      contexts: ['link'],
    });
    chrome.contextMenus.create({
      id: MENU_ID_SAVE_PAGE,
      title: 'Save page to LinkStash',
      contexts: ['page', 'selection'],
    });
  });
};

const onContextSave = async (
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined,
) => {
  let url: string | undefined;
  let pageTitle: string | undefined;
  if (info.menuItemId === MENU_ID_SAVE_LINK) {
    url = info.linkUrl;
  } else if (info.menuItemId === MENU_ID_SAVE_PAGE) {
    url = info.pageUrl ?? tab?.url;
    pageTitle = tab?.title;
  } else {
    return;
  }
  if (!url || !/^https?:\/\//i.test(url)) return;
  const tabId = tab?.id;
  const announce = (text: string, kind: 'success' | 'error') =>
    tabId != null ? showToastIn(tabId, text, kind) : showToastInActiveTab(text, kind);

  const settings = await readSettings();
  if (!settings) {
    void announce('LinkStash: configure the extension first', 'error');
    void chrome.runtime.openOptionsPage();
    return;
  }
  if (!(await chrome.permissions.contains({ origins: [originPattern(settings.host)] }))) {
    void announce('LinkStash: grant host permission in options first', 'error');
    void chrome.runtime.openOptionsPage();
    return;
  }
  const title =
    info.menuItemId === MENU_ID_SAVE_PAGE && pageTitle
      ? pageTitle
      : fallbackTitle(url, { selection: info.selectionText });
  const resp = await handleWrite({
    kind: 'create',
    input: { url, title, public: settings.defaultVisibility === 'public' },
  });
  const { text, kind } = toastTextFor(resp);
  void announce(text, kind);
  if (resp.ok) refreshActiveBadges();
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void onContextSave(info, tab);
});

// Popup → SW save channel. Routing writes through the SW means a
// pending fetch survives the popup closing (Chrome popup JS is killed
// the moment the popup loses focus); the SW also surfaces success or
// failure via an injected in-page toast so the user always sees a
// result, even after the popup is gone.
//
// Tab routing for the toast prefers, in order:
//   1. `envelope.originTabId` — the popup captures its tab at send
//      time, which is correct even if the user has switched tabs
//      while the fetch is in flight. `sender.tab` is undefined for
//      messages from extension pages (popup, options).
//   2. `sender.tab?.id` — populated for content-script messages,
//      accepted defensively.
//   3. The currently active tab — last-resort fallback.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!isWriteEnvelope(msg)) return undefined;
  const tabId = msg.originTabId ?? sender.tab?.id;
  void handleWrite(msg.request).then((resp) => {
    const { text, kind } = toastTextFor(resp);
    if (tabId != null) {
      void showToastIn(tabId, text, kind);
    } else {
      void showToastInActiveTab(text, kind);
    }
    if (resp.ok) refreshActiveBadges();
    sendResponse(resp);
  });
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenu();
  refreshActiveBadges();
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenu();
});
