export { createEngine, LocalFirstEngine } from './core/engine.js';
export { buildTurnMessages } from './core/context-builder.js';
export { defineTool, type ToolDefinition } from './tools/define-tool.js';
export { ToolRegistry, type OpenAIStyleTool } from './tools/registry.js';
export { createLlamaRNProvider, type LlamaRNProviderOptions } from './providers/llama-rn.js';
export type {
  LLMProvider,
  CompletionRequest,
  CompletionResult,
  ChatMessageInput,
  TokenChunk,
} from './providers/types.js';
export { useLocalChat, type UseLocalChatResult } from './react/use-local-chat.js';
export { InMemoryVectorStore, type VectorStore } from './memory/store.js';
export { formatMemoryBlock } from './memory/rag.js';
export { tryParseJsonToolCall } from './core/tool-json.js';
export { summarizeTranscript } from './core/summarizer.js';
export { seedFingerprint, fnv1a32 } from './core/hash.js';
export { createNodeSessionStorageAdapter, type SessionStorageAdapter } from './core/session-storage.js';
export { defaultMetaPath, SESSION_META_VERSION, type SessionMetaV1 } from './core/session-meta.js';
export type {
  ChatMessage,
  ChatRole,
  EngineConfig,
  MemoryOptions,
  MemoryRecord,
  RecallResult,
  ResetOptions,
  SessionAutoSave,
  SessionOptions,
  ToolMode,
  VectorSearchHit,
} from './types.js';
