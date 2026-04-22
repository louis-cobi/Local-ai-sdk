import { describe, expect, it } from 'vitest';
import { buildTurnMessages } from '../src/core/context-builder.js';

describe('buildTurnMessages', () => {
  it('orders summary, memory, window, then user input', () => {
    const msgs = buildTurnMessages({
      summary: 'S1',
      memoryBlock: 'M1',
      window: [
        { id: '1', role: 'user', content: 'u0' },
        { id: '2', role: 'assistant', content: 'a0' },
      ],
      userMessage: { id: '3', role: 'user', content: 'hello' },
    });
    expect(msgs.map((m) => m.role)).toEqual(['user', 'user', 'user', 'assistant', 'user']);
    expect(msgs[0].content).toContain('S1');
    expect(msgs[1].content).toContain('M1');
    expect(msgs.at(-1)?.content).toBe('hello');
  });

  it('includes multimodal user parts in window and current turn', () => {
    const msgs = buildTurnMessages({
      summary: '',
      memoryBlock: '',
      window: [
        {
          id: '1',
          role: 'user',
          content: 'see this',
          mediaParts: [{ type: 'image', uri: 'file:///a.jpg' }],
        },
      ],
      userMessage: {
        id: '2',
        role: 'user',
        content: 'and this',
        mediaParts: [{ type: 'image', uri: 'file:///b.jpg' }],
      },
    });
    expect(Array.isArray(msgs[0].content)).toBe(true);
    expect(Array.isArray(msgs[1].content)).toBe(true);
  });
});
