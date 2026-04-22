import type { ZodType } from 'zod';
import type { ToolDefinition } from './define-tool.js';

export type OpenAIStyleTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/**
 * Registry of tools: OpenAI-compatible serialization for llama.rn and local dispatch.
 */
export class ToolRegistry {
  private readonly byName = new Map<string, ToolDefinition>();

  constructor(tools: ToolDefinition[] = []) {
    for (const t of tools) {
      if (this.byName.has(t.name)) {
        throw new Error(`Duplicate tool name: ${t.name}`);
      }
      this.byName.set(t.name, t);
    }
  }

  list(): ToolDefinition[] {
    return [...this.byName.values()];
  }

  toOpenAIStyleTools(): OpenAIStyleTool[] {
    return this.list().map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: normalizeParameters(t.parameters),
      },
    }));
  }

  /**
   * Human-readable tool listing for system prompts (JSON fallback / small models).
   */
  toPromptFragment(): string {
    const lines = this.list().map((t) => {
      const params = JSON.stringify(t.parameters);
      return `- ${t.name}: ${t.description}\n  parameters schema: ${params}`;
    });
    return lines.join('\n');
  }

  async run(name: string, rawArgs: string): Promise<unknown> {
    const tool = this.byName.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    let args: Record<string, unknown> = {};
    if (rawArgs && rawArgs.trim().length > 0) {
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        throw new Error(`Invalid JSON arguments for tool ${name}`);
      }
    }

    if (tool.zodInput) {
      const parsed = (tool.zodInput as ZodType<Record<string, unknown>>).safeParse(args);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new Error(`Invalid arguments for tool ${name}: ${msg}`);
      }
      return tool.execute(parsed.data as never);
    }

    return tool.execute(args as never);
  }
}

function normalizeParameters(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema && typeof schema === 'object' && 'type' in schema) {
    return schema;
  }
  return {
    type: 'object',
    properties: schema ?? {},
    additionalProperties: true,
  };
}
