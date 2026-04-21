import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LocalFirstEngine } from '../core/engine.js';
import type { ChatMessage, SendMessageInput } from '../types.js';

export type UseLocalChatResult = {
  messages: ChatMessage[];
  streaming: string;
  isBusy: boolean;
  /** Plain text or multimodal `{ text, mediaParts }`. */
  sendMessage: (input: string | SendMessageInput) => Promise<void>;
  stop: () => Promise<void>;
  reset: (opts?: { keepSeed?: boolean }) => Promise<void>;
};

/**
 * React binding for `LocalFirstEngine`: mirrors message state and supports streaming chunks.
 */
export function useLocalChat(engine: LocalFirstEngine): UseLocalChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>(() => engine.getMessages());

  useEffect(() => {
    setMessages(engine.getMessages());
    return engine.subscribe(() => {
      setMessages(engine.getMessages());
    });
  }, [engine]);

  const [streaming, setStreaming] = useState('');
  const [isBusy, setBusy] = useState(false);

  const sendMessage = useCallback(
    async (input: string | SendMessageInput) => {
      const isEmptyString = typeof input === 'string' && input.trim().length === 0;
      const isEmptyObject =
        typeof input === 'object' &&
        input.text.trim().length === 0 &&
        (!input.mediaParts || input.mediaParts.length === 0);
      if (isEmptyString || isEmptyObject) return;
      setBusy(true);
      setStreaming('');
      try {
        await engine.streamText(input, (chunk) => {
          setStreaming((prev) => prev + chunk);
        });
      } finally {
        setStreaming('');
        setBusy(false);
      }
    },
    [engine]
  );

  const stop = useCallback(async () => {
    await engine.stop();
    setBusy(false);
  }, [engine]);

  const reset = useCallback(
    async (opts?: { keepSeed?: boolean }) => {
      await engine.reset(opts);
    },
    [engine]
  );

  return useMemo(
    () => ({
      messages,
      streaming,
      isBusy,
      sendMessage,
      stop,
      reset,
    }),
    [messages, streaming, isBusy, sendMessage, stop, reset]
  );
}
