import type { ContextParams, LlamaContext } from 'llama.rn';
import { initLlama } from 'llama.rn';
import type { CompletionRequest, CompletionResult, LLMProvider, TokenChunk } from 'local-ai-sdk';

/** llama.rn may expose multimodal helpers only on newer releases. */
type LlamaContextMultimodal = LlamaContext & {
  initMultimodal?: (opts: { path: string; use_gpu?: boolean }) => Promise<boolean>;
  releaseMultimodal?: () => Promise<void>;
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
  /** Forward any extra llama.rn ContextParams. */
  extra?: Partial<ContextParams>;
  onProgress?: (progress: number) => void;
};

/**
 * Create an `LLMProvider` backed by llama.rn (`initLlama`).
 */
export function createLlamaRNProvider(options: LlamaRNProviderOptions): LLMProvider {
  let ctx: LlamaContext | null = null;
  const embeddingEnabled = options.embedding === true;
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

  return {
    async init() {
      if (ctx) return;
      ctx = await initLlama(params, options.onProgress);
      if (options.mmprojPath) {
        const c = ctx as LlamaContextMultimodal;
        if (typeof c.initMultimodal === 'function') {
          await c.initMultimodal({ path: options.mmprojPath, use_gpu: options.mmprojUseGpu ?? true });
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
      if (!ctx) throw new Error('Llama provider not initialized. Call init() first.');
      const result = await ctx.completion(
        {
          messages: req.messages,
          n_predict: req.n_predict,
          temperature: req.temperature,
          stop: req.stop,
          tools: req.tools as object | undefined,
          tool_choice: req.tool_choice,
        },
        onToken
          ? (data) => {
              onToken({ token: data.token });
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
      if (!ctx) throw new Error('Llama provider not initialized.');
      await ctx.saveSession(path, { tokenSize: 2048 });
    },

    async loadSession(path: string) {
      if (!ctx) throw new Error('Llama provider not initialized.');
      await ctx.loadSession(path);
    },

    async stopCompletion() {
      if (!ctx) return;
      await ctx.stopCompletion();
    },

    ...(embeddingEnabled
      ? {
          async embed(text: string) {
            if (!ctx) throw new Error('Llama provider not initialized.');
            const res = await ctx.embedding(text);
            return res.embedding;
          },
        }
      : {}),
  };
}
