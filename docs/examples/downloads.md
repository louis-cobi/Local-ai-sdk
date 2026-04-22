# Example: Model Download (Expo adapter)

```ts
import * as FileSystem from 'expo-file-system';
import {
  createExpoFileSystemAdapter,
  downloadModelWithAdapter,
  createLlamaRNProvider,
} from 'local-ai-sdk';

const adapter = createExpoFileSystemAdapter(FileSystem);

const modelPath = await downloadModelWithAdapter(
  {
    repoId: 'ggml-org/gemma-4-E2B-it-GGUF',
    filename: 'gemma-4-e2b-it-Q8_0.gguf',
    revision: 'main',
  },
  {
    destinationDir: `${FileSystem.documentDirectory}models`,
    adapter,
    onProgress(loaded, total) {
      console.log('progress', { loaded, total });
    },
  }
);

const provider = createLlamaRNProvider({
  modelPath: `file://${modelPath}`,
  contextSize: 4096,
});
```
