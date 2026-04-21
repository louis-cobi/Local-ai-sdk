# Model Download API (`local-ai-sdk-models`)

## URL resolution

### `huggingFaceResolveUrl(repoId: string, filename: string, revision = 'main'): string`

Builds canonical Hugging Face resolve URL for a single file.

## Cache lookup

### `getModelPathIfCached(options: { destinationDir: string; filename: string }): Promise<string | null>`

Returns local file path if present, otherwise `null`.

## Node/Desktop downloader

### `downloadModel(options: DownloadModelOptions): Promise<string>`

Downloads a file from Hugging Face into `destinationDir`.

- Skips download if file already exists.
- Returns destination file path.

### `DownloadModelOptions`

- `repoId: string` (required)
- `filename: string` (required)
- `revision?: string` (default `main`)
- `destinationDir: string` (required)
- `onProgress?: (loaded: number, total: number | null) => void`

## React Native adapter downloader

### `downloadModelWithAdapter(source: DownloadModelSource, options): Promise<string>`

Adapter-based download path for RN/Expo/bare native.

#### `DownloadModelSource`

- `repoId: string`
- `filename: string`
- `revision?: string`

#### `options`

- `destinationDir: string`
- `adapter: ReactNativeDownloadAdapter`
- `onProgress?: (loaded: number, total: number | null) => void`

## Adapter contracts

### `ReactNativeDownloadAdapter`

- `exists(path: string): Promise<boolean>`
- `ensureDir(path: string): Promise<void>`
- `downloadToPath(args: { url: string; path: string; onProgress?: (...) => void }): Promise<void>`

### `createExpoFileSystemAdapter(fs: ExpoFileSystemLike): ReactNativeDownloadAdapter`

Builds adapter from Expo FileSystem compatible object.

### `createBlobUtilAdapter(blobUtil: BlobUtilLike): ReactNativeDownloadAdapter`

Builds adapter from `react-native-blob-util` compatible object.

### Minimal adapter shapes

- `ExpoFileSystemLike`
  - `getInfoAsync`
  - `makeDirectoryAsync`
  - `createDownloadResumable(...).downloadAsync()`
- `BlobUtilLike`
  - `fs.exists`, `fs.mkdir`
  - `config(...).fetch(...)`
  - optional `progress(cb)`
