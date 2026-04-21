export type JsonToolCall = {
  tool_call?: {
    name?: string;
    args?: Record<string, unknown>;
  };
};

/**
 * Best-effort parse for JSON tool responses from small models.
 */
export function tryParseJsonToolCall(text: string): { name: string; args: Record<string, unknown> } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const obj = JSON.parse(trimmed) as JsonToolCall;
    const name = obj.tool_call?.name;
    if (!name || typeof name !== 'string') return null;
    const args = obj.tool_call?.args;
    return { name, args: args && typeof args === 'object' ? args : {} };
  } catch {
    return null;
  }
}
