import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStub } from '../test/chrome-stub';
import {
  patchSettings,
  readSettings,
  watchSettings,
  writeSettings,
  type Settings,
} from './settings';

const validSettings: Settings = {
  host: 'https://bookmarks.example.tld',
  token: 'abc123',
  defaultVisibility: 'private',
};

describe('settings', () => {
  beforeEach(() => {
    installChromeStub();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('readSettings', () => {
    it('returns null when nothing is stored', async () => {
      await expect(readSettings()).resolves.toBeNull();
    });

    it('returns the typed payload when fully populated', async () => {
      await writeSettings(validSettings);
      await expect(readSettings()).resolves.toEqual(validSettings);
    });

    it('returns null when only a subset of keys is present', async () => {
      await chrome.storage.sync.set({ host: 'https://bookmarks.example.tld' });
      await expect(readSettings()).resolves.toBeNull();
    });

    it('drops a malformed visibility value rather than coercing it', async () => {
      await chrome.storage.sync.set({
        host: 'https://bookmarks.example.tld',
        token: 'abc',
        defaultVisibility: 'public-ish',
      });
      await expect(readSettings()).resolves.toBeNull();
    });

    it('strips trailing slashes from the host on read', async () => {
      await chrome.storage.sync.set({
        host: 'https://bookmarks.example.tld/',
        token: 'abc',
        defaultVisibility: 'private',
      });
      const out = await readSettings();
      expect(out?.host).toBe('https://bookmarks.example.tld');
    });
  });

  describe('writeSettings', () => {
    it('rejects an empty token', async () => {
      await expect(writeSettings({ ...validSettings, token: '' })).rejects.toThrow(/token/i);
    });

    it('rejects a non-https host', async () => {
      await expect(
        writeSettings({ ...validSettings, host: 'http://bookmarks.example.tld' }),
      ).rejects.toThrow(/https/i);
    });

    it('persists valid settings', async () => {
      await writeSettings(validSettings);
      const persisted = await chrome.storage.sync.get(['host', 'token', 'defaultVisibility']);
      expect(persisted).toEqual(validSettings);
    });
  });

  describe('patchSettings', () => {
    it('merges into existing values and returns the result', async () => {
      await writeSettings(validSettings);
      const merged = await patchSettings({ defaultVisibility: 'public' });
      expect(merged).toEqual({ ...validSettings, defaultVisibility: 'public' });
    });

    it('refuses to merge if the result would be invalid', async () => {
      await writeSettings(validSettings);
      await expect(patchSettings({ token: '' })).rejects.toThrow(/token/i);
    });

    it('persists when patching from empty as long as the merged result is valid', async () => {
      const out = await patchSettings(validSettings);
      expect(out).toEqual(validSettings);
    });
  });

  describe('watchSettings', () => {
    it('fires when settings change in sync storage', async () => {
      const seen: (Settings | null)[] = [];
      const unsubscribe = watchSettings((s) => seen.push(s));
      await writeSettings(validSettings);
      await vi.waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]).toEqual(validSettings);
      unsubscribe();
    });

    it('reports null after the settings are partially cleared', async () => {
      await writeSettings(validSettings);
      const seen: (Settings | null)[] = [];
      const unsubscribe = watchSettings((s) => seen.push(s));
      await chrome.storage.sync.remove('token');
      await vi.waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]).toBeNull();
      unsubscribe();
    });

    it('ignores changes outside the sync area', async () => {
      const seen: (Settings | null)[] = [];
      const unsubscribe = watchSettings((s) => seen.push(s));
      await chrome.storage.session.set({ host: 'https://other.example.tld' });
      await new Promise((r) => setTimeout(r, 5));
      expect(seen).toHaveLength(0);
      unsubscribe();
    });

    it('stops firing after unsubscribe', async () => {
      const seen: (Settings | null)[] = [];
      const unsubscribe = watchSettings((s) => seen.push(s));
      unsubscribe();
      await writeSettings(validSettings);
      await new Promise((r) => setTimeout(r, 5));
      expect(seen).toHaveLength(0);
    });
  });
});
