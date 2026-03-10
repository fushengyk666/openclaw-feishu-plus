/**
 * send.ts — Feishu Plus Message Sending
 *
 * 通过 token-first 链路发送消息到飞书。
 */

import * as lark from "@larksuiteoapi/node-sdk";
import { getLarkClient } from "../core/client.js";
import { resolveReceiveIdType } from "./targets.js";
import { PLUGIN_ID } from "../constants.js";

export interface SendMessageParams {
  cfg: any;
  to: string;
  text?: string;
  msgType?: string;
  content?: string;
  accountId?: string;
}

/**
 * Send a text message to Feishu.
 */
export async function sendMessageFeishu(params: SendMessageParams): Promise<any> {
  const { cfg, to, text, msgType, content, accountId } = params;
  const feishuCfg = cfg?.channels?.["openclaw-feishu-plus"] ?? cfg;
  const client = getLarkClient(feishuCfg);

  const receiveIdType = resolveReceiveIdType(to);
  const finalMsgType = msgType || "text";
  const finalContent = content || JSON.stringify({ text: text || "" });

  const resp = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: to,
      msg_type: finalMsgType,
      content: finalContent,
    },
  });

  return resp;
}

/**
 * Send an interactive card to Feishu.
 */
export async function sendCardFeishu(params: {
  cfg: any;
  to: string;
  card: any;
  accountId?: string;
}): Promise<any> {
  return sendMessageFeishu({
    cfg: params.cfg,
    to: params.to,
    msgType: "interactive",
    content: JSON.stringify(params.card),
    accountId: params.accountId,
  });
}

/**
 * Update an existing card message.
 */
export async function updateCardFeishu(params: {
  cfg: any;
  messageId: string;
  card: any;
  accountId?: string;
}): Promise<any> {
  const feishuCfg = params.cfg?.channels?.["openclaw-feishu-plus"] ?? params.cfg;
  const client = getLarkClient(feishuCfg);

  return client.im.message.patch({
    path: { message_id: params.messageId },
    data: { content: JSON.stringify(params.card) },
  });
}

/**
 * Edit a message's content.
 */
export async function editMessageFeishu(params: {
  cfg: any;
  messageId: string;
  msgType: string;
  content: string;
  accountId?: string;
}): Promise<any> {
  const feishuCfg = params.cfg?.channels?.["openclaw-feishu-plus"] ?? params.cfg;
  const client = getLarkClient(feishuCfg);

  return client.im.message.update({
    path: { message_id: params.messageId },
    data: {
      msg_type: params.msgType,
      content: params.content,
    },
  });
}

/**
 * Get a message by ID.
 */
export async function getMessageFeishu(params: {
  cfg: any;
  messageId: string;
  accountId?: string;
}): Promise<any> {
  const feishuCfg = params.cfg?.channels?.["openclaw-feishu-plus"] ?? params.cfg;
  const client = getLarkClient(feishuCfg);

  return client.im.message.get({
    path: { message_id: params.messageId },
  });
}
