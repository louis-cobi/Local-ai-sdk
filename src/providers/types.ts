import type { OpenAIStyleTool } from '../tools/registry.js';

export type ChatMessageInput = {
  role: string;
  content?: string;
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

export type CompletionRequest = {
  messages: ChatMessageInput[];
  n_predict: number;
  temperature?: number;
  stop?: string[];
  tools?: OpenAIStyleTool[];
  tool_choice?: string;
};

export type CompletionResult = {
  text: string;
  content: string;
  tool_calls: NativeToolCall[];
};

export type TokenChunk = {
  token: string;
};

/**
 * Narrow provider surface used by the engine (mock-friendly).
 */
export type LLMProvider = {
  init(): Promise<void>;
  dispose(): Promise<void>;
  complete(
    req: CompletionRequest,
    onToken?: (chunk: TokenChunk) => void
  ): Promise<CompletionResult>;
  saveSession(path: string): Promise<void>;
  loadSession(path: string): Promise<void>;
  stopCompletion(): Promise<void>;
  /** Optional: requires `embedding: true` in llama.rn init. */
  embed?(text: string): Promise<number[]>;
};
