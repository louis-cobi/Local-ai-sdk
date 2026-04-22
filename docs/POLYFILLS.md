# Polyfills and native helpers (React Native)

## Local-first default behavior

`local-ai-sdk` does not require an external AI SDK integration layer for its main flow.
The runtime uses:

- `local-ai-sdk` for the engine/runtime orchestration
- `local-ai-sdk/llama` for `llama.rn` provider integration
- `local-ai-sdk/models/rn` for adapter-based on-device downloads

For this default path, React Native polyfills are only needed when another dependency in your app requires them.

### When polyfills may still be required

- Another dependency in your app expects browser-like stream/encoding globals (`ReadableStream`, `TextEncoderStream`, `structuredClone`, etc.).
- Your app runtime is missing a global API used by one of your non-sdk dependencies.

---

## File download adapters in this package

`local-ai-sdk` keeps a **Node/Desktop** downloader in `local-ai-sdk/models/node` and ships explicit React Native adapters in `local-ai-sdk/models/rn`:

- `createExpoFileSystemAdapter(...)`
- `createBlobUtilAdapter(...)`
- `downloadModelWithAdapter(...)`

This keeps React Native / Expo support explicit for large model downloads while preserving Node/Desktop compatibility.

`expo-file-system` and `react-native-blob-util` are optional peer dependencies for adapter-based RN usage.

---

## Summary

| Topic | Local-first runtime approach |
| ----- | --------------------------- |
| Main integration | `local-ai-sdk` + `local-ai-sdk/llama` |
| RN file downloads | `local-ai-sdk/models/rn` with Expo/BlobUtil adapters |
| Node/Desktop downloads | `local-ai-sdk/models/node` |
| Polyfills | Only when required by other app dependencies |
