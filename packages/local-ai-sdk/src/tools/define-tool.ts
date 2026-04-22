import type { ZodType } from 'zod';

export type ToolDefinition<TArgs extends Record<string, unknown> = Record<string, never>> = {
  name: string;
  description: string;
  /** JSON Schema object describing parameters (type: object, properties, required, ...). */
  parameters: Record<string, unknown>;
  execute: (args: TArgs) => Promise<unknown> | unknown;
  /** When set, arguments are validated before `execute` (see `defineToolZod`). */
  zodInput?: ZodType<TArgs>;
};

/**
 * Define a tool with a typed `execute` handler and JSON Schema parameters.
 */
export function defineTool<TArgs extends Record<string, unknown> = Record<string, never>>(
  def: ToolDefinition<TArgs>
): ToolDefinition<TArgs> {
  return def;
}
