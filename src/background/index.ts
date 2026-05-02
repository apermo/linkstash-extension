import { LinkStashClient, isLinkStashError } from '../lib/api';
import { fallbackTitle } from '../lib/link-title';
import { readSettings, watchSettings, type Settings } from '../lib/settings';

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

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs.get(tabId).then((tab) => {
    debouncedUpdate(tabId, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' && !changeInfo.url) return;
  debouncedUpdate(tabId, tab.url);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  void chrome.tabs.query({ active: true, windowId }).then(([tab]) => {
    if (tab?.id != null) debouncedUpdate(tab.id, tab.url);
  });
});

watchSettings(() => {
  void chrome.tabs.query({ active: true }).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) debouncedUpdate(tab.id, tab.url);
    }
  });
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
  const client = new LinkStashClient(settings.host, settings.token);
  try {
    const result = await client.create({
      url,
      title:
        info.menuItemId === MENU_ID_SAVE_PAGE && pageTitle
          ? pageTitle
          : fallbackTitle(url, { selection: info.selectionText }),
      public: settings.defaultVisibility === 'public',
    });
    notify(
      result.existing ? 'Updated in LinkStash' : 'Saved to LinkStash',
      result.bookmark.title || url,
    );
  } catch (e) {
    const message = isLinkStashError(e) ? e.message : e instanceof Error ? e.message : String(e);
    notify('LinkStash error', message);
  }
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void onContextSave(info, tab);
});

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenu();
  void chrome.tabs.query({ active: true }).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) debouncedUpdate(tab.id, tab.url);
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenu();
});
