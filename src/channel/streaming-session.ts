/**
 * streaming-session.ts — Encapsulates all per-message streaming card state
 *
 * Replaces the scattered closure variables in plugin.ts (cardKitCardId,
 * cardKitSequence, accumulatedText, cardMessageId, streamingCardCreated)
 * with a single cohesive object.
 *
 * Benefits:
 * - plugin.ts handleInboundMessage stays thin
 * - State transitions are explicit and traceable
 * - Easier to test in isolation
 * - Natural attachment point for future features (e.g., timeout, retry budget)
 */

import {
  buildThinkingStreamingCard,
  resolveStreamingTarget,
  buildStreamingReferenceMessage,
  buildStreamingContentUpdate,
  buildStreamingFinalizeUpdate,
  buildStreamingSettingsUpdate,
} from "./streaming-card.js";
import type { StreamingCardSdk } from "./streaming-card-executor.js";
import { sendMessageFeishu } from "./send.js";

export interface StreamingSessionConfig {
  /** Whether streaming cards are enabled for this message */
  useStreaming: boolean;
  /** Whether this is a direct (p2p) message */
  isDirect: boolean;
  /** Sender open_id */
  senderOpenId: string;
  /** Chat ID (empty for DM) */
  chatId: string;
  /** Account ID for send operations */
  accountId: string;
  /** Full channel config for send */
  cfg: any;
  /** CardKit SDK instance */
  streamingSdk: StreamingCardSdk;
  /** Logger functions */
  log: {
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

/**
 * StreamingSession manages the complete lifecycle of a single streaming card
 * exchange for one inbound message.
 *
 * Lifecycle:
 * 1. construct → initial state
 * 2. deliver() called per agent output block
 * 3. internally decides: create card → push content → update → finalize
 * 4. Falls back to plain text if streaming is off or card creation fails
 */
export class StreamingSession {
  // ── Internal state ──
  private cardKitCardId: string | null = null;
  private cardKitSequence = 0;
  private accumulatedText = "";
  private cardMessageId: string | null = null;
  private streamingCardCreated = false;

  constructor(private readonly config: StreamingSessionConfig) {}

  // ── Public accessors for testing ──

  get isCardCreated(): boolean {
    return this.streamingCardCreated;
  }

  get cardId(): string | null {
    return this.cardKitCardId;
  }

  get currentText(): string {
    return this.accumulatedText;
  }

  // ── Main dispatch method ──

  /**
   * Called by the buffered block dispatcher for each output chunk.
   * Handles the full decision tree: create → update → finalize | fallback.
   */
  async deliver(payload: any, info: any): Promise<void> {
    const text = payload?.text ?? payload?.body ?? payload?.content ?? "";
    if (!text?.trim()) return;

    const isFinal = info?.kind === "final";

    if (!this.config.useStreaming) {
      await this.sendPlainText(text);
      return;
    }

    // Create card on first non-empty chunk
    if (!this.streamingCardCreated) {
      const created = await this.createStreamingCard();
      if (!created) {
        // Card creation failed → fall back to plain text
        await this.sendPlainText(text);
        return;
      }
    }

    // Card exists — accumulate and update
    this.accumulatedText += text;

    if (isFinal) {
      await this.finalizeCard();
    } else {
      await this.updateStreamingContent();
    }
  }

  // ── Internal methods ──

  private async createStreamingCard(): Promise<boolean> {
    const { streamingSdk, cfg, accountId, log } = this.config;
    try {
      const thinkingCard = buildThinkingStreamingCard();
      const createResp = await streamingSdk.createCard({
        data: { type: "card_json", data: JSON.stringify(thinkingCard) },
      });
      this.cardKitCardId = (createResp?.data as any)?.card_id ?? null;
      if (!this.cardKitCardId) return false;
      this.cardKitSequence = 1;
      this.streamingCardCreated = true;

      // Send IM message referencing card_id
      const target = resolveStreamingTarget({
        isDirect: this.config.isDirect,
        senderOpenId: this.config.senderOpenId,
        chatId: this.config.chatId,
      });
      const referenceMessage = buildStreamingReferenceMessage(this.cardKitCardId, target);
      const sendResp = await sendMessageFeishu({
        cfg,
        to: target.targetId,
        msgType: "interactive",
        content: referenceMessage.data.content,
        accountId,
        userId: this.config.senderOpenId,
      });
      this.cardMessageId = (sendResp as any)?.message_id ?? null;
      log.info(
        `streaming card created (card_id=${this.cardKitCardId}, msg_id=${this.cardMessageId})`,
      );
      return true;
    } catch (err: any) {
      // Roll back state if CardKit create succeeded but reference message send failed.
      // A streaming card is only considered "created" when both steps succeed,
      // otherwise later deliver() calls would see an inconsistent half-created state.
      this.cardKitCardId = null;
      this.cardKitSequence = 0;
      this.cardMessageId = null;
      this.streamingCardCreated = false;

      const detail = err?.response?.data ? JSON.stringify(err.response.data) : String(err);
      log.error(`failed to create streaming card: ${detail}`);
      return false;
    }
  }

  private async updateStreamingContent(): Promise<void> {
    if (!this.cardKitCardId) return;
    try {
      this.cardKitSequence++;
      await this.config.streamingSdk.updateContent(
        buildStreamingContentUpdate(this.cardKitCardId, this.cardKitSequence, this.accumulatedText),
      );
    } catch (err) {
      this.config.log.error(`stream update failed: ${String(err)}`);
    }
  }

  private async finalizeCard(): Promise<void> {
    if (!this.cardKitCardId) return;
    try {
      this.cardKitSequence++;
      await this.config.streamingSdk.updateFinalCard(
        buildStreamingFinalizeUpdate(this.cardKitCardId, this.cardKitSequence, this.accumulatedText),
      );
      this.cardKitSequence++;
      await this.config.streamingSdk.updateSettings(
        buildStreamingSettingsUpdate(this.cardKitCardId, this.cardKitSequence),
      );
    } catch (err) {
      this.config.log.error(`finalize card failed: ${String(err)}`);
    }
  }

  private async sendPlainText(text: string): Promise<void> {
    try {
      const targetId = this.config.isDirect ? this.config.senderOpenId : this.config.chatId;
      await sendMessageFeishu({
        cfg: this.config.cfg,
        to: targetId,
        text,
        accountId: this.config.accountId,
        userId: this.config.senderOpenId,
      });
    } catch (err) {
      this.config.log.error(`failed to send reply: ${String(err)}`);
    }
  }
}
