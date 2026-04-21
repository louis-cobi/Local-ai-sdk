# Llama Adapter API (`local-ai-sdk-llama`)

## `createLlamaRNProvider(options: LlamaRNProviderOptions): LLMProvider`

Creates a provider backed by `llama.rn` `initLlama`.

### Parameters: `LlamaRNProviderOptions`

- `modelPath: string` (required)
- `contextSize?: number` (`n_ctx`)
- `n_gpu_layers?: number`
- `n_batch?: number`
- `n_threads?: number`
- `use_mlock?: boolean`
- `use_mmap?: boolean`
- `flash_attn?: boolean`
- `ctx_shift?: boolean`
  - default behavior: `false` when `mmprojPath` is set, otherwise `true`
- `embedding?: boolean`
  - when true, exposes `embed(text)` from provider
- `pooling_type?: ContextParams['pooling_type']`
- `mmprojPath?: string`
  - enables multimodal initialization for supported builds
- `mmprojUseGpu?: boolean` (default `true`)
- `extra?: Partial<ContextParams>`
- `onProgress?: (progress: number) => void`

### Return value

Returns an object implementing `LLMProvider`:

- `init` initializes context and optional multimodal projector
- `dispose` releases multimodal state and context
- `complete` runs generation and maps token callback
- `saveSession` and `loadSession` bridge provider KV state
- `stopCompletion` interrupts generation
- optional `embed` when `embedding: true`

## `createSpeechSynthesizer(ctx: LlamaContext): { speak(text: string): Promise<never> }`

Placeholder API for future llama-native TTS integration.

- Current behavior: `speak` throws an explicit not-implemented error.
