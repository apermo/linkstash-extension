import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
import {
  applyBrowserOverlay,
  FIREFOX_GECKO_ID,
  FIREFOX_MIN_VERSION,
  isBrowser,
  outDirFor,
} from './manifest-overlay';

describe('applyBrowserOverlay', () => {
  it('returns the chrome manifest unchanged in shape', () => {
    const out = applyBrowserOverlay(manifest, 'chrome');
    expect(out).not.toHaveProperty('browser_specific_settings');
    expect(out.minimum_chrome_version).toBe(manifest.minimum_chrome_version);
    expect(out.manifest_version).toBe(3);
  });

  it('adds browser_specific_settings.gecko for firefox', () => {
    const out = applyBrowserOverlay(manifest, 'firefox') as Record<string, unknown> & {
      browser_specific_settings: { gecko: { id: string; strict_min_version: string } };
    };
    expect(out.browser_specific_settings.gecko).toEqual({
      id: FIREFOX_GECKO_ID,
      strict_min_version: FIREFOX_MIN_VERSION,
    });
  });

  it('strips minimum_chrome_version from the firefox manifest', () => {
    const out = applyBrowserOverlay(manifest, 'firefox');
    expect(out).not.toHaveProperty('minimum_chrome_version');
  });

  it('does not mutate the input', () => {
    const before = JSON.stringify(manifest);
    applyBrowserOverlay(manifest, 'firefox');
    expect(JSON.stringify(manifest)).toBe(before);
  });
});

describe('isBrowser', () => {
  it('accepts chrome and firefox', () => {
    expect(isBrowser('chrome')).toBe(true);
    expect(isBrowser('firefox')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isBrowser('safari')).toBe(false);
    expect(isBrowser('')).toBe(false);
    expect(isBrowser(undefined)).toBe(false);
  });
});

describe('outDirFor', () => {
  it('routes chrome to dist/ and firefox to dist-firefox/', () => {
    expect(outDirFor('chrome')).toBe('dist');
    expect(outDirFor('firefox')).toBe('dist-firefox');
  });
});
