// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bookmark } from '../lib/api';
import { renderToast, toastTextFor } from './toast';

const fullBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
  id: 1,
  url: 'https://example.tld/x',
  title: 'X',
  description: '',
  tags: [],
  favorite: false,
  public: false,
  created: '2026-05-01T00:00:00+00:00',
  modified: '2026-05-01T00:00:00+00:00',
  ...overrides,
});

describe('toastTextFor', () => {
  it('says "Saved" on a fresh create', () => {
    expect(
      toastTextFor({ ok: true, kind: 'create', result: { bookmark: fullBookmark(), existing: false } }),
    ).toEqual({ text: 'Saved to LinkStash', kind: 'success' });
  });

  it('says "Already in" when the create idempotently re-saved', () => {
    expect(
      toastTextFor({ ok: true, kind: 'create', result: { bookmark: fullBookmark(), existing: true } }),
    ).toEqual({ text: 'Already in LinkStash', kind: 'success' });
  });

  it('says "Updated" on update', () => {
    expect(toastTextFor({ ok: true, kind: 'update', bookmark: fullBookmark() })).toEqual({
      text: 'Updated in LinkStash',
      kind: 'success',
    });
  });

  it('says "Removed" on delete', () => {
    expect(toastTextFor({ ok: true, kind: 'delete' })).toEqual({
      text: 'Removed from LinkStash',
      kind: 'success',
    });
  });

  it('surfaces the server message verbatim on error', () => {
    expect(
      toastTextFor({
        ok: false,
        error: {
          kind: 'auth',
          status: 403,
          code: 'linkstash_forbidden',
          message: 'You are not allowed to create or modify bookmarks.',
        },
      }),
    ).toEqual({
      text: 'LinkStash: You are not allowed to create or modify bookmarks.',
      kind: 'error',
    });
  });
});

describe('renderToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appends a single toast element with the message', () => {
    renderToast('Saved to LinkStash', 'success');
    const el = document.getElementById('__linkstash_toast__');
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain('Saved to LinkStash');
  });

  it('replaces a stale toast on a second call rather than stacking', () => {
    renderToast('first', 'success');
    renderToast('second', 'error');
    const all = document.querySelectorAll('#__linkstash_toast__');
    expect(all).toHaveLength(1);
    expect(all[0]?.textContent).toContain('second');
  });

  it('removes itself after the dismiss timeout', () => {
    renderToast('Saved to LinkStash', 'success');
    expect(document.getElementById('__linkstash_toast__')).not.toBeNull();
    vi.advanceTimersByTime(2600 + 280 + 5);
    expect(document.getElementById('__linkstash_toast__')).toBeNull();
  });

  it('uses different background colour for success vs error', () => {
    renderToast('ok', 'success');
    const successBg = (document.getElementById('__linkstash_toast__') as HTMLElement).style.background;
    document.body.innerHTML = '';
    renderToast('boom', 'error');
    const errorBg = (document.getElementById('__linkstash_toast__') as HTMLElement).style.background;
    expect(successBg).not.toBe('');
    expect(errorBg).not.toBe('');
    expect(successBg).not.toBe(errorBg);
  });
});
