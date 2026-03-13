/**
 * platform/im/client.ts — Feishu IM Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import {
  feishuGet,
  feishuPost,
  feishuDelete,
  type IdentityMode,
} from "../../identity/feishu-api.js";

export async function listChats(params: {
  pageSize?: number;
  pageToken?: string;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const qp: Record<string, string | number | boolean | undefined> = {};
  if (typeof params.pageSize === "number") qp.page_size = params.pageSize;
  if (params.pageToken) qp.page_token = params.pageToken;
  if (params.userIdType) qp.user_id_type = params.userIdType;

  const result = await feishuGet(
    "im.chat.list",
    "/open-apis/im/v1/chats",
    { userId: params.userId, identityMode: params.identityMode, params: qp },
  );
  return result.data;
}

export async function getChat(params: {
  chatId: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "im.chat.get",
    `/open-apis/im/v1/chats/${params.chatId}`,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function sendMessageToChat(params: {
  chatId: string;
  msgType: string;
  content: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const body: Record<string, unknown> = {
    receive_id: params.chatId,
    msg_type: params.msgType,
    content: params.content,
  };

  const result = await feishuPost(
    "im.message.create",
    "/open-apis/im/v1/messages",
    body,
    { userId: params.userId, identityMode: params.identityMode, params: { receive_id_type: "chat_id" } },
  );
  return result.data;
}

export async function listMessagesInChat(params: {
  chatId: string;
  pageSize?: number;
  pageToken?: string;
  sortType?: string;
  updateTimeStart?: string;
  updateTimeEnd?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const qp: Record<string, string | number | boolean | undefined> = {
    container_id_type: "chat",
    container_id: params.chatId,
  };
  if (typeof params.pageSize === "number") qp.page_size = params.pageSize;
  if (params.pageToken) qp.page_token = params.pageToken;
  if (params.sortType) qp.sort_type = params.sortType;
  if (params.updateTimeStart) qp.start_time = params.updateTimeStart;
  if (params.updateTimeEnd) qp.end_time = params.updateTimeEnd;

  const result = await feishuGet(
    "im.message.list",
    "/open-apis/im/v1/messages",
    { userId: params.userId, identityMode: params.identityMode, params: qp },
  );
  return result.data;
}

export async function replyToMessage(params: {
  messageId: string;
  msgType: string;
  content: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const body = {
    msg_type: params.msgType,
    content: params.content,
  };

  const result = await feishuPost(
    "im.message.reply",
    `/open-apis/im/v1/messages/${params.messageId}/reply`,
    body,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function deleteMessage(params: {
  messageId: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuDelete(
    "im.message.delete",
    `/open-apis/im/v1/messages/${params.messageId}`,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function forwardMessage(params: {
  messageId: string;
  receiveId: string;
  receiveIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const receiveIdType = params.receiveIdType ?? "chat_id";

  const result = await feishuPost(
    "im.message.forward",
    `/open-apis/im/v1/messages/${params.messageId}/forward`,
    { receive_id: params.receiveId },
    { userId: params.userId, identityMode: params.identityMode, params: { receive_id_type: receiveIdType } },
  );
  return result.data;
}

export async function getMessage(params: {
  messageId: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "im.message.get",
    `/open-apis/im/v1/messages/${params.messageId}`,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}
