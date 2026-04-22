# Model Download API (`local-ai-sdk-models`)

## URL resolution

### `huggingFaceResolveUrl(repoId: string, filename: string, revision = 'main'): string`

Builds the canonical Hugging Face resolve URL for one file.

- **Parameters**
  - `repoId: string` — repository id like `ggml-org/gemma-4-E2B-it-GGUF`
  - `filename: string` — file path within the repo
  - `revision?: string` — branch/tag/commit, default `main`
- **Returns**
  - `string` canonical URL

## Cache lookup

### `getModelPathIfCached(options: { destinationDir: string; filename: string }): Promise<string | null>`

Returns the local destination path when the file already exists.

- **Returns**
  - `string` when cached
  - `null` when not found

## Node/Desktop downloader

### `downloadModel(options: DownloadModelOptions): Promise<string>`

Downloads from Hugging Face with streaming writes and retry support.

- Skips network download when the destination file already exists.
- Uses `*.part` temporary file and atomic rename on success.
- Optional checksum validation is performed on both cached and newly downloaded files.

#### `DownloadModelOptions`

- `repoId: string` (required)
- `filename: string` (required)
- `revision?: string` (default `main`)
- `destinationDir: string` (required)
- `onProgress?: (loaded: number, total: number | null) => void`
- `signal?: AbortSignal`
- `retry?: { attempts?: number; baseDelayMs?: number; maxDelayMs?: number; jitter?: boolean }`
- `checksum?: { algorithm: 'sha256'; expected: string }`

### Runtime behavior

- **Retry defaults**
  - `attempts: 3`
  - `baseDelayMs: 300`
  - `maxDelayMs: 3000`
  - `jitter: true`
- **Non-retryable failures**
  - aborted requests
  - checksum mismatches
- **Throws**
  - error on HTTP failure
  - error on checksum mismatch
  - `'Download aborted'` when `signal` aborts

## React Native adapter downloader

### `downloadModelWithAdapter(source: DownloadModelSource, options: { destinationDir: string; adapter: ReactNativeDownloadAdapter; onProgress?: (loaded: number, total: number | null) => void; signal?: AbortSignal; retry?: DownloadModelOptions['retry']; checksum?: { algorithm: 'sha256'; expected: string } }): Promise<string>`

Adapter-based download flow for React Native / Expo / custom native stacks.

- Computes target path as `${destinationDir}/${source.filename}` with normalized separators.
- Skips download when `adapter.exists(destPath)` is true.
- Creates parent directory with `adapter.ensureDir`.
- Applies the same retry/abort semantics as `downloadModel`.

#### `DownloadModelSource`

- `repoId: string`
- `filename: string`
- `revision?: string`

## Adapter contracts

### `ReactNativeDownloadAdapter`

- `exists(path: string): Promise<boolean>`
- `ensureDir(path: string): Promise<void>`
- `downloadToPath(args: { url: string; path: string; onProgress?: (loaded: number, total: number | null) => void; signal?: AbortSignal; checksum?: { algorithm: 'sha256'; expected: string } }): Promise<void>`

### `createExpoFileSystemAdapter(fs: ExpoFileSystemLike): ReactNativeDownloadAdapter`

Builds an adapter from an Expo FileSystem-compatible object.

Notes:
- Supports `onProgress`
- Does not enforce `signal`/`checksum` internally (Expo API limitations vary by runtime)

### `createBlobUtilAdapter(blobUtil: BlobUtilLike): ReactNativeDownloadAdapter`

Builds an adapter from a `react-native-blob-util` compatible object.

Notes:
- Supports `onProgress` through `request.progress` when available
- Does not enforce `signal`/`checksum` internally

### Minimal adapter shapes

#### `ExpoFileSystemLike`

- `getInfoAsync(path)`
- `makeDirectoryAsync(path, opts?)`
- `createDownloadResumable(url, fileUri, options, callback?).downloadAsync()`

#### `BlobUtilLike`

- `fs.exists(path)`
- `fs.mkdir(path)`
- `config(opts).fetch('GET', url, headers?)`
- optional `config(opts).progress(cb)`
