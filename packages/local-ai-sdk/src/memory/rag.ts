import type { VectorSearchHit } from '../types.js';

export function formatMemoryBlock(hits: VectorSearchHit[], maxChars: number): string {
  if (hits.length === 0) return '';
  const lines: string[] = [];
  let used = 0;
  for (const h of hits) {
    const meta = h.metadata && Object.keys(h.metadata).length ? ` (${JSON.stringify(h.metadata)})` : '';
    const line = `- ${h.content}${meta}`;
    if (used + line.length + 1 > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join('\n');
}
