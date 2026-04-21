# local-ai-sdk

Stateful, mobile-first helper library for running local LLMs via [`llama.rn`](https://github.com/mybigday/llama.rn).

## Goals

- **Stateful sessions**: prefill an immutable system/tools seed once (`n_predict: 0`), persist KV state with `saveSession` / `loadSession`.
- **Small prompts each turn**: inject `summary → RAG memory → short window → user` without re-sending the full system seed.
- **Tools**: native llama.rn tool calling (`tool_choice: 'auto'`) or a JSON fallback mode for smaller models.
- **Optional RAG**: `remember()` / `recall()` with an in-memory vector store (swap for SQLite-vec in your app).

## Install

```bash
npm install local-ai-sdk llama.rn react
```

`react` is optional unless you import `useLocalChat`.

## Quick start (React Native)

```ts
import { createEngine, createLlamaRNProvider, defineTool } from 'local-ai-sdk';

const timeTool = defineTool({
  name: 'get_time',
  description: 'Return the current time (ISO string).',
  parameters: { type: 'object', properties: {} },
  execute: async () => new Date().toISOString(),
});

const provider = createLlamaRNProvider({
  modelPath: 'file:///path/to/model.gguf',
  contextSize: 4096,
  n_gpu_layers: 99,
  ctx_shift: true,
  embedding: true, // required for remember/recall
});

const engine = createEngine({
  provider,
  systemPrompt: 'You are a concise on-device assistant.',
  tools: [timeTool],
  session: {
    path: '/absolute/path/to/session.bin',
    autoSave: true,
    // storage: myRnfsAdapter, // recommended in RN (Node uses fs automatically)
  },
  memory: { windowSize: 4, summaryThreshold: 20, ragTopK: 5 },
  seedExtras: ['file:///path/to/model.gguf', '4096'],
});

await engine.init();
await engine.sendMessage('What time is it?');
```

## Session metadata

Binary KV state is stored at `session.path`. Chat UI state (messages, summary, counters) is stored in a small JSON file next to it (default: `${session.path}.meta.json`). On React Native you should pass `session.storage` to read/write those files with your FS module.

## API surface (intentionally small)

- `createLlamaRNProvider`
- `createEngine` / `LocalFirstEngine`
- `defineTool`
- `useLocalChat`
- `InMemoryVectorStore` (bring your own persistent store when needed)

## Scripts

- `npm run build` – build ESM/CJS + types (`tsup`)
- `npm test` – unit tests (`vitest`)

## License

MIT
