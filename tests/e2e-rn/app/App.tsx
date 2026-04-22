import * as FileSystem from 'expo-file-system';
import React, { useMemo, useRef, useState } from 'react';
import { Button, ScrollView, Text, TextInput, View } from 'react-native';
import {
  createEngine,
  createExpoFileSystemAdapter,
  createLlamaRNProvider,
  defineTool,
  downloadModelWithAdapter,
  getModelPathIfCached,
  type LocalFirstEngine,
} from 'local-ai-sdk';

const MODEL_REPO = process.env.EXPO_PUBLIC_E2E_MODEL_REPO ?? 'ggml-org/gemma-4-E2B-it-GGUF';
const MODEL_FILE = process.env.EXPO_PUBLIC_E2E_MODEL_FILE ?? 'gemma-4-e2b-it-Q8_0.gguf';
const MMPROJ_FILE = process.env.EXPO_PUBLIC_E2E_MMPROJ_FILE ?? 'mmproj-gemma-4-e2b-it-f16.gguf';
const MODEL_DIR = process.env.EXPO_PUBLIC_E2E_MODEL_DIR ?? 'models/e2b';
const SESSION_PATH = process.env.EXPO_PUBLIC_E2E_SESSION_PATH ?? 'sessions/e2b-session.bin';
const E2E_SYSTEM_PROMPT =
  process.env.EXPO_PUBLIC_E2E_SYSTEM_PROMPT ??
  'You are an e2e assistant. Always be concise, call tools when useful, and include a short trace marker.';
const E2E_PREFILL_TEXT = process.env.EXPO_PUBLIC_E2E_PREFILL_TEXT ?? 'Trace: e2e-prefill';

type EventLevel = 'INFO' | 'OK' | 'WARN' | 'ERROR';

