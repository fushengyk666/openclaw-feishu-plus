/**
 * reply-dispatcher-types.ts — shared types/state for Feishu reply pipeline
 */

import type { FeishuFooterConfig } from "./footer-config.js";

export const CARD_PHASES = {
  idle: "idle",
  creating: "creating",
  streaming: "streaming",
  completed: "completed",
  aborted: "aborted",
  terminated: "terminated",
  creation_failed: "creation_failed",
} as const;

export type CardPhase = (typeof CARD_PHASES)[keyof typeof CARD_PHASES];

export const TERMINAL_PHASES: ReadonlySet<CardPhase> = new Set([
  "completed",
  "aborted",
  "terminated",
  "creation_failed",
]);

export type TerminalReason = "normal" | "error" | "abort" | "unavailable" | "creation_failed";

export const PHASE_TRANSITIONS: Record<CardPhase, ReadonlySet<CardPhase>> = {
  idle: new Set(["creating", "aborted", "terminated"]),
  creating: new Set(["streaming", "creation_failed", "aborted", "terminated"]),
  streaming: new Set(["completed", "aborted", "terminated"]),
  completed: new Set(),
  aborted: new Set(),
  terminated: new Set(),
  creation_failed: new Set(),
};

export interface ReasoningState {
  accumulatedReasoningText: string;
  reasoningStartTime: number | null;
  reasoningElapsedMs: number;
  isReasoningPhase: boolean;
}

export interface StreamingTextState {
  accumulatedText: string;
  completedText: string;
  streamingPrefix: string;
  lastPartialText: string;
}

export interface CardKitState {
  cardKitCardId: string | null;
  originalCardKitCardId: string | null;
  cardKitSequence: number;
  cardMessageId: string | null;
}

export const THROTTLE_CONSTANTS = {
  CARDKIT_MS: 100,
  PATCH_MS: 1500,
  LONG_GAP_THRESHOLD_MS: 2000,
  BATCH_AFTER_GAP_MS: 300,
} as const;

export const EMPTY_REPLY_FALLBACK_TEXT = "Done.";

export interface CreateFeishuReplyDispatcherParams {
  cfg: any;
  agentId: string;
  chatId: string;
  replyToMessageId?: string;
  accountId?: string;
  chatType?: "p2p" | "group";
  senderOpenId: string;
  skipTyping?: boolean;
  replyInThread?: boolean;
  footer?: FeishuFooterConfig;
  streamingSdk: {
    createCard(payload: any): Promise<any>;
    updateElementContent(cardId: string, elementId: string, body: any): Promise<void>;
    updateSettings(cardId: string, body: any): Promise<void>;
  };
  log: {
    info: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error: (...args: any[]) => void;
    debug?: (...args: any[]) => void;
  };
}

export interface FeishuReplyDispatcherResult {
  dispatcherOptions: {
    deliver: (payload: any, info: any) => Promise<void>;
    onIdle: () => Promise<void>;
    onError: (err: unknown, info?: { kind?: string }) => Promise<void>;
  };
  replyOptions: Record<string, unknown>;
  markFullyComplete: () => void;
  abortCard: () => Promise<void>;
}
