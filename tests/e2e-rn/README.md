# React Native E2E (Expo + llama.rn + Gemma 4 E2B)

This suite validates runtime behavior on real RN builds, not Vitest mocks.

Harness app is included at `tests/e2e-rn/app`.

## Goal

Validate the full vertical path in a real RN app:

- model download and file integrity
- provider/context init (`llama.rn`)
- SDK turn loop (send, stream, stop)
- multimodal path (`mmproj`)
- session save/load stability
- backend bootstrap + memory fallback behavior

## Scenarios

- `gemma4-mmproj.yaml`: Gemma 4 E2B model + `mmproj` boot and multimodal prompt.
- `session-multimodal-save-load.yaml`: save/load session behavior with multimodal turns.
- `rag-restart.yaml`: RAG backend bootstrap + app restart continuity check.
- `download-model.yaml`: model + `mmproj` download and cache hit verification.
- `chat-stream-stop.yaml`: streaming path and user stop action.
- `provider-capabilities.yaml`: runtime `provider.capabilities` contract visibility.
- `error-surface.yaml`: malformed input / missing asset error path with stable UI signaling.

## Requirements

- Expo SDK `>=53`
- React Native `>=0.79`
- `llama.rn >= 0.10.0`
- Development build (Expo Go is not enough for native module coverage)
- `maestro` CLI installed
- real device strongly recommended (especially for Gemma 4 + multimodal)
- see `tests/e2e-rn/ENVIRONMENT.md`

## Required app test IDs

The host app must expose these test IDs:

- `e2e-model-ready`
- `e2e-mmproj-ready`
- `e2e-input`
- `e2e-send`
- `e2e-assistant-last`
- `e2e-session-save`
- `e2e-session-load`
- `e2e-memory-upsert`
- `e2e-memory-query`
- `e2e-restart-marker`
- `e2e-download-model`
- `e2e-download-mmproj`
- `e2e-cache-hit`
- `e2e-stream-start`
- `e2e-stop`
- `e2e-provider-capabilities`
- `e2e-error-banner`

## Run

```bash
npm install --prefix tests/e2e-rn/app
npm run e2e:rn:app:android
maestro test tests/e2e-rn/maestro/gemma4-mmproj.yaml
maestro test tests/e2e-rn/maestro/session-multimodal-save-load.yaml
maestro test tests/e2e-rn/maestro/rag-restart.yaml
maestro test tests/e2e-rn/maestro/download-model.yaml
maestro test tests/e2e-rn/maestro/chat-stream-stop.yaml
maestro test tests/e2e-rn/maestro/provider-capabilities.yaml
maestro test tests/e2e-rn/maestro/error-surface.yaml
```

