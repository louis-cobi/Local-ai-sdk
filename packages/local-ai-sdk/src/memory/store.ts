import type { MemoryRecord, VectorSearchHit } from '../types.js';

export type VectorStore = {
  upsert(id: string, vector: number[], record: MemoryRecord): Promise<void>;
  search(queryVector: number[], k: number): Promise<VectorSearchHit[]>;
  delete(id: string): Promise<void>;
};

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Simple in-memory vector store (cosine similarity). Useful for tests and small apps.
 */
export class InMemoryVectorStore implements VectorStore {
  private readonly items = new Map<string, { vector: number[]; record: MemoryRecord }>();

  async upsert(id: string, vector: number[], record: MemoryRecord): Promise<void> {
    this.items.set(id, { vector, record: { ...record, id } });
  }

  async search(queryVector: number[], k: number): Promise<VectorSearchHit[]> {
    const scored: VectorSearchHit[] = [];
    for (const [id, item] of this.items.entries()) {
      scored.push({
        id,
        score: cosineSimilarity(queryVector, item.vector),
        content: item.record.content,
        metadata: item.record.metadata,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
