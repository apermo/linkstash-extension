export interface Bookmark {
  id: number;
  url: string;
  title: string;
  description: string;
  tags: string[];
  favorite: boolean;
  public: boolean;
  created: string;
  modified: string;
}

export interface BookmarkInput {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
  favorite?: boolean;
  public?: boolean;
}

export interface BookmarkPatch {
  url?: string;
  title?: string;
  description?: string;
  tags?: string[];
  favorite?: boolean;
  public?: boolean;
}

export interface CheckResult {
  exists: boolean;
  id?: number;
}

export interface Tag {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export interface CreateResult {
  bookmark: Bookmark;
  existing: boolean;
}

export type LinkStashErrorKind = 'auth' | 'notFound' | 'server' | 'network';

export class LinkStashError extends Error {
  override readonly name = 'LinkStashError';
  constructor(
    readonly kind: LinkStashErrorKind,
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const isLinkStashError = (e: unknown): e is LinkStashError => e instanceof LinkStashError;

interface ApiErrorBody {
  code?: string;
  message?: string;
  data?: { status?: number };
}

const isErrorBody = (v: unknown): v is ApiErrorBody =>
  typeof v === 'object' && v !== null && ('code' in v || 'message' in v);

const kindFor = (status: number): LinkStashErrorKind => {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'notFound';
  return 'server';
};

const stripSlash = (s: string) => s.replace(/\/+$/, '');

export class LinkStashClient {
  private readonly base: string;

  constructor(
    host: string,
    private readonly token: string,
  ) {
    this.base = `${stripSlash(host)}/wp-json/linkstash/v1`;
  }

  async check(url: string): Promise<CheckResult> {
    const res = await this.request(`/check?url=${encodeURIComponent(url)}`);
    return (await res.json()) as CheckResult;
  }

  async create(input: BookmarkInput): Promise<CreateResult> {
    const res = await this.request('/bookmarks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const bookmark = (await res.json()) as Bookmark;
    const existing = res.headers.get('X-LinkStash-Existing') === '1';
    return { bookmark, existing };
  }

  async get(id: number): Promise<Bookmark> {
    const res = await this.request(`/bookmarks/${id}`);
    return (await res.json()) as Bookmark;
  }

  async update(id: number, patch: BookmarkPatch): Promise<Bookmark> {
    const res = await this.request(`/bookmarks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return (await res.json()) as Bookmark;
  }

  async remove(id: number): Promise<void> {
    await this.request(`/bookmarks/${id}`, { method: 'DELETE' });
  }

  async tags(prefix: string): Promise<Tag[]> {
    const res = await this.request(`/tags?q=${encodeURIComponent(prefix)}`);
    return (await res.json()) as Tag[];
  }

  async testConnection(): Promise<
    { ok: true } | { ok: false; reason: 'auth' | 'notFound' | 'server' | 'network'; message: string }
  > {
    // Hits /check (require_read_bookmarks → current_user_can('edit_posts')),
    // which is the same capability gate POST /bookmarks uses. /tags?q=
    // would 200 even for an anonymous request because of allow_anyone, so
    // a broken or read-only token would falsely report "Connection ok".
    try {
      await this.check('https://linkstash.invalid/connection-probe');
      return { ok: true };
    } catch (e) {
      if (isLinkStashError(e)) {
        return { ok: false, reason: e.kind, message: e.message };
      }
      return { ok: false, reason: 'network', message: e instanceof Error ? e.message : String(e) };
    }
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      // `credentials: 'omit'` is critical. Chrome extensions with host
      // permissions auto-attach the user's cookies to fetches, so a user
      // who's also logged into the WP admin would send both the Bearer
      // token *and* a `wordpress_logged_in_*` cookie. WP's
      // `rest_cookie_check_errors` then sees cookie auth without an
      // `X-WP-Nonce` header and forcibly demotes the request to
      // anonymous (`wp_set_current_user(0)`) before the permission
      // callback runs, producing a misleading 403 even though the token
      // itself is valid. Omitting credentials keeps the bearer-token
      // auth path clean.
      res = await fetch(`${this.base}${path}`, { ...init, headers, credentials: 'omit' });
    } catch (e) {
      throw new LinkStashError(
        'network',
        0,
        'network_error',
        e instanceof Error ? e.message : 'Network error',
      );
    }
    const contentType = res.headers.get('content-type') ?? '';
    const looksJson = contentType.includes('application/json');
    if (!res.ok) {
      const body: unknown = looksJson ? await res.json().catch(() => ({})) : {};
      const code = isErrorBody(body) && typeof body.code === 'string' ? body.code : 'http_error';
      const message =
        isErrorBody(body) && typeof body.message === 'string'
          ? body.message
          : `HTTP ${res.status}`;
      throw new LinkStashError(kindFor(res.status), res.status, code, message);
    }
    if (!looksJson && init.method !== 'DELETE') {
      throw new LinkStashError(
        'notFound',
        res.status,
        'not_json',
        'Server returned a non-JSON response — is the LinkStash plugin active and are pretty permalinks enabled?',
      );
    }
    return res;
  }
}
