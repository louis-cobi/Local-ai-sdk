import * as FileSystem from 'expo-file-system';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createEngine, defineTool, type LocalFirstEngine } from 'local-ai-sdk';
import { createLlamaRNProvider } from 'local-ai-sdk/llama';
import { createBlobUtilAdapter, createExpoFileSystemAdapter, downloadModelWithAdapter } from 'local-ai-sdk/models/rn';

const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

type DownloadAdapter = 'expo' | 'blob';
type EventLevel = 'INFO' | 'OK' | 'WARN' | 'ERROR';
type FlowStep = 'idle' | 'running' | 'done' | 'failed';

type RuntimeConfig = {
  modelRepo: string;
  modelFile: string;
  mmprojFile: string;
  modelDir: string;
  sessionPath: string;
  systemPrompt: string;
  prefillText: string;
  contextSize: number;
  nGpuLayers: number;
  embedding: boolean;
  mmprojUseGpu: boolean;
  downloadAdapter: DownloadAdapter;
  defaultInput: string;
};

type EventLog = {
  id: string;
  at: string;
  level: EventLevel;
  message: string;
};

const MIN_MODEL_BYTES = 1_000_000;

const PRESETS: Record<string, RuntimeConfig> = {
  default: {
    modelRepo: ENV.EXPO_PUBLIC_E2E_MODEL_REPO ?? 'unsloth/gemma-4-E2B-it-GGUF',
    modelFile: ENV.EXPO_PUBLIC_E2E_MODEL_FILE ?? 'gemma-4-E2B-it-Q4_K_M.gguf',
    mmprojFile: ENV.EXPO_PUBLIC_E2E_MMPROJ_FILE ?? 'mmproj-F16.gguf',
    modelDir: ENV.EXPO_PUBLIC_E2E_MODEL_DIR ?? 'models/e2b-q4',
    sessionPath: ENV.EXPO_PUBLIC_E2E_SESSION_PATH ?? 'sessions/e2b-session.bin',
    systemPrompt:
      ENV.EXPO_PUBLIC_E2E_SYSTEM_PROMPT ??
      'You are a manual test assistant for local-ai-sdk. Be concise and deterministic.',
    prefillText: ENV.EXPO_PUBLIC_E2E_PREFILL_TEXT ?? 'Trace: manual-test-prefill',
    contextSize: Number(ENV.EXPO_PUBLIC_E2E_CONTEXT_SIZE ?? 4096),
    nGpuLayers: Number(ENV.EXPO_PUBLIC_E2E_GPU_LAYERS ?? 0),
    embedding: (ENV.EXPO_PUBLIC_E2E_EMBEDDING ?? 'true').toLowerCase() !== 'false',
    mmprojUseGpu: (ENV.EXPO_PUBLIC_E2E_MMPROJ_USE_GPU ?? 'false').toLowerCase() === 'true',
    downloadAdapter: ((ENV.EXPO_PUBLIC_E2E_DOWNLOAD_ADAPTER ?? 'expo').toLowerCase() === 'blob' ? 'blob' : 'expo') as DownloadAdapter,
    defaultInput: 'Explain what this app can validate in one paragraph (Q4 default profile).',
  },
  coldStart: {
    modelRepo: 'ggml-org/gemma-4-E2B-it-GGUF',
    modelFile: 'gemma-4-E2B-it-Q8_0.gguf',
    mmprojFile: 'mmproj-gemma-4-E2B-it-Q8_0.gguf',
    modelDir: 'models/e2b-cold',
    sessionPath: 'sessions/cold-session.bin',
    systemPrompt: 'Cold start profile. Reply with deterministic text and explicit markers.',
    prefillText: 'Trace: cold-start',
    contextSize: 4096,
    nGpuLayers: 0,
    embedding: true,
    mmprojUseGpu: false,
    downloadAdapter: 'expo',
    defaultInput: 'Cold profile sanity check.',
  },
  warmCache: {
    modelRepo: 'ggml-org/gemma-4-E2B-it-GGUF',
    modelFile: 'gemma-4-E2B-it-Q8_0.gguf',
    mmprojFile: 'mmproj-gemma-4-E2B-it-Q8_0.gguf',
    modelDir: 'models/e2b',
    sessionPath: 'sessions/warm-session.bin',
    systemPrompt: 'Warm cache profile. Focus on speed and short answers.',
    prefillText: 'Trace: warm-cache',
    contextSize: 4096,
    nGpuLayers: 0,
    embedding: true,
    mmprojUseGpu: false,
    downloadAdapter: 'expo',
    defaultInput: 'Warm cache quick check.',
  },
};

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function Section(props: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      {props.children}
    </View>
  );
}

function ActionButton(props: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}): React.JSX.Element {
  return (
    <Pressable
      testID={props.testID}
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        styles.actionButton,
        props.disabled ? styles.actionButtonDisabled : null,
        pressed && !props.disabled ? styles.actionButtonPressed : null,
      ]}
    >
      <Text style={styles.actionButtonText}>{props.title}</Text>
    </Pressable>
  );
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const anyError = error as Error & { cause?: unknown; code?: string | number };
    const details = {
      name: error.name,
      message: error.message,
      code: anyError.code,
      stack: error.stack,
      cause: anyError.cause,
    };
    return JSON.stringify(details, null, 2);
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

