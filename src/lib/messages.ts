import type { Bookmark, BookmarkInput, BookmarkPatch, LinkStashErrorKind } from './api';

export type WriteRequest =
  | { kind: 'create'; input: BookmarkInput }
  | { kind: 'update'; id: number; patch: BookmarkPatch }
  | { kind: 'delete'; id: number };

export interface WriteEnvelope {
  channel: 'linkstash/write';
  request: WriteRequest;
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

export const sendWrite = async (request: WriteRequest): Promise<WriteResponse> => {
  const envelope: WriteEnvelope = { channel: 'linkstash/write', request };
  return chrome.runtime.sendMessage<WriteEnvelope, WriteResponse>(envelope);
};
