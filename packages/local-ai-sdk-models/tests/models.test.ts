import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
});
