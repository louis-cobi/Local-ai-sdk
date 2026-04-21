import { ToolRegistry } from '../tools/registry.js';
import { buildTurnMessages } from './context-builder.js';
import { seedFingerprint } from './hash.js';
import { defaultMetaPath, SESSION_META_VERSION, type SessionMetaV1 } from './session-meta.js';
import { createNodeSessionStorageAdapter, type SessionStorageAdapter } from './session-storage.js';
import { summarizeTranscript } from './summarizer.js';
import { tryParseJsonToolCall } from './tool-json.js';
import { formatMemoryBlock } from '../memory/rag.js';
import { InMemoryVectorStore, type VectorStore } from '../memory/store.js';
import type { ChatMessageInput, LLMProvider } from '../providers/types.js';
import type {
  ChatMessage,
  EngineConfig,
  MemoryRecord,
  RecallResult,
  ResetOptions,
  SessionAutoSave,
  ToolMode,
} from '../types.js';

const MAX_TOOL_ROUNDS = 5;

function newId(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function shouldAutoSave(auto: SessionAutoSave | undefined, turnIndex: number): boolean {
  if (auto === undefined || auto === false) return false;
  if (auto === true || auto === 'everyTurn') return true;
  if (typeof auto === 'number') {
    if (auto <= 0) return false;
    return turnIndex % auto === 0;
  }
  return false;
}

export class LocalFirstEngine {
  private readonly provider: LLMProvider;
  private readonly registry: ToolRegistry;
  private readonly toolsOpenAI: ReturnType<ToolRegistry['toOpenAIStyleTools']>;
  private readonly toolMode: ToolMode;

  private messages: ChatMessage[] = [];
  private summary = '';
  private logicalTurnCount = 0;
  private initialized = false;
  private storage: SessionStorageAdapter | null = null;
  private readonly vectorStore: VectorStore;
  private seedHash = '';

  private readonly listeners = new Set<() => void>();

  constructor(private readonly config: EngineConfig) {
    this.provider = config.provider;
    this.registry = new ToolRegistry(config.tools ?? []);
    this.toolsOpenAI = this.registry.toOpenAIStyleTools();
    this.toolMode = config.toolMode ?? (this.toolsOpenAI.length > 0 ? 'native' : 'json');
    this.vectorStore = new InMemoryVectorStore();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getMessages(): ChatMessage[] {
    // Return a shallow copy so React `useSyncExternalStore` can detect updates safely.
    return this.messages.slice();
  }

  getSummary(): string {
    return this.summary;
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private buildSeedSystemPrompt(): string {
    const toolBlock = this.registry.toPromptFragment();
    if (this.toolMode === 'json') {
      return [
        this.config.systemPrompt.trim(),
        '',
        'Tool calling (JSON): If you must use a tool, respond ONLY with JSON of the form:',
        '{"tool_call":{"name":"<name>","args":{...}}}',
        'If no tool is needed, respond with normal text. Never mix JSON and free text.',
        '',
        'Available tools:',
        toolBlock || '(none)',
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      this.config.systemPrompt.trim(),
      '',
      'You may call tools when that is the best way to help.',
      '',
      'Available tools:',
      toolBlock || '(none)',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private computeSeedHash(): string {
    const toolSig = this.registry
      .list()
      .map((t) => `${t.name}:${JSON.stringify(t.parameters)}`)
      .join('|');
    return seedFingerprint([
      this.config.systemPrompt,
      toolSig,
      this.toolMode,
      ...(this.config.seedExtras ?? []),
    ]);
  }

  private windowSlice(priorMessages: ChatMessage[]): ChatMessage[] {
    const turns = this.config.memory?.windowSize ?? 4;
    const rel = priorMessages.filter((m) => m.role === 'user' || m.role === 'assistant');
    const max = turns * 2;
    return rel.slice(Math.max(0, rel.length - max));
  }

  private async resolveStorage(): Promise<SessionStorageAdapter | null> {
    if (this.config.session?.storage) return this.config.session.storage;
    return createNodeSessionStorageAdapter();
  }

  private metaPath(): string | null {
    if (!this.config.session) return null;
    return this.config.session.metaPath ?? defaultMetaPath(this.config.session.path);
  }

  private async readMeta(): Promise<SessionMetaV1 | null> {
    const storage = this.storage;
    const mp = this.metaPath();
    if (!storage || !mp) return null;
    const raw = await storage.readText(mp);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionMetaV1;
    } catch {
      return null;
    }
  }

  private async writeMeta(): Promise<void> {
    const storage = this.storage;
    const mp = this.metaPath();
    if (!storage || !mp) return;
    const meta: SessionMetaV1 = {
      version: SESSION_META_VERSION,
      seedHash: this.seedHash,
      summary: this.summary,
      messages: this.messages,
      logicalTurnCount: this.logicalTurnCount,
    };
    await storage.writeText(mp, JSON.stringify(meta));
  }

  private async persistAll(): Promise<void> {
    if (!this.config.session) return;
    await this.provider.saveSession(this.config.session.path);
    await this.writeMeta();
  }

  private async prefillSeed(): Promise<void> {
    const system = this.buildSeedSystemPrompt();
    await this.provider.complete({
      messages: [{ role: 'system', content: system }],
      n_predict: 0,
      temperature: 0,
      stop: this.config.stop,
      tools: this.toolMode === 'native' && this.toolsOpenAI.length ? this.toolsOpenAI : undefined,
      tool_choice:
        this.toolMode === 'native' && this.toolsOpenAI.length ? ('none' as string) : undefined,
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.provider.init();
    this.storage = await this.resolveStorage();
    this.seedHash = this.computeSeedHash();

    const session = this.config.session;
    if (session && this.storage) {
      const mp = this.metaPath()!;
      const meta = await this.readMeta();
      const hasBin = await this.storage.exists(session.path);
      if (meta && meta.version === SESSION_META_VERSION && meta.seedHash === this.seedHash && hasBin) {
        await this.provider.loadSession(session.path);
        this.summary = meta.summary ?? '';
        this.messages = (meta.messages ?? []).map((m) => ({ ...m }));
        this.logicalTurnCount = meta.logicalTurnCount ?? 0;
        this.initialized = true;
        this.notify();
        return;
      }
      // Incompatible or missing session: start fresh files
      if (hasBin) await this.storage.delete(session.path);
      if (await this.storage.exists(mp)) await this.storage.delete(mp);
    }

    await this.prefillSeed();
    if (session) {
      await this.persistAll();
    }
    this.initialized = true;
    this.notify();
  }

  async dispose(): Promise<void> {
    await this.provider.dispose();
    this.initialized = false;
    this.notify();
  }

  async save(): Promise<void> {
    if (!this.config.session) return;
    await this.persistAll();
  }

  async load(): Promise<void> {
    if (!this.config.session) throw new Error('session.path is not configured');
    await this.provider.loadSession(this.config.session.path);
    const meta = await this.readMeta();
    if (meta && meta.seedHash === this.seedHash) {
      this.summary = meta.summary ?? '';
      this.messages = (meta.messages ?? []).map((m) => ({ ...m }));
      this.logicalTurnCount = meta.logicalTurnCount ?? 0;
    }
    this.notify();
  }

  async reset(opts: ResetOptions = {}): Promise<void> {
    const keepSeed = opts.keepSeed !== false;
    this.messages = [];
    this.summary = '';
    this.logicalTurnCount = 0;

    if (this.config.session && this.storage) {
      const session = this.config.session;
      const mp = this.metaPath()!;
      if (await this.storage.exists(session.path)) await this.storage.delete(session.path);
      if (await this.storage.exists(mp)) await this.storage.delete(mp);
    }

    if (!keepSeed) {
      throw new Error(
        'reset({ keepSeed: false }) requires re-initializing the llama context; release and create a new provider.'
      );
    }

    await this.prefillSeed();
    if (this.config.session) await this.persistAll();
    this.notify();
  }

  async stop(): Promise<void> {
    await this.provider.stopCompletion();
  }

  /**
   * Run summarization over older turns, then shrink the in-memory window.
   */
  private async maybeSummarize(): Promise<void> {
    const threshold = this.config.memory?.summaryThreshold ?? 20;
    if (this.logicalTurnCount <= threshold) return;

    const turns = this.config.memory?.windowSize ?? 4;
    const rel = this.messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    const keep = turns * 2;
    if (rel.length <= keep) return;

    const older = rel.slice(0, Math.max(0, rel.length - keep));
    const transcript = older.map((m) => `${m.role}: ${m.content}`).join('\n');
    const addition = await summarizeTranscript(this.provider, transcript, {
      maxPredict: Math.min(512, this.config.maxPredict ?? 256),
      temperature: 0.2,
      stop: this.config.stop,
    });

    this.summary = this.summary ? `${this.summary}\n${addition}` : addition;
    // Keep only the recent tail in UI state
    this.messages = rel.slice(-keep).map((m) => ({ ...m, id: m.id ?? newId() }));
    this.logicalTurnCount = threshold; // reset pressure; avoids immediate re-trigger
    await this.writeMeta();
  }

  private async runToolLoop(
    initialMessages: ChatMessageInput[],
    onToken?: (t: string) => void
  ): Promise<{ text: string; messages: ChatMessageInput[] }> {
    let msgs = initialMessages;
    let lastText = '';
    let includeTools = this.toolMode === 'native' && this.toolsOpenAI.length > 0;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const streamBuf: string[] = [];
      const res = await this.provider.complete(
        {
          messages: msgs,
          n_predict: this.config.maxPredict ?? 256,
          temperature: this.config.temperature ?? 0.7,
          stop: this.config.stop,
          tools: includeTools ? this.toolsOpenAI : undefined,
          tool_choice: includeTools ? 'auto' : undefined,
        },
        onToken
          ? (chunk) => {
              streamBuf.push(chunk.token);
              onToken(chunk.token);
            }
          : undefined
      );

      lastText = (res.content || res.text).trim();

      if (this.toolMode === 'native' && res.tool_calls && res.tool_calls.length > 0) {
        const next = [...msgs];
        next.push({
          role: 'assistant',
          content: res.content || res.text,
          tool_calls: res.tool_calls,
        });

        for (const tc of res.tool_calls) {
          const raw = await this.registry.run(tc.function.name, tc.function.arguments);
          next.push({
            role: 'tool',
            tool_call_id: tc.id ?? `call_${tc.function.name}`,
            content: JSON.stringify(raw),
          });
        }
        msgs = next;
        includeTools = true;
        continue;
      }

      if (this.toolMode === 'json') {
        const parsed = tryParseJsonToolCall(res.content || res.text);
        if (parsed) {
          const raw = await this.registry.run(parsed.name, JSON.stringify(parsed.args));
          const next = [...msgs];
          next.push({ role: 'assistant', content: res.content || res.text });
          next.push({
            role: 'user',
            content: `Tool ${parsed.name} returned: ${JSON.stringify(raw)}`,
          });
          msgs = next;
          includeTools = false;
          continue;
        }
      }

      return { text: lastText, messages: msgs };
    }

    return { text: lastText, messages: msgs };
  }

  private async buildMemoryBlock(userInput: string): Promise<string> {
    const maxChars = this.config.memory?.maxMemoryChars ?? 4000;
    const k = this.config.memory?.ragTopK ?? 5;
    if (!this.provider.embed) return '';
    const q = await this.provider.embed(userInput);
    const hits = await this.vectorStore.search(q, k);
    return formatMemoryBlock(hits, maxChars);
  }

  async remember(record: MemoryRecord): Promise<string> {
    if (!this.provider.embed) {
      throw new Error('remember() requires an embedding-capable provider (enable embedding in llama.rn).');
    }
    const id = record.id ?? newId();
    const vec = await this.provider.embed(record.content);
    await this.vectorStore.upsert(id, vec, { ...record, id });
    return id;
  }

  async recall(query: string): Promise<RecallResult> {
    if (!this.provider.embed) {
      throw new Error('recall() requires an embedding-capable provider (enable embedding in llama.rn).');
    }
    const k = this.config.memory?.ragTopK ?? 5;
    const maxChars = this.config.memory?.maxMemoryChars ?? 4000;
    const q = await this.provider.embed(query);
    const hits = await this.vectorStore.search(q, k);
    return { hits, contextBlock: formatMemoryBlock(hits, maxChars) };
  }

  async embed(text: string): Promise<number[]> {
    if (!this.provider.embed) {
      throw new Error('embed() requires an embedding-capable provider (enable embedding in llama.rn).');
    }
    return this.provider.embed(text);
  }

  async sendMessage(userText: string, onToken?: (chunk: string) => void): Promise<string> {
    if (!this.initialized) throw new Error('Engine not initialized. Call init() first.');

    this.messages = [...this.messages, { id: newId(), role: 'user', content: userText }];
    const prior = this.messages.slice(0, -1);
    const window = this.windowSlice(prior);
    const memoryBlock = await this.buildMemoryBlock(userText);

    const turnMessages = buildTurnMessages({
      summary: this.summary,
      memoryBlock,
      window,
      userInput: userText,
    });

    const { text } = await this.runToolLoop(turnMessages, onToken);

    this.messages = [...this.messages, { id: newId(), role: 'assistant', content: text }];
    this.logicalTurnCount += 1;

    await this.maybeSummarize();

    const auto = this.config.session?.autoSave ?? true;
    if (this.config.session && shouldAutoSave(auto, this.logicalTurnCount)) {
      await this.persistAll();
    } else {
      await this.writeMeta();
    }

    this.notify();
    return text;
  }

  async generateText(userText: string): Promise<string> {
    return this.sendMessage(userText);
  }

  async streamText(userText: string, onToken: (chunk: string) => void): Promise<string> {
    return this.sendMessage(userText, onToken);
  }
}

export function createEngine(config: EngineConfig): LocalFirstEngine {
  return new LocalFirstEngine(config);
}
