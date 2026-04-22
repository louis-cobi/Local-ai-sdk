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

## Provider model

`LLMProvider` is capability-based in `local-ai-sdk`: this adapter exposes a wide capability set (session, embedding, runtime helpers, multimodal, LoRA, vocoder, parallel, speech) on top of the base contract.

Full signatures and option details are in [docs/api/llama.md](../../docs/api/llama.md).
