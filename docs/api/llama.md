# Llama Adapter API (`local-ai-sdk`)

## `createLlamaRNProvider(options: LlamaRNProviderOptions): LLMProvider`

Creates a provider backed by `llama.rn` `initLlama`.

Runtime matrix for this adapter:

- `llama.rn >= 0.10.0`
- `react-native >= 0.79.0`
- `expo >= 53.0.0` (recommended)

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
- `mmprojImageMinTokens?: number`
- `mmprojImageMaxTokens?: number`
- `extra?: Partial<ContextParams>`
- `onProgress?: (progress: number) => void`

### Return value

Returns a capability-rich provider (`BaseLLMProvider` + optional capabilities):

- `init` initializes context and optional multimodal projector
- `dispose` releases multimodal state and context
- `complete` forwards the full advanced completion surface (`sampling`, `grammar`, `response_format`, `thinking`, template args, etc.)
- `saveSession` and `loadSession` bridge provider KV state
- `stopCompletion` interrupts generation
- `embed`, `tokenize`, `detokenize`, `rerank`, `bench`, `clearCache`
- multimodal lifecycle + inspection (`initMultimodal`, `isMultimodalEnabled`, `getMultimodalSupport`, `releaseMultimodal`)
- LoRA runtime controls (`applyLoraAdapters`, `removeLoraAdapters`, `getLoadedLoraAdapters`)
- vocoder/audio APIs (`initVocoder`, `isVocoderEnabled`, `getFormattedAudioCompletion`, `getAudioCompletionGuideTokens`, `decodeAudioTokens`, `releaseVocoder`)
- speech capability (`provider.speech.speak(text)`)
- parallel queue APIs through `provider.parallel.*`
- `loadModelInfo(modelPath?)` bridge to `loadLlamaModelInfo`
- `capabilities` descriptor for explicit runtime capability checks

## Completion passthrough details

`provider.complete(req)` now forwards all advanced request fields supported by `llama.rn`, including:

- `top_k`, `top_p`, `min_p`, penalties, `mirostat*`, `seed`
- `grammar`, `response_format`
- `enable_thinking`, `reasoning_format`
- `chat_template_kwargs`, `parallel_tool_calls`
- `force_pure_content`, `prefill_text`, `media_paths`

## `createSpeechSynthesizer(ctx: LlamaContext): { speak(text: string): Promise<number[]> }`

Speech helper built on llama vocoder APIs.

- **Parameters**
  - `ctx: LlamaContext` with vocoder methods enabled
- **Behavior**
  - validates vocoder support and enabled state
  - formats audio completion prompt
  - runs completion and decodes generated audio tokens
- **Returns**
  - decoded vocoder values (`number[]`)
