import * as FileSystem from 'expo-file-system';
import React, { useMemo, useRef, useState } from 'react';
import { Button, ScrollView, Text, TextInput, View } from 'react-native';
import { createEngine, createLlamaRNProvider, downloadModel, getModelPathIfCached, type LocalFirstEngine } from 'local-ai-sdk';

const MODEL_REPO = process.env.EXPO_PUBLIC_E2E_MODEL_REPO ?? 'ggml-org/gemma-4-E2B-it-GGUF';
const MODEL_FILE = process.env.EXPO_PUBLIC_E2E_MODEL_FILE ?? 'gemma-4-e2b-it-Q8_0.gguf';
const MMPROJ_FILE = process.env.EXPO_PUBLIC_E2E_MMPROJ_FILE ?? 'mmproj-gemma-4-e2b-it-f16.gguf';
const MODEL_DIR = process.env.EXPO_PUBLIC_E2E_MODEL_DIR ?? 'models/e2b';
const SESSION_PATH = process.env.EXPO_PUBLIC_E2E_SESSION_PATH ?? 'sessions/e2b-session.bin';

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export default function App(): React.JSX.Element {
  const [input, setInput] = useState('');
  const [assistantLast, setAssistantLast] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [mmprojPath, setMmprojPath] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [mmprojReady, setMmprojReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [providerCapabilities, setProviderCapabilities] = useState('{}');
  const engineRef = useRef<LocalFirstEngine | null>(null);

  const modelDirAbs = useMemo(() => `${FileSystem.documentDirectory ?? ''}${MODEL_DIR}`, []);
  const sessionPathAbs = useMemo(() => `${FileSystem.documentDirectory ?? ''}${SESSION_PATH}`, []);

  const capabilitiesText = useMemo(() => providerCapabilities, [providerCapabilities]);

  async function ensureModel(filename: string): Promise<string> {
    const cached = await getModelPathIfCached({
      repoId: MODEL_REPO,
      filename,
      destinationDir: modelDirAbs,
    });
    if (cached) {
      setCacheHit(true);
      return cached;
    }
    return downloadModel({
      repoId: MODEL_REPO,
      filename,
      destinationDir: modelDirAbs,
    });
  }

  async function initEngine(mainPath: string, projectorPath: string): Promise<void> {
    const provider = createLlamaRNProvider({
      modelPath: toFileUri(mainPath),
      mmprojPath: toFileUri(projectorPath),
      contextSize: 4096,
      embedding: true,
      n_gpu_layers: 99,
    });
    const engine = createEngine({
      provider,
      systemPrompt: 'You are an e2e assistant.',
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
    setProviderCapabilities(JSON.stringify(provider.capabilities ?? {}));
  }

  async function onDownloadModel(): Promise<void> {
    setErrorBanner('');
    try {
      const p = await ensureModel(MODEL_FILE);
      setModelPath(p);
      setModelReady(true);
      if (mmprojPath) {
        await initEngine(p, mmprojPath);
      }
    } catch (error) {
      setErrorBanner(String(error));
    }
  }

  async function onDownloadMmproj(): Promise<void> {
    setErrorBanner('');
    try {
      const p = await ensureModel(MMPROJ_FILE);
      setMmprojPath(p);
      setMmprojReady(true);
      if (modelPath) {
        await initEngine(modelPath, p);
      }
    } catch (error) {
      setErrorBanner(String(error));
    }
  }

  async function onSend(): Promise<void> {
    setErrorBanner('');
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      return;
    }
    if (!input.trim()) {
      setErrorBanner('Input is required.');
      return;
    }
    try {
      const out = await engine.sendMessage(input);
      setAssistantLast(out);
    } catch (error) {
      setErrorBanner(String(error));
    }
  }

  async function onStream(): Promise<void> {
    setErrorBanner('');
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      return;
    }
    setStreaming(true);
    setAssistantLast('');
    try {
      const out = await engine.streamText(input || 'hello', (chunk) => {
        setAssistantLast((prev) => `${prev}${chunk}`);
      });
      setAssistantLast(out);
    } catch (error) {
      setErrorBanner(String(error));
    } finally {
      setStreaming(false);
    }
  }

  async function onStop(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.stop();
  }

  async function onSaveSession(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      return;
    }
    await engine.save();
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
  }

  async function onMemoryUpsert(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      return;
    }
    await engine.remember({ content: 'e2e memory marker gemma4-e2b' });
  }

  async function onMemoryQuery(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) {
      setErrorBanner('Engine is not initialized.');
      return;
    }
    const out = await engine.recall('gemma4-e2b marker');
    setAssistantLast(out.contextBlock || 'no-memory');
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Text testID="e2e-provider-capabilities">{capabilitiesText}</Text>
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
      <Text testID="e2e-restart-marker">restart-marker</Text>
    </ScrollView>
  );
}

