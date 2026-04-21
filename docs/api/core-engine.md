# Core Engine API

## Factory

### `createEngine(config: EngineConfig): LocalFirstEngine`

Creates a `LocalFirstEngine` instance.

- **Parameters**
  - `config: EngineConfig`
- **Returns**
  - `LocalFirstEngine`

## Class `LocalFirstEngine`

### `constructor(config: EngineConfig)`

Builds engine state, registry, tool mode, and vector store. Does not initialize provider runtime yet.

### `init(): Promise<void>`

Initializes provider and session state.

- Loads compatible existing session/meta when available.
- Otherwise pre-fills immutable seed and optionally persists session files.

### `dispose(): Promise<void>`

Disposes provider resources and marks engine as uninitialized.

### `save(): Promise<void>`

Persists session binary + metadata when `session` is configured. No-op otherwise.

### `load(): Promise<void>`

Loads binary session from `session.path` and restores metadata if seed hash is compatible.

- **Throws**
  - Error if `session.path` is not configured.

### `reset(opts?: ResetOptions): Promise<void>`

Clears chat state and session files, then re-seeds.

- `opts.keepSeed` defaults to `true`.
- `keepSeed: false` is not supported in-place and throws by design.

### `stop(): Promise<void>`

Requests provider to stop an in-flight completion.

### `sendMessage(userInput: string | SendMessageInput, onToken?: (chunk: string) => void): Promise<string>`

Runs one user turn end-to-end.

- **Parameters**
  - `userInput`
    - `string` plain text, or
    - `SendMessageInput` multimodal payload
  - `onToken` optional token callback for streaming
- **Behavior**
  - Validates non-empty text and/or media
  - Builds context messages
  - Executes completion + tool loop
  - Appends assistant response
  - Applies summarization policy
  - Persists metadata/session based on autosave policy
- **Returns**
  - Final assistant text

### `generateText(userInput: string | SendMessageInput): Promise<string>`

Alias of `sendMessage(userInput)`.

### `streamText(userInput: string | SendMessageInput, onToken: (chunk: string) => void): Promise<string>`

Streaming helper that delegates to `sendMessage` with token callback.

### `getMessages(): ChatMessage[]`

Returns a shallow copy of current chat messages.

### `getSummary(): string`

Returns current rolling summary text.

### `subscribe(listener: () => void): () => void`

Subscribes to state updates.

- **Returns**
  - Unsubscribe function

### `remember(record: MemoryRecord): Promise<string>`

Embeds and stores a memory record in vector store.

- **Requires**
  - Provider with `embed` support
- **Returns**
  - Memory record id

### `recall(query: string): Promise<RecallResult>`

Embeds query, searches vector store, and returns retrieval results + prompt-ready memory block.

### `embed(text: string): Promise<number[]>`

Exposes provider embedding call directly.

## Turn and memory helpers

### `buildTurnMessages(params: BuildContextParams): ChatMessageInput[]`

Builds completion input in this order:

1. summary
2. retrieved memory block
3. recent chat window
4. current user message

### `summarizeTranscript(provider: LLMProvider, transcript: string, opts: { maxPredict: number; temperature: number; stop?: string[] }): Promise<string>`

Asks the model to produce a compact summary of old dialogue.

### `tryParseJsonToolCall(text: string): { name: string; args: Record<string, unknown> } | null`

Parses JSON tool fallback payloads.

### `seedFingerprint(parts: string[]): string`

Deterministic hash for seed compatibility checks.

### `fnv1a32(input: string): string`

Low-cost hash primitive used by `seedFingerprint`.
