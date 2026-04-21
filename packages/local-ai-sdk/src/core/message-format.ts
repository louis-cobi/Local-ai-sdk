import type { ChatMessage } from '../types.js';
import type { ChatMessageInput, LlamaMessageContentPart } from '../providers/types.js';

function guessAudioFormat(uri: string): 'wav' | 'mp3' {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.mp3')) return 'mp3';
  return 'wav';
}

/**
 * Map a stored chat message to provider message input (text or multimodal parts).
 */
export function chatMessageToInput(m: ChatMessage): ChatMessageInput {
  if (m.role !== 'user' || !m.mediaParts || m.mediaParts.length === 0) {
    return { role: m.role, content: m.content };
  }

  const parts: LlamaMessageContentPart[] = [];
  if (m.content.trim().length > 0) {
    parts.push({ type: 'text', text: m.content });
  }

  for (const p of m.mediaParts) {
    if (p.type === 'image') {
      parts.push({
        type: 'image_url',
        image_url: { url: p.uri },
      });
    } else if (p.type === 'audio') {
      parts.push({
        type: 'input_audio',
        input_audio: {
          url: p.uri,
          format: p.format ?? guessAudioFormat(p.uri),
        },
      });
    }
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', text: '' });
  }

  return { role: 'user', content: parts };
}

/**
 * Build the user turn for the current completion (summary/memory/window already applied).
 */
export function buildUserTurnInput(userMessage: ChatMessage): ChatMessageInput {
  return chatMessageToInput(userMessage);
}
