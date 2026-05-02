export interface TokenContext {
  /** The token currently being edited (the substring between the previous comma and the caret). */
  prefix: string;
  /** Index in the full string where the current token starts. */
  start: number;
  /** Index in the full string where the current token ends (exclusive). */
  end: number;
}

const isWs = (ch: string) => ch === ' ' || ch === '\t';

export const currentToken = (value: string, caret: number): TokenContext => {
  const safeCaret = Math.max(0, Math.min(caret, value.length));

  let start = safeCaret;
  while (start > 0 && value[start - 1] !== ',') start--;
  while (start < safeCaret && isWs(value[start] ?? '')) start++;

  let end = safeCaret;
  while (end < value.length && value[end] !== ',') end++;
  while (end > start && isWs(value[end - 1] ?? '')) end--;

  return { prefix: value.slice(start, end), start, end };
};

export const replaceToken = (value: string, ctx: TokenContext, replacement: string): string => {
  const before = value.slice(0, ctx.start);
  const after = value.slice(ctx.end);
  const trailing = after.startsWith(',') || after === '' ? after : `,${after}`;
  const rest = trailing === '' ? ', ' : trailing;
  return `${before}${replacement}${rest}`;
};
