import { describe, expect, it, vi } from 'vitest';
import { createEngine } from '../src/core/engine.js';
import { defineTool } from '../src/tools/define-tool.js';
import type { CompletionRequest, CompletionResult, LLMProvider } from '../src/providers/types.js';

function mockProvider(script: Array<{ res: CompletionResult }>): LLMProvider {
  let i = 0;
  const sessions: string[] = [];
  return {
    init: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
    complete: vi.fn(async (req: CompletionRequest) => {
      const next = script[Math.min(i, script.length - 1)];
      i += 1;
      return { ...next.res, tool_calls: next.res.tool_calls ?? [] };
    }),
    saveSession: vi.fn(async (path: string) => {
      sessions.push(path);
    }),
    loadSession: vi.fn(async () => {}),
    stopCompletion: vi.fn(async () => {}),
    embed: vi.fn(async (text: string) => {
      return Array.from({ length: 8 }, (_, k) => (text.charCodeAt(0) + k) / 255);
    }),
  };
}

describe('LocalFirstEngine', () => {
  it('prefills seed on init when no session is configured', async () => {
    const provider = mockProvider([
      { res: { text: '', content: '', tool_calls: [] } }, // prefill
      { res: { text: 'hi', content: 'hi', tool_calls: [] } },
    ]);
    const engine = createEngine({
      provider,
      systemPrompt: 'You are a test assistant.',
      memory: { windowSize: 2, summaryThreshold: 1000 },
    });
    await engine.init();
    expect(provider.complete).toHaveBeenCalled();
    const first = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as CompletionRequest;
    expect(first.n_predict).toBe(0);
    expect(first.messages[0]?.role).toBe('system');

    const out = await engine.sendMessage('hello');
    expect(out).toBe('hi');
    expect(engine.getMessages().length).toBe(2);
  });

  it('runs JSON tool mode', async () => {
    const tool = defineTool({
      name: 'add',
      description: 'add numbers',
      parameters: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } },
      execute: async ({ a, b }) => (a as number) + (b as number),
    });

    const provider = mockProvider([
      { res: { text: '', content: '', tool_calls: [] } }, // prefill
      { res: { text: '{"tool_call":{"name":"add","args":{"a":1,"b":2}}}', content: '{"tool_call":{"name":"add","args":{"a":1,"b":2}}}', tool_calls: [] } },
      { res: { text: '3', content: '3', tool_calls: [] } },
    ]);

    const engine = createEngine({
      provider,
      systemPrompt: 'test',
      tools: [tool],
      toolMode: 'json',
      memory: { windowSize: 4, summaryThreshold: 1000 },
    });
    await engine.init();
    const out = await engine.sendMessage('compute');
    expect(out).toBe('3');
  });

  it('remember/recall uses embeddings when available', async () => {
    const provider = mockProvider([{ res: { text: '', content: '', tool_calls: [] } }]);
    const engine = createEngine({ provider, systemPrompt: 'test', memory: { ragTopK: 2, maxMemoryChars: 2000 } });
    await engine.init();
    await engine.remember({ content: 'User likes tea' });
    const recall = await engine.recall('beverage preference');
    expect(recall.hits.length).toBeGreaterThan(0);
  });
});
