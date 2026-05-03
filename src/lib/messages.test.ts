import { describe, expect, it, vi } from 'vitest';
import { isWriteEnvelope, sendWrite, type WriteResponse } from './messages';

describe('isWriteEnvelope', () => {
  it('accepts a properly tagged envelope', () => {
    expect(
      isWriteEnvelope({
        channel: 'linkstash/write',
        request: { kind: 'delete', id: 1 },
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
});
