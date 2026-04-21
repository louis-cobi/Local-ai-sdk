# local-ai-sdk — roadmap (V0 → V1)

This document captures the shipped architecture and the planned evolution of `local-ai-sdk`.

## V0 (mobile-first core) — implemented

- **Immutable seed**: system prompt + tool policy prefilled once with `n_predict: 0`, then persisted when `session` is configured.
- **Turn construction**: `summary → recalled memory → sliding window → user` via `buildTurnMessages` (system/tools seed is not re-sent each turn).
- **Persistence**:
  - KV cache: `LlamaContext.saveSession` / `loadSession`
  - UI/meta JSON: `${session.path}.meta.json` via optional `session.storage` (Node `fs` auto-detected in tests; RN should inject an adapter).
- **Seed fingerprint**: invalidates incompatible session files when `systemPrompt`, tool schemas, `toolMode`, or `seedExtras` change.
- **Tools**:
  - `toolMode: 'native'` uses llama.rn `tools` + `tool_choice: 'auto'` with a bounded tool loop.
  - `toolMode: 'json'` parses `{"tool_call":{"name","args"}}` from assistant text.
- **Summarization**: when `logicalTurnCount` exceeds `memory.summaryThreshold`, compress older turns and shrink the stored message window.
- **React**: `useLocalChat(engine)` exposes `messages`, `streaming`, `isBusy`, `sendMessage`, `stop`, `reset`.

## V1 (memory + RAG) — implemented (baseline)

- **`embed(text)`** on the engine when the provider exposes embeddings (`embedding: true` in `initLlama`).
- **`remember` / `recall`** backed by `InMemoryVectorStore` (cosine similarity) and `formatMemoryBlock` injection.
- **Next steps (app-side)**:
  - Replace the in-memory store with SQLite-vec / `op-sqlite` for durable embeddings.
  - Add optional grammar / JSON-schema helpers (`response_format`) for strict structured outputs.

## Non-goals / cautions

- **Context shifting** is treated as a safety net (`ctx_shift` in `createLlamaRNProvider`), not the primary memory architecture.
- **Multimodal session files** may be limited upstream; keep sessions text-first.
- **`reset({ keepSeed: false })`** is not supported without creating a fresh llama context/provider.

## Repository conventions

- Code comments and technical docs are **English-first** (see `.cursor/rules/english-code-and-docs.mdc`).
