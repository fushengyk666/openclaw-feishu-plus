/**
 * streaming-session.ts — Encapsulates all per-message streaming card state
 *
 * Aligned with the official OpenClaw feishu plugin's FeishuStreamingSession:
 * - Uses raw HTTP via StreamingCardSdk (not SDK wrapper methods)
 * - mergeStreamingText for proper text dedup/overlap handling
 * - Throttled updates (max 10/sec)
 * - uuid-based idempotent CardKit calls
 * - Non-empty initial card content
 * - Proper close sequence: final content update + streaming_mode=false
 */

import {
  buildThinkingStreamingCard,
  resolveStreamingTarget,
  buildStreamingReferenceMessage,
  mergeStreamingText,
  STREAMING_ELEMENT_ID,
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

function truncateSummary(text: string, max = 50): string {
  if (!text) return "";
  const clean = text.replace(/\n/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max - 3) + "...";
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
  private currentText = "";
  private cardMessageId: string | null = null;
  private streamingCardCreated = false;
  private closed = false;

  // ── Throttling ──
  private lastUpdateTime = 0;
  private pendingText: string | null = null;
  private updateThrottleMs = 100;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly config: StreamingSessionConfig) {}

  // ── Public accessors for testing ──

  get isCardCreated(): boolean {
    return this.streamingCardCreated;
  }

  get cardId(): string | null {
    return this.cardKitCardId;
  }

  get accumulatedText(): string {
    return this.currentText;
  }

  // Legacy compat alias
  get currentText_(): string {
    return this.currentText;
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

    // Card exists — merge text using the official mergeStreamingText approach
    this.currentText = mergeStreamingText(this.currentText, text);

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
    if (!this.cardKitCardId || this.closed) return;

    const textToUpdate = this.currentText;
    if (!textToUpdate) return;

    // Throttle: skip if updated recently, but remember pending text
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottleMs) {
      this.pendingText = textToUpdate;
      return;
    }
    this.pendingText = null;
    this.lastUpdateTime = now;

    this.queue = this.queue.then(async () => {
      if (!this.cardKitCardId || this.closed) return;
      try {
        this.cardKitSequence++;
        await this.config.streamingSdk.updateElementContent(
          this.cardKitCardId,
          STREAMING_ELEMENT_ID,
          {
            content: textToUpdate,
            sequence: this.cardKitSequence,
            uuid: `s_${this.cardKitCardId}_${this.cardKitSequence}`,
          },
        );
      } catch (err) {
        this.config.log.error(`stream update failed: ${String(err)}`);
      }
    });
    await this.queue;
  }

  private async finalizeCard(): Promise<void> {
    if (!this.cardKitCardId || this.closed) return;
    this.closed = true;

    // Wait for any pending updates
    await this.queue;

    // Merge any pending text
    const finalText = mergeStreamingText(
      this.currentText,
      this.pendingText ?? undefined,
    );
    this.currentText = finalText;

    try {
      // Final content update (if text differs from what's been pushed)
      this.cardKitSequence++;
      await this.config.streamingSdk.updateElementContent(
        this.cardKitCardId,
        STREAMING_ELEMENT_ID,
        {
          content: finalText,
          sequence: this.cardKitSequence,
          uuid: `s_${this.cardKitCardId}_${this.cardKitSequence}`,
        },
      );

      // Close streaming mode
      this.cardKitSequence++;
      await this.config.streamingSdk.updateSettings(
        this.cardKitCardId,
        {
          settings: JSON.stringify({
            config: {
              streaming_mode: false,
              summary: { content: truncateSummary(finalText) },
            },
          }),
          sequence: this.cardKitSequence,
          uuid: `c_${this.cardKitCardId}_${this.cardKitSequence}`,
        },
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
