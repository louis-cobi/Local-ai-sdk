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
maestro test tests/e2e-rn/maestro/preflight.yaml
maestro test tests/e2e-rn/maestro/chat-stream-stop.yaml
maestro test tests/e2e-rn/maestro/provider-capabilities.yaml
maestro test tests/e2e-rn/maestro/error-surface.yaml
maestro test tests/e2e-rn/maestro/full-pass.yaml
```

## Where to see results

You have two result surfaces:

- **Visual console in app** (`tests/e2e-rn/app/App.tsx`)
  - runtime status: model/mmproj ready, cache hit, engine ready
  - model config: repo/file names
  - prompt controls: system prompt + prefill text
  - stream metrics: chunk count, char count, duration, avg chars/s
  - download metrics: backend, progress, bytes, duration
  - init/session/memory metrics: init duration, session path, memory recall hits
  - tool path: dedicated `Tool probe` button + last tool result
  - metrics export: `Export metrics` button writes JSON in app storage
  - errors: stable banner (`e2e-error-banner`)
  - live event log with timestamps
- **CLI logs**
  - Expo/Metro logs in the terminal running `npm run e2e:rn:app:android`
  - Maestro scenario logs in the terminal running `maestro test ...`

For one-command end-to-end validation (download -> init -> stream -> prefill -> tools -> session -> errors), run:

```bash
maestro test tests/e2e-rn/maestro/full-pass.yaml
```

Before running heavier flows (`full-pass`, multimodal/session), run this quick health check:

```bash
maestro test tests/e2e-rn/maestro/preflight.yaml
```

## Android emulator anti-flakiness checklist

Disable system animations before running Maestro:

```bash
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

Also prefer:

- one emulator per test batch (avoid stale state reuse)
- explicit assertion sync points over fixed sleeps
- re-running failed flow once with fresh app launch before triage

## Save logs to files (PowerShell)

From repo root:

```powershell
npm run e2e:rn:app:android *>&1 | Tee-Object -FilePath tests/e2e-rn/logs/expo-android.log
```

Run Maestro with log capture:

```powershell
maestro test tests/e2e-rn/maestro/gemma4-mmproj.yaml *>&1 | Tee-Object -FilePath tests/e2e-rn/logs/maestro-gemma4-mmproj.log
```

Create `tests/e2e-rn/logs` first if needed.

Capture Android runtime logs (PowerShell):

```powershell
adb logcat -T 1m | Tee-Object -FilePath tests/e2e-rn/logs/adb-logcat.log
```
