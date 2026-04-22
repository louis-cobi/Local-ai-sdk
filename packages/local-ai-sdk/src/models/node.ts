import { mkdir, access, rename, rm } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import {
  huggingFaceResolveUrl,
  isRetryableError,
  normalizeRetry,
  retryDelayMs,
  sleepWithSignal,
  throwIfAborted,
  type DownloadChecksum,
  type DownloadModelRetry,
} from './shared.js';

export type DownloadModelOptions = {
  repoId: string;
  filename: string;
  revision?: string;
  destinationDir: string;
  onProgress?: (loaded: number, total: number | null) => void;
  signal?: AbortSignal;
  retry?: DownloadModelRetry;
  checksum?: DownloadChecksum;
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeDigest(value: string): string {
  return value.trim().toLowerCase();
}

async function verifyChecksumOrThrow(path: string, checksum?: DownloadChecksum): Promise<void> {
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
  const source = Readable.fromWeb(response.body as never);
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

export async function getModelPathIfCached(options: {
  destinationDir: string;
  filename: string;
}): Promise<string | null> {
  const full = join(options.destinationDir, options.filename);
  return (await pathExists(full)) ? full : null;
}

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
