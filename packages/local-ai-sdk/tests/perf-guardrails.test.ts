import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { createEngine } from '../src/core/engine.js';
import type { LLMProvider } from '../src/providers/types.js';

function createPerfProvider(): LLMProvider {
  return {
    async init() {},
    async dispose() {},
    async complete() {
      return { text: 'ok', content: 'ok', tool_calls: [] };
    },
    async stopCompletion() {},
    async embed(text: string) {
      return Array.from({ length: 32 }, (_, i) => ((text.length + i) % 10) / 10);
    },
  };
}

async function measureMs(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

describe('perf guardrails (soft thresholds)', () => {
  it('keeps sendMessage latency within a soft budget', async () => {
    const engine = createEngine({
      provider: createPerfProvider(),
      systemPrompt: 'perf',
      memory: { windowSize: 4, summaryThreshold: 1000 },
    });
    await engine.init();
    const elapsed = await measureMs(async () => {
      for (let i = 0; i < 20; i++) {
        await engine.sendMessage(`hello-${i}`);
      }
    });
    const avg = elapsed / 20;
    if (avg > 40) {
      // eslint-disable-next-line no-console
      console.warn(`[perf] sendMessage avg is high: ${avg.toFixed(2)}ms`);
    }
    expect(avg).toBeLessThan(120);
  });
});