export default function App(): React.JSX.Element {
  const [draftConfig, setDraftConfig] = useState<RuntimeConfig>(PRESETS.default);
  const [activeConfig, setActiveConfig] = useState<RuntimeConfig>(PRESETS.default);
  const [activePreset, setActivePreset] = useState<keyof typeof PRESETS>('default');
  const [input, setInput] = useState(PRESETS.default.defaultInput);
  const [assistantLast, setAssistantLast] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [logFilter, setLogFilter] = useState<EventLevel | 'ALL'>('ALL');
  const [streamTokenCount, setStreamTokenCount] = useState(0);
  const [streamCharCount, setStreamCharCount] = useState(0);
  const [avgCharsPerSec, setAvgCharsPerSec] = useState<number | null>(null);
  const [sendDurationMs, setSendDurationMs] = useState<number | null>(null);
  const [streamDurationMs, setStreamDurationMs] = useState<number | null>(null);
  const [initDurationMs, setInitDurationMs] = useState<number | null>(null);
  const [memoryRecallHits, setMemoryRecallHits] = useState(0);
  const [lastToolResult, setLastToolResult] = useState('none');
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [mmprojPath, setMmprojPath] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [mmprojReady, setMmprojReady] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineInitializing, setEngineInitializing] = useState(false);
  const [autoInitAfterDownload, setAutoInitAfterDownload] = useState(false);
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [providerCapabilities, setProviderCapabilities] = useState('{}');
  const [downloadBackend, setDownloadBackend] = useState<DownloadAdapter>('expo');
  const [downloadProgressPct, setDownloadProgressPct] = useState<number | null>(null);
  const [downloadBytes, setDownloadBytes] = useState(0);
  const [downloadDurationMs, setDownloadDurationMs] = useState<number | null>(null);
  const [metricsExportPath, setMetricsExportPath] = useState<string | null>(null);
  const [modelMissing, setModelMissing] = useState<boolean | null>(null);
  const [mmprojMissing, setMmprojMissing] = useState<boolean | null>(null);
  const [flowState, setFlowState] = useState<Record<string, FlowStep>>({
    cold: 'idle',
    warm: 'idle',
    memory: 'idle',
    tool: 'idle',
  });
  const engineRef = useRef<LocalFirstEngine | null>(null);
  const lastProgressLogPctRef = useRef<number>(-1);

  const fsAdapter = useMemo(() => createExpoFileSystemAdapter(FileSystem), []);
  const blobAdapter = useMemo(() => {
    try {
      const mod = require('react-native-blob-util');
      const blobUtil = mod?.default ?? mod;
      return createBlobUtilAdapter(blobUtil);
    } catch {
      return null;
    }
  }, []);
  const modelDirAbs = useMemo(
    () => `${FileSystem.documentDirectory ?? ''}${activeConfig.modelDir}`,
    [activeConfig.modelDir]
  );
  const sessionPathAbs = useMemo(
    () => `${FileSystem.documentDirectory ?? ''}${activeConfig.sessionPath}`,
    [activeConfig.sessionPath]
  );

  const filteredLogs = useMemo(
    () => (logFilter === 'ALL' ? logs : logs.filter((l) => l.level === logFilter)),
    [logs, logFilter]
  );

  function writeTerminalLog(level: EventLevel, message: string): void {
    const prefix = `[E2E][${level}]`;
    if (level === 'ERROR') {
      console.error(prefix, message);
      return;
    }
    if (level === 'WARN') {
      console.warn(prefix, message);
      return;
    }
    console.log(prefix, message);
  }

  function pushLog(level: EventLevel, message: string): void {
    const now = new Date();
    const at = now.toISOString().split('T')[1]?.replace('Z', '') ?? now.toISOString();
    setLogs((prev) => [{ id: `${now.getTime()}-${Math.random()}`, at, level, message }, ...prev].slice(0, 200));
    writeTerminalLog(level, message);
  }

  function setError(error: unknown): void {
    const msg = String(error);
    setErrorBanner(msg);
    pushLog('ERROR', msg);
  }

  function clearError(): void {
    setErrorBanner('');
  }

  async function runAction(name: string, fn: () => Promise<void>): Promise<void> {
    clearError();
    pushLog('INFO', `Action start: ${name}`);
    try {
      await fn();
      pushLog('OK', `Action done: ${name}`);
    } catch (error) {
      setError(error);
    }
  }

  function getSelectedAdapter() {
    const selected = activeConfig.downloadAdapter;
    const adapter = selected === 'blob' ? blobAdapter : fsAdapter;
    return { selected, adapter };
  }

  async function readFileSize(path: string): Promise<number> {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return 0;
    return 'size' in info ? Number(info.size ?? 0) : 0;
  }

  async function isValidModelArtifact(path: string): Promise<boolean> {
    const size = await readFileSize(path);
    return size >= MIN_MODEL_BYTES;
  }

  async function refreshAssetPresence(): Promise<void> {
    const { adapter } = getSelectedAdapter();
    if (!adapter) {
      setModelMissing(true);
      setMmprojMissing(true);
      return;
    }
    const modelCached = `${modelDirAbs.replace(/[\\/]+$/, '')}/${activeConfig.modelFile.replace(/^[\\/]+/, '').split('/').join('/')}`;
    const mmprojCached = `${modelDirAbs.replace(/[\\/]+$/, '')}/${activeConfig.mmprojFile.replace(/^[\\/]+/, '').split('/').join('/')}`;
    const [modelExists, mmprojExists] = await Promise.all([adapter.exists(modelCached), adapter.exists(mmprojCached)]);
    if (!modelExists) {
      setModelMissing(true);
    } else {
      const valid = await isValidModelArtifact(modelCached);
      setModelMissing(!valid);
      if (!valid) {
        const size = await readFileSize(modelCached);
        pushLog('WARN', `Model cache exists but is invalid (size=${size} bytes): ${modelCached}`);
      }
    }
    if (!mmprojExists) {
      setMmprojMissing(true);
    } else {
      const valid = await isValidModelArtifact(mmprojCached);
      setMmprojMissing(!valid);
      if (!valid) {
        const size = await readFileSize(mmprojCached);
        pushLog('WARN', `mmproj cache exists but is invalid (size=${size} bytes): ${mmprojCached}`);
      }
    }
  }

  useEffect(() => {
    void refreshAssetPresence();
  }, [activeConfig.modelFile, activeConfig.mmprojFile, activeConfig.modelDir, activeConfig.downloadAdapter]);

  async function ensureModel(filename: string): Promise<string> {
    const { selected, adapter } = getSelectedAdapter();
    if (!adapter) {
      throw new Error(
        'Blob adapter is selected but react-native-blob-util is missing. Install it or switch to expo adapter.'
      );
    }
    setDownloadBackend(selected);
    setDownloadProgressPct(0);
    setDownloadBytes(0);
    setDownloadDurationMs(null);
    lastProgressLogPctRef.current = -1;
    const normalized = filename.replace(/^[\\/]+/, '').split('/').join('/');
    const cached = `${modelDirAbs.replace(/[\\/]+$/, '')}/${normalized}`;
    pushLog(
      'INFO',
      `Checking model asset: repo=${activeConfig.modelRepo}, file=${filename}, adapter=${selected}, dest=${modelDirAbs}`
    );
    if (await adapter.exists(cached)) {
      const valid = await isValidModelArtifact(cached);
      if (valid) {
        const size = await readFileSize(cached);
        setCacheHit(true);
        setDownloadProgressPct(100);
        pushLog('OK', `Cache hit for ${filename} (${size} bytes)`);
        return cached;
      }
      const invalidSize = await readFileSize(cached);
      pushLog(
        'WARN',
        `Cache file for ${filename} is invalid (${invalidSize} bytes). Deleting and re-downloading.`
      );
      await FileSystem.deleteAsync(cached, { idempotent: true }).catch(() => {});
    }
    const t0 = Date.now();
    pushLog('INFO', `Download start for ${filename}`);
    const path = await downloadModelWithAdapter(
      {
        repoId: activeConfig.modelRepo,
        filename,
      },
      {
        destinationDir: modelDirAbs,
        adapter,
        onProgress: (loaded, total) => {
          setDownloadBytes(loaded);
          if (total && total > 0) {
            const pct = Math.min(100, Math.floor((loaded / total) * 100));
            setDownloadProgressPct(pct);
            const roundedBucket = Math.floor(pct / 10) * 10;
            if (roundedBucket !== lastProgressLogPctRef.current) {
              lastProgressLogPctRef.current = roundedBucket;
              pushLog('INFO', `Download progress ${filename}: ${pct}% (${loaded}/${total} bytes)`);
            }
          } else {
            setDownloadProgressPct(null);
            if (loaded > 0 && loaded % (5 * 1024 * 1024) < 64 * 1024) {
              pushLog('INFO', `Download progress ${filename}: ${loaded} bytes (unknown total)`);
            }
          }
        },
      }
    );
    const durationMs = Date.now() - t0;
    setDownloadDurationMs(durationMs);
    setDownloadProgressPct(100);
    const finalSize = await readFileSize(path);
    if (finalSize < MIN_MODEL_BYTES) {
      pushLog(
        'ERROR',
        `Downloaded artifact is too small (${finalSize} bytes). Check repo/file names and network/auth.`
      );
      throw new Error(
        `Downloaded artifact looks invalid (${finalSize} bytes): ${filename}. Verify Hugging Face repo/file.`
      );
    }
    pushLog('OK', `Download completed for ${filename} in ${durationMs} ms -> ${path} (${finalSize} bytes)`);
    return path;
  }

  async function initEngine(mainPath: string, projectorPath: string | null): Promise<void> {
    const t0 = Date.now();
    setEngineInitializing(true);
    pushLog(
      'INFO',
      `Engine init start: model=${mainPath}, mmproj=${projectorPath ?? 'disabled'}, vision=${projectorPath ? 'on' : 'off'}, ctx=${activeConfig.contextSize}, gpu_layers=${activeConfig.nGpuLayers}, embedding=${activeConfig.embedding}, mmproj_use_gpu=${activeConfig.mmprojUseGpu}`
    );
    let phase = 'prechecks';
    try {
      const modelInfo = await FileSystem.getInfoAsync(mainPath);
      pushLog(
        'INFO',
        `Init precheck model exists=${modelInfo.exists} size=${'size' in modelInfo ? String(modelInfo.size ?? 'n/a') : 'n/a'}`
      );
      if (!modelInfo.exists) {
        throw new Error('Model file is missing on disk before provider initialization.');
      }
      if (projectorPath) {
        const mmprojInfo = await FileSystem.getInfoAsync(projectorPath);
        pushLog(
          'INFO',
          `Init precheck mmproj exists=${mmprojInfo.exists} size=${'size' in mmprojInfo ? String(mmprojInfo.size ?? 'n/a') : 'n/a'}`
        );
        if (!mmprojInfo.exists) {
          throw new Error('mmproj file is missing on disk before vision initialization.');
        }
      }

      phase = 'dispose-existing-engine';
      const existing = engineRef.current as (LocalFirstEngine & { dispose?: () => Promise<void> }) | null;
      if (existing?.dispose) {
        pushLog('INFO', 'Disposing previous engine instance before re-init');
        await existing.dispose().catch(() => {});
      }

      const probeTool = defineTool({
        name: 'probeStatus',
        description: 'Return a deterministic probe string for manual tool-path verification.',
        parameters: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
          },
          required: ['topic'],
        },
        execute: async (args: Record<string, unknown>) => {
          const topic = String(args.topic ?? 'unknown');
          const out = `tool-ok:${topic}`;
          setLastToolResult(out);
          pushLog('OK', `Tool executed with topic=${topic}`);
          return { ok: true, out };
        },
      });

      phase = 'create-provider';
      const provider = createLlamaRNProvider({
        modelPath: toFileUri(mainPath),
        mmprojPath: projectorPath ? toFileUri(projectorPath) : undefined,
        contextSize: activeConfig.contextSize,
        embedding: activeConfig.embedding,
        n_gpu_layers: activeConfig.nGpuLayers,
        mmprojUseGpu: activeConfig.mmprojUseGpu,
      });
      pushLog('INFO', 'Provider object created');

      phase = 'provider.init';
      pushLog('INFO', 'Provider init start');
      await Promise.race([
        provider.init(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('provider.init timeout after 180000 ms')), 180000);
        }),
      ]);
      pushLog('OK', 'Provider init completed');

      phase = 'provider-load-model-info';
      try {
        const modelMeta = await provider.loadModelInfo();
        const metaPreview = JSON.stringify(modelMeta).slice(0, 400);
        pushLog('INFO', `Model info preview: ${metaPreview}`);
      } catch (error) {
        pushLog('WARN', `loadModelInfo failed before init: ${describeError(error)}`);
      }

      phase = 'create-engine';
      const sessionStorage = {
        readText: async (path: string) => FileSystem.readAsStringAsync(path).catch(() => null),
        writeText: async (path: string, data: string) => {
          const parent = path.split('/').slice(0, -1).join('/');
          await FileSystem.makeDirectoryAsync(parent, { intermediates: true }).catch(() => {});
          await FileSystem.writeAsStringAsync(path, data);
        },
        writeTextAtomic: async (path: string, data: string) => {
          const tmp = `${path}.tmp`;
          const parent = path.split('/').slice(0, -1).join('/');
          await FileSystem.makeDirectoryAsync(parent, { intermediates: true }).catch(() => {});
          await FileSystem.writeAsStringAsync(tmp, data);
          await FileSystem.moveAsync({ from: tmp, to: path }).catch(async () => {
            await FileSystem.writeAsStringAsync(path, data);
            await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
          });
        },
        exists: async (path: string) => {
          const info = await FileSystem.getInfoAsync(path);
          return info.exists;
        },
        delete: async (path: string) => {
          await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
        },
      };
      const buildEngine = (withSession: boolean) =>
        createEngine({
          provider,
          systemPrompt: activeConfig.systemPrompt,
          tools: [probeTool as never],
          completionDefaults: {
            prefill_text: activeConfig.prefillText,
          },
          session: withSession
            ? {
                path: sessionPathAbs,
                storage: sessionStorage,
              }
            : undefined,
        });
      let engine = buildEngine(true);
      pushLog('INFO', 'Engine object created');

      phase = 'engine.init';
      pushLog('INFO', 'Engine init start (SDK bootstrap)');
      try {
        await Promise.race([
          engine.init(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('engine.init timeout after 180000 ms')), 180000);
          }),
        ]);
      } catch (firstInitError) {
        pushLog(
          'WARN',
          `Engine init with session failed, retrying without session. Cause: ${describeError(firstInitError)}`
        );
        phase = 'engine.init.retry-without-session';
        engine = buildEngine(false);
        await Promise.race([
          engine.init(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('engine.init (no-session) timeout after 180000 ms')), 180000);
          }),
        ]);
        pushLog('WARN', 'Engine initialized in safe mode without session persistence');
      }
      engineRef.current = engine;
      setEngineReady(true);
      const initMs = Date.now() - t0;
      const capabilities = JSON.stringify(provider.capabilities ?? {});
      setInitDurationMs(initMs);
      setProviderCapabilities(capabilities);
      pushLog('OK', `Engine initialized in ${initMs} ms`);
      pushLog('INFO', `Provider capabilities: ${capabilities}`);
    } catch (error) {
      const detail = describeError(error);
      pushLog('ERROR', `Engine init failed at phase=${phase}`);
      pushLog('ERROR', `Engine init diagnostic: ${detail}`);
      throw new Error(`Engine init failed at phase=${phase}. ${detail}`);
    } finally {
      setEngineInitializing(false);
    }
  }

  async function onApplyConfig(): Promise<void> {
    await runAction('apply-config', async () => {
      setActiveConfig(draftConfig);
      setInput(draftConfig.defaultInput);
      setEngineReady(false);
      setModelReady(false);
      setMmprojReady(false);
      setModelPath(null);
      setMmprojPath(null);
      setCacheHit(false);
      setAssistantLast('');
      await refreshAssetPresence();
    });
  }

  async function onResetConfig(): Promise<void> {
    await runAction('reset-config', async () => {
      setDraftConfig(PRESETS.default);
      setActivePreset('default');
    });
  }

  async function onLoadPreset(name: keyof typeof PRESETS): Promise<void> {
    await runAction(`load-preset:${name}`, async () => {
      const preset = PRESETS[name];
      setDraftConfig(preset);
      setActivePreset(name);
    });
  }

  async function onDownloadModel(): Promise<void> {
    await runAction('download-model', async () => {
      const p = await ensureModel(activeConfig.modelFile);
      setModelPath(p);
      setModelReady(true);
      setModelMissing(false);
      if (autoInitAfterDownload) {
        if (visionEnabled && mmprojPath) {
          pushLog('INFO', 'Auto-init is enabled: initializing engine in vision mode after model download');
          await initEngine(p, mmprojPath);
        } else if (!visionEnabled) {
          pushLog('INFO', 'Auto-init is enabled: initializing engine in text-only mode after model download');
          await initEngine(p, null);
        }
      }
    });
  }

  async function onDownloadMmproj(): Promise<void> {
    await runAction('download-mmproj', async () => {
      const p = await ensureModel(activeConfig.mmprojFile);
      setMmprojPath(p);
      setMmprojReady(true);
      setMmprojMissing(false);
      if (autoInitAfterDownload && visionEnabled && modelPath) {
        pushLog('INFO', 'Auto-init is enabled: initializing engine in vision mode after mmproj download');
        await initEngine(modelPath, p);
      }
    });
  }

  async function onInitEngine(): Promise<void> {
    await runAction('init-engine', async () => {
      if (engineInitializing) {
        throw new Error('Engine initialization is already in progress.');
      }
      if (!modelPath) {
        throw new Error('Download model before initializing the engine.');
      }
      await initEngine(modelPath, null);
    });
  }

  async function onInitVision(): Promise<void> {
    await runAction('init-vision', async () => {
      if (engineInitializing) {
        throw new Error('Engine initialization is already in progress.');
      }
      if (!modelPath || !mmprojPath) {
        throw new Error('Download model and mmproj before initializing vision mode.');
      }
      await initEngine(modelPath, mmprojPath);
    });
  }

  async function onSend(): Promise<void> {
    await runAction('send-message', async () => {
      if (engineInitializing) {
        throw new Error('Engine initialization is in progress. Wait before sending a message.');
      }
      const engine = engineRef.current;
      if (!engine) throw new Error('Engine is not initialized.');
      if (!input.trim()) throw new Error('Input is required.');
      const t0 = Date.now();
      const out = await engine.sendMessage(input);
      setSendDurationMs(Date.now() - t0);
      setAssistantLast(out);
    });
  }

  async function onStream(): Promise<void> {
    await runAction('stream-message', async () => {
      if (engineInitializing) {
        throw new Error('Engine initialization is in progress. Wait before starting stream.');
      }
      const engine = engineRef.current;
      if (!engine) throw new Error('Engine is not initialized.');
      setStreaming(true);
      setStreamTokenCount(0);
      setStreamCharCount(0);
      setAvgCharsPerSec(null);
      setAssistantLast('');
      try {
        const t0 = Date.now();
        const out = await engine.streamText(input || 'hello', (chunk) => {
          setStreamTokenCount((n) => n + 1);
          setStreamCharCount((n) => n + chunk.length);
          setAssistantLast((prev) => `${prev}${chunk}`);
        });
        const durationMs = Date.now() - t0;
        setStreamDurationMs(durationMs);
        if (durationMs > 0) {
          setAvgCharsPerSec(Math.round((out.length / durationMs) * 1000));
        }
        setAssistantLast(out);
      } finally {
        setStreaming(false);
      }
    });
  }

  async function onStop(): Promise<void> {
    await runAction('stop-stream', async () => {
      const engine = engineRef.current;
      if (!engine) throw new Error('Engine is not initialized.');
      await engine.stop();
    });
  }

  async function onSaveSession(): Promise<void> {
    await runAction('save-session', async () => {
      const engine = engineRef.current;
      if (!engine) throw new Error('Engine is not initialized.');
      await engine.save();
    });
  }

  async function onLoadSession(): Promise<void> {
    await runAction('load-session', async () => {
      const engine = engineRef.current;
      if (!engine) throw new Error('Engine is not initialized.');
      await engine.load();
      const last = engine.getMessages().at(-1)?.content ?? '';
      setAssistantLast(last);
    });
  }

  async function onResetSessionFile(): Promise<void> {
    await runAction('reset-session-file', async () => {
      await FileSystem.deleteAsync(sessionPathAbs, { idempotent: true }).catch(() => {});
    });
  }

  async function onMemoryUpsert(): Promise<void> {
    await runAction('memory-upsert', async () => {
      const engine = engineRef.current;
      if (!engine) throw new Error('Engine is not initialized.');
      await engine.remember({ content: 'manual memory marker e2e-rn' });
    });
  }

  async function onMemoryQuery(): Promise<void> {
    await runAction('memory-query', async () => {
      const engine = engineRef.current;
      if (!engine) throw new Error('Engine is not initialized.');
      const out = await engine.recall('manual memory marker');
      setAssistantLast(out.contextBlock || 'no-memory');
      setMemoryRecallHits(out.hits.length);
    });
  }

  async function onToolProbe(): Promise<void> {
    await runAction('tool-probe', async () => {
      const engine = engineRef.current;
      if (!engine) throw new Error('Engine is not initialized.');
      const out = await engine.sendMessage(
        'Call the probeStatus tool with topic "health" and return only the tool output.'
      );
      setAssistantLast(out);
    });
  }

  async function onExportMetrics(): Promise<void> {
    await runAction('export-metrics', async () => {
      const dir = `${FileSystem.documentDirectory ?? ''}e2e-metrics`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const file = `${dir}/metrics-${Date.now()}.json`;
      const payload = {
        activeConfig,
        downloadBackend,
        downloadProgressPct,
        downloadBytes,
        downloadDurationMs,
        initDurationMs,
        sendDurationMs,
        streamDurationMs,
        streamTokenCount,
        streamCharCount,
        avgCharsPerSec,
        memoryRecallHits,
        providerCapabilities: JSON.parse(providerCapabilities || '{}'),
        errorBanner,
        assistantLast,
        exportedAt: new Date().toISOString(),
      };
      await FileSystem.writeAsStringAsync(file, JSON.stringify(payload, null, 2));
      setMetricsExportPath(file);
    });
  }

  async function runFlow(name: keyof typeof flowState, fn: () => Promise<void>): Promise<void> {
    setFlowState((prev) => ({ ...prev, [name]: 'running' }));
    try {
      await fn();
      setFlowState((prev) => ({ ...prev, [name]: 'done' }));
    } catch {
      setFlowState((prev) => ({ ...prev, [name]: 'failed' }));
    }
  }

  async function onRunColdStep(): Promise<void> {
    await runFlow('cold', async () => {
      await refreshAssetPresence();
      if (modelMissing === false || mmprojMissing === false) {
        pushLog('WARN', 'Cold check expects missing files. Clear app storage to simulate a true cold start.');
      } else {
        pushLog('OK', 'Cold check confirms missing assets.');
      }
    });
  }

  async function onRunWarmStep(): Promise<void> {
    await runFlow('warm', async () => {
      await onDownloadModel();
      await onDownloadMmproj();
      await onInitEngine();
      pushLog('OK', 'Warm step complete.');
    });
  }

  async function onRunMemoryStep(): Promise<void> {
    await runFlow('memory', async () => {
      await onMemoryUpsert();
      await onMemoryQuery();
    });
  }

  async function onRunToolStep(): Promise<void> {
    await runFlow('tool', async () => {
      await onToolProbe();
    });
  }

  function renderStatusLine(label: string, value: string, testID?: string): React.JSX.Element {
    return (
      <Text testID={testID}>
        {label}: {value}
      </Text>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <Text style={styles.pageTitle}>Local AI SDK Manual Test Console</Text>

      <Section title="Configuration">
        <Text style={styles.hintText}>Preset actif: {activePreset}</Text>
        <View style={styles.actionColumn}>
          <ActionButton title="Load default" onPress={() => void onLoadPreset('default')} />
          <ActionButton title="Load coldStart" onPress={() => void onLoadPreset('coldStart')} />
          <ActionButton title="Load warmCache" onPress={() => void onLoadPreset('warmCache')} />
        </View>
        <TextInput value={draftConfig.modelRepo} onChangeText={(v) => setDraftConfig((c) => ({ ...c, modelRepo: v }))} placeholder="Model repo" style={styles.input} />
        <TextInput value={draftConfig.modelFile} onChangeText={(v) => setDraftConfig((c) => ({ ...c, modelFile: v }))} placeholder="Model file" style={styles.input} />
        <TextInput value={draftConfig.mmprojFile} onChangeText={(v) => setDraftConfig((c) => ({ ...c, mmprojFile: v }))} placeholder="mmproj file" style={styles.input} />
        <TextInput value={draftConfig.modelDir} onChangeText={(v) => setDraftConfig((c) => ({ ...c, modelDir: v }))} placeholder="Model directory" style={styles.input} />
        <TextInput value={draftConfig.sessionPath} onChangeText={(v) => setDraftConfig((c) => ({ ...c, sessionPath: v }))} placeholder="Session path" style={styles.input} />
        <TextInput value={draftConfig.systemPrompt} onChangeText={(v) => setDraftConfig((c) => ({ ...c, systemPrompt: v }))} placeholder="System prompt" style={styles.input} />
        <TextInput value={draftConfig.prefillText} onChangeText={(v) => setDraftConfig((c) => ({ ...c, prefillText: v }))} placeholder="Prefill text" style={styles.input} />
        <TextInput
          value={String(draftConfig.contextSize)}
          onChangeText={(v) => setDraftConfig((c) => ({ ...c, contextSize: parseNumber(v, c.contextSize) }))}
          placeholder="Context size"
          style={styles.input}
        />
        <TextInput
          value={String(draftConfig.nGpuLayers)}
          onChangeText={(v) => setDraftConfig((c) => ({ ...c, nGpuLayers: parseNumber(v, c.nGpuLayers) }))}
          placeholder="n_gpu_layers"
          style={styles.input}
        />
        <View style={styles.actionColumn}>
          <ActionButton
            title={`Adapter: ${draftConfig.downloadAdapter}`}
            onPress={() =>
              setDraftConfig((c) => ({
                ...c,
                downloadAdapter: c.downloadAdapter === 'expo' ? 'blob' : 'expo',
              }))
            }
          />
          <ActionButton
            title={`Embedding: ${draftConfig.embedding ? 'on' : 'off'}`}
            onPress={() => setDraftConfig((c) => ({ ...c, embedding: !c.embedding }))}
          />
          <ActionButton
            title={`MMProj GPU: ${draftConfig.mmprojUseGpu ? 'on' : 'off'}`}
            onPress={() => setDraftConfig((c) => ({ ...c, mmprojUseGpu: !c.mmprojUseGpu }))}
          />
          <ActionButton
            title={`Vision: ${visionEnabled ? 'on' : 'off'}`}
            onPress={() => setVisionEnabled((v) => !v)}
          />
        </View>
        <TextInput value={draftConfig.defaultInput} onChangeText={(v) => setDraftConfig((c) => ({ ...c, defaultInput: v }))} placeholder="Default chat input" style={styles.input} />
        <View style={styles.actionColumn}>
          <ActionButton title="Apply config" onPress={() => void onApplyConfig()} />
          <ActionButton title="Reset defaults" onPress={() => void onResetConfig()} />
        </View>
      </Section>

      <Section title="Models & Engine">
        {renderStatusLine('Model repo', activeConfig.modelRepo)}
        {renderStatusLine('Model file', activeConfig.modelFile)}
        {renderStatusLine('mmproj file', activeConfig.mmprojFile)}
        {renderStatusLine('System prompt', activeConfig.systemPrompt, 'e2e-system-prompt')}
        {renderStatusLine('Prefill', activeConfig.prefillText, 'e2e-prefill')}
        {renderStatusLine('Download adapter', downloadBackend, 'e2e-download-adapter')}
        {renderStatusLine(
          'Download progress',
          downloadProgressPct == null ? 'n/a' : `${downloadProgressPct}%`,
          'e2e-download-progress'
        )}
        {renderStatusLine('Download bytes', String(downloadBytes), 'e2e-download-bytes')}
        {renderStatusLine(
          'Download duration ms',
          downloadDurationMs == null ? 'n/a' : String(downloadDurationMs),
          'e2e-download-duration'
        )}
        {renderStatusLine(
          'Init duration ms',
          initDurationMs == null ? 'n/a' : String(initDurationMs),
          'e2e-init-duration'
        )}
        {renderStatusLine(
          'Engine status',
          engineReady ? 'ready' : engineInitializing ? 'initializing' : 'not-ready',
          'e2e-engine-ready'
        )}
        {renderStatusLine('Vision mode', visionEnabled ? 'on' : 'off')}
        {renderStatusLine('Session path', sessionPathAbs, 'e2e-session-path')}
        <Text testID="e2e-provider-capabilities">capabilities: {providerCapabilities}</Text>
        <View style={styles.actionColumn}>
          <ActionButton
            testID="e2e-download-model"
            title="Download model"
            onPress={() => void onDownloadModel()}
            disabled={engineInitializing}
          />
          <ActionButton
            testID="e2e-download-mmproj"
            title="Download mmproj"
            onPress={() => void onDownloadMmproj()}
            disabled={engineInitializing}
          />
          <ActionButton
            title={`Auto-init: ${autoInitAfterDownload ? 'on' : 'off'}`}
            onPress={() => setAutoInitAfterDownload((v) => !v)}
            disabled={engineInitializing}
          />
          <ActionButton
            title={engineInitializing ? 'Initializing...' : 'Init/Re-init engine'}
            onPress={() => void onInitEngine()}
            disabled={engineInitializing}
          />
          <ActionButton
            title={engineInitializing ? 'Initializing vision...' : 'Init vision'}
            onPress={() => void onInitVision()}
            disabled={engineInitializing}
          />
        </View>
      </Section>

      <Section title="Chat">
        {errorBanner ? <Text testID="e2e-error-banner">{errorBanner}</Text> : null}
        <Text testID="e2e-assistant-last">{assistantLast}</Text>
        <TextInput
          testID="e2e-input"
          value={input}
          onChangeText={setInput}
          placeholder="Type a prompt"
          style={styles.input}
        />
        {renderStatusLine('Send duration ms', sendDurationMs == null ? 'n/a' : String(sendDurationMs), 'e2e-send-duration')}
        {renderStatusLine(
          'Stream metrics',
          `${streamTokenCount} chunks / ${streamCharCount} chars / ${streamDurationMs ?? 'n/a'} ms`,
          'e2e-stream-metrics'
        )}
        {renderStatusLine(
          'Average chars/s',
          avgCharsPerSec == null ? 'n/a' : String(avgCharsPerSec),
          'e2e-avg-chars-sec'
        )}
        <View style={styles.actionColumn}>
          <ActionButton testID="e2e-send" title="Send" onPress={() => void onSend()} disabled={engineInitializing} />
          <ActionButton
            testID="e2e-stream-start"
            title="Stream"
            onPress={() => void onStream()}
            disabled={streaming || engineInitializing}
          />
          <ActionButton testID="e2e-stop" title="Stop" onPress={() => void onStop()} />
        </View>
      </Section>

      <Section title="Tools, Memory, Session & Metrics">
        {renderStatusLine('Memory recall hits', String(memoryRecallHits), 'e2e-memory-hits')}
        {renderStatusLine('Last tool result', lastToolResult, 'e2e-tool-last-result')}
        {renderStatusLine('Metrics export path', metricsExportPath ?? 'n/a', 'e2e-metrics-export-path')}
        <View style={styles.actionColumn}>
          <ActionButton testID="e2e-tool-probe" title="Tool probe" onPress={() => void onToolProbe()} />
          <ActionButton testID="e2e-memory-upsert" title="Remember" onPress={() => void onMemoryUpsert()} />
          <ActionButton testID="e2e-memory-query" title="Recall" onPress={() => void onMemoryQuery()} />
        </View>
        <View style={styles.actionColumn}>
          <ActionButton testID="e2e-session-save" title="Save session" onPress={() => void onSaveSession()} />
          <ActionButton testID="e2e-session-load" title="Load session" onPress={() => void onLoadSession()} />
          <ActionButton title="Reset session file" onPress={() => void onResetSessionFile()} />
        </View>
        <ActionButton testID="e2e-export-metrics" title="Export metrics" onPress={() => void onExportMetrics()} />
      </Section>

      <Section title="Guided Manual Steps">
        <Text>cold: {flowState.cold}</Text>
        <Text>warm: {flowState.warm}</Text>
        <Text>memory: {flowState.memory}</Text>
        <Text>tool: {flowState.tool}</Text>
        <View style={styles.actionColumn}>
          <ActionButton title="Run cold step" onPress={() => void onRunColdStep()} />
          <ActionButton title="Run warm step" onPress={() => void onRunWarmStep()} />
        </View>
        <View style={styles.actionColumn}>
          <ActionButton title="Run memory step" onPress={() => void onRunMemoryStep()} />
          <ActionButton title="Run tool step" onPress={() => void onRunToolStep()} />
        </View>
      </Section>

      <Section title="Logs">
        <Text testID="e2e-log-count">events:{logs.length}</Text>
        <View style={styles.actionColumn}>
          <ActionButton title={`Filter: ${logFilter}`} onPress={() => setLogFilter((v) => (v === 'ALL' ? 'INFO' : v === 'INFO' ? 'OK' : v === 'OK' ? 'WARN' : v === 'WARN' ? 'ERROR' : 'ALL'))} />
          <ActionButton title="Clear logs" onPress={() => setLogs([])} />
        </View>
        {filteredLogs.map((event) => (
          <Text key={event.id}>
            [{event.at}] [{event.level}] {event.message}
          </Text>
        ))}
      </Section>

      {modelReady ? <Text testID="e2e-model-ready">model-ready</Text> : null}
      {mmprojReady ? <Text testID="e2e-mmproj-ready">mmproj-ready</Text> : null}
      {cacheHit ? <Text testID="e2e-cache-hit">cache-hit</Text> : null}
      {modelMissing === true ? <Text testID="e2e-model-missing">model-missing</Text> : null}
      {mmprojMissing === true ? <Text testID="e2e-mmproj-missing">mmproj-missing</Text> : null}
      <Text testID="e2e-restart-marker">restart-marker</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f5f7fb',
  },
  screenContent: {
    padding: 16,
    gap: 10,
  },
  pageTitle: {
    fontWeight: '700',
    fontSize: 19,
    color: '#0f172a',
    marginBottom: 2,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#0f172a',
    fontSize: 15,
  },
  hintText: {
    color: '#475569',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  actionColumn: {
    gap: 8,
  },
  actionButton: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  actionButtonPressed: {
    opacity: 0.9,
  },
  actionButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
});

