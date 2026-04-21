# local-ai-sdk (monorepo)

Stateful, mobile-first helpers for on-device LLMs.

| Package | Description |
|--------|-------------|
| [`local-ai-sdk`](packages/local-ai-sdk) | **Main install**: engine + re-exports **Llama** adapter and **HF download** helpers (depends on the two packages below) |
| [`local-ai-sdk-models`](packages/local-ai-sdk-models) | Hugging Face download / cache (also pulled in by `local-ai-sdk`) |
| [`local-ai-sdk-llama`](packages/local-ai-sdk-llama) | [`llama.rn`](https://github.com/mybigday/llama.rn) `LLMProvider` (also pulled in by `local-ai-sdk`) |
| [`local-ai-sdk-bundle`](packages/local-ai-sdk-bundle) | **Deprecated** — thin alias of `local-ai-sdk` |

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) | Single-package install, API, multimodal, RN session storage |
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

## Gemma 4 (E2B / E4B) on device

- **E2B** and **E4B** are multimodal instruction-tuned models (text + image; small variants often support audio input). See the [Gemma 4 announcement](https://huggingface.co/blog/gemma4).
- You need the **main GGUF** and the matching **`mmproj`** file from the same Hugging Face repo (e.g. [ggml-org/gemma-4-E2B-it-GGUF](https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF)).
- Use a **realistic `n_ctx`** on phones (e.g. 4096–8192) even though marketing lists 128k.
- Prefer **`ctx_shift: false`** for multimodal; `local-ai-sdk-llama` sets this automatically when `mmprojPath` is provided.
- **Embeddings for RAG** usually require a separate embedding-capable setup; do not assume the chat GGUF doubles as an embedder unless your build supports it.

## Scripts

- `npm run build` — build workspaces in dependency order  
- `npm test` — run Vitest across packages  

## License

MIT
