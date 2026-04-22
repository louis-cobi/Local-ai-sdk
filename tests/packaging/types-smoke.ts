import { defineToolZod, type ToolDefinition, type CompletionRequest } from 'local-ai-sdk';
import { z } from 'zod';

const tool = defineToolZod({
  name: 'sum',
  description: 'Add two numbers.',
  input: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: ({ a, b }) => a + b,
});

export const typedTool: ToolDefinition<{ a: number; b: number }> = tool;

export const typedRequest: CompletionRequest = {
  messages: [{ role: 'user', content: 'hello' }],
  n_predict: 32,
};
