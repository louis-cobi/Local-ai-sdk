import type { ContextParams, LlamaContext, TokenData } from 'llama.rn';
import { initLlama, loadLlamaModelInfo } from 'llama.rn';
import type { CompletionRequest, CompletionResult, LLMProvider, TokenChunk } from 'local-ai-sdk';
import { createSpeechSynthesizer } from './speech.js';

type BenchResult = {
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

type EmbeddingParams = {
  embd_normalize?: number;
};

type RerankParams = {
  normalize?: number;
};

type RerankResult = {
  score: number;
  index: number;
  document?: string;
};

type LoraAdapter = {
  path: string;
  scaled?: number;
};

type MultimodalInitOptions = {
  path: string;
  use_gpu?: boolean;
  image_min_tokens?: number;
  image_max_tokens?: number;
};

type VocoderInitOptions = {
  path: string;
  n_batch?: number;
};

type ParallelAPI = {
  completion(
    req: CompletionRequest,
    onToken?: (requestId: number, chunk: TokenChunk) => void
  ): Promise<{ requestId: number; promise: Promise<CompletionResult>; stop: () => Promise<void> }>;
  embedding(
    text: string,
    params?: EmbeddingParams
  ): Promise<{ requestId: number; promise: Promise<{ embedding: number[] }> }>;
  rerank(
    query: string,
    documents: string[],
    params?: RerankParams
  ): Promise<{ requestId: number; promise: Promise<RerankResult[]> }>;
  enable(config?: { n_parallel?: number; n_batch?: number }): Promise<boolean>;
  disable(): Promise<boolean>;
  configure(config: { n_parallel?: number; n_batch?: number }): Promise<boolean>;
  getStatus(): Promise<{
    enabled: boolean;
    maxSlots: number;
    queueLength: number;
    activeRequests: Array<{ requestId: number; status: string; progress?: number; queuePosition?: number }>;
  }>;
  subscribeToStatus(callback: (status: unknown) => void): Promise<{ remove: () => void }>;
};

type LlamaRNProvider = LLMProvider & {
  tokenize(text: string, opts?: { media_paths?: string[] }): Promise<{ tokens: number[] }>;
  detokenize(tokens: number[]): Promise<string>;
  rerank(query: string, documents: string[], params?: RerankParams): Promise<RerankResult[]>;
  bench(pp: number, tg: number, pl: number, nr: number): Promise<BenchResult>;
  clearCache(clearData?: boolean): Promise<void>;
  initMultimodal(opts: MultimodalInitOptions): Promise<boolean>;
  isMultimodalEnabled(): Promise<boolean>;
  getMultimodalSupport(): Promise<{ vision: boolean; audio: boolean }>;
  releaseMultimodal(): Promise<void>;
  applyLoraAdapters(loraList: LoraAdapter[]): Promise<void>;
  removeLoraAdapters(): Promise<void>;
  getLoadedLoraAdapters(): Promise<LoraAdapter[]>;
  initVocoder(opts: VocoderInitOptions): Promise<boolean>;
  isVocoderEnabled(): Promise<boolean>;
  getFormattedAudioCompletion(
    speaker: Record<string, unknown> | null,
    textToSpeak: string
  ): Promise<{ prompt: string; grammar?: string }>;
  getAudioCompletionGuideTokens(textToSpeak: string): Promise<number[]>;
  decodeAudioTokens(tokens: number[]): Promise<number[]>;
  releaseVocoder(): Promise<void>;
  loadModelInfo(modelPath?: string): Promise<Record<string, unknown>>;
  parallel: ParallelAPI;
};

/** llama.rn may expose multimodal helpers only on newer releases. */
type LlamaContextMultimodal = LlamaContext & {
  initMultimodal?: (opts: MultimodalInitOptions) => Promise<boolean>;
  isMultimodalEnabled?: () => Promise<boolean>;
  getMultimodalSupport?: () => Promise<{ vision: boolean; audio: boolean }>;
  releaseMultimodal?: () => Promise<void>;
};

type LlamaContextAdvanced = LlamaContextMultimodal & {
  tokenize?: (
    text: string,
    opts?: {
      media_paths?: string[];
    }
  ) => Promise<{ tokens: number[] }>;
  detokenize?: (tokens: number[]) => Promise<string>;
  rerank?: (query: string, documents: string[], params?: RerankParams) => Promise<RerankResult[]>;
  bench?: (pp: number, tg: number, pl: number, nr: number) => Promise<BenchResult>;
  clearCache?: (clearData?: boolean) => Promise<void>;
  applyLoraAdapters?: (loraList: LoraAdapter[]) => Promise<void>;
  removeLoraAdapters?: () => Promise<void>;
  getLoadedLoraAdapters?: () => Promise<LoraAdapter[]>;
  initVocoder?: (opts: VocoderInitOptions) => Promise<boolean>;
  isVocoderEnabled?: () => Promise<boolean>;
  getFormattedAudioCompletion?: (
    speaker: Record<string, unknown> | null,
    textToSpeak: string
  ) => Promise<{ prompt: string; grammar?: string }>;
  getAudioCompletionGuideTokens?: (textToSpeak: string) => Promise<number[]>;
  decodeAudioTokens?: (tokens: number[]) => Promise<number[]>;
  releaseVocoder?: () => Promise<void>;
  parallel?: ParallelAPI;
};

export type LlamaRNProviderOptions = {
  modelPath: string;
  /** Maps to llama.rn `n_ctx`. */
  contextSize?: number;
  n_gpu_layers?: number;
  n_batch?: number;
  n_threads?: number;
  use_mlock?: boolean;
  use_mmap?: boolean;
  flash_attn?: boolean;
  /**
   * Context shifting. For multimodal models, llama.rn recommends disabling shifting.
   * Default: `false` when `mmprojPath` is set, otherwise `true`.
   */
  ctx_shift?: boolean;
  /** Set `true` to expose `embedding()` on the context. */
  embedding?: boolean;
  pooling_type?: ContextParams['pooling_type'];
  /** Multimodal projector (Gemma 4, LLaVA, etc.). Requires a compatible llama.rn build with `initMultimodal`. */
  mmprojPath?: string;
  /** Forwarded to `initMultimodal` when supported (default true). */
  mmprojUseGpu?: boolean;
  mmprojImageMinTokens?: number;
  mmprojImageMaxTokens?: number;
  /** Forward any extra llama.rn ContextParams. */
  extra?: Partial<ContextParams>;
  onProgress?: (progress: number) => void;
};

function mapTokenChunk(data: TokenData): TokenChunk {
  const tokenData = data as TokenData & {
    content?: string;
    reasoning_content?: string;
    tool_calls?: unknown[];
    accumulated_text?: string;
    requestId?: number;
  };
  return {
    token: tokenData.token,
    content: tokenData.content,
    reasoning_content: tokenData.reasoning_content,
    tool_calls: tokenData.tool_calls,
    accumulated_text: tokenData.accumulated_text,
    requestId: tokenData.requestId,
  } as TokenChunk;
}

function mapCompletionRequestToLlamaParams(req: CompletionRequest): Record<string, unknown> {
  return {
    ...req,
    tools: req.tools as object | undefined,
  };
}

/**
 * Create an `LLMProvider` backed by llama.rn (`initLlama`).
 */
export function createLlamaRNProvider(options: LlamaRNProviderOptions): LlamaRNProvider {
  let ctx: LlamaContext | null = null;
  const multimodal = Boolean(options.mmprojPath);
  const ctxShiftDefault = options.ctx_shift ?? !multimodal;

  const params: ContextParams = {
    model: options.modelPath,
    n_ctx: options.contextSize,
    n_gpu_layers: options.n_gpu_layers,
    n_batch: options.n_batch,
    n_threads: options.n_threads,
    use_mlock: options.use_mlock,
    use_mmap: options.use_mmap,
    flash_attn: options.flash_attn,
    ctx_shift: ctxShiftDefault,
    embedding: options.embedding,
    pooling_type: options.pooling_type,
    ...options.extra,
  };

  const requireCtx = (): LlamaContextAdvanced => {
    if (!ctx) throw new Error('Llama provider not initialized. Call init() first.');
    return ctx as LlamaContextAdvanced;
  };

  const requireFeature = <T>(value: T | undefined, feature: string): T => {
    if (!value) {
      throw new Error(`Current llama.rn build does not expose ${feature}.`);
    }
    return value;
  };

  const parallelApi: ParallelAPI = {
    async completion(req: CompletionRequest, onToken?: (requestId: number, chunk: TokenChunk) => void) {
      const c = requireCtx();
      const parallel = requireFeature(c.parallel, 'parallel mode');
      const request = await parallel.completion(
        mapCompletionRequestToLlamaParams(req) as CompletionRequest,
        onToken
          ? (requestId, data) => {
            onToken(requestId, mapTokenChunk(data as TokenData));
            }
          : undefined
      );
      return {
        requestId: request.requestId,
        promise: request.promise.then((result: { text: string; content?: string; tool_calls?: unknown[] }) => ({
          text: result.text,
          content: result.content ?? result.text,
          tool_calls: (result.tool_calls ?? []) as CompletionResult['tool_calls'],
        })),
        stop: request.stop,
      };
    },
    async embedding(text: string, p?: EmbeddingParams) {
      const c = requireCtx();
      const parallel = requireFeature(c.parallel, 'parallel embedding');
      return parallel.embedding(text, p);
    },
    async rerank(query: string, documents: string[], p?: RerankParams) {
      const c = requireCtx();
      const parallel = requireFeature(c.parallel, 'parallel rerank');
      return parallel.rerank(query, documents, p);
    },
    async enable(config?: { n_parallel?: number; n_batch?: number }) {
      const c = requireCtx();
      const parallel = requireFeature(c.parallel, 'parallel mode');
      return parallel.enable(config);
    },
    async disable() {
      const c = requireCtx();
      const parallel = requireFeature(c.parallel, 'parallel mode');
      return parallel.disable();
    },
    async configure(config: { n_parallel?: number; n_batch?: number }) {
      const c = requireCtx();
      const parallel = requireFeature(c.parallel, 'parallel mode');
      return parallel.configure(config);
    },
    async getStatus() {
      const c = requireCtx();
      const parallel = requireFeature(c.parallel, 'parallel status');
      return parallel.getStatus();
    },
    async subscribeToStatus(callback: (status: unknown) => void) {
      const c = requireCtx();
      const parallel = requireFeature(c.parallel, 'parallel status subscriptions');
      return parallel.subscribeToStatus(callback);
    },
  };

  return {
    async init() {
      if (ctx) return;
      ctx = await initLlama(params, options.onProgress);
      if (options.mmprojPath) {
        const c = ctx as LlamaContextMultimodal;
        if (typeof c.initMultimodal === 'function') {
          await c.initMultimodal({
            path: options.mmprojPath,
            use_gpu: options.mmprojUseGpu ?? true,
            image_min_tokens: options.mmprojImageMinTokens,
            image_max_tokens: options.mmprojImageMaxTokens,
          });
        }
      }
    },

    async dispose() {
      if (!ctx) return;
      const c = ctx as LlamaContextMultimodal;
      if (typeof c.releaseMultimodal === 'function') {
        await c.releaseMultimodal();
      }
      await ctx.release();
      ctx = null;
    },

    async complete(req: CompletionRequest, onToken?: (chunk: TokenChunk) => void): Promise<CompletionResult> {
      const c = requireCtx();
      const result = await c.completion(
        mapCompletionRequestToLlamaParams(req) as never,
        onToken
          ? (data) => {
              onToken(mapTokenChunk(data));
            }
          : undefined
      );
      return {
        text: result.text,
        content: result.content ?? result.text,
        tool_calls: (result.tool_calls ?? []) as CompletionResult['tool_calls'],
      };
    },

    async saveSession(path: string) {
      await requireCtx().saveSession(path, { tokenSize: 2048 });
    },

    async loadSession(path: string) {
      await requireCtx().loadSession(path);
    },

    async stopCompletion() {
      if (!ctx) return;
      await requireCtx().stopCompletion();
    },
    async embed(text: string) {
      const res = await requireCtx().embedding(text);
      return res.embedding;
    },
    async tokenize(text: string, opts?: { media_paths?: string[] }) {
      const c = requireCtx();
      const fn = requireFeature(c.tokenize, 'tokenize');
      return fn(text, opts);
    },
    async detokenize(tokens: number[]) {
      const c = requireCtx();
      const fn = requireFeature(c.detokenize, 'detokenize');
      return fn(tokens);
    },
    async rerank(query: string, documents: string[], rerankParams?: RerankParams) {
      const c = requireCtx();
      const fn = requireFeature(c.rerank, 'rerank');
      return fn(query, documents, rerankParams);
    },
    async bench(pp: number, tg: number, pl: number, nr: number) {
      const c = requireCtx();
      const fn = requireFeature(c.bench, 'bench');
      const result = (await fn(pp, tg, pl, nr)) as unknown as Record<string, number>;
      return {
        nKvMax: result.nKvMax ?? result.n_kv_max ?? 0,
        nBatch: result.nBatch ?? result.n_batch ?? 0,
        nUBatch: result.nUBatch ?? result.n_ubatch ?? 0,
        flashAttn: result.flashAttn ?? result.flash_attn ?? 0,
        isPpShared: result.isPpShared ?? result.is_pp_shared ?? 0,
        nGpuLayers: result.nGpuLayers ?? result.n_gpu_layers ?? 0,
        nThreads: result.nThreads ?? result.n_threads ?? 0,
        nThreadsBatch: result.nThreadsBatch ?? result.n_threads_batch ?? 0,
        pp: result.pp ?? 0,
        tg: result.tg ?? 0,
        pl: result.pl ?? 0,
        nKv: result.nKv ?? result.n_kv ?? 0,
        tPp: result.tPp ?? result.t_pp ?? 0,
        speedPp: result.speedPp ?? result.speed_pp ?? 0,
        tTg: result.tTg ?? result.t_tg ?? 0,
        speedTg: result.speedTg ?? result.speed_tg ?? 0,
        t: result.t ?? 0,
        speed: result.speed ?? 0,
      };
    },
    async clearCache(clearData = false) {
      const c = requireCtx();
      const fn = requireFeature(c.clearCache, 'clearCache');
      return fn(clearData);
    },
    async initMultimodal(multimodalOptions: MultimodalInitOptions) {
      const c = requireCtx();
      const fn = requireFeature(c.initMultimodal, 'initMultimodal');
      return fn(multimodalOptions);
    },
    async isMultimodalEnabled() {
      const c = requireCtx();
      const fn = requireFeature(c.isMultimodalEnabled, 'isMultimodalEnabled');
      return fn();
    },
    async getMultimodalSupport() {
      const c = requireCtx();
      const fn = requireFeature(c.getMultimodalSupport, 'getMultimodalSupport');
      return fn();
    },
    async releaseMultimodal() {
      const c = requireCtx();
      const fn = requireFeature(c.releaseMultimodal, 'releaseMultimodal');
      return fn();
    },
    async applyLoraAdapters(loraList: LoraAdapter[]) {
      const c = requireCtx();
      const fn = requireFeature(c.applyLoraAdapters, 'applyLoraAdapters');
      return fn(loraList);
    },
    async removeLoraAdapters() {
      const c = requireCtx();
      const fn = requireFeature(c.removeLoraAdapters, 'removeLoraAdapters');
      return fn();
    },
    async getLoadedLoraAdapters() {
      const c = requireCtx();
      const fn = requireFeature(c.getLoadedLoraAdapters, 'getLoadedLoraAdapters');
      return fn();
    },
    async initVocoder(vocoderOptions: VocoderInitOptions) {
      const c = requireCtx();
      const fn = requireFeature(c.initVocoder, 'initVocoder');
      return fn(vocoderOptions);
    },
    async isVocoderEnabled() {
      const c = requireCtx();
      const fn = requireFeature(c.isVocoderEnabled, 'isVocoderEnabled');
      return fn();
    },
    async getFormattedAudioCompletion(speaker: Record<string, unknown> | null, textToSpeak: string) {
      const c = requireCtx();
      const fn = requireFeature(c.getFormattedAudioCompletion, 'getFormattedAudioCompletion');
      return fn(speaker, textToSpeak);
    },
    async getAudioCompletionGuideTokens(textToSpeak: string) {
      const c = requireCtx();
      const fn = requireFeature(c.getAudioCompletionGuideTokens, 'getAudioCompletionGuideTokens');
      return fn(textToSpeak);
    },
    async decodeAudioTokens(tokens: number[]) {
      const c = requireCtx();
      const fn = requireFeature(c.decodeAudioTokens, 'decodeAudioTokens');
      return fn(tokens);
    },
    async releaseVocoder() {
      const c = requireCtx();
      const fn = requireFeature(c.releaseVocoder, 'releaseVocoder');
      return fn();
    },
    async loadModelInfo(modelPath?: string) {
      return (await loadLlamaModelInfo(modelPath ?? options.modelPath)) as Record<string, unknown>;
    },
    parallel: parallelApi,
    get speech() {
      return createSpeechSynthesizer(requireCtx());
    },
  };
}
