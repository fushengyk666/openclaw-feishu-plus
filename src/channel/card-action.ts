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
          `**message**: ${event?.open_message_id ?? ""}\n` +
          `**value**: \n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``,
      },
      {
        tag: "hr",
      },
      {
        tag: "note",
        elements: [
          {
            tag: "plain_text",
            content: "(Feishu Plus) 当前为最小回调实现：仅确认收到。后续会接入 OpenClaw agent 自动处理。",
          },
        ],
      },
    ],
  };
}

export function createCardActionDispatcher(params: {
  encryptKey?: string;
  verificationToken?: string;
  loggerLevel?: lark.LoggerLevel;
  onAction?: (event: InteractiveCardActionEvent) => Promise<InteractiveCard | undefined>;
}): lark.CardActionHandler {
  const onAction = params.onAction ?? (async (event) => buildCardActionAckCard(event));

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
