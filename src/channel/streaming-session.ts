/**
 * streaming-session.ts — Encapsulates all per-message streaming card state
 *
 * Polished against the official OpenClaw feishu plugin behavior:
 * - partial replies drive the first-screen experience
 * - short/final-only replies avoid forced streaming cards
 * - delayed card creation reduces awkward flash for tiny replies
 * - mergeStreamingText for proper text dedup/overlap handling
 * - throttled updates (max 10/sec)
 * - uuid-based idempotent CardKit calls
 */

import {
  buildThinkingStreamingCard,
  resolveStreamingTarget,
  buildStreamingReferenceMessage,
  mergeStreamingText,
  STREAMING_ELEMENT_ID,
} from "./streaming-card.js";
import type { StreamingCardSdk } from "./streaming-card-executor.js";
import { sendMessageFeishu, sendMarkdownCardFeishu, shouldUseCard } from "./send.js";

export interface StreamingSessionConfig {
  useStreaming: boolean;
  isDirect: boolean;
  senderOpenId: string;
  chatId: string;
  accountId: string;
  cfg: any;
  streamingSdk: StreamingCardSdk;
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

function shouldForceStreamingCard(text: string): boolean {
  const clean = (text ?? "").trim();
  if (!clean) return false;
  if (clean.length >= 120) return true;
  if (clean.includes("\n")) return true;
  if (/```[\s\S]*?```/.test(clean)) return true;
  if (/\|.+\|[\r\n]+\|[-:| ]+\|/.test(clean)) return true;
  return false;
}

export class StreamingSession {
  private cardKitCardId: string | null = null;
  private cardKitSequence = 0;
  private currentText = "";
  private cardMessageId: string | null = null;
  private streamingCardCreated = false;
  private closed = false;
  private plainTextDelivered = false;
  private partialCount = 0;

  private lastUpdateTime = 0;
  private pendingText: string | null = null;
  private updateThrottleMs = 100;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly config: StreamingSessionConfig) {}

  get isCardCreated(): boolean {
    return this.streamingCardCreated;
  }

  get cardId(): string | null {
    return this.cardKitCardId;
  }

  get accumulatedText(): string {
    return this.currentText;
  }

  get currentText_(): string {
    return this.currentText;
  }

  async onPartialText(text: string): Promise<void> {
    if (!this.config.useStreaming || this.closed) return;
    if (!text?.trim()) return;

    this.partialCount += 1;
    const merged = mergeStreamingText(this.currentText, text);
    const changed = merged !== this.currentText;
    this.currentText = merged;
    if (!changed) return;

    if (!this.streamingCardCreated) {
      const shouldCreate = this.partialCount >= 2 || shouldForceStreamingCard(this.currentText);
      if (!shouldCreate) return;
      this.config.log.info(
        `streaming: creating card (partials=${this.partialCount}, chars=${this.currentText.length}, ` +
        `force=${shouldForceStreamingCard(this.currentText)})`,
      );
      const created = await this.createStreamingCard();
      if (!created) return;
    }

    await this.updateStreamingContent();
  }

  async deliver(payload: any, info: any): Promise<void> {
    const text = payload?.text ?? payload?.body ?? payload?.content ?? "";
    if (!text?.trim()) return;

    const isFinal = info?.kind === "final";

    if (!this.config.useStreaming) {
      await this.sendTextOrCard(text);
      return;
    }

    this.currentText = mergeStreamingText(this.currentText, text);

    if (!isFinal) {
      // Non-final blocks may still be useful for slow models lacking onPartialReply.
      if (!this.streamingCardCreated && shouldForceStreamingCard(this.currentText)) {
        const created = await this.createStreamingCard();
        if (!created) return;
      }
      if (this.streamingCardCreated) {
        await this.updateStreamingContent();
      }
      return;
    }

    // Final-only / short response: do not force card.
    if (!this.streamingCardCreated) {
      await this.sendTextOrCard(this.currentText);
      this.plainTextDelivered = true;
      this.closed = true;
      return;
    }

    await this.finalizeCard();
  }

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

    await this.queue;

    const finalText = mergeStreamingText(this.currentText, this.pendingText ?? undefined);
    this.currentText = finalText;

    try {
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

  async closeIfNeeded(): Promise<void> {
    if (this.closed || this.plainTextDelivered) return;
    if (this.streamingCardCreated) {
      await this.finalizeCard();
      return;
    }
    if (this.currentText.trim()) {
      await this.sendTextOrCard(this.currentText);
      this.plainTextDelivered = true;
      this.closed = true;
    }
  }

  /**
   * Send text as either plain text (post/md) or a markdown card.
   * Uses card rendering for code blocks and tables (better readability).
   * This aligns with the official feishu plugin's `shouldUseCard()` pattern.
   */
  private async sendTextOrCard(text: string): Promise<void> {
    try {
      const targetId = this.config.isDirect ? this.config.senderOpenId : this.config.chatId;
      const useCard = shouldUseCard(text);

      if (useCard) {
        this.config.log.info(`delivery: markdown card (structured content detected)`);
        await sendMarkdownCardFeishu({
          cfg: this.config.cfg,
          to: targetId,
          text,
          accountId: this.config.accountId,
          userId: this.config.senderOpenId,
        });
      } else {
        this.config.log.info(`delivery: post/md text (${text.length} chars)`);
        await sendMessageFeishu({
          cfg: this.config.cfg,
          to: targetId,
          text,
          accountId: this.config.accountId,
          userId: this.config.senderOpenId,
        });
      }
    } catch (err) {
      this.config.log.error(`failed to send reply: ${String(err)}`);
    }
  }
}
