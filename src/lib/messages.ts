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

export const isWriteEnvelope = (v: unknown): v is WriteEnvelope =>
  typeof v === 'object' && v !== null && (v as { channel?: unknown }).channel === 'linkstash/write';

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