type EventLog = {
  id: string;
  at: string;
  level: EventLevel;
  message: string;
};

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export default function App(): React.JSX.Element {
  const [input, setInput] = useState('');
  const [assistantLast, setAssistantLast] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [streamTokenCount, setStreamTokenCount] = useState(0);
  const [streamCharCount, setStreamCharCount] = useState(0);
  const [sendDurationMs, setSendDurationMs] = useState<number | null>(null);
  const [streamDurationMs, setStreamDurationMs] = useState<number | null>(null);
  const [lastToolResult, setLastToolResult] = useState('none');
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [mmprojPath, setMmprojPath] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [mmprojReady, setMmprojReady] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [providerCapabilities, setProviderCapabilities] = useState('{}');
  const engineRef = useRef<LocalFirstEngine | null>(null);

  const modelDirAbs = useMemo(() => `${FileSystem.documentDirectory ?? ''}${MODEL_DIR}`, []);
  const sessionPathAbs = useMemo(() => `${FileSystem.documentDirectory ?? ''}${SESSION_PATH}`, []);
  const fsAdapter = useMemo(() => createExpoFileSystemAdapter(FileSystem), []);

  const capabilitiesText = useMemo(() => providerCapabilities, [providerCapabilities]);

  function pushLog(level: EventLevel, message: string): void {
    const now = new Date();
    const at = now.toISOString().split('T')[1]?.replace('Z', '') ?? now.toISOString();
    setLogs((prev) => [{ id: `${now.getTime()}-${Math.random()}`, at, level, message }, ...prev].slice(0, 120));
  }

  function clearError(): void {
    setErrorBanner('');
  }

  function setError(error: unknown): void {
    const msg = String(error);
    setErrorBanner(msg);
    pushLog('ERROR', msg);
  }

  async function ensureModel(filename: string): Promise<string> {
    const cached = await getModelPathIfCached({
      repoId: MODEL_REPO,
      filename,
      destinationDir: modelDirAbs,
    });
    if (cached) {
      setCacheHit(true);
      pushLog('OK', `Cache hit for ${filename}`);
      return cached;
    }
    pushLog('INFO', `Downloading ${filename} from ${MODEL_REPO}`);
    return downloadModelWithAdapter(
      {
        repoId: MODEL_REPO,
        filename,
      },
      {
        destinationDir: modelDirAbs,
        adapter: fsAdapter,
      }
    );
  }

  async function initEngine(mainPath: string, projectorPath: string): Promise<void> {
    const probeTool = defineTool<{ topic: string }>({
      name: 'probeStatus',
      description: 'Return a deterministic probe string for E2E tool-call verification.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
        },
        required: ['topic'],
      },
      execute: async ({ topic }) => {
        const out = `tool-ok:${topic}`;
        setLastToolResult(out);
        pushLog('OK', `Tool executed with topic=${topic}`);
        return { ok: true, out };
      },
    });

    const provider = createLlamaRNProvider({
      modelPath: toFileUri(mainPath),
      mmprojPath: toFileUri(projectorPath),
      contextSize: 4096,
      embedding: true,
      n_gpu_layers: 99,
    });
    const engine = createEngine({
      provider,
      systemPrompt: E2E_SYSTEM_PROMPT,
      tools: [probeTool],
      completionDefaults: {
        prefill_text: E2E_PREFILL_TEXT,
      },
      session: {
        path: sessionPathAbs,
        storage: {
          readText: async (path) => FileSystem.readAsStringAsync(path).catch(() => null),
          writeText: async (path, data) => {
            const parent = path.split('/').slice(0, -1).join('/');
            await FileSystem.makeDirectoryAsync(parent, { intermediates: true }).catch(() => {});
            await FileSystem.writeAsStringAsync(path, data);
          },
          writeTextAtomic: async (path, data) => {
            const tmp = `${path}.tmp`;
            const parent = path.split('/').slice(0, -1).join('/');
            await FileSystem.makeDirectoryAsync(parent, { intermediates: true }).catch(() => {});
            await FileSystem.writeAsStringAsync(tmp, data);
            await FileSystem.moveAsync({ from: tmp, to: path }).catch(async () => {
              await FileSystem.writeAsStringAsync(path, data);
              await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
            });
          },
          exists: async (path) => {
            const info = await FileSystem.getInfoAsync(path);
            return info.exists;
          },
          delete: async (path) => {
            await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
          },
        },
      },
    });
    await engine.init();
    engineRef.current = engine;
    setEngineReady(true);
    setProviderCapabilities(JSON.stringify(provider.capabilities ?? {}));
    pushLog('OK', 'Engine initialized');
  }

  async function onDownloadModel(): Promise<void> {
    clearError();
    try {
      const p = await ensureModel(MODEL_FILE);
      setModelPath(p);
      setModelReady(true);
      pushLog('OK', `Model ready: ${p}`);
      if (mmprojPath) {
        await initEngine(p, mmprojPath);
      }
    } catch (error) {
      setError(error);
    }
  }

  async function onDownloadMmproj(): Promise<void> {
    clearError();
    try {
      const p = await ensureModel(MMPROJ_FILE);
      setMmprojPath(p);
      setMmprojReady(true);
      pushLog('OK', `mmproj ready: ${p}`);
      if (modelPath) {
        await initEngine(modelPath, p);
      }
    } catch (error) {
      setError(error);
    }
  }

  async function onSend(): Promise<void> {
    clearError();
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      pushLog('WARN', 'Send requested before engine init');
      return;
    }
    if (!input.trim()) {
      setErrorBanner('Input is required.');
      pushLog('WARN', 'Send blocked: input is empty');
      return;
    }
    try {
      const t0 = Date.now();
      pushLog('INFO', `Send start: "${input.slice(0, 64)}"`);
      const out = await engine.sendMessage(input);
      const durationMs = Date.now() - t0;
      setSendDurationMs(durationMs);
      pushLog('OK', `Send done in ${durationMs} ms`);
      setAssistantLast(out);
    } catch (error) {
      setError(error);
    }
  }

  async function onStream(): Promise<void> {
    clearError();
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      pushLog('WARN', 'Stream requested before engine init');
      return;
    }
    setStreaming(true);
    setStreamTokenCount(0);
    setStreamCharCount(0);
    setAssistantLast('');
    try {
      const t0 = Date.now();
      pushLog('INFO', 'Streaming start');
      const out = await engine.streamText(input || 'hello', (chunk) => {
        setStreamTokenCount((n) => n + 1);
        setStreamCharCount((n) => n + chunk.length);
        setAssistantLast((prev) => `${prev}${chunk}`);
      });
      const durationMs = Date.now() - t0;
      setStreamDurationMs(durationMs);
      pushLog('OK', `Streaming done in ${durationMs} ms`);
      setAssistantLast(out);
    } catch (error) {
      setError(error);
    } finally {
      setStreaming(false);
    }
  }

  async function onStop(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.stop();
    pushLog('INFO', 'Stop requested');
  }

  async function onSaveSession(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      return;
    }
    await engine.save();
    pushLog('OK', `Session saved: ${sessionPathAbs}`);
  }

  async function onLoadSession(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      return;
    }
    await engine.load();
    const last = engine.getMessages().at(-1)?.content ?? '';
    setAssistantLast(last);
    pushLog('OK', `Session loaded: ${sessionPathAbs}`);
  }

  async function onMemoryUpsert(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      return;
    }
    await engine.remember({ content: 'e2e memory marker gemma4-e2b' });
    pushLog('OK', 'Memory upsert completed');
  }

  async function onMemoryQuery(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      return;
    }
    const out = await engine.recall('gemma4-e2b marker');
    setAssistantLast(out.contextBlock || 'no-memory');
    pushLog('OK', `Memory recall hits=${out.hits.length}`);
  }

  async function onToolProbe(): Promise<void> {
    const engine = engineRef.current;
    clearError();
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      pushLog('WARN', 'Tool probe requested before engine init');
      return;
    }
    try {
      pushLog('INFO', 'Tool probe turn start');
      const out = await engine.sendMessage(
        'Call the probeStatus tool with topic "health" and return the tool output only.'
      );
      setAssistantLast(out);
      pushLog('OK', 'Tool probe turn completed');
    } catch (error) {
      setError(error);
    }
  }

  function renderStatusLine(label: string, value: string, testID?: string): React.JSX.Element {
    return (
      <Text testID={testID}>
        {label}: {value}
      </Text>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Text style={{ fontWeight: '700', fontSize: 18 }}>Local AI SDK E2E Console</Text>
      {renderStatusLine('Model repo', MODEL_REPO)}
      {renderStatusLine('Model file', MODEL_FILE)}
      {renderStatusLine('mmproj file', MMPROJ_FILE)}
      {renderStatusLine('System prompt', E2E_SYSTEM_PROMPT, 'e2e-system-prompt')}
      {renderStatusLine('Prefill', E2E_PREFILL_TEXT, 'e2e-prefill')}
      {renderStatusLine('Engine ready', engineReady ? 'yes' : 'no', 'e2e-engine-ready')}
      {renderStatusLine('Session path', sessionPathAbs, 'e2e-session-path')}
      {renderStatusLine('Send duration ms', sendDurationMs == null ? 'n/a' : String(sendDurationMs), 'e2e-send-duration')}
      {renderStatusLine(
        'Stream metrics',
        `${streamTokenCount} chunks / ${streamCharCount} chars / ${streamDurationMs ?? 'n/a'} ms`,
        'e2e-stream-metrics'
      )}
      {renderStatusLine('Last tool result', lastToolResult, 'e2e-tool-last-result')}

      <Text testID="e2e-provider-capabilities">capabilities: {capabilitiesText}</Text>
      {modelReady ? <Text testID="e2e-model-ready">model-ready</Text> : null}
      {mmprojReady ? <Text testID="e2e-mmproj-ready">mmproj-ready</Text> : null}
      {cacheHit ? <Text testID="e2e-cache-hit">cache-hit</Text> : null}

      {errorBanner ? <Text testID="e2e-error-banner">{errorBanner}</Text> : null}
      <Text testID="e2e-assistant-last">{assistantLast}</Text>

      <TextInput
        testID="e2e-input"
        value={input}
        onChangeText={setInput}
        placeholder="Type a prompt"
        style={{ borderWidth: 1, borderColor: '#999', padding: 8 }}
      />

      <View>
        <Button testID="e2e-download-model" title="Download model" onPress={() => void onDownloadModel()} />
      </View>
      <View>
        <Button testID="e2e-download-mmproj" title="Download mmproj" onPress={() => void onDownloadMmproj()} />
      </View>
      <View>
        <Button testID="e2e-send" title="Send" onPress={() => void onSend()} />
      </View>
      <View>
        <Button testID="e2e-stream-start" title="Stream" onPress={() => void onStream()} disabled={streaming} />
      </View>
      <View>
        <Button testID="e2e-tool-probe" title="Tool probe" onPress={() => void onToolProbe()} />
      </View>
      <View>
        <Button testID="e2e-stop" title="Stop" onPress={() => void onStop()} />
      </View>
      <View>
        <Button testID="e2e-session-save" title="Save session" onPress={() => void onSaveSession()} />
      </View>
      <View>
        <Button testID="e2e-session-load" title="Load session" onPress={() => void onLoadSession()} />
      </View>
      <View>
        <Button testID="e2e-memory-upsert" title="Remember" onPress={() => void onMemoryUpsert()} />
      </View>
      <View>
        <Button testID="e2e-memory-query" title="Recall" onPress={() => void onMemoryQuery()} />
      </View>

      <Text style={{ fontWeight: '700', marginTop: 8 }}>Event log</Text>
      <Text testID="e2e-log-count">events:{logs.length}</Text>
      {logs.map((event) => (
        <Text key={event.id}>
          [{event.at}] [{event.level}] {event.message}
        </Text>
      ))}

      <Text testID="e2e-restart-marker">restart-marker</Text>
    </ScrollView>
  );
}

