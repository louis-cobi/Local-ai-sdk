# local-ai-sdk-llama

[`llama.rn`](https://github.com/mybigday/llama.rn) adapter implementing `LLMProvider` from [`local-ai-sdk`](../local-ai-sdk).

## Usage

Prefer importing from **`local-ai-sdk`** (it re-exports this package). Standalone:

```ts
import { createEngine, createLlamaRNProvider } from 'local-ai-sdk';

const provider = createLlamaRNProvider({
  modelPath: 'file:///path/to/model.gguf',
  contextSize: 8192,
  mmprojPath: 'file:///path/to/mmproj.gguf',
  embedding: true,
});

const engine = createEngine({ provider, systemPrompt: 'You are helpful.' });
await engine.init();
```

## Advanced runtime APIs

The provider now exposes the broader `llama.rn` context surface:

- Advanced completion controls (`top_k`, `top_p`, penalties, `grammar`, `response_format`, thinking controls, template kwargs, and more)
- Parallel decoding queue (`provider.parallel.*`)
- Multimodal status/lifecycle APIs
- LoRA runtime adapter APIs
- Vocoder/audio token APIs
- Context utilities (`tokenize`, `detokenize`, `rerank`, `bench`, `clearCache`, `loadModelInfo`)

## Multimodal

Pass `mmprojPath` for vision/audio models. `ctx_shift` defaults to `false` when `mmprojPath` is set (per llama.rn guidance). Requires a `llama.rn` build that exposes `initMultimodal` / `releaseMultimodal`.

## Speech

`createSpeechSynthesizer` now uses llama vocoder methods when available (`initVocoder`, audio guide tokens, token decoding). It throws clear runtime errors when the current build does not expose vocoder support.

## Breaking migration notes

- `LLMProvider` is no longer a minimal interface; all runtime APIs are now part of the contract.
- `embed` is now required on `LLMProvider`.
- If you maintain a custom provider, implement the new methods or wrap your provider with compatibility shims.

Full signatures and option details are in [docs/api/llama.md](../../docs/api/llama.md).
