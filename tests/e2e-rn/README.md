# React Native Manual Test App (Expo + llama.rn + Gemma 4 E2B)

This app is the manual validation console for `local-ai-sdk` on real RN builds.
Use it first as a user-facing sandbox, then automate stable paths with Maestro.

App location: `tests/e2e-rn/app`.

## Goal

Offer a complete manual test surface for package consumers:

- runtime configuration from UI (model/provider/chat settings)
- model and mmproj download with progress and cache visibility
- engine init/re-init with capability inspection
- chat send/stream/stop and deterministic tool probing
- memory/session workflows
- metrics export and event log inspection

## Manual testing domains

- **Configuration**
  - edit repo/file/path/provider settings at runtime
  - load presets (`default`, `coldStart`, `warmCache`)
  - apply and reset config without code edits

- **Models and engine**
  - download model/mmproj independently
  - inspect download metrics (progress, bytes, duration)
  - initialize/re-initialize engine and read provider capabilities

- **Chat**
  - send single-turn message
  - stream response and stop generation
  - monitor throughput counters

- **Tools, memory, session, metrics**
  - probe registered tools in-band
  - remember/recall memory markers
  - save/load/reset session file
  - export JSON metrics snapshot

## Requirements

- Expo SDK `>=53`
- React Native `>=0.79`
- `llama.rn >= 0.10.0`
- Development build (Expo Go is not enough for native module coverage)
- `maestro` CLI installed
- real device strongly recommended (especially for Gemma 4 + multimodal)
- see `tests/e2e-rn/ENVIRONMENT.md`

## Required app test IDs (kept for future automation)

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

## Run the manual app

```bash
npm install --prefix tests/e2e-rn/app
npm run e2e:rn:app:android
```

## Suggested manual workflow order

Use this lifecycle to validate package behavior before adding automation:

1. apply `coldStart` preset and run "Run cold step"
2. download model and mmproj
3. initialize engine
4. run send + stream + stop in Chat
5. run tool probe
6. run memory remember/recall
7. save/load session and reset session file
8. export metrics JSON
9. switch to `warmCache` preset and rerun warm path

## Expo and runtime logs

Expo/Metro logs are visible in the terminal running:

```powershell
npm run e2e:rn:app:android
```

Optional log capture:

```powershell
npm run e2e:rn:app:android *>&1 | Tee-Object -FilePath tests/e2e-rn/logs/expo-android.log
```

## Optional: switch default adapter to blob

```powershell
$env:EXPO_PUBLIC_E2E_DOWNLOAD_ADAPTER="blob"; npm run start --prefix tests/e2e-rn/app -- --clear
```

## Optional: automation comes after manual stability

Once manual flows are stable, run Maestro scenarios from `tests/e2e-rn/maestro`.

## Android emulator anti-flakiness checklist

```bash
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

Also prefer:

- one emulator per test batch (avoid stale state reuse)
- re-running failed manual step once after fresh app launch
