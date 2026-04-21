import type { ChatMessage } from '../types.js';
import type { ChatMessageInput } from '../providers/types.js';

export type BuildContextParams = {
  summary: string;
  memoryBlock: string;
  window: ChatMessage[];
  userInput: string;
};

/**
 * Build chat messages for a new user turn.
 * Order: summary → retrieved memory → recent window → current user message.
 * The immutable system/tools seed is expected to live in the KV cache already.
 */
export function buildTurnMessages(params: BuildContextParams): ChatMessageInput[] {
  const out: ChatMessageInput[] = [];

  if (params.summary.trim().length > 0) {
    out.push({
      role: 'user',
      content: `Conversation summary:\n${params.summary.trim()}`,
    });
  }

  if (params.memoryBlock.trim().length > 0) {
    out.push({
      role: 'user',
      content: `Relevant memory:\n${params.memoryBlock.trim()}`,
    });
  }

  for (const m of params.window) {
    if (m.role === 'user' || m.role === 'assistant') {
      out.push({ role: m.role, content: m.content });
    }
  }

  out.push({ role: 'user', content: params.userInput });
  return out;
}
