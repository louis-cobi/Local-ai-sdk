# Getting started (consumer app)

## Install (recommended)

The **`local-ai-sdk`** package includes the engine, the **`local-ai-sdk-llama`** adapter, and **`local-ai-sdk-models`** (Hugging Face downloads) as **dependencies** and re-exports their APIs from one entry point.

```bash
npm install local-ai-sdk llama.rn react
```

Peers: **`llama.rn`** (native runtime; required for `createLlamaRNProvider`), optional **`react`** (only if you use `useLocalChat`).

```ts
import {
  createEngine,
  createLlamaRNProvider,
  downloadModel,
} from 'local-ai-sdk';
```

## Why three packages still exist in the monorepo?

They are **implementation packages** linked by npm workspaces. Consumers normally install **`local-ai-sdk` only**; npm pulls `local-ai-sdk-llama` and `local-ai-sdk-models` automatically.

You might install a subpackage **alone** only for unusual setups (e.g. a headless Node tool that only needs `local-ai-sdk-models`, or a custom `LLMProvider` without Llama). That is optional.

## Deprecated: `local-ai-sdk-bundle`

It only re-exports `local-ai-sdk`. Prefer `local-ai-sdk` directly.

## How [React Native AI](https://github.com/callstackincubator/ai) (Callstack) does it

They ship **separate provider packages** (e.g. `@react-native-ai/llama` + `llama.rn` + often **`react-native-blob-util`**) and optional **`ai`** (Vercel AI SDK) — see [their README](https://github.com/callstackincubator/ai). Polyfills apply when using `ai`: [Polyfills – React Native AI](https://www.react-native-ai.dev/docs/polyfills).

This repo does **not** require the Vercel `ai` package. See [POLYFILLS.md](./POLYFILLS.md) for `react-native-blob-util` / Expo FileSystem options and polyfill guidance.

## Minimal example (React Native)

```ts
import { createEngine, defineTool, createLlamaRNProvider } from 'local-ai-sdk';

const provider = createLlamaRNProvider({
  modelPath: 'file:///absolute/path/model.gguf',
  contextSize: 4096,
  n_gpu_layers: 99,
  embedding: true,
});

const engine = createEngine({
  provider,
  systemPrompt: 'You are a helpful on-device assistant.',
  session: {
    path: '/absolute/path/session.kv.bin',
    storage: yourRnFsAdapter,
  },
});

await engine.init();
await engine.sendMessage('Hello');
```

## Main API surface (`local-ai-sdk`)

| Export | Purpose |
|--------|---------|
| `createEngine` / `LocalFirstEngine` | Stateful runtime: seed KV, turns, tools, summarization, optional session files |
| `createLlamaRNProvider` | From bundled llama adapter |
| `downloadModel` / `getModelPathIfCached` | From bundled models helper |
| `defineTool` / `defineToolZod` | Tool definitions |
| `buildTurnMessages` | Low-level turn assembly |
| `useLocalChat` | React hook |
| `remember` / `recall` / `embed` | When the provider exposes `embed()` |

## Multimodal user input

```ts
await engine.sendMessage({
  text: 'What is in this image?',
  mediaParts: [{ type: 'image', uri: 'file:///path/to/photo.jpg' }],
});
```

## Large model downloads on React Native / Expo

`local-ai-sdk-models` has a Node/Desktop default (`downloadModel`), plus RN adapters for large files:

- `createExpoFileSystemAdapter(...)` for Expo projects
- `createBlobUtilAdapter(...)` for bare RN / blob-util setups
- `downloadModelWithAdapter(...)` for a unified API

```ts
import * as FileSystem from 'expo-file-system';
import {
  createExpoFileSystemAdapter,
  downloadModelWithAdapter,
} from 'local-ai-sdk';

await downloadModelWithAdapter(
  { repoId: 'ggml-org/gemma-4-E2B-it-GGUF', filename: 'gemma-4-e2b-it-Q8_0.gguf' },
  {
    destinationDir: `${FileSystem.documentDirectory}models`,
    adapter: createExpoFileSystemAdapter(FileSystem),
  }
);
```

## Session metadata (React Native)

Binary KV lives at `session.path`. Chat UI state is JSON at `${session.path}.meta.json` by default. Pass `session.storage` with read/write/delete/exists backed by your FS module (Expo, RNFS, etc.). Node tests can omit it when `fs` is available.

## TypeScript

Types ship with each package (`dist/index.d.ts`). Ensure `moduleResolution` is `bundler` or `node16`/`nodenext` in your app `tsconfig` if you hit resolution issues.

## See also

- [Polyfills](./POLYFILLS.md) — `react-native-blob-util`, Vercel `ai`, RN polyfills  
- [Publishing](./PUBLISHING.md) — publish order for the monorepo  
- [Root README](https://github.com/Cobi/Local-ai-sdk/blob/main/README.md) — Gemma 4 notes and layout  
- [SDK roadmap](https://github.com/Cobi/Local-ai-sdk/blob/main/plan/SDK-ROADMAP.md) — architecture  
