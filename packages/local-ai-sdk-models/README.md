# local-ai-sdk-models

Download and cache files from Hugging Face for use with `local-ai-sdk` and `local-ai-sdk-llama`.

## API

- `downloadModel({ repoId, filename, revision?, destinationDir, onProgress?, signal?, retry?, checksum? })` — Node/Desktop default (fs + fetch), downloads if missing, returns local path.
- `getModelPathIfCached({ destinationDir, filename })` — returns path when the file already exists.
- `huggingFaceResolveUrl(repoId, filename, revision?)` — builds the resolve URL.
- `downloadModelWithAdapter(source, { destinationDir, adapter, onProgress?, signal?, retry?, checksum? })` — React Native path with adapter injection.
- `createExpoFileSystemAdapter(expoFileSystem)` — Expo adapter factory.
- `createBlobUtilAdapter(reactNativeBlobUtil)` — react-native-blob-util adapter factory.

## Reliability options

- `signal`: supports cancellation via `AbortController`.
- `retry`: configurable retry policy `{ attempts, baseDelayMs, maxDelayMs, jitter }`.
- `checksum`: optional SHA-256 validation `{ algorithm: 'sha256', expected }`.
- Node downloads use streaming writes to a temporary `.part` file and atomic rename on success.

## React Native examples

```ts
import * as FileSystem from 'expo-file-system';
import {
  createExpoFileSystemAdapter,
  downloadModelWithAdapter,
} from 'local-ai-sdk';

const path = await downloadModelWithAdapter(
  {
    repoId: 'ggml-org/gemma-4-E2B-it-GGUF',
    filename: 'gemma-4-e2b-it-Q8_0.gguf',
  },
  {
    destinationDir: `${FileSystem.documentDirectory}models`,
    adapter: createExpoFileSystemAdapter(FileSystem),
  }
);
```

```ts
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  createBlobUtilAdapter,
  downloadModelWithAdapter,
} from 'local-ai-sdk';

const path = await downloadModelWithAdapter(
  {
    repoId: 'ggml-org/gemma-4-E2B-it-GGUF',
    filename: 'gemma-4-e2b-it-Q8_0.gguf',
  },
  {
    destinationDir: `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/models`,
    adapter: createBlobUtilAdapter(ReactNativeBlobUtil),
  }
);
```

`expo-file-system` and `react-native-blob-util` are optional peer dependencies.
