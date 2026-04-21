import type { ChatMessage } from '../types.js';

export const SESSION_META_VERSION = 1 as const;

export type SessionMetaV1 = {
  version: typeof SESSION_META_VERSION;
  seedHash: string;
  summary: string;
  messages: ChatMessage[];
  logicalTurnCount: number;
};

export function defaultMetaPath(sessionPath: string): string {
  return `${sessionPath}.meta.json`;
}
