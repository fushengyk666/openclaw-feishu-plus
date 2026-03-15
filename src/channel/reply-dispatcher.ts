/**
 * reply-dispatcher.ts — official-aligned reply dispatcher factory
 */

import { addReactionFeishu, listReactionsFeishu, removeReactionFeishu } from "./reactions.js";
import { sendMarkdownCardFeishu, sendMessageFeishu, shouldUseCard } from "./send.js";
import { expandAutoMode, resolveReplyMode } from "./reply-mode.js";
import { StreamingCardController } from "./streaming-card-controller.js";
import { UnavailableGuard } from "./unavailable-guard.js";
import type { CreateFeishuReplyDispatcherParams, FeishuReplyDispatcherResult } from "./reply-dispatcher-types.js";

function chunkText(text: string, limit = 4000): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += limit) chunks.push(text.slice(i, i + limit));
  return chunks.length ? chunks : [text];
}

export async function addTypingIndicator(params: { cfg: any; messageId: string; accountId?: string }): Promise<{ reactionId: string | null }> {
  try {
    const resp = await addReactionFeishu({
      cfg: params.cfg,
      messageId: params.messageId,
      emojiType: "Typing",
      accountId: params.accountId,
    });
    return { reactionId: (resp?.data as any)?.reaction_id ?? null };
  } catch {
    return { reactionId: null };
  }
}

export async function removeTypingIndicatorSafe(params: { cfg: any; messageId: string; state: { reactionId: string | null }; accountId?: string }): Promise<void> {
  if (params.state.reactionId) {
    try {
      await removeReactionFeishu({
        cfg: params.cfg,
        messageId: params.messageId,
        reactionId: params.state.reactionId,
        accountId: params.accountId,
      });
      return;
    } catch {}
  }

  try {
    const items = await listReactionsFeishu({ cfg: params.cfg, messageId: params.messageId, accountId: params.accountId });
    const typingReaction = items.find((item: any) => item?.reaction_type?.emoji_type === "Typing" || item?.reaction_type?.emoji_type === "typing");
    const reactionId = typingReaction?.reaction_id;
    if (reactionId) {
      await removeReactionFeishu({ cfg: params.cfg, messageId: params.messageId, reactionId, accountId: params.accountId });
    }
  } catch {}
}

export function createFeishuReplyDispatcher(params: CreateFeishuReplyDispatcherParams): FeishuReplyDispatcherResult {
  const { cfg, chatId, replyToMessageId, accountId, replyInThread, senderOpenId } = params;
  const channelCfg = cfg?.channels?.["openclaw-feishu-plus"] ?? cfg;

  const effectiveReplyMode = resolveReplyMode({ feishuCfg: channelCfg, chatType: params.chatType });
  const replyMode = expandAutoMode({ mode: effectiveReplyMode, streaming: channelCfg?.streaming, chatType: params.chatType });
  const useStreamingCards = replyMode === "streaming";

  const controller = useStreamingCards ? new StreamingCardController(params) : null;
  let staticAborted = false;
  const staticGuard = controller
    ? null
    : new UnavailableGuard({
        replyToMessageId,
        getCardMessageId: () => null,
        onTerminate: () => {
          staticAborted = true;
        },
      });

  const shouldSkip = (source: string): boolean => {
    if (controller) return controller.shouldSkipForUnavailable(source);
    return staticGuard?.shouldSkip(source) ?? false;
  };

  let typingState: { reactionId: string | null } | null = null;
  let typingStopped = false;
  let dispatchFullyComplete = false;

  const stopTyping = async () => {
    typingStopped = true;
    if (!typingState || !replyToMessageId) return;
    await removeTypingIndicatorSafe({ cfg, messageId: replyToMessageId, state: typingState, accountId });
    typingState = null;
  };

  const dispatcherOptions = {
    deliver: async (payload: any) => {
      if (shouldSkip("deliver.entry")) return;
      if (staticAborted || controller?.isTerminated || controller?.isAborted) return;

      const text = payload?.text ?? payload?.body ?? payload?.content ?? "";
      if (!text.trim()) return;

      if (controller) {
        await controller.ensureCardCreated();
        if (controller.isTerminated) return;
        if (controller.cardMessageId) {
          await controller.onDeliver(payload);
          return;
        }
      }

      const targetId = params.chatType === "p2p" ? senderOpenId : chatId;
      if (shouldUseCard(text)) {
        for (const chunk of chunkText(text)) {
          await sendMarkdownCardFeishu({
            cfg,
            to: targetId,
            text: chunk,
            accountId,
            userId: senderOpenId,
            replyToMessageId,
            replyInThread,
          });
        }
      } else {
        for (const chunk of chunkText(text)) {
          await sendMessageFeishu({
            cfg,
            to: targetId,
            text: chunk,
            accountId,
            userId: senderOpenId,
            replyToMessageId,
            replyInThread,
          });
        }
      }
    },

    onIdle: async () => {
      if (controller && dispatchFullyComplete) {
        await controller.onIdle();
      }
      await stopTyping();
    },

    onError: async (err: unknown, info?: { kind?: string }) => {
      if (controller) {
        if (controller.terminateIfUnavailable("onError", err)) {
          await stopTyping();
          return;
        }
        await controller.onError(err, info);
        await stopTyping();
        return;
      }
      if (staticGuard?.terminate("onError", err)) {
        await stopTyping();
        return;
      }
      params.log.error(`reply failed (${info?.kind ?? "unknown"}): ${String(err)}`);
      await stopTyping();
    },
  };

  const replyOptions: Record<string, unknown> = {
    disableBlockStreaming: true,
    onReplyStart: async () => {
      if (shouldSkip("onReplyStart")) return;
      if (!replyToMessageId || typingStopped || params.skipTyping) return;
      if (typingState?.reactionId) return;
      typingState = await addTypingIndicator({ cfg, messageId: replyToMessageId, accountId });
      if (typingStopped && typingState) {
        await removeTypingIndicatorSafe({ cfg, messageId: replyToMessageId, state: typingState, accountId });
        typingState = null;
      }
    },
    ...(controller
      ? {
          onReasoningStream: async (payload: any) => controller.onReasoningStream(payload),
          onPartialReply: async (payload: any) => controller.onPartialReply(payload),
        }
      : {}),
  };

  return {
    dispatcherOptions,
    replyOptions,
    markFullyComplete: () => {
      dispatchFullyComplete = true;
      controller?.markFullyComplete();
    },
    abortCard: controller ? () => controller.abortCard() : async () => {},
  };
}
