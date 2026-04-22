# Example: Tools with Zod

```ts
import { z } from 'zod';
import { createEngine, defineToolZod } from 'local-ai-sdk';
import { createLlamaRNProvider } from 'local-ai-sdk/llama';

const weatherTool = defineToolZod({
  name: 'get_weather',
  description: 'Return weather for a city',
  input: z.object({
    city: z.string().min(1),
    unit: z.enum(['c', 'f']).default('c'),
  }),
  async execute(args) {
    return { city: args.city, temp: 22, unit: args.unit };
  },
});

const provider = createLlamaRNProvider({
  modelPath: 'file:///absolute/path/model.gguf',
  contextSize: 4096,
});

const engine = createEngine({
  provider,
  systemPrompt: 'Use tools when needed and explain results clearly.',
  tools: [weatherTool],
  toolMode: 'native',
});

await engine.init();
const reply = await engine.sendMessage('What is the weather in Paris in celsius?');
console.log(reply);
```
