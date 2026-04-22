import type { LlamaContext } from 'llama.rn';

/**
 * Speech helper built on llama.rn vocoder APIs.
 */
export function createSpeechSynthesizer(_ctx: LlamaContext): {
  speak: (text: string) => Promise<number[]>;
} {
  const ctx = _ctx as LlamaContext & {
    isVocoderEnabled?: () => Promise<boolean>;
    getAudioCompletionGuideTokens?: (textToSpeak: string) => Promise<number[]>;
    completion?: (
      params: {
        prompt: string;
        n_predict?: number;
        grammar?: string;
      },
      callback?: (data: { token: string }) => void
    ) => Promise<{ text?: string; tokens?: number[] }>;
    getFormattedAudioCompletion?: (
      speaker: Record<string, unknown> | null,
      textToSpeak: string
    ) => Promise<{ prompt: string; grammar?: string }>;
    decodeAudioTokens?: (tokens: number[]) => Promise<number[]>;
  };

  return {
    async speak(text: string) {
      if (!text.trim()) throw new Error('speak(text) requires non-empty text.');
      if (
        typeof ctx.isVocoderEnabled !== 'function' ||
        typeof ctx.getFormattedAudioCompletion !== 'function' ||
        typeof ctx.getAudioCompletionGuideTokens !== 'function' ||
        typeof ctx.completion !== 'function' ||
        typeof ctx.decodeAudioTokens !== 'function'
      ) {
        throw new Error(
          'Speech synthesis is not available in this llama.rn build. Ensure vocoder APIs are enabled.'
        );
      }
      const enabled = await ctx.isVocoderEnabled();
      if (!enabled) {
        throw new Error(
          'Vocoder is not enabled. Call initVocoder(...) on the context before speak(...).'
        );
      }
      const formatted = await ctx.getFormattedAudioCompletion(null, text);
      const guideTokens = await ctx.getAudioCompletionGuideTokens(text);
      const completion = (await ctx.completion({
        prompt: formatted.prompt,
        grammar: formatted.grammar,
        n_predict: Math.max(64, guideTokens.length * 2),
      })) as { tokens?: number[] };
      const tokens = Array.isArray(completion.tokens) ? completion.tokens : [];
      return ctx.decodeAudioTokens(tokens);
    },
  };
}
