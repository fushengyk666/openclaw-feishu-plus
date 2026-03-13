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
import type { IdentityMode } from "../identity/token-resolver.js";
import { resolveReceiveIdType } from "./targets.js";

export interface SendMessageParams {
  cfg: any;
  to: string;
  text?: string;
  msgType?: string;
  content?: string;
  accountId?: string;
  userId?: string;
  identityMode?: IdentityMode;
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

/** Detect if text contains markdown elements that benefit from card rendering */
export function shouldUseCard(text: string): boolean {
  return /```[\s\S]*?```/.test(text) || /\|.+\|[\r\n]+\|[-:| ]+\|/.test(text);
}

/**
 * Build a Feishu post-format payload with markdown (md) tag.
 * The official feishu plugin always uses this format for proper markdown rendering.
 */
function buildPostMessagePayload(text: string): { content: string; msgType: string } {
  return {
    content: JSON.stringify({
      zh_cn: {
        content: [
          [{ tag: "md", text }],
        ],
      },
    }),
    msgType: "post",
  };
}

/**
 * Build a Feishu interactive card with markdown content.
 * Used for code blocks, tables, and other structured content.
 */
export function buildMarkdownCard(text: string): Record<string, unknown> {
  return {
    schema: "2.0",
    config: { wide_screen_mode: true },
    body: {
      elements: [{ tag: "markdown", content: text }],
    },
  };
}

/**
 * Send a text/card/file/image message to Feishu.
 *
 * When `msgType` and `content` are NOT specified (plain text path),
 * uses `post` format with `md` tag for proper markdown rendering.
 * This aligns with the official OpenClaw feishu plugin behavior.
 */
export async function sendMessageFeishu(params: SendMessageParams): Promise<any> {
  const { to, text, msgType, content, userId, identityMode } = params;

  const receiveIdType = resolveReceiveIdType(to);

  // If explicit msgType/content provided (e.g. interactive card), use as-is
  let finalMsgType: string;
  let finalContent: string;
  if (msgType && content) {
    finalMsgType = msgType;
    finalContent = content;
  } else if (msgType) {
    finalMsgType = msgType;
    finalContent = content || JSON.stringify({ text: text || "" });
  } else {
    // Default path: use post format with md tag for proper markdown rendering
    const payload = buildPostMessagePayload(text || "");
    finalMsgType = payload.msgType;
    finalContent = payload.content;
  }

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
      identityMode,
      params: { receive_id_type: receiveIdType },
    },
  );

  return result.data;
}

/**
 * Send a message as a markdown card (interactive message).
 * Renders markdown properly in Feishu (code blocks, tables, bold/italic, etc.)
 */
export async function sendMarkdownCardFeishu(params: SendMessageParams): Promise<any> {
  const card = buildMarkdownCard(params.text || "");
  return sendMessageFeishu({
    ...params,
    msgType: "interactive",
    content: JSON.stringify(card),
    text: undefined,
  });
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
  identityMode?: IdentityMode;
}): Promise<any> {
  return sendModuleHooks.sendMessageFeishu({
    cfg: params.cfg,
    to: params.to,
    msgType: "interactive",
    content: JSON.stringify(params.card),
    accountId: params.accountId,
    userId: params.userId,
    identityMode: params.identityMode,
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
  identityMode?: IdentityMode;
}): Promise<any> {
  const result = await requestLike.patch(
    "im.message.update",
    `/open-apis/im/v1/messages/${params.messageId}`,
    { content: JSON.stringify(params.card) },
    { userId: params.userId, identityMode: params.identityMode },
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
  identityMode?: IdentityMode;
}): Promise<any> {
  const result = await requestLike.put(
    "im.message.update",
    `/open-apis/im/v1/messages/${params.messageId}`,
    {
      msg_type: params.msgType,
      content: params.content,
    },
    { userId: params.userId, identityMode: params.identityMode },
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
  identityMode?: IdentityMode;
}): Promise<any> {
  const result = await requestLike.get(
    "im.message.get",
    `/open-apis/im/v1/messages/${params.messageId}`,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}
