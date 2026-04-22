/**
 * Fast deterministic non-crypto hash for seed/config fingerprinting.
 */
export function fnv1a32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function seedFingerprint(parts: string[]): string {
  return fnv1a32(parts.join('\u0001'));
}
