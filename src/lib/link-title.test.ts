import { describe, expect, it } from 'vitest';
import { fallbackTitle } from './link-title';

describe('fallbackTitle', () => {
  it('prefers a non-empty selection over anything else', () => {
    expect(
      fallbackTitle('https://example.tld/article', {
        selection: 'How to ship MV3',
        anchor: 'Anchor text',
      }),
    ).toBe('How to ship MV3');
  });

  it('falls back to anchor text when the selection is empty', () => {
    expect(
      fallbackTitle('https://example.tld/article', {
        selection: '   ',
        anchor: 'Anchor text',
      }),
    ).toBe('Anchor text');
  });

  it('uses the last URL segment when neither selection nor anchor is provided', () => {
    expect(fallbackTitle('https://example.tld/articles/how-to-ship-mv3')).toBe(
      'how-to-ship-mv3',
    );
  });

  it('decodes percent-encoded segments', () => {
    expect(fallbackTitle('https://example.tld/articles/Hello%20World')).toBe(
      'Hello World',
    );
  });

  it('falls back to the host when the path is empty', () => {
    expect(fallbackTitle('https://example.tld/')).toBe('example.tld');
  });

  it('caps very long selections so the API does not get a novel', () => {
    const long = 'x'.repeat(500);
    const out = fallbackTitle('https://example.tld', { selection: long });
    expect(out.length).toBe(200);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns the raw URL if URL parsing fails', () => {
    expect(fallbackTitle('not-a-url')).toBe('not-a-url');
  });
});
