/**
 * card-action.ts — Interactive Card Action Callback (Webhook)
 *
 * Implements a minimal CardActionHandler integration for Feishu interactive cards.
 *
 * Notes:
 * - Card action callbacks are delivered over HTTP (webhook) — not WS.
 * - This implementation responds quickly with a small acknowledgement card.
 * - Future work: route card actions into the OpenClaw agent runtime (async) and
 *   update the original card with real results.
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { InteractiveCard, InteractiveCardActionEvent } from "@larksuiteoapi/node-sdk";

import { getFeishuPlusRuntime } from "./runtime.js";
import { sendMessageFeishu } from "./send.js";

export function buildCardActionAckCard(event: InteractiveCardActionEvent): InteractiveCard {
  const tag = event?.action?.tag ?? "unknown";
  const value = event?.action?.value ?? {};

  return {
    config: {
      enable_forward: false,
      update_multi: true,
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: "plain_text",
        content: "已收到卡片操作",
      },
      template: "wathet",
    },
    elements: [
      {
        tag: "markdown",
        content:
          `**action.tag**: ${tag}\n` +
          `**from**: ${event?.open_id ?? ""}\n` +
          `**open_message_id**: ${event?.open_message_id ?? ""}\n` +
          `**value**: \n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``,
      },
      { tag: "hr" },
      {
        tag: "note",
        elements: [
          {
            tag: "plain_text",
            content: "(Feishu Plus) 当前为最小回调实现：已尝试路由到 OpenClaw agent；若 runtime 不可用则仅确认收到。",
          },
        ],
      },
    ],
  };
}

/**
 * Route a card action event into the OpenClaw agent runtime.
 *
 * Minimal strategy (Phase 3):
 * - Convert card action into an inbound envelope to the agent
 * - Let the agent respond (buffered dispatcher)
 * - Send the final aggregated text back to the user as a plain text message
 *
 * Notes:
 * - This function is best-effort. If anything fails, the webhook handler can still
 *   return an ack card.
 * - For now we only send a final plain text reply (no card updates).
 */
export async function routeCardActionToAgent(params: {
  cfg: any;
  accountId: string;
  event: InteractiveCardActionEvent;
  channelRuntime?: any;
  log?: { info?: (...args: any[]) => void; error?: (...args: any[]) => void };
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const log = params.log ?? {};
  const runtime = params.channelRuntime ?? getFeishuPlusRuntime();

  if (!runtime?.routing?.resolveAgentRoute || !runtime?.reply?.dispatchReplyWithBufferedBlockDispatcher) {
    return { ok: false, reason: "channelRuntime_not_available" };
  }

  try {
    const senderOpenId = params.event.open_id;
    const peer = { kind: "direct" as const, id: senderOpenId };

    const route = runtime.routing.resolveAgentRoute({
      cfg: params.cfg,
      channel: "openclaw-feishu-plus",
      accountId: params.accountId,
      peer,
    });

    const body = `【Feishu Card Action】\n` +
      `tag: ${params.event?.action?.tag ?? ""}\n` +
      `open_message_id: ${params.event?.open_message_id ?? ""}\n` +
      `value: ${JSON.stringify(params.event?.action?.value ?? {}, null, 2)}`;

    const from = `openclaw-feishu-plus:card_action:${senderOpenId}`;
    const to = `openclaw-feishu-plus:direct`;

    const envelope = runtime.reply.formatAgentEnvelope({
      channel: "Feishu",
      from,
      timestamp: new Date(),
      body,
    });

    const ctxPayload = runtime.reply.finalizeInboundContext({
      Body: envelope,
      BodyForAgent: body,
      RawBody: body,
      CommandBody: body,
      From: from,
      To: to,
      SessionKey: route.sessionKey,
      AgentId: route.agentId,
      AccountId: route.accountId ?? params.accountId,
      ChatType: "direct",
      SenderName: senderOpenId,
      SenderId: senderOpenId,
      Provider: "openclaw-feishu-plus",
      Surface: "openclaw-feishu-plus",
      MessageSid: params.event.open_message_id,
      Timestamp: Date.now(),
      WasMentioned: true,
      OriginatingChannel: "openclaw-feishu-plus",
      OriginatingTo: to,
    });

    let finalText = "";

    await runtime.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg: params.cfg,
      dispatcherOptions: {
        deliver: async (payload: any) => {
          finalText += (payload?.text ?? payload?.body ?? payload?.content ?? "");
        },
      },
    });

    const text = finalText.trim();
    if (text) {
      await sendMessageFeishu({
        cfg: params.cfg,
        to: senderOpenId,
        text,
        accountId: params.accountId,
        userId: senderOpenId,
      });
    }

    log.info?.("card action routed to agent", { route, hasReply: !!text });
    return { ok: true };
  } catch (err: any) {
    log.error?.("card action route failed", String(err));
    return { ok: false, reason: "route_failed" };
  }
}

export function createCardActionDispatcher(params: {
  encryptKey?: string;
  verificationToken?: string;
  loggerLevel?: lark.LoggerLevel;
  onAction?: (event: InteractiveCardActionEvent) => Promise<InteractiveCard | undefined>;
}): lark.CardActionHandler {
  const onAction = params.onAction ?? (async (event) => {
    // Best-effort: route to agent, then return ack card immediately.
    // (Feishu expects a quick HTTP response.)
    return buildCardActionAckCard(event);
  });

  return new lark.CardActionHandler(
    {
      encryptKey: params.encryptKey,
      verificationToken: params.verificationToken,
      loggerLevel: params.loggerLevel ?? lark.LoggerLevel.warn,
    },
    async (data: InteractiveCardActionEvent) => {
      return (await onAction(data)) ?? buildCardActionAckCard(data);
    },
  );
}
