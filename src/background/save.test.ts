import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkStashError, type Bookmark, type LinkStashClient } from '../lib/api';
import { installChromeStub } from '../test/chrome-stub';
import { handleWrite, performWrite, writeErrorPayload } from './save';

const VALID_SETTINGS = {
  host: 'https://bookmarks.example.tld',
  token: 'abc123',
  defaultVisibility: 'private' as const,
};

const fullBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
  id: 42,
  url: 'https://example.tld/article',
  title: 'Article',
  description: '',
  tags: [],
  favorite: false,
  public: false,
  created: '2026-05-01T00:00:00+00:00',
  modified: '2026-05-01T00:00:00+00:00',
  ...overrides,
});

describe('writeErrorPayload', () => {
  it('maps a LinkStashError to a structured payload', () => {
    const err = new LinkStashError('auth', 403, 'linkstash_forbidden', 'denied');
    expect(writeErrorPayload(err)).toEqual({
      kind: 'auth',
      status: 403,
      code: 'linkstash_forbidden',
      message: 'denied',
    });
  });

  it('maps a plain Error to a network kind with status 0', () => {
    expect(writeErrorPayload(new Error('boom'))).toEqual({
      kind: 'network',
      status: 0,
      code: 'unknown',
      message: 'boom',
    });
  });

  it('coerces non-Error throwables to a string message', () => {
    expect(writeErrorPayload('weird')).toEqual({
      kind: 'network',
      status: 0,
      code: 'unknown',
      message: 'weird',
    });
  });
});

describe('performWrite', () => {
  it('routes create requests to client.create and wraps the result', async () => {
    const bookmark = fullBookmark();
    const client = {
      create: vi.fn().mockResolvedValue({ bookmark, existing: false }),
      update: vi.fn(),
      remove: vi.fn(),
    } as unknown as LinkStashClient;
    const resp = await performWrite(
      { kind: 'create', input: { url: 'https://example.tld/x', title: 't' } },
      client,
    );
    expect(resp).toEqual({
      ok: true,
      kind: 'create',
      result: { bookmark, existing: false },
    });
  });

  it('routes update requests to client.update', async () => {
    const bookmark = fullBookmark({ title: 'New' });
    const client = {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(bookmark),
      remove: vi.fn(),
    } as unknown as LinkStashClient;
    const resp = await performWrite({ kind: 'update', id: 42, patch: { title: 'New' } }, client);
    expect(resp).toEqual({ ok: true, kind: 'update', bookmark });
  });

  it('routes delete requests to client.remove', async () => {
    const client = {
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
    } as unknown as LinkStashClient;
    const resp = await performWrite({ kind: 'delete', id: 7 }, client);
    expect(resp).toEqual({ ok: true, kind: 'delete' });
  });
});

describe('handleWrite', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installChromeStub();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a config error when settings are missing', async () => {
    (chrome.permissions.contains as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const resp = await handleWrite({
      kind: 'create',
      input: { url: 'https://example.tld/a' },
    });
    expect(resp.ok).toBe(false);
    if (!resp.ok) expect(resp.error.kind).toBe('config');
  });

  it('returns a permission error when host permission is not granted', async () => {
    await chrome.storage.sync.set(VALID_SETTINGS);
    (chrome.permissions.contains as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const resp = await handleWrite({
      kind: 'create',
      input: { url: 'https://example.tld/a' },
    });
    expect(resp.ok).toBe(false);
    if (!resp.ok) expect(resp.error.kind).toBe('permission');
  });

  it('passes through the LinkStashError kind on a 403 from POST', async () => {
    await chrome.storage.sync.set(VALID_SETTINGS);
    (chrome.permissions.contains as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'linkstash_forbidden',
          message: 'You are not allowed to create or modify bookmarks.',
          data: { status: 403 },
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    );
    const resp = await handleWrite({
      kind: 'create',
      input: { url: 'https://example.tld/a' },
    });
    expect(resp.ok).toBe(false);
    if (!resp.ok) {
      expect(resp.error.kind).toBe('auth');
      expect(resp.error.status).toBe(403);
      expect(resp.error.code).toBe('linkstash_forbidden');
    }
  });

  it('returns a successful create response when the server replies 201', async () => {
    await chrome.storage.sync.set(VALID_SETTINGS);
    (chrome.permissions.contains as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(fullBookmark()), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const resp = await handleWrite({
      kind: 'create',
      input: { url: 'https://example.tld/a' },
    });
    expect(resp.ok).toBe(true);
    if (resp.ok && resp.kind === 'create') {
      expect(resp.result.existing).toBe(false);
      expect(resp.result.bookmark.id).toBe(42);
    }
  });
});

