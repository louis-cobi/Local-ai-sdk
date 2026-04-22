import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createEngine } from '../src/core/engine.js';
import { defineTool } from '../src/tools/define-tool.js';
import { defineToolZod } from '../src/tools/define-tool-zod.js';
import type { CompletionRequest, CompletionResult, LLMProvider } from '../src/providers/types.js';
import type { SessionStorageAdapter } from '../src/core/session-storage.js';
import { SESSION_META_VERSION } from '../src/core/session-meta.js';

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

    const completeCalls = (provider.complete as ReturnType<typeof vi.fn>).mock.calls;
    const secondReq = completeCalls[2]?.[0] as CompletionRequest;
    const assistantToolCallMsg = secondReq.messages.find((m) => m.role === 'assistant' && m.tool_calls);
    const toolResultMsg = secondReq.messages.find((m) => m.role === 'tool');

    expect(assistantToolCallMsg).toBeDefined();
    expect(toolResultMsg?.content).toBe('3');
  });

  it('remember/recall uses embeddings when available', async () => {
    const provider = mockProvider([{ res: { text: '', content: '', tool_calls: [] } }]);
    const engine = createEngine({ provider, systemPrompt: 'test', memory: { ragTopK: 2, maxMemoryChars: 2000 } });
    await engine.init();
    await engine.remember({ content: 'User likes tea' });
    const recall = await engine.recall('beverage preference');
    expect(recall.hits.length).toBeGreaterThan(0);
  });

  it('continues JSON tool mode when tool execution fails', async () => {
    const provider = mockProvider([
      { res: { text: '', content: '', tool_calls: [] } }, // prefill
      {
        res: {
          text: '{"tool_call":{"name":"missing_tool","args":{"x":1}}}',
          content: '{"tool_call":{"name":"missing_tool","args":{"x":1}}}',
          tool_calls: [],
        },
      },
      { res: { text: 'handled', content: 'handled', tool_calls: [] } },
    ]);

    const engine = createEngine({
      provider,
      systemPrompt: 'test',
      toolMode: 'json',
      memory: { windowSize: 4, summaryThreshold: 1000 },
    });
    await engine.init();
    const out = await engine.sendMessage('run');
    expect(out).toBe('handled');

    const completeCalls = (provider.complete as ReturnType<typeof vi.fn>).mock.calls;
    const secondReq = completeCalls[2]?.[0] as CompletionRequest;
    const toolResultMsg = secondReq.messages.find((m) => m.role === 'tool');

    expect(toolResultMsg).toBeDefined();
    expect(String(toolResultMsg?.content)).toContain('"ok":false');
    expect(String(toolResultMsg?.content)).toContain('Unknown tool');
  });

  it('native tool mode continues when tool validation fails', async () => {
    const tool = defineToolZod({
      name: 'mul',
      description: 'multiply',
      input: z.object({ a: z.number(), b: z.number() }),
      execute: async ({ a, b }) => a * b,
    });

    const provider = mockProvider([
      { res: { text: '', content: '', tool_calls: [] } },
      {
        res: {
          text: '',
          content: '',
          tool_calls: [
            {
              type: 'function',
              function: { name: 'mul', arguments: '{"a":3,"b":"oops"}' },
              id: 'c1',
            },
          ],
        },
      },
      { res: { text: 'recovered', content: 'recovered', tool_calls: [] } },
    ]);

    const engine = createEngine({
      provider,
      systemPrompt: 'test',
      tools: [tool],
      toolMode: 'native',
      memory: { windowSize: 4, summaryThreshold: 1000 },
    });
    await engine.init();
    const out = await engine.sendMessage('run');
    expect(out).toBe('recovered');

    const completeCalls = (provider.complete as ReturnType<typeof vi.fn>).mock.calls;
    const secondReq = completeCalls[2]?.[0] as CompletionRequest;
    const toolResultMsg = secondReq.messages.find((m) => m.role === 'tool');

    expect(toolResultMsg).toBeDefined();
    expect(String(toolResultMsg?.content)).toContain('"ok":false');
    expect(String(toolResultMsg?.content)).toContain('Invalid arguments');
  });

  it('auto-saves provider session every N turns', async () => {
    const provider = mockProvider([
      { res: { text: '', content: '', tool_calls: [] } }, // prefill
      { res: { text: 'r1', content: 'r1', tool_calls: [] } },
      { res: { text: 'r2', content: 'r2', tool_calls: [] } },
    ]);

    const engine = createEngine({
      provider,
      systemPrompt: 'test',
      session: {
        path: 'tmp/session.bin',
        autoSave: 2,
      },
      memory: { windowSize: 4, summaryThreshold: 1000 },
    });

    await engine.init();
    await engine.sendMessage('m1');
    await engine.sendMessage('m2');

    expect(provider.saveSession).toHaveBeenCalledTimes(2);
  });

  it('purges incompatible session artifacts and reseeds on init', async () => {
    const provider = mockProvider([{ res: { text: '', content: '', tool_calls: [] } }]);
    const files = new Map<string, string>([
      ['tmp/session.bin', 'binary-session'],
      [
        'tmp/session.bin.meta.json',
        JSON.stringify({
          version: SESSION_META_VERSION,
          seedHash: 'stale-seed-hash',
          summary: 'old',
          messages: [],
          logicalTurnCount: 7,
        }),
      ],
    ]);

    const storage: SessionStorageAdapter = {
      async readText(path: string) {
        return files.has(path) ? files.get(path)! : null;
      },
      async writeText(path: string, data: string) {
        files.set(path, data);
      },
      async exists(path: string) {
        return files.has(path);
      },
      async delete(path: string) {
        files.delete(path);
      },
    };

    const engine = createEngine({
      provider,
      systemPrompt: 'new prompt',
      session: {
        path: 'tmp/session.bin',
        storage,
      },
      memory: { windowSize: 4, summaryThreshold: 1000 },
    });

    await engine.init();

    expect(provider.loadSession).not.toHaveBeenCalled();
    await expect(storage.exists('tmp/session.bin')).resolves.toBe(false);
    await expect(storage.exists('tmp/session.bin.meta.json')).resolves.toBe(true);
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(provider.saveSession).toHaveBeenCalledTimes(1);
    const metaRaw = await storage.readText('tmp/session.bin.meta.json');
    expect(metaRaw).toBeTruthy();
    const meta = JSON.parse(metaRaw!);
    expect(meta.seedHash).not.toBe('stale-seed-hash');
    expect(meta.summary).toBe('');
    expect(meta.messages).toEqual([]);
    expect(meta.logicalTurnCount).toBe(0);
  });
});
