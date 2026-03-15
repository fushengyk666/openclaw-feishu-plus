/**
 * send.ts — Feishu Plus Message Sending
 *
 * Outbound helpers with official-style reply threading + unavailable-message guard.
 */

import {
  feishuDelete,
  feishuGet,
  feishuPatch,
  feishuPost,
  feishuPut,
} from "../identity/feishu-api.js";
import type { IdentityMode } from "../identity/token-resolver.js";
import { resolveReceiveIdType } from "./targets.js";
import { normalizeMessageId, runWithMessageUnavailableGuard } from "./message-unavailable.js";

export interface SendMessageParams {
  cfg: any;
  to: string;
  text?: string;
  msgType?: string;
  content?: string;
  accountId?: string;
  userId?: string;
  identityMode?: IdentityMode;
  replyToMessageId?: string;
  replyInThread?: boolean;
}

export interface SendRequestLike {
  post<T = any>(operation: string, path: string, body?: unknown, opts?: { userId?: string; identityMode?: IdentityMode; params?: Record<string, string | number | boolean | undefined> }): Promise<{ data: T }>;
  patch<T = any>(operation: string, path: string, body?: unknown, opts?: { userId?: string; identityMode?: IdentityMode; params?: Record<string, string | number | boolean | undefined> }): Promise<{ data: T }>;
  put<T = any>(operation: string, path: string, body?: unknown, opts?: { userId?: string; identityMode?: IdentityMode; params?: Record<string, string | number | boolean | undefined> }): Promise<{ data: T }>;
  get<T = any>(operation: string, path: string, opts?: { userId?: string; identityMode?: IdentityMode; params?: Record<string, string | number | boolean | undefined> }): Promise<{ data: T }>;
  delete<T = any>(operation: string, path: string, opts?: { userId?: string; identityMode?: IdentityMode; params?: Record<string, string | number | boolean | undefined> }): Promise<{ data: T }>;
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

export function __setSendRequestLikeForTests(mock: SendRequestLike): void {
  requestLike = mock;
}

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
  sendModuleHooks = { ...sendModuleHooks, ...hooks };
}

export function __resetSendModuleHooksForTests(): void {
  sendModuleHooks = {
    sendMessageFeishu: (params) => sendMessageFeishu(params),
  };
}

export function shouldUseCard(text: string): boolean {
  return /```[\s\S]*?```/.test(text) || /\|.+\|[\r\n]+\|[-:| ]+\|/.test(text);
}

function buildPostMessagePayload(text: string): { content: string; msgType: string } {
  return {
    content: JSON.stringify({
      zh_cn: { content: [[{ tag: "md", text }]] },
    }),
    msgType: "post",
  };
}

export function buildMarkdownCard(text: string): Record<string, unknown> {
  return {
    schema: "2.0",
    config: { wide_screen_mode: true },
    body: { elements: [{ tag: "markdown", content: text }] },
  };
}

export async function deleteMessageFeishu(params: {
  cfg: any;
  messageId: string;
  accountId?: string;
  userId?: string;
  identityMode?: IdentityMode;
}): Promise<any> {
  return runWithMessageUnavailableGuard({
    messageId: params.messageId,
    operation: "im.message.delete",
    fn: async () => {
      const result = await requestLike.delete(
        "im.message.delete",
        `/open-apis/im/v1/messages/${normalizeMessageId(params.messageId)}`,
        { userId: params.userId, identityMode: params.identityMode },
      );
      return result.data;
    },
  });
}

