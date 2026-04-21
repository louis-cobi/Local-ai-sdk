import type { LLMProvider } from '../providers/types.js';

/**
 * Ask the model to compress older dialogue. This extends the active KV state;
 * pair with session save/load in the engine.
 */
export async function summarizeTranscript(
  provider: LLMProvider,
  transcript: string,
  opts: { maxPredict: number; temperature: number; stop?: string[] }
): Promise<string> {
  const prompt = [
    'Summarize the following dialogue for future context.',
    'Requirements:',
    '- Be concise (<= 200 words).',
    '- Preserve key facts, decisions, and user preferences.',
    '- Output plain text only (no JSON, no markdown fences).',
    '',
    'Dialogue:',
    transcript,
  ].join('\n');

  const res = await provider.complete({
    messages: [{ role: 'user', content: prompt }],
    n_predict: opts.maxPredict,
    temperature: opts.temperature,
    stop: opts.stop,
  });

  return (res.content || res.text).trim();
}
