import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createNodeSessionStorageAdapter } from '../src/core/session-storage.js';

describe('createNodeSessionStorageAdapter', () => {
  it('creates parent directories before writing text', async () => {
    const adapter = await createNodeSessionStorageAdapter();
    expect(adapter).not.toBeNull();

    const root = await mkdtemp(join(tmpdir(), 'local-ai-sdk-meta-'));
    const target = join(root, 'nested', 'state', 'session.meta.json');

    try {
      await adapter!.writeText(target, '{"ok":true}');
      const persisted = await readFile(target, 'utf8');
      expect(persisted).toBe('{"ok":true}');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
