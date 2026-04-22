# E2E Environment (Expo + llama.rn + Gemma 4 E2B)

## Target stack

- Expo SDK `>=53`
- React Native `>=0.79`
- React `>=19`
- `llama.rn >= 0.10.0`
- `local-ai-sdk` from this workspace

## Build mode

- Use a **development build** (`expo run:android` / `expo run:ios`), not Expo Go.
- Use release-like settings when validating performance-sensitive flows.

## Android storage policy (API 33+)

- E2E downloads are stored in app-specific storage (`FileSystem.documentDirectory`).
- `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` are intentionally not required for this path.
- This avoids runtime permission prompts and keeps emulator/device behavior consistent under scoped storage.

## Required model assets

- Main model GGUF (Gemma 4 E2B IT)
- Matching `mmproj` GGUF from the same source/revision
- Store both under app-accessible `file://` paths

## Env vars for host app

Use a local `.env.e2e` file (example below) and map values to Expo public env vars for the harness app:

```bash
EXPO_PUBLIC_E2E_MODEL_REPO=ggml-org/gemma-4-E2B-it-GGUF
EXPO_PUBLIC_E2E_MODEL_FILE=gemma-4-e2b-it-Q8_0.gguf
EXPO_PUBLIC_E2E_MMPROJ_FILE=mmproj-gemma-4-e2b-it-f16.gguf
EXPO_PUBLIC_E2E_MODEL_DIR=models/e2b
EXPO_PUBLIC_E2E_SESSION_PATH=sessions/e2b-session.bin
EXPO_PUBLIC_E2E_DOWNLOAD_ADAPTER=expo
```

`EXPO_PUBLIC_E2E_DOWNLOAD_ADAPTER` supports:

- `expo` -> `createExpoFileSystemAdapter` (default, app-specific storage)
- `blob` -> `createBlobUtilAdapter` via `react-native-blob-util`

## Host app checklist

- exposes all e2e test IDs listed in `README.md`
- has buttons for:
  - download model + mmproj
  - init provider/engine
  - send/stream/stop
  - save/load session
  - restart marker
  - memory upsert/query
- renders current `provider.capabilities` JSON in a dedicated test element

## Suggested run order

1. `download-model.yaml`
2. `gemma4-mmproj.yaml`
3. `chat-stream-stop.yaml`
4. `session-multimodal-save-load.yaml`
5. `provider-capabilities.yaml`
6. `error-surface.yaml`
7. `rag-restart.yaml`
