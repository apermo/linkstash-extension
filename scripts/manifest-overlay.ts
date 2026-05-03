export type Browser = 'chrome' | 'firefox';

export const FIREFOX_GECKO_ID = 'linkstash@apermo.de';
export const FIREFOX_MIN_VERSION = '121.0';

export function isBrowser(value: string | undefined): value is Browser {
  return value === 'chrome' || value === 'firefox';
}

export function applyBrowserOverlay(
  base: Record<string, unknown>,
  browser: Browser,
): Record<string, unknown> {
  if (browser === 'chrome') {
    return { ...base };
  }

  const { minimum_chrome_version: _drop, ...rest } = base as {
    minimum_chrome_version?: string;
  } & Record<string, unknown>;

  return {
    ...rest,
    browser_specific_settings: {
      gecko: {
        id: FIREFOX_GECKO_ID,
        strict_min_version: FIREFOX_MIN_VERSION,
      },
    },
  };
}

export function outDirFor(browser: Browser): string {
  return browser === 'firefox' ? 'dist-firefox' : 'dist';
}
