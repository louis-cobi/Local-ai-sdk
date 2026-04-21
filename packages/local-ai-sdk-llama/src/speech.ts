import type { LlamaContext } from 'llama.rn';

/**
 * Speech / TTS hooks on `LlamaContext` vary by llama.rn version. This placeholder
 * documents the intended integration point. When your native build exposes a
 * stable vocoder or `speech` API, call it from here.
 */
export function createSpeechSynthesizer(_ctx: LlamaContext): {
  speak: (text: string) => Promise<never>;
} {
  return {
    async speak() {
      throw new Error(
        'Speech synthesis is not implemented for this llama.rn build. Upgrade llama.rn or use an external TTS engine.'
      );
    },
  };
}
