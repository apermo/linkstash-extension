/**
 * Picks the best available title for a context-menu link save.
 *
 * Preference order:
 *   1. The user's text selection (if any), trimmed and capped.
 *   2. The page's link text (anchor text), if a content script supplied it.
 *   3. Last segment of the URL pathname.
 *   4. The host.
 */
export const fallbackTitle = (
  url: string,
  options: { selection?: string | undefined; anchor?: string | undefined } = {},
): string => {
  const cap = (s: string) => (s.length > 200 ? `${s.slice(0, 199)}…` : s);
  const sel = options.selection?.trim();
  if (sel) return cap(sel);
  const anchor = options.anchor?.trim();
  if (anchor) return cap(anchor);
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last) return cap(decodeURIComponent(last));
    return u.host;
  } catch {
    return url;
  }
};
