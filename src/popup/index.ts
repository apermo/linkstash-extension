import { LinkStashClient, isLinkStashError, type Bookmark, type BookmarkInput } from '../lib/api';
import { readSettings, type Settings } from '../lib/settings';

type Mode = { kind: 'new'; url: string; title: string } | { kind: 'edit'; bookmark: Bookmark };

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
};

const states = {
  loading: $<HTMLDivElement>('#loading'),
  needsConfig: $<HTMLElement>('#needs-config'),
  needsPermission: $<HTMLElement>('#needs-permission'),
  form: $<HTMLFormElement>('#bookmark-form'),
};

const elements = {
  modeLabel: $<HTMLSpanElement>('#mode-label'),
  origin: $<HTMLSpanElement>('#origin'),
  title: $<HTMLInputElement>('#title'),
  description: $<HTMLTextAreaElement>('#description'),
  tags: $<HTMLInputElement>('#tags'),
  isPublic: $<HTMLInputElement>('#is-public'),
  status: $<HTMLParagraphElement>('#status'),
  save: $<HTMLButtonElement>('#save'),
  delete: $<HTMLButtonElement>('#delete'),
  openOptions: $<HTMLButtonElement>('#open-options'),
  openOptionsLink: $<HTMLButtonElement>('#open-options-link'),
  grant: $<HTMLButtonElement>('#grant'),
};

const showOnly = (state: keyof typeof states) => {
  for (const [name, el] of Object.entries(states)) {
    el.classList.toggle('hidden', name !== state);
  }
};

const setStatus = (text: string, kind: 'error' | 'success' | 'info' = 'info') => {
  elements.status.textContent = text;
  elements.status.classList.remove('error', 'success');
  if (kind === 'error') elements.status.classList.add('error');
  if (kind === 'success') elements.status.classList.add('success');
};

const parseTags = (raw: string): string[] =>
  raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

const formatTags = (tags: string[]): string => tags.join(', ');

const originPattern = (host: string) => {
  const url = new URL(host);
  return `${url.protocol}//${url.host}/*`;
};

const ensurePermission = async (host: string): Promise<boolean> =>
  chrome.permissions.contains({ origins: [originPattern(host)] });

const requestPermission = async (host: string): Promise<boolean> =>
  chrome.permissions.request({ origins: [originPattern(host)] });

const activeTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) throw new Error('No active tab to save.');
  return { url: tab.url, title: tab.title ?? '' };
};

let mode: Mode | null = null;
let settings: Settings | null = null;
let client: LinkStashClient | null = null;

const renderMode = () => {
  if (!mode) return;
  if (mode.kind === 'new') {
    elements.modeLabel.textContent = 'New';
    elements.modeLabel.classList.remove('existing');
    elements.origin.textContent = mode.url;
    elements.title.value = mode.title;
    elements.description.value = '';
    elements.tags.value = '';
    elements.isPublic.checked = settings?.defaultVisibility === 'public';
    elements.delete.classList.add('hidden');
    elements.save.textContent = 'Save';
    setStatus('');
  } else {
    elements.modeLabel.textContent = 'Saved';
    elements.modeLabel.classList.add('existing');
    elements.origin.textContent = mode.bookmark.url;
    elements.title.value = mode.bookmark.title;
    elements.description.value = mode.bookmark.description;
    elements.tags.value = formatTags(mode.bookmark.tags);
    elements.isPublic.checked = mode.bookmark.public;
    elements.delete.classList.remove('hidden');
    elements.save.textContent = 'Update';
    setStatus('');
  }
};

const init = async () => {
  showOnly('loading');
  settings = await readSettings();
  if (!settings) {
    showOnly('needsConfig');
    return;
  }
  if (!(await ensurePermission(settings.host))) {
    showOnly('needsPermission');
    return;
  }
  client = new LinkStashClient(settings.host, settings.token);

  const tab = await activeTab();
  try {
    const checkResult = await client.check(tab.url);
    if (checkResult.exists && typeof checkResult.id === 'number') {
      const bookmark = await client.get(checkResult.id);
      mode = { kind: 'edit', bookmark };
    } else {
      mode = { kind: 'new', url: tab.url, title: tab.title };
    }
  } catch (e) {
    mode = { kind: 'new', url: tab.url, title: tab.title };
    setStatus(humanize(e), 'error');
  }

  showOnly('form');
  renderMode();
};

const humanize = (e: unknown): string => {
  if (isLinkStashError(e)) {
    if (e.kind === 'auth') return 'Token rejected — open options to reconfigure.';
    if (e.kind === 'notFound') return 'Endpoint not found — is the LinkStash plugin active?';
    if (e.kind === 'network') return 'Network error — check the host URL.';
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
};

const collectInput = (): BookmarkInput | null => {
  if (!mode) return null;
  const url = mode.kind === 'edit' ? mode.bookmark.url : mode.url;
  return {
    url,
    title: elements.title.value.trim(),
    description: elements.description.value,
    tags: parseTags(elements.tags.value),
    public: elements.isPublic.checked,
  };
};

states.form.addEventListener('submit', (e) => {
  e.preventDefault();
  void onSubmit();
});

const onSubmit = async () => {
  if (!client || !mode) return;
  const input = collectInput();
  if (!input) return;
  elements.save.disabled = true;
  setStatus('Saving…');
  try {
    if (mode.kind === 'new') {
      const result = await client.create(input);
      mode = { kind: 'edit', bookmark: result.bookmark };
      renderMode();
      setStatus(result.existing ? 'Updated existing bookmark.' : 'Saved.', 'success');
    } else {
      const updated = await client.update(mode.bookmark.id, input);
      mode = { kind: 'edit', bookmark: updated };
      renderMode();
      setStatus('Updated.', 'success');
    }
  } catch (e) {
    setStatus(humanize(e), 'error');
  } finally {
    elements.save.disabled = false;
  }
};

elements.delete.addEventListener('click', () => {
  void onDelete();
});

const onDelete = async () => {
  if (!client || mode?.kind !== 'edit') return;
  if (!confirm('Delete this bookmark?')) return;
  elements.delete.disabled = true;
  setStatus('Deleting…');
  try {
    await client.remove(mode.bookmark.id);
    const url = mode.bookmark.url;
    const title = mode.bookmark.title;
    mode = { kind: 'new', url, title };
    renderMode();
    setStatus('Deleted.', 'success');
  } catch (e) {
    setStatus(humanize(e), 'error');
  } finally {
    elements.delete.disabled = false;
  }
};

const openOptions = () => void chrome.runtime.openOptionsPage();
elements.openOptions.addEventListener('click', openOptions);
elements.openOptionsLink.addEventListener('click', openOptions);

elements.grant.addEventListener('click', () => {
  void (async () => {
    if (!settings) return;
    const granted = await requestPermission(settings.host);
    if (granted) await init();
  })();
});

void init();
