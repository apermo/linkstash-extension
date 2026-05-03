import { describe, expect, it, vi } from 'vitest';
import { isWriteEnvelope, sendWrite, type WriteResponse } from './messages';

describe('isWriteEnvelope', () => {
  it('accepts a properly tagged delete envelope', () => {
    expect(
      isWriteEnvelope({
        channel: 'linkstash/write',
        request: { kind: 'delete', id: 1 },
      }),
    ).toBe(true);
  });

  it('accepts a create envelope with the required url', () => {
    expect(
      isWriteEnvelope({
        channel: 'linkstash/write',
        request: { kind: 'create', input: { url: 'https://example.tld/x' } },
      }),
    ).toBe(true);
  });

  it('accepts an update envelope with id + patch object', () => {
    expect(
      isWriteEnvelope({
        channel: 'linkstash/write',
        request: { kind: 'update', id: 7, patch: { title: 'New' } },
      }),
    ).toBe(true);
  });

  it('rejects payloads with a different channel', () => {
    expect(isWriteEnvelope({ channel: 'unrelated', request: {} })).toBe(false);
  });

  it('rejects null and primitives', () => {
    expect(isWriteEnvelope(null)).toBe(false);
    expect(isWriteEnvelope('linkstash/write')).toBe(false);
  });

  it('rejects envelopes whose request is missing or wrong shape', () => {
    expect(isWriteEnvelope({ channel: 'linkstash/write' })).toBe(false);
    expect(isWriteEnvelope({ channel: 'linkstash/write', request: 'oops' })).toBe(false);
    expect(isWriteEnvelope({ channel: 'linkstash/write', request: { kind: 'whatever' } })).toBe(false);
  });

  it('rejects create requests without a url', () => {
    expect(
      isWriteEnvelope({
        channel: 'linkstash/write',
        request: { kind: 'create', input: {} },
      }),
    ).toBe(false);
  });

  it('rejects update requests with a non-numeric id', () => {
    expect(
      isWriteEnvelope({
        channel: 'linkstash/write',
        request: { kind: 'update', id: 'seven', patch: {} },
      }),
    ).toBe(false);
  });

  it('rejects originTabId values that are not a number', () => {
    expect(
      isWriteEnvelope({
        channel: 'linkstash/write',
        request: { kind: 'delete', id: 1 },
        originTabId: 'lots',
      }),
    ).toBe(false);
  });
});

describe('sendWrite', () => {
  it('wraps the request in the expected envelope and returns the SW response', async () => {
    const expected: WriteResponse = { ok: true, kind: 'delete' };
    const sendMessage = vi.fn().mockResolvedValue(expected);
    vi.stubGlobal('chrome', {
      runtime: { sendMessage },
    });
    try {
      const resp = await sendWrite({ kind: 'delete', id: 7 });
      expect(resp).toEqual(expected);
      expect(sendMessage).toHaveBeenCalledWith({
        channel: 'linkstash/write',
        request: { kind: 'delete', id: 7 },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('threads originTabId onto the envelope when provided', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, kind: 'delete' });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    try {
      await sendWrite({ kind: 'delete', id: 1 }, { originTabId: 42 });
      expect(sendMessage).toHaveBeenCalledWith({
        channel: 'linkstash/write',
        request: { kind: 'delete', id: 1 },
        originTabId: 42,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('omits originTabId from the envelope when undefined', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, kind: 'delete' });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    try {
      await sendWrite({ kind: 'delete', id: 1 }, { originTabId: undefined });
      const [envelope] = sendMessage.mock.calls[0] as [Record<string, unknown>];
      expect(envelope).not.toHaveProperty('originTabId');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
