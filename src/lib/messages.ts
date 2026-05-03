import type { Bookmark, BookmarkInput, BookmarkPatch, LinkStashErrorKind } from './api';

export type WriteRequest =
  | { kind: 'create'; input: BookmarkInput }
  | { kind: 'update'; id: number; patch: BookmarkPatch }
  | { kind: 'delete'; id: number };

export interface WriteEnvelope {
  channel: 'linkstash/write';
  request: WriteRequest;
  /**
   * Tab id the request originated from, when the sender knows it.
   *
   * `chrome.runtime.MessageSender.tab` is only populated for messages
   * from content scripts; messages from the popup leave `sender.tab`
   * undefined. The popup therefore captures the active tab id at send
   * time so the SW can route the confirmation toast back to the same
   * tab even if the user has switched tabs by the time the fetch
   * resolves.
   */
  originTabId?: number;
}

export interface WriteErrorPayload {
  kind: LinkStashErrorKind | 'config' | 'permission';
  status: number;
  code: string;
  message: string;
}

export type CreateResult = { bookmark: Bookmark; existing: boolean };

export type WriteResponse =
  | { ok: true; kind: 'create'; result: CreateResult }
  | { ok: true; kind: 'update'; bookmark: Bookmark }
  | { ok: true; kind: 'delete' }
  | { ok: false; error: WriteErrorPayload };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const isWriteRequest = (v: unknown): v is WriteRequest => {
  if (!isObject(v)) return false;
  if (v.kind === 'create') return isObject(v.input) && typeof v.input.url === 'string';
  if (v.kind === 'update') return typeof v.id === 'number' && isObject(v.patch);
  if (v.kind === 'delete') return typeof v.id === 'number';
  return false;
};

export const isWriteEnvelope = (v: unknown): v is WriteEnvelope => {
  if (!isObject(v)) return false;
  if (v.channel !== 'linkstash/write') return false;
  if (!isWriteRequest(v.request)) return false;
  if ('originTabId' in v && typeof v.originTabId !== 'number' && v.originTabId !== undefined) {
    return false;
  }
  return true;
};

export const sendWrite = async (
  request: WriteRequest,
  options: { originTabId?: number | undefined } = {},
): Promise<WriteResponse> => {
  const envelope: WriteEnvelope = {
    channel: 'linkstash/write',
    request,
    ...(options.originTabId != null ? { originTabId: options.originTabId } : {}),
  };
  return chrome.runtime.sendMessage<WriteEnvelope, WriteResponse>(envelope);
};
