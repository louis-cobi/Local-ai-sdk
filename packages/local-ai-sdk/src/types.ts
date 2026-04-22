import type { ToolDefinition } from './tools/define-tool.js';
import type { SessionStorageAdapter } from './core/session-storage.js';
import type { CompletionAdvancedParams } from './providers/types.js';

/** Chat role aligned with common chat templates. */
export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

/** User media for multimodal turns (URIs only; no large blobs in session meta). */
export type UserMediaPart =
  | { type: 'image'; uri: string }
  | { type: 'audio'; uri: string; format?: 'wav' | 'mp3' };

export type ChatMessage = {
  id: string;
  role: ChatRole;
  /** Primary text; may be empty when only media is sent. */
  content: string;
  /** Optional vision/audio attachments (file:// or app-resolved paths). */
  mediaParts?: UserMediaPart[];
  /** Present when role is `tool` or when logging tool results. */
  name?: string;
};

/** Input for a single user turn (text and optional media). */
export type SendMessageInput = {
  text: string;
  mediaParts?: UserMediaPart[];
  completion?: CompletionAdvancedParams;
};

export type ToolMode = 'native' | 'json';

export type SessionAutoSave = boolean | 'everyTurn' | number;

export type SessionOptions = {
  /** Filesystem path for the binary session (KV cache) file. */
  path: string;
  /** When to call `saveSession` after successful turns. */
  autoSave?: SessionAutoSave;
  /**
   * Optional path for JSON metadata (summary, window, seed hash).
   * Defaults to `${session.path}.meta.json`.
   */
  metaPath?: string;
  /**
   * Optional persistence adapter for metadata JSON.
   * If omitted, the engine tries Node `fs` (tests/Node); in React Native you should pass one.
   */
  storage?: SessionStorageAdapter;
};

export type MemoryOptions = {
  /** Recent user/assistant turns injected into each completion (default 4). */
  windowSize?: number;
  /** When logical turn count exceeds this, run summarization (default 20). */
  summaryThreshold?: number;
  /** Max characters injected from RAG / recalled memories (default 4000). */
  maxMemoryChars?: number;
  /** Max results to pull from the vector store on recall (default 5). */
  ragTopK?: number;
};

export type MemoryRecord = {
  id?: string;
  type?: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type VectorSearchHit = {
  id: string;
  score: number;
  content: string;
  metadata?: Record<string, unknown>;
};

export type EngineConfig = {
  provider: import('./providers/types.js').LLMProvider;
  systemPrompt: string;
  tools?: ToolDefinition[];
  session?: SessionOptions;
  memory?: MemoryOptions;
  /** How tool calls are resolved (default: `native` when tools exist). */
  toolMode?: ToolMode;
  /** Default max tokens per assistant generation. */
  maxPredict?: number;
  /** Default sampling temperature. */
  temperature?: number;
  /** Optional stop sequences passed to the provider. */
  stop?: string[];
  /** Default completion controls applied on each turn. */
  completionDefaults?: CompletionAdvancedParams;
  /**
   * Extra strings included in the seed fingerprint (e.g. model path, `n_ctx`)
   * to invalidate incompatible session files.
   */
  seedExtras?: string[];
};

export type ResetOptions = {
  /** When true, keep the same seed prefill; only clears chat state (default true). */
  keepSeed?: boolean;
};

export type RecallResult = {
  hits: VectorSearchHit[];
  /** Joined text block ready for prompt injection. */
  contextBlock: string;
};

export type { ToolDefinition };
