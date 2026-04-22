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
- `exists(path: string): Promise<boolean>`
- `delete(path: string): Promise<void>`

### `SessionMetaV1`

- `version: 1`
- `seedHash: string`
- `summary: string`
- `messages: ChatMessage[]`
- `logicalTurnCount: number`

### `defaultMetaPath(sessionPath: string): string`

Returns `${sessionPath}.meta.json`.
