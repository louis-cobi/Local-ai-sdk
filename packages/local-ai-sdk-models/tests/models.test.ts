import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { getModelPathIfCached, huggingFaceResolveUrl, downloadModel } from '../src/index.js';

describe('local-ai-sdk-models', () => {
  it('huggingFaceResolveUrl builds resolve path', () => {
    const u = huggingFaceResolveUrl('org/repo', 'folder/file.gguf', 'main');
    expect(u).toContain('org/repo');
    expect(u).toContain('resolve/main/folder/file.gguf');
  });

  it('getModelPathIfCached returns null when missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lasm-'));
    try {
      expect(await getModelPathIfCached({ destinationDir: dir, filename: 'missing.gguf' })).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('getModelPathIfCached returns path when file exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lasm-'));
    const path = join(dir, 'x.gguf');
    await writeFile(path, 'x');
    try {
      expect(await getModelPathIfCached({ destinationDir: dir, filename: 'x.gguf' })).toBe(path);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('downloadModel writes file when fetch succeeds', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lasm-'));
    const buf = new Uint8Array([1, 2, 3]);
    fetchSpy!.mockResolvedValue(
      new Response(buf, {
        status: 200,
        headers: { 'content-length': String(buf.byteLength) },
      })
    );
    try {
      const p = await downloadModel({
        repoId: 'x/y',
        filename: 'm.gguf',
        destinationDir: dir,
      });
      expect(p).toBe(join(dir, 'm.gguf'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('downloadModel reports chunked progress and validates checksum', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lasm-'));
    const c1 = new Uint8Array([1, 2]);
    const c2 = new Uint8Array([3, 4, 5]);
    const expected = createHash('sha256')
      .update(Buffer.from([...c1, ...c2]))
      .digest('hex');
    fetchSpy!.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(c1);
            controller.enqueue(c2);
            controller.close();
          },
        }),
        {
          status: 200,
          headers: { 'content-length': String(c1.byteLength + c2.byteLength) },
        }
      )
    );
    const progress: number[] = [];
    try {
      await downloadModel({
        repoId: 'x/y',
        filename: 'progress.gguf',
        destinationDir: dir,
        checksum: { algorithm: 'sha256', expected },
        onProgress: (loaded) => progress.push(loaded),
      });
      expect(progress).toEqual([2, 5]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('downloadModel retries after transient failure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lasm-'));
    const okBytes = new Uint8Array([9, 9, 9]);
    fetchSpy!
      .mockRejectedValueOnce(new Error('network unstable'))
      .mockResolvedValueOnce(
        new Response(okBytes, {
          status: 200,
          headers: { 'content-length': String(okBytes.byteLength) },
        })
      );
    try {
      const out = await downloadModel({
        repoId: 'x/y',
        filename: 'retry.gguf',
        destinationDir: dir,
        retry: { attempts: 2, baseDelayMs: 1, maxDelayMs: 2, jitter: false },
      });
      expect(out).toBe(join(dir, 'retry.gguf'));
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('downloadModel aborts and removes temporary file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lasm-'));
    const ac = new AbortController();
    fetchSpy!.mockResolvedValue(
      new Response(
        new ReadableStream({
          async start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            await delay(10);
            controller.enqueue(new Uint8Array([4, 5, 6]));
            controller.close();
          },
        }),
        {
          status: 200,
          headers: { 'content-length': '6' },
        }
      )
    );
    const task = downloadModel({
      repoId: 'x/y',
      filename: 'abort.gguf',
      destinationDir: dir,
      signal: ac.signal,
      retry: { attempts: 1, jitter: false },
    });
    ac.abort();
    try {
      await expect(task).rejects.toThrow(/aborted/i);
      const part = await getModelPathIfCached({ destinationDir: dir, filename: 'abort.gguf.part' });
      expect(part).toBeNull();
      const final = await getModelPathIfCached({ destinationDir: dir, filename: 'abort.gguf' });
      expect(final).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('downloadModel fails on checksum mismatch and cleans up temp file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lasm-'));
    fetchSpy!.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    try {
      await expect(
        downloadModel({
          repoId: 'x/y',
          filename: 'bad-checksum.gguf',
          destinationDir: dir,
          checksum: { algorithm: 'sha256', expected: 'deadbeef' },
          retry: { attempts: 1, jitter: false },
        })
      ).rejects.toThrow(/checksum/i);
      const part = await getModelPathIfCached({ destinationDir: dir, filename: 'bad-checksum.gguf.part' });
      expect(part).toBeNull();
      const final = await getModelPathIfCached({ destinationDir: dir, filename: 'bad-checksum.gguf' });
      expect(final).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
