# local-ai-sdk Documentation (V0.0.0 Baseline)

This site documents the **V0.0.0 baseline** of `local-ai-sdk`, using the current repository state as the reference implementation.

## What V0.0.0 does

- Provides a **stateful local AI engine** for on-device LLM workflows.
- Keeps a persistent conversation state with:
  - immutable seed prefill
  - optional KV session persistence
  - JSON metadata persistence (summary + message window)
- Supports **tool calling** with two modes:
  - `native` tool calls (`CompletionResult.tool_calls: NativeToolCall[]`)
  - `json` fallback tool calls (`{"tool_call": ...}`), normalized into the same assistant `tool_calls` + `role: tool` result flow
- Supports optional memory/RAG primitives:
  - `embed`
  - `remember`
  - `recall`
- Supports multimodal user input (`text`, `image`, `audio`) through provider-compatible message parts.

## Package layout

- `local-ai-sdk` (main install): engine + llama.rn provider + model download helpers

## Start here

- [Architecture](./architecture.md): runtime model and message flow
- [Core Engine API](./api/core-engine.md): `createEngine`, `LocalFirstEngine`
- [Types](./api/types.md): all major configuration and data contracts
- [Provider Contracts](./api/providers.md): provider interface and completion payloads
- [React Bindings API](./api/react.md): `useLocalChat` hook contract
- [Llama Adapter API](./api/llama.md): `createLlamaRNProvider`
- [Model Download API](./api/models.md): download + adapter helpers
- [Examples](./examples/basic-chat.md): end-to-end integration examples
- [Versioning Note](./versioning.md): baseline guarantee details
