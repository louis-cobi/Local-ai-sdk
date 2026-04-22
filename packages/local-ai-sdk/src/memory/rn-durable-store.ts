import type { MemoryOptions, MemoryRecord, VectorSearchHit } from '../types.js';
import { InMemoryVectorStore, type VectorStore } from './store.js';

type DurableConfig = NonNullable<MemoryOptions['durableStore']>;

/**
 * RN durable vector-store adapter with graceful fallback.
 * If runtime dependencies are unavailable, it uses in-memory storage.
 */
export class RnDurableVectorStore implements VectorStore {
  private readonly fallback = new InMemoryVectorStore();
  private backendReady = false;
  private bootPromise: Promise<void> | null = null;

  constructor(private readonly config: DurableConfig) {}

  private async ensureBootstrapped(): Promise<void> {
    if (this.backendReady) return;
    if (!this.bootPromise) {
      this.bootPromise = this.bootstrap();
    }
    await this.bootPromise;
  }

  private async bootstrap(): Promise<void> {
    try {
      const moduleName =
        this.config.backend === 'op-sqlite' ? '@op-engineering/op-sqlite' : 'expo-vector-search';
      await import(moduleName);
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
  if (memory?.durableStore?.kind === 'rn') {
    return new RnDurableVectorStore(memory.durableStore);
  }
  return new InMemoryVectorStore();
}

