import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LinkStashClient,
  isLinkStashError,
  type Bookmark,
  type LinkStashErrorKind,
} from './api';

const HOST = 'https://bookmarks.example.tld';
const TOKEN = 'tkn-abc';

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

const ok = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

const err = (status: number, body: { code: string; message: string }) =>
  new Response(JSON.stringify({ ...body, data: { status } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('LinkStashClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const client = () => new LinkStashClient(HOST, TOKEN);

  it('attaches the bearer token and JSON accept header to every request', async () => {
    fetchMock.mockResolvedValueOnce(ok({ exists: false }));
    await client().check('https://example.tld/x');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect((init.headers as Record<string, string>).Accept).toBe('application/json');
  });

  describe('check', () => {
    it('encodes the URL and returns { exists, id }', async () => {
      fetchMock.mockResolvedValueOnce(ok({ exists: true, id: 7 }));
      const out = await client().check('https://example.tld/path?a=1');
      expect(out).toEqual({ exists: true, id: 7 });
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        `${HOST}/wp-json/linkstash/v1/check?url=${encodeURIComponent('https://example.tld/path?a=1')}`,
      );
    });

    it('returns { exists: false } when the API says so', async () => {
      fetchMock.mockResolvedValueOnce(ok({ exists: false }));
      await expect(client().check('https://example.tld')).resolves.toEqual({ exists: false });
    });
  });

  describe('create', () => {
    it('POSTs the bookmark input and surfaces existing=false on 201', async () => {
      fetchMock.mockResolvedValueOnce(ok(fullBookmark(), { status: 201 }));
      const result = await client().create({
        url: 'https://example.tld/x',
        title: 't',
        public: true,
      });
      expect(result.existing).toBe(false);
      expect(result.bookmark.id).toBe(42);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${HOST}/wp-json/linkstash/v1/bookmarks`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        url: 'https://example.tld/x',
        title: 't',
        public: true,
      });
    });

    it('flags existing=true when X-LinkStash-Existing is set on a 200 reply', async () => {
      fetchMock.mockResolvedValueOnce(
        ok(fullBookmark(), { status: 200, headers: { 'X-LinkStash-Existing': '1' } }),
      );
      const result = await client().create({ url: 'https://example.tld/x' });
      expect(result.existing).toBe(true);
    });
  });

  describe('get', () => {
    it('fetches a bookmark by id', async () => {
      fetchMock.mockResolvedValueOnce(ok(fullBookmark({ id: 99 })));
      const bm = await client().get(99);
      expect(bm.id).toBe(99);
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${HOST}/wp-json/linkstash/v1/bookmarks/99`);
    });
  });

  describe('update', () => {
    it('PATCHes only the supplied fields', async () => {
      fetchMock.mockResolvedValueOnce(ok(fullBookmark({ title: 'New' })));
      const bm = await client().update(42, { title: 'New' });
      expect(bm.title).toBe('New');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ title: 'New' });
    });
  });

  describe('remove', () => {
    it('DELETEs by id', async () => {
      fetchMock.mockResolvedValueOnce(ok({ deleted: true }));
      await client().remove(42);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${HOST}/wp-json/linkstash/v1/bookmarks/42`);
      expect(init.method).toBe('DELETE');
    });
  });

  describe('tags', () => {
    it('passes the prefix as a query param and returns the array', async () => {
      fetchMock.mockResolvedValueOnce(ok([{ id: 1, slug: 'js', name: 'JavaScript', count: 12 }]));
      const tags = await client().tags('ja');
      expect(tags).toHaveLength(1);
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${HOST}/wp-json/linkstash/v1/tags?q=ja`);
    });
  });

  describe('testConnection', () => {
    it('hits /check (the auth-gated endpoint) rather than /tags', async () => {
      fetchMock.mockResolvedValueOnce(ok({ exists: false }));
      await client().testConnection();
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/wp-json\/linkstash\/v1\/check\?url=/);
    });

    it('returns ok:true when /check responds 200', async () => {
      fetchMock.mockResolvedValueOnce(ok({ exists: false }));
      await expect(client().testConnection()).resolves.toEqual({ ok: true });
    });

    it('returns ok:false with auth reason on 401', async () => {
      fetchMock.mockResolvedValueOnce(err(401, { code: 'rest_forbidden', message: 'No.' }));
      const result = await client().testConnection();
      expect(result).toEqual({ ok: false, reason: 'auth', message: expect.any(String) });
    });

    it('returns ok:false with auth reason on 403 (read-only or unknown token)', async () => {
      fetchMock.mockResolvedValueOnce(
        err(403, { code: 'linkstash_forbidden', message: 'You are not allowed to read bookmarks.' }),
      );
      const result = await client().testConnection();
      expect(result).toEqual({
        ok: false,
        reason: 'auth',
        message: 'You are not allowed to read bookmarks.',
      });
    });

    it('returns ok:false with network reason when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('failed to fetch'));
      const result = await client().testConnection();
      expect(result).toEqual({ ok: false, reason: 'network', message: expect.any(String) });
    });
  });

  describe('error mapping', () => {
    const cases: Array<{ status: number; kind: LinkStashErrorKind }> = [
      { status: 401, kind: 'auth' },
      { status: 403, kind: 'auth' },
      { status: 404, kind: 'notFound' },
      { status: 500, kind: 'server' },
    ];

    for (const c of cases) {
      it(`maps status ${c.status} to a ${c.kind} error`, async () => {
        fetchMock.mockResolvedValueOnce(
          err(c.status, { code: 'x', message: 'boom' }),
        );
        try {
          await client().check('https://example.tld/x');
          expect.unreachable('should have thrown');
        } catch (e) {
          expect(isLinkStashError(e)).toBe(true);
          if (isLinkStashError(e)) {
            expect(e.kind).toBe(c.kind);
            expect(e.status).toBe(c.status);
          }
        }
      });
    }

    it('wraps fetch failures as network errors', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('offline'));
      try {
        await client().check('https://example.tld/x');
        expect.unreachable('should have thrown');
      } catch (e) {
        expect(isLinkStashError(e)).toBe(true);
        if (isLinkStashError(e)) expect(e.kind).toBe('network');
      }
    });
  });

  it('strips trailing slashes from the host so paths join cleanly', async () => {
    fetchMock.mockResolvedValueOnce(ok({ exists: false }));
    await new LinkStashClient(`${HOST}/`, TOKEN).check('https://example.tld');
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith(`${HOST}/wp-json/linkstash/v1/`)).toBe(true);
    expect(url.includes('//wp-json')).toBe(false);
  });
});