export async function sendMessageFeishu(params: SendMessageParams): Promise<any> {
  const { to, text, msgType, content, userId, identityMode, replyToMessageId, replyInThread } = params;

  let finalMsgType: string;
  let finalContent: string;
  if (msgType && content) {
    finalMsgType = msgType;
    finalContent = content;
  } else if (msgType) {
    finalMsgType = msgType;
    finalContent = content || JSON.stringify({ text: text || "" });
  } else {
    const payload = buildPostMessagePayload(text || "");
    finalMsgType = payload.msgType;
    finalContent = payload.content;
  }

  if (replyToMessageId) {
    const normalizedId = normalizeMessageId(replyToMessageId);
    return runWithMessageUnavailableGuard({
      messageId: normalizedId,
      operation: `im.message.reply(${finalMsgType})`,
      fn: async () => {
        const result = await requestLike.post(
          "im.message.reply",
          `/open-apis/im/v1/messages/${normalizedId}/reply`,
          {
            content: finalContent,
            msg_type: finalMsgType,
            reply_in_thread: replyInThread,
          },
          { userId, identityMode },
        );
        return result.data;
      },
    });
  }

  const receiveIdType = resolveReceiveIdType(to);
  const result = await requestLike.post(
    "im.message.create",
    "/open-apis/im/v1/messages",
    {
      receive_id: to,
      msg_type: finalMsgType,
      content: finalContent,
    },
    { userId, identityMode, params: { receive_id_type: receiveIdType } },
  );

  return result.data;
}

export async function sendMarkdownCardFeishu(params: SendMessageParams): Promise<any> {
  const card = buildMarkdownCard(params.text || "");
  return sendMessageFeishu({
    ...params,
    msgType: "interactive",
    content: JSON.stringify(card),
    text: undefined,
  });
}

export async function sendCardFeishu(params: {
  cfg: any;
  to: string;
  card: any;
  accountId?: string;
  userId?: string;
  identityMode?: IdentityMode;
  replyToMessageId?: string;
  replyInThread?: boolean;
}): Promise<any> {
  return sendModuleHooks.sendMessageFeishu({
    cfg: params.cfg,
    to: params.to,
    msgType: "interactive",
    content: JSON.stringify(params.card),
    accountId: params.accountId,
    userId: params.userId,
    identityMode: params.identityMode,
    replyToMessageId: params.replyToMessageId,
    replyInThread: params.replyInThread,
  });
}

export async function updateCardFeishu(params: {
  cfg: any;
  messageId: string;
  card: any;
  accountId?: string;
  userId?: string;
  identityMode?: IdentityMode;
}): Promise<any> {
  return runWithMessageUnavailableGuard({
    messageId: params.messageId,
    operation: "im.message.update",
    fn: async () => {
      const result = await requestLike.patch(
        "im.message.update",
        `/open-apis/im/v1/messages/${normalizeMessageId(params.messageId)}`,
        { content: JSON.stringify(params.card) },
        { userId: params.userId, identityMode: params.identityMode },
      );
      return result.data;
    },
  });
}

export async function editMessageFeishu(params: {
  cfg: any;
  messageId: string;
  msgType: string;
  content: string;
  accountId?: string;
  userId?: string;
  identityMode?: IdentityMode;
}): Promise<any> {
  return runWithMessageUnavailableGuard({
    messageId: params.messageId,
    operation: "im.message.update",
    fn: async () => {
      const result = await requestLike.put(
        "im.message.update",
        `/open-apis/im/v1/messages/${normalizeMessageId(params.messageId)}`,
        {
          msg_type: params.msgType,
          content: params.content,
        },
        { userId: params.userId, identityMode: params.identityMode },
      );
      return result.data;
    },
  });
}

export async function getMessageFeishu(params: {
  cfg: any;
  messageId: string;
  accountId?: string;
  userId?: string;
  identityMode?: IdentityMode;
}): Promise<any> {
  return runWithMessageUnavailableGuard({
    messageId: params.messageId,
    operation: "im.message.get",
    fn: async () => {
      const result = await requestLike.get(
        "im.message.get",
        `/open-apis/im/v1/messages/${normalizeMessageId(params.messageId)}`,
        { userId: params.userId, identityMode: params.identityMode },
      );
      return result.data;
    },
  });
}
