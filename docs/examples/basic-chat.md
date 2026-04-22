# Example: Basic Chat

```ts
import { createEngine } from 'local-ai-sdk';
import { createLlamaRNProvider } from 'local-ai-sdk/llama';

const provider = createLlamaRNProvider({
  modelPath: 'file:///absolute/path/model.gguf',
  contextSize: 4096,
  embedding: true,
});

const engine = createEngine({
  provider,
  systemPrompt: 'You are a concise local assistant.',
  memory: { windowSize: 4, summaryThreshold: 20 },
  session: {
    path: '/absolute/path/session.kv.bin',
    // storage: your React Native storage adapter
  },
});

await engine.init();
const reply = await engine.sendMessage('Hello, summarize your capabilities in one sentence.');
console.log(reply);
```
