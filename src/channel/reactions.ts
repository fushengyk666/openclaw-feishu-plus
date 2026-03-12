/**
 * reactions.ts — Feishu Plus Reactions
 *
 * 飞书消息表情回应管理。
 */

import { getLarkClient } from "../identity/client.js";

/**
 * Feishu emoji type names (uppercase).
 */
export const FeishuEmoji = {
  OK: "OK",
  THUMBSUP: "THUMBSUP",
  THANKS: "THANKS",
  MUSCLE: "MUSCLE",
  FINGERHEART: "FINGERHEART",
  APPLAUSE: "APPLAUSE",
  FISTBUMP: "FISTBUMP",
  JIAYI: "JIAYI",
  DONE: "DONE",
  SMILE: "SMILE",
  BLUSH: "BLUSH",
} as const;

/**
 * Add a reaction to a message.
 */
export async function addReactionFeishu(params: {
  cfg: any;
  messageId: string;
  emojiType: string;
  accountId?: string;
}): Promise<any> {
  const feishuCfg = params.cfg?.channels?.["openclaw-feishu-plus"] ?? params.cfg;
  const client = getLarkClient(feishuCfg);

  return client.im.messageReaction.create({
    path: { message_id: params.messageId },
    data: {
      reaction_type: { emoji_type: params.emojiType },
    },
  });
}

/**
 * Remove a reaction from a message.
 */
export async function removeReactionFeishu(params: {
  cfg: any;
  messageId: string;
  reactionId: string;
  accountId?: string;
}): Promise<any> {
  const feishuCfg = params.cfg?.channels?.["openclaw-feishu-plus"] ?? params.cfg;
  const client = getLarkClient(feishuCfg);

  return client.im.messageReaction.delete({
    path: {
      message_id: params.messageId,
      reaction_id: params.reactionId,
    },
  });
}

/**
 * List reactions on a message.
 */
export async function listReactionsFeishu(params: {
  cfg: any;
  messageId: string;
  accountId?: string;
}): Promise<any[]> {
  const feishuCfg = params.cfg?.channels?.["openclaw-feishu-plus"] ?? params.cfg;
  const client = getLarkClient(feishuCfg);

  const resp = await client.im.messageReaction.list({
    path: { message_id: params.messageId },
  });

  return resp?.data?.items ?? [];
}
