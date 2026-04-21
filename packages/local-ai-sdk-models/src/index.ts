import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type DownloadModelOptions = {
  /** Hugging Face repo id, e.g. `ggml-org/gemma-4-E2B-it-GGUF`. */
  repoId: string;
  /** File name inside the repo, e.g. `gemma-4-e2b-it-Q8_0.gguf`. */
  filename: string;
  /** Branch or tag (default `main`). */
  revision?: string;
  /** Directory where the file will be stored (created if missing). */
  destinationDir: string;
  /** Optional progress callback (bytes loaded, total if known). */
  onProgress?: (loaded: number, total: number | null) => void;
};

export type DownloadModelSource = {
  repoId: string;
  filename: string;
  revision?: string;
};

/**
 * Adapter for React Native download implementations.
 * `downloadToPath` receives the resolved HF URL and target path and must write the file.
 */
export type ReactNativeDownloadAdapter = {
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
  downloadToPath(args: {
    url: string;
    path: string;
    onProgress?: (loaded: number, total: number | null) => void;
  }): Promise<void>;
};

/** Minimal shape expected from Expo FileSystem. */
export type ExpoFileSystemLike = {
  getInfoAsync(path: string): Promise<{ exists: boolean }>;
  makeDirectoryAsync(path: string, opts?: { intermediates?: boolean }): Promise<void>;
  createDownloadResumable(
    url: string,
    fileUri: string,
    options: Record<string, unknown>,
    callback?: (data: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void
  ): { downloadAsync(): Promise<unknown> };
};

/** Minimal shape expected from react-native-blob-util. */
export type BlobUtilLike = {
  fs: {
    exists(path: string): Promise<boolean>;
    mkdir(path: string): Promise<unknown>;
  };
  config(opts: { path: string; fileCache?: boolean }): {
    fetch(method: 'GET', url: string, headers?: Record<string, string>): Promise<unknown>;
    progress?(cb: (received: number, total: number) => void): unknown;
  };
};

/**
 * Build the canonical Hugging Face resolve URL for a single file.
 */
export function huggingFaceResolveUrl(repoId: string, filename: string, revision = 'main'): string {
  const encoded = filename
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
  return `https://huggingface.co/${repoId}/resolve/${revision}/${encoded}`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the local path if the file already exists under `destinationDir`, otherwise `null`.
 */
export async function getModelPathIfCached(options: {
  destinationDir: string;
  filename: string;
}): Promise<string | null> {
  const full = join(options.destinationDir, options.filename);
  return (await pathExists(full)) ? full : null;
}

/**
 * Download a GGUF (or other) file from Hugging Face into `destinationDir`.
 * Skips the download if the destination file already exists.
 */
export async function downloadModel(options: DownloadModelOptions): Promise<string> {
  const { repoId, filename, revision = 'main', destinationDir, onProgress } = options;
  await mkdir(destinationDir, { recursive: true });
  const destPath = join(destinationDir, filename);
  if (await pathExists(destPath)) {
    return destPath;
  }

  const url = huggingFaceResolveUrl(repoId, filename, revision);
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'application/octet-stream',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download model (${res.status} ${res.statusText}): ${url}`);
  }

  const lenHeader = res.headers.get('content-length');
  const total = lenHeader ? parseInt(lenHeader, 10) : null;

  const buf = await res.arrayBuffer();
  onProgress?.(buf.byteLength, total ?? buf.byteLength);

  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, Buffer.from(buf));
  return destPath;
}

/**
 * Generic RN path using an injected adapter (Expo FS, blob-util, or custom).
 */
export async function downloadModelWithAdapter(
  source: DownloadModelSource,
  options: {
    destinationDir: string;
    adapter: ReactNativeDownloadAdapter;
    onProgress?: (loaded: number, total: number | null) => void;
  }
): Promise<string> {
  const { destinationDir, adapter, onProgress } = options;
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
  await adapter.downloadToPath({
    url,
    path: destPath,
    onProgress,
  });
  return destPath;
}

/**
 * Create a React Native adapter from Expo FileSystem.
 */
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

/**
 * Create a React Native adapter from react-native-blob-util.
 */
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
