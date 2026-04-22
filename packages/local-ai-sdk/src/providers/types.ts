import type { OpenAIStyleTool } from '../tools/registry.js';

/** OpenAI-compatible multimodal parts for llama.rn `completion`. */
export type LlamaMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | {
      type: 'input_audio';
      input_audio: { data?: string; url?: string; format?: 'wav' | 'mp3' };
    };

export type ChatMessageInput = {
  role: string;
  content?: string | LlamaMessageContentPart[];
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
};

export type NativeToolCall = {
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  id?: string;
};

export type CompletionResponseFormat = {
  type: 'text' | 'json_object' | 'json_schema';
  json_schema?: {
    strict?: boolean;
    schema: object;
  };
  schema?: object;
};

export type CompletionReasoningFormat = 'none' | 'auto' | 'deepseek';

export type CompletionAdvancedParams = {
  prompt?: string;
  chatTemplate?: string;
  chat_template?: string;
  jinja?: boolean;
  parallel_tool_calls?: object;
  response_format?: CompletionResponseFormat;
  media_paths?: string | string[];
  add_generation_prompt?: boolean;
  now?: string | number;
  chat_template_kwargs?: Record<string, unknown>;
  force_pure_content?: boolean;
  prefill_text?: string;

  top_k?: number;
  top_p?: number;
  min_p?: number;
  typical_p?: number;
  temp?: number;
  repeat_penalty?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  mirostat?: number;
  mirostat_tau?: number;
  mirostat_eta?: number;
  n_probs?: number;
  seed?: number;
  ignore_eos?: boolean;
  penalty_last_n?: number;
  penalty_repeat?: number;
  penalty_freq?: number;
  penalty_present?: number;
  penalize_nl?: boolean;
  dry_multiplier?: number;
  dry_base?: number;
  dry_allowed_length?: number;
  dry_penalty_last_n?: number;
  dry_sequence_breakers?: string[];
  grammar?: string;
  grammar_lazy?: boolean;
  grammar_triggers?: string[];
  preserved_tokens?: string[];
  chat_format?: number;
  generation_prompt?: string;
  thinking_forced_open?: boolean;
  thinking_start_tag?: string;
  thinking_end_tag?: string;
  chat_parser?: string;
  enable_thinking?: boolean;
  reasoning_format?: CompletionReasoningFormat;
  n_threads?: number;
  n_threads_batch?: number;
  n_batch?: number;
  n_ubatch?: number;
};

export type CompletionRequest = {
  messages: ChatMessageInput[];
  n_predict: number;
  temperature?: number;
  stop?: string[];
  tools?: OpenAIStyleTool[];
  tool_choice?: string;
} & CompletionAdvancedParams;

export type CompletionResult = {
  text: string;
  content: string;
  tool_calls: NativeToolCall[];
};

export type TokenChunk = {
  token: string;
  content?: string;
  reasoning_content?: string;
  tool_calls?: NativeToolCall[];
  accumulated_text?: string;
  requestId?: number;
};

export type EmbeddingParams = {
  embd_normalize?: number;
};

export type RerankParams = {
  normalize?: number;
};

export type RerankResult = {
  score: number;
  index: number;
  document?: string;
};

export type CompletionRequestHandle = {
  requestId: number;
  promise: Promise<CompletionResult>;
  stop: () => Promise<void>;
};

export type AsyncRequestHandle<T> = {
  requestId: number;
  promise: Promise<T>;
};

export type ParallelRequestStatus = {
  requestId: number;
  status: string;
  progress?: number;
  queuePosition?: number;
};

export type ParallelStatus = {
  enabled: boolean;
  maxSlots: number;
  queueLength: number;
  activeRequests: ParallelRequestStatus[];
};

export type BenchResult = {
  nKvMax: number;
  nBatch: number;
  nUBatch: number;
  flashAttn: number;
  isPpShared: number;
  nGpuLayers: number;
  nThreads: number;
  nThreadsBatch: number;
  pp: number;
  tg: number;
  pl: number;
  nKv: number;
  tPp: number;
  speedPp: number;
  tTg: number;
  speedTg: number;
  t: number;
  speed: number;
};

