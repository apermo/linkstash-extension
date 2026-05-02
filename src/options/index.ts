import { LinkStashClient } from '../lib/api';
import { readSettings, writeSettings, type Settings, type Visibility } from '../lib/settings';

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
};

const form = $<HTMLFormElement>('#settings-form');
const hostInput = $<HTMLInputElement>('#host');
const tokenInput = $<HTMLInputElement>('#token');
const saveBtn = $<HTMLButtonElement>('#save');
const testBtn = $<HTMLButtonElement>('#test');
const status = $<HTMLParagraphElement>('#status');

const setStatus = (text: string, kind: 'error' | 'success' | 'info' = 'info') => {
  status.textContent = text;
  status.classList.remove('error', 'success');
  if (kind === 'error') status.classList.add('error');
  if (kind === 'success') status.classList.add('success');
};

const readVisibility = (): Visibility => {
  const v = (form.elements.namedItem('visibility') as RadioNodeList).value;
  return v === 'public' ? 'public' : 'private';
};

const setVisibility = (v: Visibility) => {
  for (const el of form.querySelectorAll<HTMLInputElement>('input[name="visibility"]')) {
    el.checked = el.value === v;
  }
};

const originPattern = (host: string): string => {
  const url = new URL(host);
  return `${url.protocol}//${url.host}/*`;
};

const requestHostPermission = async (host: string): Promise<boolean> => {
  const origins = [originPattern(host)];
  if (await chrome.permissions.contains({ origins })) return true;
  return chrome.permissions.request({ origins });
};

const load = async () => {
  const current = await readSettings();
  if (!current) return;
  hostInput.value = current.host;
  tokenInput.value = current.token;
  setVisibility(current.defaultVisibility);
};

const collect = (): Settings => ({
  host: hostInput.value.trim(),
  token: tokenInput.value.trim(),
  defaultVisibility: readVisibility(),
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  void onSave();
});

const onSave = async () => {
  const next = collect();
  saveBtn.disabled = true;
  try {
    if (!next.host || !/^https:\/\//i.test(next.host)) {
      setStatus('Host must be a full https:// URL.', 'error');
      return;
    }
    if (!next.token) {
      setStatus('A token is required.', 'error');
      return;
    }
    const granted = await requestHostPermission(next.host);
    if (!granted) {
      setStatus('Permission for that host was denied — settings not saved.', 'error');
      return;
    }
    await writeSettings(next);
    setStatus('Saved.', 'success');
  } catch (e) {
    setStatus(e instanceof Error ? e.message : String(e), 'error');
  } finally {
    saveBtn.disabled = false;
  }
};

testBtn.addEventListener('click', () => {
  void onTest();
});

const onTest = async () => {
  const next = collect();
  if (!next.host || !next.token) {
    setStatus('Fill in host and token before testing.', 'error');
    return;
  }
  if (!/^https:\/\//i.test(next.host)) {
    setStatus('Host must be a full https:// URL.', 'error');
    return;
  }
  testBtn.disabled = true;
  setStatus('Testing…');
  try {
    const granted = await requestHostPermission(next.host);
    if (!granted) {
      setStatus('Permission required to talk to that host.', 'error');
      return;
    }
    const result = await new LinkStashClient(next.host, next.token).testConnection();
    if (result.ok) {
      setStatus('Connection ok.', 'success');
    } else {
      const reason =
        result.reason === 'auth'
          ? 'Token rejected — check Tools → LinkStash.'
          : result.reason === 'notFound'
            ? 'Endpoint not found — is the LinkStash plugin active?'
            : result.reason === 'network'
              ? 'Network error — check the host URL.'
              : `Server error: ${result.message}`;
      setStatus(reason, 'error');
    }
  } catch (e) {
    setStatus(e instanceof Error ? e.message : String(e), 'error');
  } finally {
    testBtn.disabled = false;
  }
};

void load();
