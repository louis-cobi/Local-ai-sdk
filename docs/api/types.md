# Core Types

## Chat and multimodal types

### `ChatRole`

```ts
type ChatRole = 'user' | 'assistant' | 'system' | 'tool'
```

### `UserMediaPart`

```ts
type UserMediaPart =
  | { type: 'image'; uri: string }
  | { type: 'audio'; uri: string; format?: 'wav' | 'mp3' }
```

### `ChatMessage`

- `id: string`
- `role: ChatRole`
- `content: string`
- `mediaParts?: UserMediaPart[]`
- `name?: string`

### `SendMessageInput`

- `text: string`
- `mediaParts?: UserMediaPart[]`
- `completion?: CompletionAdvancedParams`

## Configuration types

### `ToolMode`

```ts
type ToolMode = 'native' | 'json'
```

Mode semantics:

- `native`: provider emits `NativeToolCall[]` via `CompletionResult.tool_calls`.
- `json`: provider emits text JSON (`{"tool_call":{"name","args"}}`), then engine normalizes it into assistant `tool_calls` + `role: tool` result messages.

### `SessionAutoSave`

```ts
type SessionAutoSave = boolean | 'everyTurn' | number
```

### `SessionOptions`

- `path: string` (required)
- `autoSave?: SessionAutoSave`
- `metaPath?: string`
- `storage?: SessionStorageAdapter`

### `MemoryOptions`

- `windowSize?: number` (default 4 turns)
- `summaryThreshold?: number` (default 20 logical turns)
- `maxMemoryChars?: number` (default 4000)
- `ragTopK?: number` (default 5)
- `vectorStore?: VectorStore` (custom store injection)
- `durableStore?: { kind: 'rn'; backend: 'op-sqlite' | 'expo-vector-search'; namespace?: string }`

### `EngineConfig`

- `provider: LLMProvider` (required)
- `systemPrompt: string` (required)
- `tools?: ToolDefinition[]`
- `session?: SessionOptions`
- `memory?: MemoryOptions`
- `toolMode?: ToolMode`
- `maxPredict?: number`
- `temperature?: number`
- `stop?: string[]`
- `completionDefaults?: CompletionAdvancedParams`
- `seedExtras?: string[]`

Tool error behavior:

- For both `native` and `json`, tool execution errors are converted to structured `role: tool` payloads (`{ ok: false, error: string }`) and the turn continues.

### `ResetOptions`

- `keepSeed?: boolean` (default `true`)

## Memory and retrieval types

### `MemoryRecord`

- `id?: string`
- `type?: string`
- `content: string`
- `metadata?: Record<string, unknown>`

### `VectorSearchHit`

- `id: string`
- `score: number`
- `content: string`
- `metadata?: Record<string, unknown>`

### `RecallResult`

- `hits: VectorSearchHit[]`
- `contextBlock: string`

## Session metadata types

### `SessionStorageAdapter`

- `readText(path: string): Promise<string | null>`
- `writeText(path: string, data: string): Promise<void>`
- `writeTextAtomic?(path: string, data: string): Promise<void>`
- `exists(path: string): Promise<boolean>`
- `delete(path: string): Promise<void>`

`SessionOptions.storage` accepts this contract.

### `SessionMetaV1`

- `version: 1`
- `seedHash: string`
- `summary: string`
- `messages: ChatMessage[]`
- `logicalTurnCount: number`

### `defaultMetaPath(sessionPath: string): string`

Returns `${sessionPath}.meta.json`.

### `SESSION_META_VERSION`

Current metadata schema version constant (`1`).

## Tool and vector contracts

### `ToolDefinition<TArgs>`

- `name: string`
- `description: string`
- `parameters: Record<string, unknown>` (JSON Schema object)
- `execute: (args: TArgs) => Promise<unknown> | unknown`
- `zodInput?: ZodType<TArgs>`

### `VectorStore`

- `upsert(id: string, vector: number[], record: MemoryRecord): Promise<void>`
- `search(queryVector: number[], k: number): Promise<VectorSearchHit[]>`
- `delete(id: string): Promise<void>`
