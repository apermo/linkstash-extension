import { LinkStashClient, isLinkStashError } from '../lib/api';
import type { WriteErrorPayload, WriteRequest, WriteResponse } from '../lib/messages';
import { readSettings } from '../lib/settings';

const originPattern = (host: string): string => {
  const url = new URL(host);
  return `${url.protocol}//${url.host}/*`;
};

export const writeErrorPayload = (e: unknown): WriteErrorPayload => {
  if (isLinkStashError(e)) {
    return { kind: e.kind, status: e.status, code: e.code, message: e.message };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { kind: 'network', status: 0, code: 'unknown', message };
};

export const performWrite = async (
  request: WriteRequest,
  client: LinkStashClient,
): Promise<WriteResponse> => {
  if (request.kind === 'create') {
    const result = await client.create(request.input);
    return { ok: true, kind: 'create', result };
  }
  if (request.kind === 'update') {
    const bookmark = await client.update(request.id, request.patch);
    return { ok: true, kind: 'update', bookmark };
  }
  await client.remove(request.id);
  return { ok: true, kind: 'delete' };
};

export const handleWrite = async (request: WriteRequest): Promise<WriteResponse> => {
  const settings = await readSettings();
  if (!settings) {
    return {
      ok: false,
      error: {
        kind: 'config',
        status: 0,
        code: 'no_settings',
        message: 'LinkStash is not configured. Open the options page first.',
      },
    };
  }
  if (!(await chrome.permissions.contains({ origins: [originPattern(settings.host)] }))) {
    return {
      ok: false,
      error: {
        kind: 'permission',
        status: 0,
        code: 'no_host_permission',
        message: 'Grant host permission in the options page first.',
      },
    };
  }
  const client = new LinkStashClient(settings.host, settings.token);
  try {
    return await performWrite(request, client);
  } catch (e) {
    return { ok: false, error: writeErrorPayload(e) };
  }
};

export const notificationFor = (
  resp: WriteResponse,
  fallbackUrl?: string,
): { title: string; message: string } => {
  if (!resp.ok) {
    return { title: 'LinkStash error', message: resp.error.message };
  }
  if (resp.kind === 'create') {
    const subtitle = resp.result.bookmark.title || resp.result.bookmark.url || fallbackUrl || '';
    return {
      title: resp.result.existing ? 'Updated in LinkStash' : 'Saved to LinkStash',
      message: subtitle,
    };
  }
  if (resp.kind === 'update') {
    return { title: 'Updated in LinkStash', message: resp.bookmark.title || resp.bookmark.url };
  }
  return { title: 'Removed from LinkStash', message: '' };
};
