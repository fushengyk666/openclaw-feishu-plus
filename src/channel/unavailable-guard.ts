/**
 * unavailable-guard.ts — terminate reply pipeline on recalled/deleted message
 */

import {
  extractLarkApiCode,
  getMessageUnavailableState,
  isMessageUnavailable,
  isMessageUnavailableError,
  isTerminalMessageApiCode,
  markMessageUnavailable,
} from "./message-unavailable.js";

export interface UnavailableGuardParams {
  replyToMessageId: string | undefined;
  getCardMessageId: () => string | null;
  onTerminate: () => void;
}

export class UnavailableGuard {
  private terminated = false;
  private readonly replyToMessageId: string | undefined;
  private readonly getCardMessageId: () => string | null;
  private readonly onTerminate: () => void;

  constructor(params: UnavailableGuardParams) {
    this.replyToMessageId = params.replyToMessageId;
    this.getCardMessageId = params.getCardMessageId;
    this.onTerminate = params.onTerminate;
  }

  get isTerminated(): boolean {
    return this.terminated;
  }

  shouldSkip(_source: string): boolean {
    if (this.terminated) return true;
    if (!this.replyToMessageId) return false;
    if (!isMessageUnavailable(this.replyToMessageId)) return false;
    return this.terminate(_source);
  }

  terminate(source: string, err?: unknown): boolean {
    if (this.terminated) return true;

    const fromError = isMessageUnavailableError(err) ? err : undefined;
    const cardMessageId = this.getCardMessageId();
    const state = getMessageUnavailableState(this.replyToMessageId) ?? getMessageUnavailableState(cardMessageId ?? undefined);
    let apiCode = fromError?.apiCode ?? state?.apiCode;

    if (!apiCode && err) {
      const detectedCode = extractLarkApiCode(err);
      if (isTerminalMessageApiCode(detectedCode)) {
        const fallbackMessageId = this.replyToMessageId ?? cardMessageId ?? undefined;
        if (fallbackMessageId) {
          markMessageUnavailable({ messageId: fallbackMessageId, apiCode: detectedCode, operation: source });
        }
        apiCode = detectedCode;
      }
    }

    if (!apiCode) return false;
    this.terminated = true;
    this.onTerminate();
    return true;
  }
}
