/**
 * send.ts — Feishu Plus Message Sending
 *
 * Channel outbound helpers.
 * Default path now goes through identity/feishu-api so outbound message APIs
 * can participate in dual-auth routing when a userId is provided.
 */

import {
  feishuDelete,
  feishuGet,
  feishuPatch,
  feishuPost,
  feishuPut,
} from "../identity/feishu-api.js";
import { resolveReceiveIdType } from "./targets.js";

export interface SendMessageParams {
  cfg: any;
  to: string;
  text?: string;
  msgType?: string;
  content?: string;
  accountId?: string;
  userId?: string;
}

export interface SendRequestLike {
  post<T = any>(operation: string, path: string, body?: unknown, opts?: { userId?: string; params?: Record<string, string | number | boolean | undefined> }): Promise<{ data: T }>;
  patch<T = any>(operation: string, path: string, body?: unknown, opts?: { userId?: string; params?: Record<string, string | number | boolean | undefined> }): Promise<{ data: T }>;
  put<T = any>(operation: string, path: string, body?: unknown, opts?: { userId?: string; params?: Record<string, string | number | boolean | undefined> }): Promise<{ data: T }>;
  get<T = any>(operation: string, path: string, opts?: { userId?: string; params?: Record<string, string | number | boolean | undefined> }): Promise<{ data: T }>;
  delete<T = any>(operation: string, path: string, opts?: { userId?: string; params?: Record<string, string | number | boolean | undefined> }): Promise<{ data: T }>;
}

export interface SendModuleHooks {
  sendMessageFeishu: typeof sendMessageFeishu;
}

let requestLike: SendRequestLike = {
  post: feishuPost,
  patch: feishuPatch,
  put: feishuPut,
  get: feishuGet,
  delete: feishuDelete,
};

/** 测试注入：覆盖 send.ts 使用的 feishu-api 请求实现 */
export function __setSendRequestLikeForTests(mock: SendRequestLike): void {
  requestLike = mock;
}

/** 重置为默认的 feishu-api 实现 */
export function __resetSendRequestLikeForTests(): void {
  requestLike = {
    post: feishuPost,
    patch: feishuPatch,
    put: feishuPut,
    get: feishuGet,
    delete: feishuDelete,
  };
}

let sendModuleHooks: SendModuleHooks = {
  sendMessageFeishu: (params) => sendMessageFeishu(params),
};

export function __setSendModuleHooksForTests(hooks: Partial<SendModuleHooks>): void {
  sendModuleHooks = {
    ...sendModuleHooks,
    ...hooks,
  };
}

export function __resetSendModuleHooksForTests(): void {
  sendModuleHooks = {
    sendMessageFeishu: (params) => sendMessageFeishu(params),
  };
}

/**
 * Send a text/card/file/image message to Feishu.
 */
export async function sendMessageFeishu(params: SendMessageParams): Promise<any> {
  const { to, text, msgType, content, userId } = params;

  const receiveIdType = resolveReceiveIdType(to);
  const finalMsgType = msgType || "text";
  const finalContent = content || JSON.stringify({ text: text || "" });

  const result = await requestLike.post(
    "im.message.create",
    "/open-apis/im/v1/messages",
    {
      receive_id: to,
      msg_type: finalMsgType,
      content: finalContent,
    },
    {
      userId,
      params: { receive_id_type: receiveIdType },
    },
  );

  return result.data;
}

/**
 * Send an interactive card to Feishu.
 */
export async function sendCardFeishu(params: {
  cfg: any;
  to: string;
  card: any;
  accountId?: string;
  userId?: string;
}): Promise<any> {
  return sendModuleHooks.sendMessageFeishu({
    cfg: params.cfg,
    to: params.to,
    msgType: "interactive",
    content: JSON.stringify(params.card),
    accountId: params.accountId,
    userId: params.userId,
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
  userId?: string;
}): Promise<any> {
  const result = await requestLike.patch(
    "im.message.update",
    `/open-apis/im/v1/messages/${params.messageId}`,
    { content: JSON.stringify(params.card) },
    { userId: params.userId },
  );
  return result.data;
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
  userId?: string;
}): Promise<any> {
  const result = await requestLike.put(
    "im.message.update",
    `/open-apis/im/v1/messages/${params.messageId}`,
    {
      msg_type: params.msgType,
      content: params.content,
    },
    { userId: params.userId },
  );
  return result.data;
}

/**
 * Get a message by ID.
 */
export async function getMessageFeishu(params: {
  cfg: any;
  messageId: string;
  accountId?: string;
  userId?: string;
}): Promise<any> {
  const result = await requestLike.get(
    "im.message.get",
    `/open-apis/im/v1/messages/${params.messageId}`,
    { userId: params.userId },
  );
  return result.data;
}
