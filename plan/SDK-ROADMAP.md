# local-ai-sdk — roadmap (V0 → V1 → V2)

This document captures the shipped architecture and the planned evolution of the monorepo (`packages/local-ai-sdk`, `local-ai-sdk-models`, `local-ai-sdk-llama`).

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

## V2 (parity + multimodal) — implemented

- **Monorepo**: `local-ai-sdk-models` (Hugging Face download/cache), `local-ai-sdk-llama` (llama.rn provider with optional `mmproj`), and **`local-ai-sdk`** as the **default consumer package** — it depends on the other two and re-exports their APIs. Optional: install subpackages alone for edge cases.
- **Zod tools**: `defineToolZod` + validation in `ToolRegistry` before `execute`.
- **Multimodal user turns**: `sendMessage({ text, mediaParts })` with `file://` URIs; metadata stores URIs only (no base64 blobs).
- **Model downloads**: `downloadModel` / `getModelPathIfCached` / `huggingFaceResolveUrl` in `local-ai-sdk-models`.
  - Node path now uses streaming I/O, retry/backoff, optional `AbortSignal`, optional SHA-256 checks, and `.part` atomic writes.
  - React Native adapter path supports the same high-level options (`signal`, `retry`, `checksum`) where adapter capabilities allow.
- **TTS**: `createSpeechSynthesizer` placeholder in `local-ai-sdk-llama` until a stable vocoder API exists on the native context.

## V3 (desktop runtimes) — planned

- **Desktop focus**: first-class `llama.cpp` support with ergonomic model/runtime management.
- **`llama-swap` integration**: smoother model switching / process management for local desktop workflows.
- **Download transport boundary**: `llama-swap` remains runtime orchestration; model download stays managed by `local-ai-sdk-models`.
- **Potential adapters**: evaluate `Ollama` and `vLLM` backends while keeping the same stateful engine contract.

## Non-goals / cautions

- **Context shifting**: `local-ai-sdk-llama` defaults `ctx_shift` to `false` when `mmprojPath` is set (multimodal); otherwise `true` as a safety net.
- **Multimodal session files** may be limited upstream; validate `saveSession` / `loadSession` with your `llama.rn` build.
- **`reset({ keepSeed: false })`** is not supported without creating a fresh llama context/provider.

## Repository conventions

- Code comments and technical docs are **English-first** (see `.cursor/rules/english-code-and-docs.mdc`).
- `local-ai-sdk-bundle` is intentionally temporary and scheduled for removal in the next minor line.
