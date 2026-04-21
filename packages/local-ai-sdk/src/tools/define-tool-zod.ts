import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDefinition } from './define-tool.js';

/**
 * Define a tool with a Zod input schema (converted to JSON Schema for native tool calling).
 */
export function defineToolZod<T extends z.ZodRawShape>(opts: {
  name: string;
  description: string;
  input: z.ZodObject<T>;
  execute: (args: z.infer<z.ZodObject<T>>) => Promise<unknown> | unknown;
}): ToolDefinition<z.infer<z.ZodObject<T>>> {
  const parameters = zodToJsonSchema(opts.input, {
    $refStrategy: 'none',
  }) as Record<string, unknown>;

  return {
    name: opts.name,
    description: opts.description,
    parameters,
    execute: opts.execute as (args: z.infer<z.ZodObject<T>>) => Promise<unknown> | unknown,
    zodInput: opts.input as z.ZodType<z.infer<z.ZodObject<T>>>,
  };
}
