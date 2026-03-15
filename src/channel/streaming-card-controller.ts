/**
 * streaming-card-controller.ts — official-style streaming card lifecycle controller
 */

import { splitReasoningText, stripReasoningTags } from "./reasoning-text.js";
import { buildThinkingCard, buildStreamingPatchCard, buildCompleteCard, STREAMING_ELEMENT_ID } from "./builder.js";
import { sendCardFeishu, sendMessageFeishu, sendMarkdownCardFeishu, shouldUseCard, updateCardFeishu, deleteMessageFeishu } from "./send.js";
import { FlushController } from "./flush-controller.js";
import { UnavailableGuard } from "./unavailable-guard.js";
import { ImageResolver } from "./image-resolver.js";
import type {
  CardKitState,
  CardPhase,
  ReasoningState,
  StreamingTextState,
  TerminalReason,
  CreateFeishuReplyDispatcherParams,
} from "./reply-dispatcher-types.js";
import { EMPTY_REPLY_FALLBACK_TEXT, PHASE_TRANSITIONS, TERMINAL_PHASES, THROTTLE_CONSTANTS } from "./reply-dispatcher-types.js";

function plainSummary(text: string): string {
  const clean = (text || "").replace(/[*_`#>~\[\]()]/g, "").replace(/\n+/g, " ").trim();
  return clean.slice(0, 120) || "Done.";
}

export class StreamingCardController {
  private phase: CardPhase = "idle";
  private cardKit: CardKitState = {
    cardKitCardId: null,
    originalCardKitCardId: null,
    cardKitSequence: 0,
    cardMessageId: null,
  };
  private text: StreamingTextState = {
    accumulatedText: "",
    completedText: "",
    streamingPrefix: "",
    lastPartialText: "",
  };
  private reasoning: ReasoningState = {
    accumulatedReasoningText: "",
    reasoningStartTime: null,
    reasoningElapsedMs: 0,
    isReasoningPhase: false,
  };

  private readonly flush: FlushController;
  private readonly guard: UnavailableGuard;
  private readonly imageResolver: ImageResolver;
  private readonly dispatchStartTime = Date.now();
  private createEpoch = 0;
  private dispatchFullyComplete = false;
  private cardCreationPromise: Promise<void> | null = null;
  private _terminalReason: TerminalReason | null = null;

  constructor(private readonly deps: CreateFeishuReplyDispatcherParams) {
    this.guard = new UnavailableGuard({
      replyToMessageId: deps.replyToMessageId,
      getCardMessageId: () => this.cardKit.cardMessageId,
      onTerminate: () => {
        this.transition("terminated", "UnavailableGuard", "unavailable");
      },
    });
    this.flush = new FlushController(() => this.performFlush());
    this.imageResolver = new ImageResolver({
      cfg: deps.cfg,
      accountId: deps.accountId,
      onImageResolved: () => {
        if (!this.isTerminalPhase && this.cardKit.cardMessageId) void this.throttledCardUpdate();
      },
      log: deps.log,
    });
  }

  get cardMessageId(): string | null {
    return this.cardKit.cardMessageId;
  }
  get isTerminalPhase(): boolean {
    return TERMINAL_PHASES.has(this.phase);
  }
  get isAborted(): boolean {
    return this.phase === "aborted";
  }
  get isTerminated(): boolean {
    return this.guard.isTerminated;
  }
  get terminalReason(): TerminalReason | null {
    return this._terminalReason;
  }

  shouldSkipForUnavailable(source: string): boolean {
    return this.guard.shouldSkip(source);
  }
  terminateIfUnavailable(source: string, err?: unknown): boolean {
    return this.guard.terminate(source, err);
  }

  private shouldProceed(source: string): boolean {
    if (this.guard.isTerminated || this.guard.shouldSkip(source)) return false;
    return !this.isTerminalPhase;
  }

  private transition(to: CardPhase, source: string, reason?: TerminalReason): boolean {
    const from = this.phase;
    if (from === to) return false;
    if (!PHASE_TRANSITIONS[from].has(to)) {
      this.deps.log.warn?.(`phase transition rejected ${from} -> ${to} @ ${source}`);
      return false;
    }
    this.phase = to;
    if (TERMINAL_PHASES.has(to)) {
      this._terminalReason = reason ?? null;
      this.createEpoch += 1;
      this.flush.cancelPendingFlush();
      this.flush.complete();
    }
    return true;
  }

  private isStaleCreate(epoch: number): boolean {
    return epoch !== this.createEpoch;
  }

  markFullyComplete(): void {
    this.dispatchFullyComplete = true;
  }

  async ensureCardCreated(): Promise<void> {
    if (this.guard.shouldSkip("ensureCardCreated.precheck")) return;
    if (this.cardKit.cardMessageId || this.phase === "creation_failed" || this.isTerminalPhase) return;
    if (this.cardCreationPromise) {
      await this.cardCreationPromise;
      return;
    }

    if (!this.transition("creating", "ensureCardCreated")) return;
    this.createEpoch += 1;
    const epoch = this.createEpoch;
    this.cardCreationPromise = (async () => {
      try {
        try {
          const thinkingCard = buildThinkingCard();
          const createResp = await this.deps.streamingSdk.createCard({
            data: { type: "card_json", data: JSON.stringify(thinkingCard) },
          });
          if (this.isStaleCreate(epoch)) return;

          const cardId = (createResp?.data as any)?.card_id ?? null;
          if (!cardId) throw new Error("card.create returned empty card_id");

          this.cardKit.cardKitCardId = cardId;
          this.cardKit.originalCardKitCardId = cardId;
          this.cardKit.cardKitSequence = 1;

          const sendResp = await sendMessageFeishu({
            cfg: this.deps.cfg,
            to: this.deps.chatType === "p2p" ? this.deps.senderOpenId : this.deps.chatId,
            msgType: "interactive",
            content: JSON.stringify({ type: "card", data: { card_id: cardId } }),
            accountId: this.deps.accountId,
            userId: this.deps.senderOpenId,
            replyToMessageId: this.deps.replyToMessageId,
            replyInThread: this.deps.replyInThread,
          });

          if (this.isStaleCreate(epoch)) {
            const lateMessageId = (sendResp as any)?.message_id ?? null;
            if (lateMessageId) {
              try {
                await deleteMessageFeishu({
                  cfg: this.deps.cfg,
                  messageId: lateMessageId,
                  accountId: this.deps.accountId,
                  userId: this.deps.senderOpenId,
                });
              } catch {}
            }
            return;
          }

          this.cardKit.cardMessageId = (sendResp as any)?.message_id ?? null;
          this.flush.setCardMessageReady(true);
          this.transition("streaming", "ensureCardCreated.cardkit");
        } catch (cardKitErr) {
          if (this.isStaleCreate(epoch)) return;
          if (this.guard.terminate("ensureCardCreated.cardkitFlow", cardKitErr)) return;

          const fallbackCard = buildStreamingPatchCard("", "");
          const result = await sendCardFeishu({
            cfg: this.deps.cfg,
            to: this.deps.chatType === "p2p" ? this.deps.senderOpenId : this.deps.chatId,
            card: fallbackCard,
            accountId: this.deps.accountId,
            userId: this.deps.senderOpenId,
            replyToMessageId: this.deps.replyToMessageId,
            replyInThread: this.deps.replyInThread,
          });
          if (this.isStaleCreate(epoch)) return;
          this.cardKit.cardMessageId = (result as any)?.message_id ?? null;
          this.cardKit.cardKitCardId = null;
          this.cardKit.originalCardKitCardId = null;
          this.flush.setCardMessageReady(true);
          this.transition("streaming", "ensureCardCreated.imFallback");
        }
      } catch (err) {
        if (this.isStaleCreate(epoch)) return;
        if (this.guard.terminate("ensureCardCreated.outer", err)) return;
        this.transition("creation_failed", "ensureCardCreated.outer", "creation_failed");
      }
    })();
    await this.cardCreationPromise;
  }

  async onDeliver(payload: any): Promise<void> {
    if (!this.shouldProceed("onDeliver")) return;
    const text = payload?.text ?? "";
    if (!text.trim()) return;

    await this.ensureCardCreated();
    if (!this.shouldProceed("onDeliver.postCreate")) return;
    if (!this.cardKit.cardMessageId && this.phase !== "creation_failed") return;

    const split = splitReasoningText(text);
    if (split.reasoningText && !split.answerText) {
      this.reasoning.accumulatedReasoningText = split.reasoningText;
      this.reasoning.isReasoningPhase = true;
      await this.throttledCardUpdate();
      return;
    }

    this.reasoning.isReasoningPhase = false;
    if (split.reasoningText) this.reasoning.accumulatedReasoningText = split.reasoningText;
    const answerText = split.answerText ?? text;
    this.text.completedText += (this.text.completedText ? "\n\n" : "") + answerText;

    if (!this.text.lastPartialText && !this.text.streamingPrefix) {
      this.text.accumulatedText += (this.text.accumulatedText ? "\n\n" : "") + answerText;
      this.text.streamingPrefix = this.text.accumulatedText;
      await this.throttledCardUpdate();
    }
  }

  async onReasoningStream(payload: any): Promise<void> {
    if (!this.shouldProceed("onReasoningStream")) return;
    await this.ensureCardCreated();
    if (!this.shouldProceed("onReasoningStream.postCreate")) return;
    const rawText = payload?.text ?? "";
    if (!rawText) return;
    if (!this.reasoning.reasoningStartTime) this.reasoning.reasoningStartTime = Date.now();
    this.reasoning.isReasoningPhase = true;
    const split = splitReasoningText(rawText);
    this.reasoning.accumulatedReasoningText = split.reasoningText ?? rawText;
    await this.throttledCardUpdate();
  }

  async onPartialReply(payload: any): Promise<void> {
    if (!this.shouldProceed("onPartialReply")) return;
    const text = stripReasoningTags(payload?.text ?? "");
    if (!text) return;

    if (!this.reasoning.reasoningStartTime) this.reasoning.reasoningStartTime = Date.now();
    if (this.reasoning.isReasoningPhase) {
      this.reasoning.isReasoningPhase = false;
      this.reasoning.reasoningElapsedMs = this.reasoning.reasoningStartTime ? Date.now() - this.reasoning.reasoningStartTime : 0;
    }

    if (this.text.lastPartialText && text.length < this.text.lastPartialText.length) {
      this.text.streamingPrefix += (this.text.streamingPrefix ? "\n\n" : "") + this.text.lastPartialText;
    }
    this.text.lastPartialText = text;
    this.text.accumulatedText = this.text.streamingPrefix ? `${this.text.streamingPrefix}\n\n${text}` : text;

    await this.ensureCardCreated();
    if (!this.shouldProceed("onPartialReply.postCreate")) return;
    if (!this.cardKit.cardMessageId && this.phase !== "creation_failed") return;
    await this.throttledCardUpdate();
  }

  private async performFlush(): Promise<void> {
    if (!this.cardKit.cardMessageId || this.isTerminalPhase) return;
    if (!this.cardKit.cardKitCardId && this.cardKit.originalCardKitCardId) return;

    try {
      const displayText = this.reasoning.isReasoningPhase && this.reasoning.accumulatedReasoningText
        ? (this.text.accumulatedText
            ? `${this.text.accumulatedText}\n\n💭 **Thinking...**\n\n${this.reasoning.accumulatedReasoningText}`
            : `💭 **Thinking...**\n\n${this.reasoning.accumulatedReasoningText}`)
        : this.text.accumulatedText;
      const resolvedDisplayText = this.imageResolver.resolveImages(displayText);

      if (this.cardKit.cardKitCardId) {
        this.cardKit.cardKitSequence += 1;
        await this.deps.streamingSdk.updateElementContent(this.cardKit.cardKitCardId, STREAMING_ELEMENT_ID, {
          content: resolvedDisplayText,
          sequence: this.cardKit.cardKitSequence,
          uuid: `s_${this.cardKit.cardKitCardId}_${this.cardKit.cardKitSequence}`,
        });
      } else {
        await updateCardFeishu({
          cfg: this.deps.cfg,
          messageId: this.cardKit.cardMessageId,
          card: buildStreamingPatchCard(this.reasoning.isReasoningPhase ? "" : resolvedDisplayText, this.reasoning.isReasoningPhase ? this.reasoning.accumulatedReasoningText : undefined),
          accountId: this.deps.accountId,
          userId: this.deps.senderOpenId,
        });
      }
    } catch (err: any) {
      if (this.guard.terminate("flushCardUpdate", err)) return;
      const code = err?.code ?? err?.response?.data?.code;
      if (code === 230020) return;
      if (this.cardKit.cardKitCardId) this.cardKit.cardKitCardId = null;
    }
  }

  private async throttledCardUpdate(): Promise<void> {
    if (this.guard.shouldSkip("throttledCardUpdate")) return;
    const throttleMs = this.cardKit.cardKitCardId ? THROTTLE_CONSTANTS.CARDKIT_MS : THROTTLE_CONSTANTS.PATCH_MS;
    await this.flush.throttledUpdate(throttleMs);
  }

  private async finalizeCardUpdate(flags?: { isError?: boolean; isAborted?: boolean }): Promise<void> {
    await this.flush.waitForFlush();
    if (this.cardCreationPromise) await this.cardCreationPromise;

    const effectiveCardId = this.cardKit.cardKitCardId ?? this.cardKit.originalCardKitCardId;
    const rawFinalText = this.text.completedText || this.text.accumulatedText || EMPTY_REPLY_FALLBACK_TEXT;
    const finalText = await this.imageResolver.resolveImagesAwait(rawFinalText, 15000);
    const finalCard = buildCompleteCard({
      text: finalText,
      reasoningText: this.reasoning.accumulatedReasoningText || undefined,
      reasoningElapsedMs: this.reasoning.reasoningElapsedMs || undefined,
      elapsedMs: Date.now() - this.dispatchStartTime,
      isError: flags?.isError,
      isAborted: flags?.isAborted,
      footer: this.deps.footer ? { status: this.deps.footer.status ?? false, elapsed: this.deps.footer.elapsed ?? false } : undefined,
    });

    if (effectiveCardId) {
      this.cardKit.cardKitSequence += 1;
      await this.deps.streamingSdk.updateSettings(effectiveCardId, {
        settings: JSON.stringify({ config: { streaming_mode: false, summary: { content: plainSummary(finalText) } } }),
        sequence: this.cardKit.cardKitSequence,
        uuid: `c_${effectiveCardId}_${this.cardKit.cardKitSequence}`,
      });
      this.cardKit.cardKitSequence += 1;
      await this.deps.streamingSdk.updateElementContent(effectiveCardId, STREAMING_ELEMENT_ID, {
        content: finalText,
        sequence: this.cardKit.cardKitSequence,
        uuid: `s_${effectiveCardId}_${this.cardKit.cardKitSequence}`,
      });
    } else if (this.cardKit.cardMessageId) {
      await updateCardFeishu({
        cfg: this.deps.cfg,
        messageId: this.cardKit.cardMessageId,
        card: finalCard,
        accountId: this.deps.accountId,
        userId: this.deps.senderOpenId,
      });
    } else if (this.phase === "creation_failed") {
      const targetId = this.deps.chatType === "p2p" ? this.deps.senderOpenId : this.deps.chatId;
      if (shouldUseCard(finalText)) {
        await sendMarkdownCardFeishu({
          cfg: this.deps.cfg,
          to: targetId,
          text: finalText,
          accountId: this.deps.accountId,
          userId: this.deps.senderOpenId,
          replyToMessageId: this.deps.replyToMessageId,
          replyInThread: this.deps.replyInThread,
        });
      } else {
        await sendMessageFeishu({
          cfg: this.deps.cfg,
          to: targetId,
          text: finalText,
          accountId: this.deps.accountId,
          userId: this.deps.senderOpenId,
          replyToMessageId: this.deps.replyToMessageId,
          replyInThread: this.deps.replyInThread,
        });
      }
    }
  }

  async onError(err: unknown, info?: { kind?: string }): Promise<void> {
    if (this.guard.terminate("onError", err)) return;
    this.deps.log.error(`streaming reply failed (${info?.kind ?? "unknown"}): ${String(err)}`);
    if (!this.transition("completed", "onError", "error")) return;
    try {
      await this.finalizeCardUpdate({ isError: true });
    } catch {}
  }

  async onIdle(): Promise<void> {
    if (this.guard.isTerminated || this.guard.shouldSkip("onIdle")) return;
    if (!this.dispatchFullyComplete) return;
    if (this.isTerminalPhase) return;
    if (!this.transition("completed", "onIdle", "normal")) return;
    try {
      await this.finalizeCardUpdate();
    } catch (err) {
      this.deps.log.warn?.(`final card update failed: ${String(err)}`);
    }
  }

  async abortCard(): Promise<void> {
    if (!this.transition("aborted", "abortCard", "abort")) return;
    try {
      await this.finalizeCardUpdate({ isAborted: true });
    } catch (err) {
      this.deps.log.warn?.(`abortCard failed: ${String(err)}`);
    }
  }
}
