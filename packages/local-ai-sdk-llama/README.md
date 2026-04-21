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

## Multimodal

Pass `mmprojPath` for vision/audio models. `ctx_shift` defaults to `false` when `mmprojPath` is set (per llama.rn guidance). Requires a `llama.rn` build that exposes `initMultimodal` / `releaseMultimodal`.

## Speech

`createSpeechSynthesizer` is a placeholder until a stable TTS API is available on your `LlamaContext` build.
