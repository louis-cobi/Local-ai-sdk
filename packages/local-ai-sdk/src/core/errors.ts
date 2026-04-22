export type EngineErrorCode =
  | 'E_NOT_INITIALIZED'
  | 'E_INVALID_INPUT'
  | 'E_CAPABILITY_MISSING'
  | 'E_SESSION_NOT_CONFIGURED'
  | 'E_SESSION_UNSUPPORTED'
  | 'E_SESSION_INCOMPATIBLE'
  | 'E_TOOL_ARGS'
  | 'E_TOOL_UNKNOWN'
  | 'E_EMBEDDING_UNSUPPORTED';

export class EngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
    public readonly causeData?: unknown
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

