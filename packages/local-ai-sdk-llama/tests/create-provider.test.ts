import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLlamaRNProvider } from '../src/create-provider.js';

const mocks = vi.hoisted(() => ({
  completionMock: vi.fn(),
  embeddingMock: vi.fn(),
  tokenizeMock: vi.fn(),
  detokenizeMock: vi.fn(),
  rerankMock: vi.fn(),
  benchMock: vi.fn(),
  clearCacheMock: vi.fn(),
  stopCompletionMock: vi.fn(),
  saveSessionMock: vi.fn(),
  loadSessionMock: vi.fn(),
  releaseMock: vi.fn(),
  initMultimodalMock: vi.fn(),
  isMultimodalEnabledMock: vi.fn(),
  getMultimodalSupportMock: vi.fn(),
  releaseMultimodalMock: vi.fn(),
  applyLoraAdaptersMock: vi.fn(),
  removeLoraAdaptersMock: vi.fn(),
  getLoadedLoraAdaptersMock: vi.fn(),
  initVocoderMock: vi.fn(),
  isVocoderEnabledMock: vi.fn(),
  getFormattedAudioCompletionMock: vi.fn(),
  getAudioCompletionGuideTokensMock: vi.fn(),
  decodeAudioTokensMock: vi.fn(),
  releaseVocoderMock: vi.fn(),
  parallelCompletionMock: vi.fn(),
  parallelEmbeddingMock: vi.fn(),
  parallelRerankMock: vi.fn(),
  parallelEnableMock: vi.fn(),
  parallelDisableMock: vi.fn(),
  parallelConfigureMock: vi.fn(),
  parallelGetStatusMock: vi.fn(),
  parallelSubscribeToStatusMock: vi.fn(),
  initLlamaMock: vi.fn(),
  loadLlamaModelInfoMock: vi.fn(),
}));

vi.mock('llama.rn', () => ({
  initLlama: mocks.initLlamaMock,
  loadLlamaModelInfo: mocks.loadLlamaModelInfoMock,
}));

function makeMockContext() {
  return {
    completion: mocks.completionMock,
    embedding: mocks.embeddingMock,
    tokenize: mocks.tokenizeMock,
    detokenize: mocks.detokenizeMock,
    rerank: mocks.rerankMock,
    bench: mocks.benchMock,
    clearCache: mocks.clearCacheMock,
    stopCompletion: mocks.stopCompletionMock,
    saveSession: mocks.saveSessionMock,
    loadSession: mocks.loadSessionMock,
    release: mocks.releaseMock,
    initMultimodal: mocks.initMultimodalMock,
    isMultimodalEnabled: mocks.isMultimodalEnabledMock,
    getMultimodalSupport: mocks.getMultimodalSupportMock,
    releaseMultimodal: mocks.releaseMultimodalMock,
    applyLoraAdapters: mocks.applyLoraAdaptersMock,
    removeLoraAdapters: mocks.removeLoraAdaptersMock,
    getLoadedLoraAdapters: mocks.getLoadedLoraAdaptersMock,
    initVocoder: mocks.initVocoderMock,
    isVocoderEnabled: mocks.isVocoderEnabledMock,
    getFormattedAudioCompletion: mocks.getFormattedAudioCompletionMock,
    getAudioCompletionGuideTokens: mocks.getAudioCompletionGuideTokensMock,
    decodeAudioTokens: mocks.decodeAudioTokensMock,
    releaseVocoder: mocks.releaseVocoderMock,
    parallel: {
      completion: mocks.parallelCompletionMock,
      embedding: mocks.parallelEmbeddingMock,
      rerank: mocks.parallelRerankMock,
      enable: mocks.parallelEnableMock,
      disable: mocks.parallelDisableMock,
      configure: mocks.parallelConfigureMock,
      getStatus: mocks.parallelGetStatusMock,
      subscribeToStatus: mocks.parallelSubscribeToStatusMock,
    },
  };
}

