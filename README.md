# local-ai-sdk (monorepo)

Stateful, mobile-first helpers for on-device LLMs.

| Package | Description |
| ------- | ----------- |
| [`local-ai-sdk`](packages/local-ai-sdk) | **Main install**: engine + llama.rn adapter helpers + HF download helpers |

## Documentation

| Doc | Contents |
| --- | -------- |
| [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) | Single-package install, API, multimodal, RN session storage |
| [docs/api/core-engine.md](docs/api/core-engine.md) | Engine class, factories, message/memory/session helpers |
| [docs/api/types.md](docs/api/types.md) | Core contracts and configuration types |
| [docs/api/providers.md](docs/api/providers.md) | Provider interface and completion payload contracts |
| [docs/api/react.md](docs/api/react.md) | React hook surface (`useLocalChat`) |
| [docs/api/llama.md](docs/api/llama.md) | llama.rn provider options and behavior |
| [docs/api/models.md](docs/api/models.md) | Download helpers, adapters, retry/cancel/checksum options |
| [docs/PUBLISHING.md](docs/PUBLISHING.md) | How to publish workspace packages to npm |
| [docs/POLYFILLS.md](docs/POLYFILLS.md) | `react-native-blob-util` vs Callstack; Vercel `ai` polyfills |
| [plan/SDK-ROADMAP.md](plan/SDK-ROADMAP.md) | Architecture and roadmap |

## Using this from another project

After publish:

```bash
npm install local-ai-sdk llama.rn react
```

```ts
import { createEngine, createLlamaRNProvider, downloadModel } from 'local-ai-sdk';
```

See [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

## Install (developing this repo)

```bash
npm install
npm run build
```

## Quick start

```ts
import { createEngine, createLlamaRNProvider, downloadModel } from 'local-ai-sdk';

const modelPath = await downloadModel({
  repoId: 'ggml-org/gemma-4-E2B-it-GGUF',
  filename: 'gemma-4-e2b-it-Q8_0.gguf',
  destinationDir: '/path/to/cache',
});

const provider = createLlamaRNProvider({
  modelPath: `file://${modelPath}`,
  contextSize: 8192,
  mmprojPath: 'file:///path/to/mmproj-gemma-4-e2b-it-f16.gguf',
  embedding: true,
});

const engine = createEngine({
  provider,
  systemPrompt: 'You are a concise on-device assistant.',
  seedExtras: ['gemma-4-e2b', '8192'],
});
await engine.init();
await engine.sendMessage({ text: 'Describe the image.', mediaParts: [{ type: 'image', uri: 'file:///path/to/photo.jpg' }] });
```

For RN/Expo large-file downloads, see adapter-based options in [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) (`createExpoFileSystemAdapter`, `createBlobUtilAdapter`, `downloadModelWithAdapter`).

## Supported versions

| Surface | Supported | Notes |
| ------- | --------- | ----- |
| Node.js | `>=18` | Packaging validation runs in `NodeNext` mode in CI. |
| Expo | `>=53` | New Architecture is expected in this target matrix. |
| React Native | `>=0.79` | Use adapter-based downloads (`expo-file-system` or `react-native-blob-util`). |
| llama.rn | `>=0.10.0` | New Architecture required by llama.rn from v0.10+. |
| Zod | `v4` | `defineToolZod` uses `z.toJSONSchema` from Zod v4. |

## Provider contract

- `LLMProvider` is capability-based: minimal core (`init`, `dispose`, `complete`, `stopCompletion`) + optional capabilities (`session`, `embedding`, `multimodal`, `vocoder`, `parallel`, `speech`).
- Optional `provider.capabilities` descriptor can advertise capability availability explicitly.
- `CompletionRequest` supports advanced inference controls (`top_k`, `top_p`, penalties, `grammar`, `response_format`, thinking controls, template kwargs, and related options).
- `TokenChunk` carries optional structured fields (`content`, `reasoning_content`, `tool_calls`, `accumulated_text`, `requestId`).

## Download reliability

- `downloadModel` now supports streaming writes, retry/backoff, optional `AbortSignal`, and optional SHA-256 validation.
- `downloadModelWithAdapter` keeps the same adapter flow for React Native and now accepts retry/signal/checksum options.
- `llama-swap` is a runtime orchestration concern (planned in V3), not the transport used by `local-ai-sdk` downloads.

## Gemma 4 (E2B / E4B) on device

- **E2B** and **E4B** are multimodal instruction-tuned models (text + image; small variants often support audio input). See the [Gemma 4 announcement](https://huggingface.co/blog/gemma4).
- You need the **main GGUF** and the matching **`mmproj`** file from the same Hugging Face repo (e.g. [ggml-org/gemma-4-E2B-it-GGUF](https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF)).
- Use a **realistic `n_ctx`** on phones (e.g. 4096–8192) even though marketing lists 128k.
- Prefer **`ctx_shift: false`** for multimodal; `local-ai-sdk` sets this automatically when `mmprojPath` is provided.
- **Embeddings for RAG** usually require a separate embedding-capable setup; do not assume the chat GGUF doubles as an embedder unless your build supports it.

## Scripts

- `npm run build` — build SDK package  
- `npm test` — run Vitest across packages  

## License

MIT
