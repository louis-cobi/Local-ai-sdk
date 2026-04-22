# local-ai-sdk

Stateful on-device LLM runtime: seed KV (`n_predict: 0`), `saveSession` / `loadSession`, sliding window + summary + optional RAG, tools (`defineTool` / **`defineToolZod`**), multimodal user turns.

`defineToolZod` targets Zod v4 (`z.toJSONSchema`).

## What is bundled

This package **depends on** and **re-exports**:

- **`local-ai-sdk-llama`** — `createLlamaRNProvider`, `createSpeechSynthesizer`
- **`local-ai-sdk-models`** — `downloadModel`, `getModelPathIfCached`, `huggingFaceResolveUrl`

So a normal app installs **`local-ai-sdk`** + peer **`llama.rn`** (and optional **`react`** for `useLocalChat`). You do not need three separate imports unless you maintain a custom `LLMProvider` and want to omit the Llama adapter.

Provider contracts are capability-based: base runtime is minimal, advanced features are optional capabilities.

## Peers

- **`llama.rn`** (optional in `package.json` for pure-JS / mock tests; required at runtime for `createLlamaRNProvider`)
- **`react`** (optional; only for `useLocalChat`)

## Docs

Monorepo:

- [GETTING-STARTED](../../docs/GETTING-STARTED.md)
- [Core Engine API](../../docs/api/core-engine.md)
- [Types](../../docs/api/types.md)
- [Provider Contracts](../../docs/api/providers.md)
- [React Bindings API](../../docs/api/react.md)
- [Llama Adapter API](../../docs/api/llama.md)
- [Model Download API](../../docs/api/models.md)
- [POLYFILLS](../../docs/POLYFILLS.md)
- [PUBLISHING](../../docs/PUBLISHING.md)
