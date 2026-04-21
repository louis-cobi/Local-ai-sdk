import { describe, expect, it } from 'vitest';
import { tryParseJsonToolCall } from '../src/core/tool-json.js';

describe('tryParseJsonToolCall', () => {
  it('parses tool_call objects', () => {
    const t = tryParseJsonToolCall('{"tool_call":{"name":"x","args":{"a":1}}}');
    expect(t).toEqual({ name: 'x', args: { a: 1 } });
  });

  it('returns null for plain text', () => {
    expect(tryParseJsonToolCall('hello')).toBeNull();
  });
});
