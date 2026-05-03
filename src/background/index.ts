import { LinkStashClient, isLinkStashError } from '../lib/api';
import { fallbackTitle } from '../lib/link-title';
import { isWriteEnvelope, type WriteResponse } from '../lib/messages';
import { readSettings, watchSettings, type Settings } from '../lib/settings';
import { handleWrite, notificationFor } from './save';

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

const notify = (title: string, message: string) => {
  void chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('src/assets/icon-128.png'),
    title,
    message,
  });
};

const notifyResult = (resp: WriteResponse, fallbackUrl?: string) => {
  const { title, message } = notificationFor(resp, fallbackUrl);
  notify(title, message);
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
  const settings = await readSettings();
  if (!settings) {
    notify('LinkStash', 'Configure the extension first.');
    void chrome.runtime.openOptionsPage();
    return;
  }
  if (!(await chrome.permissions.contains({ origins: [originPattern(settings.host)] }))) {
    notify('LinkStash', 'Grant host permission in options first.');
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
  notifyResult(resp, url);
  if (resp.ok) refreshActiveBadges();
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void onContextSave(info, tab);
});

// Popup → SW save channel. Routing writes through the SW means a
// pending fetch survives the popup closing (Chrome popup JS is killed
// the moment the popup loses focus); the SW also surfaces success or
// failure via chrome.notifications so the user always sees a result.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!isWriteEnvelope(msg)) return undefined;
  void handleWrite(msg.request).then((resp) => {
    notifyResult(resp);
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
