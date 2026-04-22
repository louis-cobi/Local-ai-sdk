# React Bindings API

## `useLocalChat(engine: LocalFirstEngine): UseLocalChatResult`

React hook that mirrors `LocalFirstEngine` message state and exposes streaming helpers.

- Subscribes to `engine.subscribe` and keeps `messages` synchronized.
- Uses `engine.streamText` internally for incremental token streaming.
- Prevents sending empty text-only payloads.

## `UseLocalChatResult`

- `messages: ChatMessage[]` — current engine messages snapshot
- `streaming: string` — currently streamed assistant chunk buffer
- `isBusy: boolean` — true while a turn is in progress
- `sendMessage(input: string | SendMessageInput): Promise<void>`
- `stop(): Promise<void>`
- `reset(opts?: { keepSeed?: boolean }): Promise<void>`
