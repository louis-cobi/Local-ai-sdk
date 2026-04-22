export {
  createLlamaRNProvider,
  type LlamaRNProviderOptions,
} from './providers/llama/create-provider.js';
export { createSpeechSynthesizer } from './providers/llama/speech.js';
export {
  createBlobUtilAdapter,
  createExpoFileSystemAdapter,
  downloadModel,
  downloadModelWithAdapter,
  getModelPathIfCached,
  huggingFaceResolveUrl,
  type BlobUtilLike,
  type DownloadModelOptions,
  type DownloadModelSource,
  type ExpoFileSystemLike,
  type ReactNativeDownloadAdapter,
} from './models/download.js';

export { createEngine, LocalFirstEngine } from './core/engine.js';
export { buildTurnMessages } from './core/context-builder.js';
export { chatMessageToInput, buildUserTurnInput } from './core/message-format.js';
export { defineTool, type ToolDefinition } from './tools/define-tool.js';
export { defineToolZod } from './tools/define-tool-zod.js';
export { ToolRegistry, type OpenAIStyleTool } from './tools/registry.js';
export type {
  BenchResult,
  BaseLLMProvider,
  LLMProvider,
  SessionProviderCapability,
  EmbeddingProviderCapability,
  RuntimeProviderCapability,
  MultimodalProviderCapability,
  LoraProviderCapability,
  VocoderProviderCapability,
  ParallelProviderCapability,
  SpeechProviderCapability,
  SpeechSynthesizer,
  ProviderCapabilities,
  CompletionAdvancedParams,
  CompletionRequest,
  CompletionResult,
  CompletionResponseFormat,
  CompletionReasoningFormat,
  AsyncRequestHandle,
  CompletionRequestHandle,
  EmbeddingParams,
  RerankParams,
  RerankResult,
  ParallelAPI,
  ParallelStatus,
  ParallelRequestStatus,
  LoraAdapter,
  MultimodalInitOptions,
  VocoderInitOptions,
  ChatMessageInput,
  TokenChunk,
  LlamaMessageContentPart,
} from './providers/types.js';
export { useLocalChat, type UseLocalChatResult } from './react/use-local-chat.js';
export { InMemoryVectorStore, type VectorStore } from './memory/store.js';
export { RnVectorBackendStore, createVectorStore } from './memory/rn-vector-backend-store.js';
export { formatMemoryBlock } from './memory/rag.js';
export { tryParseJsonToolCall } from './core/tool-json.js';
export { summarizeTranscript } from './core/summarizer.js';
export { seedFingerprint, fnv1a32 } from './core/hash.js';
export { createNodeSessionStorageAdapter, type SessionStorageAdapter } from './core/session-storage.js';
export { defaultMetaPath, SESSION_META_VERSION, type SessionMetaV1 } from './core/session-meta.js';
export { EngineError, type EngineErrorCode } from './core/errors.js';
export { assertBaseProviderCompliance, runProviderComplianceSuite } from './testing/provider-compliance.js';
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
  SendMessageInput,
  UserMediaPart,
} from './types.js';
