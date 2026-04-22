import { mkdir, access, rename, rm } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';

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
  /** Optional cancellation signal. */
  signal?: AbortSignal;
  /** Optional retry policy for transient failures. */
  retry?: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitter?: boolean;
  };
  /** Optional integrity verification. */
  checksum?: {
    algorithm: 'sha256';
    expected: string;
  };
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
    signal?: AbortSignal;
    checksum?: { algorithm: 'sha256'; expected: string };
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

type RetryOptions = NonNullable<DownloadModelOptions['retry']>;

const DEFAULT_RETRY: Required<RetryOptions> = {
  attempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 3000,
  jitter: true,
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

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Download aborted');
  }
}

async function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (!signal) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return;
  }
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      reject(new Error('Download aborted'));
    };
    timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function normalizeRetry(input?: DownloadModelOptions['retry']): Required<RetryOptions> {
  return {
    attempts: Math.max(1, input?.attempts ?? DEFAULT_RETRY.attempts),
    baseDelayMs: Math.max(0, input?.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs),
    maxDelayMs: Math.max(0, input?.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs),
    jitter: input?.jitter ?? DEFAULT_RETRY.jitter,
  };
}

function retryDelayMs(attempt: number, retry: Required<RetryOptions>): number {
  const base = Math.min(retry.maxDelayMs, retry.baseDelayMs * Math.pow(2, attempt));
  if (!retry.jitter) return base;
  return Math.floor(base * (0.75 + Math.random() * 0.5));
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  if (msg.includes('aborted')) return false;
  if (msg.includes('checksum')) return false;
  return true;
}

function normalizeDigest(value: string): string {
  return value.trim().toLowerCase();
}

async function verifyChecksumOrThrow(path: string, checksum?: { algorithm: 'sha256'; expected: string }): Promise<void> {
  if (!checksum) return;
  if (checksum.algorithm !== 'sha256') {
    throw new Error(`Unsupported checksum algorithm: ${checksum.algorithm}`);
  }
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on('data', (chunk: string | Buffer) => {
      hash.update(chunk);
    });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  const got = hash.digest('hex');
  const expected = normalizeDigest(checksum.expected);
  if (got !== expected) {
    throw new Error(`Checksum mismatch for ${path}: expected ${expected}, got ${got}`);
  }
}

async function streamToFile(
  response: Response,
  outPath: string,
  opts: {
    total: number | null;
    signal?: AbortSignal;
    onProgress?: (loaded: number, total: number | null) => void;
  }
): Promise<void> {
  if (!response.body) {
    throw new Error('Response body is empty');
  }
  let loaded = 0;
  const source = Readable.fromWeb(response.body as any);
  source.on('data', (chunk: Buffer | Uint8Array) => {
    loaded += chunk.length;
    opts.onProgress?.(loaded, opts.total);
    throwIfAborted(opts.signal);
  });
  const target = createWriteStream(outPath, { flags: 'w' });
  await pipeline(source, target, { signal: opts.signal });
  if (loaded === 0) {
    opts.onProgress?.(0, opts.total);
  }
}

async function downloadAttempt(options: DownloadModelOptions, destPath: string): Promise<void> {
  const { repoId, filename, revision = 'main', onProgress, signal } = options;
  throwIfAborted(signal);
  const url = huggingFaceResolveUrl(repoId, filename, revision);
  const res = await fetch(url, {
    redirect: 'follow',
    signal,
    headers: {
      Accept: 'application/octet-stream',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to download model (${res.status} ${res.statusText}): ${url}`);
  }
  const lenHeader = res.headers.get('content-length');
  const total = lenHeader ? parseInt(lenHeader, 10) : null;

  const tempPath = `${destPath}.part`;
  await rm(tempPath, { force: true });
  try {
    await streamToFile(res, tempPath, { total, signal, onProgress });
    await verifyChecksumOrThrow(tempPath, options.checksum);
    await rename(tempPath, destPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
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
  const { filename, destinationDir, signal } = options;
  const retry = normalizeRetry(options.retry);
  await mkdir(destinationDir, { recursive: true });
  const destPath = join(destinationDir, filename);
  if (await pathExists(destPath)) {
    await verifyChecksumOrThrow(destPath, options.checksum);
    return destPath;
  }
  await mkdir(dirname(destPath), { recursive: true });
  let lastError: unknown = null;
  for (let attempt = 0; attempt < retry.attempts; attempt++) {
    throwIfAborted(signal);
    try {
      await downloadAttempt(options, destPath);
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

/**
 * Generic RN path using an injected adapter (Expo FS, blob-util, or custom).
 */
export async function downloadModelWithAdapter(
  source: DownloadModelSource,
  options: {
    destinationDir: string;
    adapter: ReactNativeDownloadAdapter;
    onProgress?: (loaded: number, total: number | null) => void;
    signal?: AbortSignal;
    retry?: DownloadModelOptions['retry'];
    checksum?: { algorithm: 'sha256'; expected: string };
  }
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
