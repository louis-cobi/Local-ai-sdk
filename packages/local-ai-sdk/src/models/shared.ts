export type DownloadModelRetry = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
};

export type DownloadChecksum = {
  algorithm: 'sha256';
  expected: string;
};

export type DownloadModelSource = {
  repoId: string;
  filename: string;
  revision?: string;
};

export type ReactNativeDownloadAdapter = {
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
  downloadToPath(args: {
    url: string;
    path: string;
    onProgress?: (loaded: number, total: number | null) => void;
    signal?: AbortSignal;
    checksum?: DownloadChecksum;
  }): Promise<void>;
};

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

type RetryOptions = NonNullable<DownloadModelRetry>;

const DEFAULT_RETRY: Required<RetryOptions> = {
  attempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 3000,
  jitter: true,
};

export function huggingFaceResolveUrl(repoId: string, filename: string, revision = 'main'): string {
  const encoded = filename
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
  return `https://huggingface.co/${repoId}/resolve/${revision}/${encoded}`;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Download aborted');
  }
}

export async function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
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

export function normalizeRetry(input?: DownloadModelRetry): Required<RetryOptions> {
  return {
    attempts: Math.max(1, input?.attempts ?? DEFAULT_RETRY.attempts),
    baseDelayMs: Math.max(0, input?.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs),
    maxDelayMs: Math.max(0, input?.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs),
    jitter: input?.jitter ?? DEFAULT_RETRY.jitter,
  };
}

export function retryDelayMs(attempt: number, retry: Required<RetryOptions>): number {
  const base = Math.min(retry.maxDelayMs, retry.baseDelayMs * Math.pow(2, attempt));
  if (!retry.jitter) return base;
  return Math.floor(base * (0.75 + Math.random() * 0.5));
}

export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  if (msg.includes('aborted')) return false;
  if (msg.includes('checksum')) return false;
  return true;
}
