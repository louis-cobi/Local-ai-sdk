# local-ai-sdk

Stateful on-device LLM runtime: seed KV (`n_predict: 0`), `saveSession` / `loadSession`, sliding window + summary + optional RAG, tools (`defineTool` / **`defineToolZod`**), multimodal user turns.

## What is bundled

This package **depends on** and **re-exports**:

- **`local-ai-sdk-llama`** — `createLlamaRNProvider`, `createSpeechSynthesizer`
- **`local-ai-sdk-models`** — `downloadModel`, `getModelPathIfCached`, `huggingFaceResolveUrl`

So a normal app installs **`local-ai-sdk`** + peer **`llama.rn`** (and optional **`react`** for `useLocalChat`). You do not need three separate imports unless you maintain a custom `LLMProvider` and want to omit the Llama adapter.

## Peers

- **`llama.rn`** (optional in `package.json` for pure-JS / mock tests; required at runtime for `createLlamaRNProvider`)
- **`react`** (optional; only for `useLocalChat`)

## Docs

Monorepo: [GETTING-STARTED](../../docs/GETTING-STARTED.md) · [POLYFILLS](../../docs/POLYFILLS.md) · [PUBLISHING](../../docs/PUBLISHING.md)
