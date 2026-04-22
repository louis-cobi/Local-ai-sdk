# Polyfills and native helpers (React Native)

## Vercel `ai` / streams / `structuredClone`

This project **does not** depend on the Vercel `ai` package. Core code uses standard JavaScript (Zod, `fetch` in Node for model downloads, etc.). On React Native you typically **do not** need the same polyfills as [React Native AI’s AI SDK integration](https://www.react-native-ai.dev/docs/polyfills).

### When you might need those polyfills

- You add **`ai` (Vercel AI SDK)** alongside this library, or use other code that expects **`structuredClone`**, **`TextEncoderStream`**, **`ReadableStream`**, etc. Then follow: [Polyfills – React Native AI](https://www.react-native-ai.dev/docs/polyfills) (Expo vs bare RN snippets).

---

## Why does Callstack use `react-native-blob-util`?

[React Native AI](https://github.com/callstackincubator/ai) wires **model download and file paths** through their Llama provider using **`react-native-blob-util`** for native filesystem access, progress, and Hugging Face integration on device ([installation example](https://github.com/callstackincubator/ai)).

`local-ai-sdk` keeps a **Node/Desktop default** (`downloadModel`: `fetch` + `writeFile`) and ships explicit RN adapters:

- `createExpoFileSystemAdapter(...)`
- `createBlobUtilAdapter(...)`
- `downloadModelWithAdapter(...)`

So V1 can keep React Native / Expo comfort for large downloads while preserving Node/Desktop compatibility.

`expo-file-system` and `react-native-blob-util` are optional peer dependencies for adapter-based RN usage.

---

## Summary

| Topic | Callstack RN AI | This repo |
| ----- | --------------- | --------- |
| RN file downloads | `react-native-blob-util` commonly listed | Node default + optional Expo/BlobUtil adapters |
| Vercel `ai` + polyfills | Recommended for their API surface | Only if **you** add `ai` |
