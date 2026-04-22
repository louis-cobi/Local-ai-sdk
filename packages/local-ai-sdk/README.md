# local-ai-sdk

Stateful on-device LLM runtime: seed KV (`n_predict: 0`), `saveSession` / `loadSession`, sliding window + summary + optional RAG, tools (`defineTool` / **`defineToolZod`**), multimodal user turns.

`defineToolZod` targets Zod v4 (`z.toJSONSchema`).

## Single package runtime

This package ships the engine, llama.rn provider helpers, and Hugging Face download helpers in one npm package.

Install **`local-ai-sdk`** plus peers (`llama.rn`, `react-native`, `expo`; optional `react` for `useLocalChat`).

Provider contracts are capability-based: base runtime is minimal, advanced features are optional capabilities.

## Peers

- **`llama.rn >= 0.10.0`** (required at runtime for `createLlamaRNProvider`)
- **`react-native >= 0.79.0`**
- **`expo >= 53.0.0`** (recommended target runtime for this package matrix)
- **`react >= 19.0.0`** (optional; only for `useLocalChat`)

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
