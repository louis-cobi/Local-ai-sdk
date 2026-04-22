# Provider Contracts

## `LLMProvider`

`LocalFirstEngine` depends on this interface:

```ts
type LLMProvider = {
  init(): Promise<void>
  dispose(): Promise<void>
  complete(req: CompletionRequest, onToken?: (chunk: TokenChunk) => void): Promise<CompletionResult>
  saveSession(path: string): Promise<void>
  loadSession(path: string): Promise<void>
  stopCompletion(): Promise<void>
  embed(text: string): Promise<number[]>
  tokenize(text: string, opts?: { media_paths?: string[] }): Promise<{ tokens: number[] }>
  detokenize(tokens: number[]): Promise<string>
  rerank(query: string, documents: string[], params?: RerankParams): Promise<RerankResult[]>
  bench(pp: number, tg: number, pl: number, nr: number): Promise<BenchResult>
  clearCache(clearData?: boolean): Promise<void>

  initMultimodal(opts: MultimodalInitOptions): Promise<boolean>
  isMultimodalEnabled(): Promise<boolean>
  getMultimodalSupport(): Promise<{ vision: boolean; audio: boolean }>
  releaseMultimodal(): Promise<void>

  applyLoraAdapters(loraList: LoraAdapter[]): Promise<void>
  removeLoraAdapters(): Promise<void>
  getLoadedLoraAdapters(): Promise<LoraAdapter[]>

  initVocoder(opts: VocoderInitOptions): Promise<boolean>
  isVocoderEnabled(): Promise<boolean>
  getFormattedAudioCompletion(
    speaker: Record<string, unknown> | null,
    textToSpeak: string
  ): Promise<{ prompt: string; grammar?: string }>
  getAudioCompletionGuideTokens(textToSpeak: string): Promise<number[]>
  decodeAudioTokens(tokens: number[]): Promise<number[]>
  releaseVocoder(): Promise<void>

  loadModelInfo(modelPath?: string): Promise<Record<string, unknown>>
  parallel: ParallelAPI
}
```

## Request and response types

### `CompletionRequest`

- `messages: ChatMessageInput[]`
- `n_predict: number`
- `temperature?: number`
- `stop?: string[]`
- `tools?: OpenAIStyleTool[]`
- `tool_choice?: string`
- `CompletionAdvancedParams` fields are also supported, including:
  - `top_k`, `top_p`, `min_p`, `typical_p`, `seed`
  - `penalty_*`, `mirostat*`, `grammar`, `response_format`
  - `enable_thinking`, `reasoning_format`
  - `chat_template_kwargs`, `parallel_tool_calls`, `force_pure_content`, and more

### `CompletionResult`

- `text: string`
- `content: string`
- `tool_calls: NativeToolCall[]`

`tool_calls` represents **native tool calls emitted by the provider** (assistant intent to call tools), not tool execution outputs.

### `NativeToolCall`

```ts
type NativeToolCall = {
  type: 'function'
  function: {
    name: string
    arguments: string // JSON string
  }
  id?: string
}
```

This type models provider-originated tool requests only.

### `TokenChunk`

- `token: string`
- `content?: string`
- `reasoning_content?: string`
- `tool_calls?: NativeToolCall[]`
- `accumulated_text?: string`
- `requestId?: number`

### `CompletionResponseFormat`

```ts
type CompletionResponseFormat = {
  type: 'text' | 'json_object' | 'json_schema'
  json_schema?: { strict?: boolean; schema: object }
  schema?: object
}
```

### `ParallelAPI`

```ts
type ParallelAPI = {
  completion(
    req: CompletionRequest,
    onToken?: (requestId: number, chunk: TokenChunk) => void
  ): Promise<{ requestId: number; promise: Promise<CompletionResult>; stop: () => Promise<void> }>
  embedding(
    text: string,
    params?: EmbeddingParams
  ): Promise<{ requestId: number; promise: Promise<{ embedding: number[] }> }>
  rerank(
    query: string,
    documents: string[],
    params?: RerankParams
  ): Promise<{ requestId: number; promise: Promise<RerankResult[]> }>
  enable(config?: { n_parallel?: number; n_batch?: number }): Promise<boolean>
  disable(): Promise<boolean>
  configure(config: { n_parallel?: number; n_batch?: number }): Promise<boolean>
  getStatus(): Promise<ParallelStatus>
  subscribeToStatus(callback: (status: ParallelStatus) => void): Promise<{ remove: () => void }>
}
```

## Chat payload types

### `ChatMessageInput`

- `role: string`
- `content?: string | LlamaMessageContentPart[]`
- `tool_calls?: unknown`
- `tool_call_id?: string`
- `name?: string`

Usage notes:

- `tool_calls` is present on `assistant` messages when using native function-calling.
- `tool_call_id` is present on `role: tool` messages to link a tool result to a specific call.
- Tool outputs (including structured errors) must be sent through `role: tool` messages, not as `role: user`.
- In `json` mode, the engine synthesizes an assistant `tool_calls` entry before appending the `role: tool` result, so downstream role semantics stay aligned with native mode.

### Tool result payloads (`role: tool`)

Tool result messages always carry JSON-serialized content:

- Success example: `{"temp":22,"unit":"c"}`
- Error example: `{"ok":false,"error":"Invalid arguments for tool mul: b: Expected number, received string"}`

Error payload shape is stable:

```ts
{ ok: false; error: string }
```

### `LlamaMessageContentPart`

```ts
type LlamaMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data?: string; url?: string; format?: 'wav' | 'mp3' } }
```

## Tooling helpers

### `defineTool<TArgs>(def: ToolDefinition<TArgs>): ToolDefinition<TArgs>`

Declares a tool with JSON-schema parameters and typed execute handler.

### `defineToolZod(opts): ToolDefinition`

Declares a tool from Zod schema and auto-converts to JSON schema.

### `ToolRegistry`

- `list(): ToolDefinition[]`
- `toOpenAIStyleTools(): OpenAIStyleTool[]`
- `toPromptFragment(): string`
- `run(name: string, rawArgs: string): Promise<unknown>`

### `OpenAIStyleTool`

```ts
type OpenAIStyleTool = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}
```

Used in `CompletionRequest.tools` when `toolMode` is `native`.
