# local-ai-sdk

Local-first LLM runtime for React Native (`llama.rn`): stateful turns, session persistence, tool calling, summarization, and optional memory/RAG.

## Entrypoints

- `local-ai-sdk` - RN-safe core engine and shared runtime types/helpers
- `local-ai-sdk/react` - `useLocalChat`
- `local-ai-sdk/llama` - `createLlamaRNProvider` and speech helper
- `local-ai-sdk/models/node` - Node/Desktop downloader (`downloadModel`)
- `local-ai-sdk/models/rn` - React Native / Expo adapters (`downloadModelWithAdapter`)

## Install matrix

Install the package and only the peers required by your integration path.

### Core runtime + llama provider (React Native)

```bash
npm install local-ai-sdk llama.rn react-native expo
```

### React hook

```bash
npm install local-ai-sdk/react react
```

### Node/Desktop model download tooling

```bash
npm install local-ai-sdk
```

Use the `local-ai-sdk/models/node` import path.

## Notes

- `llama.rn` and `react-native` are runtime peers for the main RN integration path.
- `react` is only needed when using `local-ai-sdk/react`.
- `defineToolZod` targets Zod v4 (`z.toJSONSchema`).

## Docs

- [Getting Started](../../docs/GETTING-STARTED.md)
- [Core Engine API](../../docs/api/core-engine.md)
- [Provider Contracts](../../docs/api/providers.md)
- [Llama Adapter API](../../docs/api/llama.md)
- [Model Download API](../../docs/api/models.md)
- [Publishing](../../docs/PUBLISHING.md)