export type LoraAdapter = {
  path: string;
  scaled?: number;
};

export type MultimodalInitOptions = {
  path: string;
  use_gpu?: boolean;
  image_min_tokens?: number;
  image_max_tokens?: number;
};

export type VocoderInitOptions = {
  path: string;
  n_batch?: number;
};

export type ParallelAPI = {
  completion(
    req: CompletionRequest,
    onToken?: (requestId: number, chunk: TokenChunk) => void
  ): Promise<CompletionRequestHandle>;
  embedding(text: string, params?: EmbeddingParams): Promise<AsyncRequestHandle<{ embedding: number[] }>>;
  rerank(
    query: string,
    documents: string[],
    params?: RerankParams
  ): Promise<AsyncRequestHandle<RerankResult[]>>;
  enable(config?: { n_parallel?: number; n_batch?: number }): Promise<boolean>;
  disable(): Promise<boolean>;
  configure(config: { n_parallel?: number; n_batch?: number }): Promise<boolean>;
  getStatus(): Promise<ParallelStatus>;
  subscribeToStatus(callback: (status: ParallelStatus) => void): Promise<{ remove: () => void }>;
};

export type BaseLLMProvider = {
  init(): Promise<void>;
  dispose(): Promise<void>;
  complete(
    req: CompletionRequest,
    onToken?: (chunk: TokenChunk) => void
  ): Promise<CompletionResult>;
  stopCompletion(): Promise<void>;
};

export type SessionProviderCapability = {
  saveSession(path: string): Promise<void>;
  loadSession(path: string): Promise<void>;
};

export type EmbeddingProviderCapability = {
  embed(text: string): Promise<number[]>;
};

export type RuntimeProviderCapability = {
  tokenize(text: string, opts?: { media_paths?: string[] }): Promise<{ tokens: number[] }>;
  detokenize(tokens: number[]): Promise<string>;
  rerank(query: string, documents: string[], params?: RerankParams): Promise<RerankResult[]>;
  bench(pp: number, tg: number, pl: number, nr: number): Promise<BenchResult>;
  clearCache(clearData?: boolean): Promise<void>;
  loadModelInfo(modelPath?: string): Promise<Record<string, unknown>>;
};

export type MultimodalProviderCapability = {
  initMultimodal(opts: MultimodalInitOptions): Promise<boolean>;
  isMultimodalEnabled(): Promise<boolean>;
  getMultimodalSupport(): Promise<{ vision: boolean; audio: boolean }>;
  releaseMultimodal(): Promise<void>;
};

export type LoraProviderCapability = {
  applyLoraAdapters(loraList: LoraAdapter[]): Promise<void>;
  removeLoraAdapters(): Promise<void>;
  getLoadedLoraAdapters(): Promise<LoraAdapter[]>;
};

export type VocoderProviderCapability = {
  initVocoder(opts: VocoderInitOptions): Promise<boolean>;
  isVocoderEnabled(): Promise<boolean>;
  getFormattedAudioCompletion(
    speaker: Record<string, unknown> | null,
    textToSpeak: string
  ): Promise<{ prompt: string; grammar?: string }>;
  getAudioCompletionGuideTokens(textToSpeak: string): Promise<number[]>;
  decodeAudioTokens(tokens: number[]): Promise<number[]>;
  releaseVocoder(): Promise<void>;
};

export type ParallelProviderCapability = {
  parallel: ParallelAPI;
};

export type SpeechSynthesizer = {
  speak(text: string): Promise<number[]>;
};

export type SpeechProviderCapability = {
  speech: SpeechSynthesizer;
};

/**
 * Capability-based provider surface.
 * Engine only requires BaseLLMProvider; extra runtime APIs are optional.
 */
export type LLMProvider = BaseLLMProvider &
  Partial<
    SessionProviderCapability &
      EmbeddingProviderCapability &
      RuntimeProviderCapability &
      MultimodalProviderCapability &
      LoraProviderCapability &
      VocoderProviderCapability &
      ParallelProviderCapability &
      SpeechProviderCapability
  >;
};
