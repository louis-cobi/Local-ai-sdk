import {
  huggingFaceResolveUrl,
  isRetryableError,
  normalizeRetry,
  retryDelayMs,
  sleepWithSignal,
  throwIfAborted,
  type BlobUtilLike,
  type DownloadChecksum,
  type DownloadModelRetry,
  type DownloadModelSource,
  type ExpoFileSystemLike,
  type ReactNativeDownloadAdapter,
} from './shared.js';

export type DownloadModelWithAdapterOptions = {
  destinationDir: string;
  adapter: ReactNativeDownloadAdapter;
  onProgress?: (loaded: number, total: number | null) => void;
  signal?: AbortSignal;
  retry?: DownloadModelRetry;
  checksum?: DownloadChecksum;
};

export async function downloadModelWithAdapter(
  source: DownloadModelSource,
  options: DownloadModelWithAdapterOptions
): Promise<string> {
  const { destinationDir, adapter, onProgress, signal, checksum } = options;
  const retry = normalizeRetry(options.retry);
  const baseDir = destinationDir.replace(/[\\/]+$/, '');
  const rel = source.filename.replace(/^[\\/]+/, '');
  const normalized = rel.split('/').join('/');
  const destPath = `${baseDir}/${normalized}`;
  if (await adapter.exists(destPath)) {
    return destPath;
  }

  const dir = destPath.slice(0, Math.max(0, destPath.lastIndexOf('/')));
  if (dir) {
    await adapter.ensureDir(dir);
  }

  const url = huggingFaceResolveUrl(source.repoId, source.filename, source.revision ?? 'main');
  let lastError: unknown = null;
  for (let attempt = 0; attempt < retry.attempts; attempt++) {
    throwIfAborted(signal);
    try {
      await adapter.downloadToPath({
        url,
        path: destPath,
        onProgress,
        signal,
        checksum,
      });
      return destPath;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt >= retry.attempts - 1) break;
      const delay = retryDelayMs(attempt, retry);
      await sleepWithSignal(delay, signal);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Model download failed');
}

export function createExpoFileSystemAdapter(fs: ExpoFileSystemLike): ReactNativeDownloadAdapter {
  return {
    async exists(path: string) {
      const info = await fs.getInfoAsync(path);
      return Boolean(info.exists);
    },
    async ensureDir(path: string) {
      await fs.makeDirectoryAsync(path, { intermediates: true });
    },
    async downloadToPath({ url, path, onProgress }) {
      const task = fs.createDownloadResumable(
        url,
        path,
        {},
        onProgress
          ? (data) => onProgress(data.totalBytesWritten, data.totalBytesExpectedToWrite || null)
          : undefined
      );
      await task.downloadAsync();
    },
  };
}

export function createBlobUtilAdapter(blobUtil: BlobUtilLike): ReactNativeDownloadAdapter {
  return {
    async exists(path: string) {
      return blobUtil.fs.exists(path);
    },
    async ensureDir(path: string) {
      await blobUtil.fs.mkdir(path);
    },
    async downloadToPath({ url, path, onProgress }) {
      const request = blobUtil.config({ path, fileCache: true });
      if (typeof request.progress === 'function' && onProgress) {
        request.progress((received, total) => {
          onProgress(received, total ?? null);
        });
      }
      await request.fetch('GET', url, { Accept: 'application/octet-stream' });
    },
  };
}

export type {
  BlobUtilLike,
  DownloadChecksum,
  DownloadModelRetry,
  DownloadModelSource,
  ExpoFileSystemLike,
  ReactNativeDownloadAdapter,
};
export { huggingFaceResolveUrl };
