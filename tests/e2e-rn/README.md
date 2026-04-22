# React Native E2E (Expo + llama.rn)

This suite validates runtime behavior on real RN builds, not Vitest mocks.

## Scenarios

- `gemma4-mmproj.yaml`: Gemma 4 E2B model + `mmproj` boot and multimodal prompt.
- `session-multimodal-save-load.yaml`: save/load session behavior with multimodal turns.
- `rag-restart.yaml`: RAG backend bootstrap + app restart continuity check.

## Requirements

- Expo SDK `>=53`
- React Native `>=0.79`
- `llama.rn >= 0.10.0`
- Development build (Expo Go is not enough for native module coverage)
- `maestro` CLI installed

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

## Run

```bash
maestro test tests/e2e-rn/maestro/gemma4-mmproj.yaml
maestro test tests/e2e-rn/maestro/session-multimodal-save-load.yaml
maestro test tests/e2e-rn/maestro/rag-restart.yaml
```

