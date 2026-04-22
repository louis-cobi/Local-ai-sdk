import type { MemoryOptions, MemoryRecord, VectorSearchHit } from '../types.js';
import { InMemoryVectorStore, type VectorStore } from './store.js';

type RnBackendConfig = NonNullable<MemoryOptions['rnVectorBackend']>;

/**
 * RN vector backend bootstrap with graceful in-memory fallback.
 * Current implementation checks backend availability and uses in-memory vectors.
 */
export class RnVectorBackendStore implements VectorStore {
  private readonly fallback = new InMemoryVectorStore();
  private backendReady = false;
  private bootPromise: Promise<void> | null = null;

  constructor(private readonly config: RnBackendConfig) {}

  private async ensureBootstrapped(): Promise<void> {
    if (this.backendReady) return;
    if (!this.bootPromise) {
      this.bootPromise = this.bootstrap();
    }
    await this.bootPromise;
  }

  private async bootstrap(): Promise<void> {
    try {
      if (this.config.backend === 'op-sqlite') {
        await import('@op-engineering/op-sqlite');
      } else {
        await import('expo-vector-search');
      }
      this.backendReady = true;
    } catch {
      this.backendReady = false;
    }
  }

  async upsert(id: string, vector: number[], record: MemoryRecord): Promise<void> {
    await this.ensureBootstrapped();
    await this.fallback.upsert(id, vector, record);
  }

  async search(queryVector: number[], k: number): Promise<VectorSearchHit[]> {
    await this.ensureBootstrapped();
    return this.fallback.search(queryVector, k);
  }

  async delete(id: string): Promise<void> {
    await this.ensureBootstrapped();
    await this.fallback.delete(id);
  }
}

export function createVectorStore(memory?: MemoryOptions): VectorStore {
  if (memory?.vectorStore) return memory.vectorStore;
  if (memory?.rnVectorBackend?.kind === 'rn') {
    return new RnVectorBackendStore(memory.rnVectorBackend);
  }
  return new InMemoryVectorStore();
}

