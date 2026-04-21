# Architecture

## Runtime components

The V0.0.0 baseline is built around `LocalFirstEngine`, which orchestrates:

1. **Provider lifecycle** (`init`, `complete`, `save/loadSession`, `dispose`)
2. **Turn construction** (`summary -> recalled memory -> sliding window -> user turn`)
3. **Tool execution loop** (`native` or `json` mode)
4. **Session persistence** (binary KV + JSON metadata)
5. **Optional memory recall** via vector search

## Lifecycle flow

```mermaid
flowchart TD
  app[App] --> init[engine.init]
  init --> providerInit[provider.init]
  providerInit --> loadOrSeed{session exists and seed compatible}
  loadOrSeed -->|yes| load[loadSession + load metadata]
  loadOrSeed -->|no| prefill[prefill immutable seed n_predict 0]
  prefill --> persist[persist session/meta if configured]
  load --> ready[engine ready]
  persist --> ready
```

## Message flow for a turn

```mermaid
flowchart TD
  userInput[user input] --> normalize[normalize text/media]
  normalize --> buildContext[buildTurnMessages]
  buildContext --> complete[provider.complete]
  complete --> toolCheck{tool call detected}
  toolCheck -->|yes| runTool[run ToolRegistry]
  runTool --> loopBack[append tool result and continue]
  loopBack --> complete
  toolCheck -->|no| assistantReply[assistant reply]
  assistantReply --> summarize[maybe summarize older turns]
  summarize --> persist[persist session/meta]
```

## Tool modes

- `native`
  - Sends tool schemas through `tools` + `tool_choice: auto`.
  - Executes returned `tool_calls`.
  - Appends `tool` role responses and continues until final assistant text.
- `json`
  - Expects assistant JSON shaped like `{"tool_call":{"name","args"}}`.
  - Executes tool locally, injects result as follow-up message, and reruns generation.

## Persistence model

- Session binary file at `session.path` is saved/loaded through provider methods.
- Metadata JSON stores:
  - `summary`
  - `messages`
  - `logicalTurnCount`
  - `seedHash`
- Seed compatibility is enforced with a deterministic fingerprint of prompt + tool schema + tool mode + optional extras.

## Memory and summarization

- `remember` embeds memory text and upserts into vector storage.
- `recall` embeds query, searches top-k hits, returns hits + formatted context block.
- Summarization compacts older dialogue after threshold pressure and keeps only a recent window in active state.
