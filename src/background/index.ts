import { LinkStashClient, isLinkStashError } from '../lib/api';
import { readSettings, watchSettings, type Settings } from '../lib/settings';

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

chrome.runtime.onInstalled.addListener(() => {
  void chrome.tabs.query({ active: true }).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) debouncedUpdate(tab.id, tab.url);
    }
  });
});