describe('createLlamaRNProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.completionMock.mockResolvedValue({ text: 'done', content: 'done', tool_calls: [] });
    mocks.embeddingMock.mockResolvedValue({ embedding: [0.1, 0.2] });
    mocks.tokenizeMock.mockResolvedValue({ tokens: [1, 2] });
    mocks.detokenizeMock.mockResolvedValue('hello');
    mocks.rerankMock.mockResolvedValue([{ score: 1, index: 0, document: 'x' }]);
    mocks.benchMock.mockResolvedValue({
      nKvMax: 1,
      nBatch: 1,
      nUBatch: 1,
      flashAttn: 1,
      isPpShared: 1,
      nGpuLayers: 1,
      nThreads: 1,
      nThreadsBatch: 1,
      pp: 1,
      tg: 1,
      pl: 1,
      nKv: 1,
      tPp: 1,
      speedPp: 1,
      tTg: 1,
      speedTg: 1,
      t: 1,
      speed: 1,
    });
    mocks.parallelCompletionMock.mockResolvedValue({
      requestId: 1,
      promise: Promise.resolve({ text: 'p', content: 'p', tool_calls: [] }),
      stop: async () => {},
    });
    mocks.parallelEmbeddingMock.mockResolvedValue({
      requestId: 2,
      promise: Promise.resolve({ embedding: [1, 2] }),
    });
    mocks.parallelRerankMock.mockResolvedValue({
      requestId: 3,
      promise: Promise.resolve([{ score: 0.9, index: 0 }]),
    });
    mocks.parallelEnableMock.mockResolvedValue(true);
    mocks.parallelDisableMock.mockResolvedValue(true);
    mocks.parallelConfigureMock.mockResolvedValue(true);
    mocks.parallelGetStatusMock.mockResolvedValue({
      enabled: true,
      maxSlots: 2,
      queueLength: 0,
      activeRequests: [],
    });
    mocks.parallelSubscribeToStatusMock.mockResolvedValue({ remove: () => {} });
    mocks.initMultimodalMock.mockResolvedValue(true);
    mocks.isMultimodalEnabledMock.mockResolvedValue(true);
    mocks.getMultimodalSupportMock.mockResolvedValue({ vision: true, audio: true });
    mocks.initVocoderMock.mockResolvedValue(true);
    mocks.isVocoderEnabledMock.mockResolvedValue(true);
    mocks.getFormattedAudioCompletionMock.mockResolvedValue({ prompt: 'p', grammar: 'g' });
    mocks.getAudioCompletionGuideTokensMock.mockResolvedValue([10, 11]);
    mocks.decodeAudioTokensMock.mockResolvedValue([0.1, 0.2]);
    mocks.getLoadedLoraAdaptersMock.mockResolvedValue([{ path: '/tmp/lora.gguf', scaled: 1 }]);
    mocks.loadLlamaModelInfoMock.mockResolvedValue({ model: 'meta' });
    mocks.initLlamaMock.mockResolvedValue(makeMockContext());
  });

  it('forwards advanced completion params', async () => {
    const provider = createLlamaRNProvider({ modelPath: 'file:///model.gguf' });
    await provider.init();
    await provider.complete({
      messages: [{ role: 'user', content: 'hi' }],
      n_predict: 64,
      temperature: 0.2,
      top_k: 20,
      top_p: 0.9,
      grammar: 'root ::= "ok"',
      response_format: { type: 'json_object', schema: { type: 'object' } },
      enable_thinking: true,
      reasoning_format: 'auto',
      chat_template_kwargs: { lang: 'en' },
      parallel_tool_calls: { enabled: true },
    });
    const arg = mocks.completionMock.mock.calls[0][0];
    expect(arg.top_k).toBe(20);
    expect(arg.grammar).toContain('root');
    expect(arg.response_format.type).toBe('json_object');
    expect(arg.enable_thinking).toBe(true);
  });

  it('exposes advanced context APIs and parallel namespace', async () => {
    const provider = createLlamaRNProvider({ modelPath: 'file:///model.gguf' });
    await provider.init();
    await provider.tokenize('abc');
    await provider.detokenize([1, 2]);
    await provider.rerank('q', ['a']);
    await provider.bench(1, 1, 1, 1);
    await provider.clearCache();
    await provider.applyLoraAdapters([{ path: '/tmp/lora.gguf', scaled: 1 }]);
    await provider.getLoadedLoraAdapters();
    await provider.parallel.enable({ n_parallel: 2 });
    await provider.parallel.completion({ messages: [{ role: 'user', content: 'x' }], n_predict: 8 });
    expect(mocks.tokenizeMock).toHaveBeenCalled();
    expect(mocks.parallelEnableMock).toHaveBeenCalled();
    expect(mocks.parallelCompletionMock).toHaveBeenCalled();
  });

  it('initializes multimodal with advanced options', async () => {
    const provider = createLlamaRNProvider({
      modelPath: 'file:///model.gguf',
      mmprojPath: 'file:///mmproj.gguf',
      mmprojImageMinTokens: 256,
      mmprojImageMaxTokens: 1024,
    });
    await provider.init();
    expect(mocks.initMultimodalMock).toHaveBeenCalledWith({
      path: 'file:///mmproj.gguf',
      use_gpu: true,
      image_min_tokens: 256,
      image_max_tokens: 1024,
    });
    await provider.isMultimodalEnabled();
    await provider.getMultimodalSupport();
    expect(mocks.isMultimodalEnabledMock).toHaveBeenCalled();
    expect(mocks.getMultimodalSupportMock).toHaveBeenCalled();
  });

  it('exposes vocoder and model info APIs', async () => {
    const provider = createLlamaRNProvider({ modelPath: 'file:///model.gguf' });
    await provider.init();
    await provider.initVocoder({ path: 'file:///vocoder.gguf', n_batch: 16 });
    await provider.isVocoderEnabled();
    await provider.getFormattedAudioCompletion(null, 'speak');
    await provider.getAudioCompletionGuideTokens('speak');
    await provider.decodeAudioTokens([1, 2, 3]);
    await provider.releaseVocoder();
    const info = await provider.loadModelInfo();
    expect(info).toEqual({ model: 'meta' });
    expect(mocks.loadLlamaModelInfoMock).toHaveBeenCalledWith('file:///model.gguf');
  });
});
