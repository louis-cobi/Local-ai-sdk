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
  embed?(text: string): Promise<number[]>
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

### `CompletionResult`

- `text: string`
- `content: string`
- `tool_calls: NativeToolCall[]`

### `TokenChunk`

- `token: string`

## Chat payload types

### `ChatMessageInput`

- `role: string`
- `content?: string | LlamaMessageContentPart[]`
- `tool_calls?: unknown`
- `tool_call_id?: string`
- `name?: string`

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
