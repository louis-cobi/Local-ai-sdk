import type { ChatMessage } from '../types.js';
import type { ChatMessageInput } from '../providers/types.js';
import { chatMessageToInput } from './message-format.js';

export type BuildContextParams = {
  summary: string;
  memoryBlock: string;
  window: ChatMessage[];
  /** The latest user message for this turn (may include media). */
  userMessage: ChatMessage;
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
      out.push(chatMessageToInput(m));
    }
  }

  out.push(chatMessageToInput(params.userMessage));
  return out;
}
