import { LinkStashClient, isLinkStashError, type Bookmark, type BookmarkInput, type Tag } from '../lib/api';
import { sendWrite, type WriteErrorPayload, type WriteResponse } from '../lib/messages';
import { readSettings, type Settings } from '../lib/settings';
import { currentToken, replaceToken } from '../lib/tags';

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
  suggestions: $<HTMLUListElement>('#tag-suggestions'),
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

const humanizeWriteError = (err: WriteErrorPayload): string => {
  if (err.kind === 'auth') return 'Token rejected — open options to reconfigure.';
  if (err.kind === 'notFound') return 'Endpoint not found — is the LinkStash plugin active?';
  if (err.kind === 'network') return 'Network error — check the host URL.';
  if (err.kind === 'config' || err.kind === 'permission') return err.message;
  return err.message;
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
    let resp: WriteResponse;
    if (mode.kind === 'new') {
      resp = await sendWrite({ kind: 'create', input });
    } else {
      resp = await sendWrite({ kind: 'update', id: mode.bookmark.id, patch: input });
    }
    if (!resp.ok) {
      setStatus(humanizeWriteError(resp.error), 'error');
      return;
    }
    if (resp.kind === 'create') {
      mode = { kind: 'edit', bookmark: resp.result.bookmark };
      renderMode();
      setStatus(resp.result.existing ? 'Updated existing bookmark.' : 'Saved.', 'success');
    } else if (resp.kind === 'update') {
      mode = { kind: 'edit', bookmark: resp.bookmark };
      renderMode();
      setStatus('Updated.', 'success');
    }
  } catch (e) {
    // sendMessage throws if the SW is gone or there's no listener; the
    // SW's notification path covers the case where the popup closed
    // before the response arrived, so swallow silently here.
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
    const resp = await sendWrite({ kind: 'delete', id: mode.bookmark.id });
    if (!resp.ok) {
      setStatus(humanizeWriteError(resp.error), 'error');
      return;
    }
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

const SUGGEST_DEBOUNCE_MS = 200;
let suggestTimer: ReturnType<typeof setTimeout> | null = null;
let activeSuggestions: Tag[] = [];
let activeIndex = -1;

const hideSuggestions = () => {
  elements.suggestions.classList.add('hidden');
  elements.suggestions.replaceChildren();
  activeSuggestions = [];
  activeIndex = -1;
};

const renderSuggestions = (tags: Tag[]) => {
  activeSuggestions = tags;
  activeIndex = -1;
  elements.suggestions.replaceChildren(
    ...tags.map((tag, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.index = String(i);
      const name = document.createElement('span');
      name.textContent = tag.name || tag.slug;
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = String(tag.count);
      li.append(name, count);
      li.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        applySuggestion(i);
      });
      return li;
    }),
  );
  elements.suggestions.classList.toggle('hidden', tags.length === 0);
};

const setActive = (index: number) => {
  activeIndex = index;
  for (const li of elements.suggestions.querySelectorAll<HTMLLIElement>('li')) {
    li.setAttribute('aria-selected', String(Number(li.dataset.index) === index));
  }
};

const applySuggestion = (index: number) => {
  const tag = activeSuggestions[index];
  if (!tag) return;
  const value = elements.tags.value;
  const caret = elements.tags.selectionStart ?? value.length;
  const ctx = currentToken(value, caret);
  const next = replaceToken(value, ctx, tag.slug);
  elements.tags.value = next;
  const newCaret = ctx.start + tag.slug.length + 2;
  elements.tags.setSelectionRange(newCaret, newCaret);
  hideSuggestions();
  elements.tags.focus();
};

const fetchSuggestions = async () => {
  if (!client) return;
  const value = elements.tags.value;
  const caret = elements.tags.selectionStart ?? value.length;
  const ctx = currentToken(value, caret);
  if (ctx.prefix.length < 1) {
    hideSuggestions();
    return;
  }
  try {
    const tags = await client.tags(ctx.prefix);
    if (tags.length === 0) hideSuggestions();
    else renderSuggestions(tags.slice(0, 8));
  } catch {
    hideSuggestions();
  }
};

elements.tags.addEventListener('input', () => {
  if (suggestTimer) clearTimeout(suggestTimer);
  suggestTimer = setTimeout(() => void fetchSuggestions(), SUGGEST_DEBOUNCE_MS);
});

elements.tags.addEventListener('blur', () => {
  setTimeout(hideSuggestions, 100);
});

elements.tags.addEventListener('keydown', (ev) => {
  if (elements.suggestions.classList.contains('hidden')) return;
  if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    setActive(Math.min(activeIndex + 1, activeSuggestions.length - 1));
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    setActive(Math.max(activeIndex - 1, 0));
  } else if (ev.key === 'Enter' && activeIndex >= 0) {
    ev.preventDefault();
    applySuggestion(activeIndex);
  } else if (ev.key === 'Escape') {
    hideSuggestions();
  }
});

elements.grant.addEventListener('click', () => {
  void (async () => {
    if (!settings) return;
    const granted = await requestPermission(settings.host);
    if (granted) await init();
  })();
});

void init();
