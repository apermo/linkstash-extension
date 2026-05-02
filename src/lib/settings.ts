export type Visibility = 'private' | 'public';

export interface Settings {
  host: string;
  token: string;
  defaultVisibility: Visibility;
}

const KEYS = ['host', 'token', 'defaultVisibility'] as const satisfies readonly (keyof Settings)[];

const isVisibility = (v: unknown): v is Visibility => v === 'private' || v === 'public';

const normaliseHost = (host: string): string => host.replace(/\/+$/, '');

const parseSettings = (raw: Record<string, unknown>): Settings | null => {
  const { host, token, defaultVisibility } = raw;
  if (typeof host !== 'string' || host === '') return null;
  if (typeof token !== 'string' || token === '') return null;
  if (!isVisibility(defaultVisibility)) return null;
  return { host: normaliseHost(host), token, defaultVisibility };
};

const validate = (settings: Settings): void => {
  if (!settings.token) throw new Error('token must not be empty');
  let url: URL;
  try {
    url = new URL(settings.host);
  } catch {
    throw new Error('host must be a valid URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('host must use https');
  }
  if (!isVisibility(settings.defaultVisibility)) {
    throw new Error('defaultVisibility must be "private" or "public"');
  }
};

export const readSettings = async (): Promise<Settings | null> => {
  const raw = await chrome.storage.sync.get([...KEYS]);
  return parseSettings(raw);
};

export const writeSettings = async (settings: Settings): Promise<void> => {
  validate(settings);
  await chrome.storage.sync.set({
    host: normaliseHost(settings.host),
    token: settings.token,
    defaultVisibility: settings.defaultVisibility,
  });
};

export const patchSettings = async (patch: Partial<Settings>): Promise<Settings> => {
  const current = (await readSettings()) ?? {};
  const merged = { ...current, ...patch } as Settings;
  await writeSettings(merged);
  return { ...merged, host: normaliseHost(merged.host) };
};

export type SettingsChangeHandler = (settings: Settings | null) => void;

export const watchSettings = (handler: SettingsChangeHandler): (() => void) => {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: chrome.storage.AreaName,
  ): void => {
    if (areaName !== 'sync') return;
    if (!KEYS.some((k) => k in changes)) return;
    void readSettings().then(handler);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
};
