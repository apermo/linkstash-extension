import { describe, expect, it } from 'vitest';
import { currentToken, replaceToken } from './tags';

describe('currentToken', () => {
  it('returns an empty token at the start of an empty value', () => {
    expect(currentToken('', 0)).toEqual({ prefix: '', start: 0, end: 0 });
  });

  it('returns the full value when there are no commas', () => {
    expect(currentToken('java', 4)).toEqual({ prefix: 'java', start: 0, end: 4 });
  });

  it('returns just the active token when the caret sits inside the second one', () => {
    const v = 'js, react';
    const ctx = currentToken(v, v.length);
    expect(ctx.prefix).toBe('react');
    expect(v.slice(ctx.start, ctx.end)).toBe('react');
  });

  it('skips leading whitespace inside a token so the prefix is trimmed', () => {
    const v = 'js,  react';
    const ctx = currentToken(v, v.length);
    expect(ctx.prefix).toBe('react');
  });

  it('treats the token after the last comma as empty when the caret is at end with trailing comma', () => {
    const v = 'js,';
    expect(currentToken(v, v.length)).toEqual({ prefix: '', start: 3, end: 3 });
  });
});

describe('replaceToken', () => {
  it('replaces the first token and adds a trailing separator when none follows', () => {
    const v = 'rea';
    const ctx = currentToken(v, 3);
    expect(replaceToken(v, ctx, 'react')).toBe('react, ');
  });

  it('replaces a middle token without disturbing the surrounding ones', () => {
    const v = 'js, rea, frontend';
    const ctx = currentToken(v, 7);
    expect(ctx.prefix).toBe('rea');
    expect(replaceToken(v, ctx, 'react')).toBe('js, react, frontend');
  });

  it('preserves the existing trailing comma when present', () => {
    const v = 'js, rea,';
    const ctx = currentToken(v, 7);
    expect(replaceToken(v, ctx, 'react')).toBe('js, react,');
  });
});
