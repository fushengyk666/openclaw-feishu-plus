/**
 * message-unavailable.ts — message unavailable state guard
 *
 * Inspired by official openclaw-lark core/message-unavailable.ts.
 * Tracks recalled/deleted source or reply messages and short-circuits
 * subsequent reply / patch / delete attempts to avoid retry storms.
 */

export type TerminalMessageApiCode = 230011 | 231003;

export interface MessageUnavailableState {
  apiCode: TerminalMessageApiCode;
  markedAtMs: number;
  operation?: string;
}

const UNAVAILABLE_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_SIZE_BEFORE_PRUNE = 512;
const unavailableMessageCache = new Map<string, MessageUnavailableState>();

export function normalizeMessageId(messageId?: string): string | undefined {
  if (!messageId || typeof messageId !== "string") return undefined;
  const trimmed = messageId.trim();
  if (!trimmed) return undefined;
  const idx = trimmed.indexOf(":");
  return idx >= 0 ? trimmed.slice(0, idx) : trimmed;
}

function pruneExpired(nowMs = Date.now()): void {
  for (const [messageId, state] of unavailableMessageCache) {
    if (nowMs - state.markedAtMs > UNAVAILABLE_CACHE_TTL_MS) {
      unavailableMessageCache.delete(messageId);
    }
  }
}

export function extractLarkApiCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const anyErr = error as any;
  return anyErr?.code ?? anyErr?.response?.data?.code ?? anyErr?.data?.code;
}

export function isTerminalMessageApiCode(code: unknown): code is TerminalMessageApiCode {
  return code === 230011 || code === 231003;
}

export function markMessageUnavailable(params: {
  messageId: string;
  apiCode: TerminalMessageApiCode;
  operation?: string;
}): void {
  const normalizedId = normalizeMessageId(params.messageId);
  if (!normalizedId) return;

  if (unavailableMessageCache.size >= MAX_CACHE_SIZE_BEFORE_PRUNE) {
    pruneExpired();
  }

  unavailableMessageCache.set(normalizedId, {
    apiCode: params.apiCode,
    operation: params.operation,
    markedAtMs: Date.now(),
  });
}

export function getMessageUnavailableState(messageId: string | undefined): MessageUnavailableState | undefined {
  const normalizedId = normalizeMessageId(messageId);
  if (!normalizedId) return undefined;
  const state = unavailableMessageCache.get(normalizedId);
  if (!state) return undefined;
  if (Date.now() - state.markedAtMs > UNAVAILABLE_CACHE_TTL_MS) {
    unavailableMessageCache.delete(normalizedId);
    return undefined;
  }
  return state;
}

export function isMessageUnavailable(messageId: string | undefined): boolean {
  return !!getMessageUnavailableState(messageId);
}

export class MessageUnavailableError extends Error {
  readonly messageId: string;
  readonly apiCode: TerminalMessageApiCode;
  readonly operation?: string;

  constructor(params: { messageId: string; apiCode: TerminalMessageApiCode; operation?: string }) {
    super(`[feishu-plus-message-unavailable] message ${params.messageId} unavailable (code=${params.apiCode})`);
    this.name = "MessageUnavailableError";
    this.messageId = params.messageId;
    this.apiCode = params.apiCode;
    this.operation = params.operation;
  }
}

export function isMessageUnavailableError(error: unknown): error is MessageUnavailableError {
  return error instanceof MessageUnavailableError || (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "MessageUnavailableError"
  );
}

export function assertMessageAvailable(messageId: string | undefined, operation?: string): void {
  const normalizedId = normalizeMessageId(messageId);
  if (!normalizedId) return;
  const state = getMessageUnavailableState(normalizedId);
  if (!state) return;
  throw new MessageUnavailableError({
    messageId: normalizedId,
    apiCode: state.apiCode,
    operation: operation ?? state.operation,
  });
}

export function markMessageUnavailableFromError(params: {
  messageId: string | undefined;
  error: unknown;
  operation?: string;
}): TerminalMessageApiCode | undefined {
  const normalizedId = normalizeMessageId(params.messageId);
  if (!normalizedId) return undefined;
  const code = extractLarkApiCode(params.error);
  if (!isTerminalMessageApiCode(code)) return undefined;
  markMessageUnavailable({ messageId: normalizedId, apiCode: code, operation: params.operation });
  return code;
}

export async function runWithMessageUnavailableGuard<T>(params: {
  messageId: string | undefined;
  operation: string;
  fn: () => Promise<T>;
}): Promise<T> {
  const normalizedId = normalizeMessageId(params.messageId);
  if (!normalizedId) return params.fn();

  assertMessageAvailable(normalizedId, params.operation);

  try {
    return await params.fn();
  } catch (error) {
    const code = markMessageUnavailableFromError({
      messageId: normalizedId,
      error,
      operation: params.operation,
    });
    if (code) {
      throw new MessageUnavailableError({ messageId: normalizedId, apiCode: code, operation: params.operation });
    }
    throw error;
  }
}
