/**
 * chat.ts — 飞书群聊/消息工具 (Dual-Auth)
 *
 * 所有 API 调用经过 identity 层的双授权决策链路。
 * 涵盖消息发送、回复、撤回、转发等高频 IM 操作。
 */

import {
  listChats,
  getChat,
  sendMessageToChat,
  listMessagesInChat,
  replyToMessage,
  deleteMessage,
  forwardMessage,
  getMessage,
} from "../platform/im/index.js";
import { IDENTITY_MODE_SCHEMA, parseIdentityMode } from "./identity-mode.js";
import type { IdentityMode } from "../identity/feishu-api.js";

// ─── 工具定义 ───

export const CHAT_TOOL_DEFS = [
  {
    name: "feishu_plus_chat_list",
    description: "列出群聊列表",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        page_size: {
          type: "number",
          description: "每页数量（默认 20）",
        },
        page_token: { type: "string", description: "分页 token" },
        user_id_type: {
          type: "string",
          description:
            "用户 ID 类型（open_id/user_id/union_id），默认 open_id",
        },
      },
    },
  },
  {
    name: "feishu_plus_chat_get",
    description: "获取群聊信息",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        chat_id: { type: "string", description: "群聊 ID" },
      },
      required: ["chat_id"],
    },
  },
  {
    name: "feishu_plus_message_send",
    description: "发送消息到群聊",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        chat_id: { type: "string", description: "群聊 ID" },
        msg_type: {
          type: "string",
          description: "消息类型（text/post/image/file/card等）",
        },
        content: {
          type: "string",
          description: "消息内容（JSON 字符串）",
        },
        reply_to_message_id: {
          type: "string",
          description: "回复的消息 ID",
        },
        reply_in_thread: {
          type: "boolean",
          description: "是否在主题内回复",
        },
      },
      required: ["chat_id", "msg_type", "content"],
    },
  },
  {
    name: "feishu_plus_message_list",
    description: "列出群聊消息",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        chat_id: { type: "string", description: "群聊 ID" },
        page_size: {
          type: "number",
          description: "每页数量（默认 20）",
        },
        page_token: { type: "string", description: "分页 token" },
        sort_type: {
          type: "string",
          description:
            "排序方式（asc_by_update_time/desc_by_update_time）",
        },
        update_time_start: {
          type: "string",
          description: "起始更新时间戳（毫秒）",
        },
        update_time_end: {
          type: "string",
          description: "结束更新时间戳（毫秒）",
        },
      },
      required: ["chat_id"],
    },
  },
  {
    name: "feishu_plus_message_reply",
    description: "回复消息",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        message_id: {
          type: "string",
          description: "要回复的消息 ID",
        },
        msg_type: {
          type: "string",
          description: "消息类型（text/post/image等）",
        },
        content: {
          type: "string",
          description: "消息内容（JSON 字符串）",
        },
      },
      required: ["message_id", "msg_type", "content"],
    },
  },
  {
    name: "feishu_plus_message_delete",
    description: "撤回消息",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        message_id: { type: "string", description: "消息 ID" },
      },
      required: ["message_id"],
    },
  },
  {
    name: "feishu_plus_message_forward",
    description: "转发消息",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        message_id: { type: "string", description: "消息 ID" },
        receive_id: {
          type: "string",
          description: "接收者 ID（chat_id 或 open_id）",
        },
        receive_id_type: {
          type: "string",
          description: "接收者类型（chat_id/open_id）",
        },
      },
      required: ["message_id", "receive_id"],
    },
  },
  {
    name: "feishu_plus_message_get",
    description: "获取消息详情",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        message_id: { type: "string", description: "消息 ID" },
      },
      required: ["message_id"],
    },
  },
];

// ─── 工具执行器 ───

export class ChatTools {
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    userId?: string,
  ): Promise<unknown> {
    const identityMode = parseIdentityMode(params.identity_mode);
    switch (toolName) {
      case "feishu_plus_chat_list":
        return this.listChats(params, userId, identityMode);
      case "feishu_plus_chat_get":
        return this.getChat(params, userId, identityMode);
      case "feishu_plus_message_send":
        return this.sendMessage(params, userId, identityMode);
      case "feishu_plus_message_list":
        return this.listMessages(params, userId, identityMode);
      case "feishu_plus_message_reply":
        return this.replyMessage(params, userId, identityMode);
      case "feishu_plus_message_delete":
        return this.deleteMessage(params, userId, identityMode);
      case "feishu_plus_message_forward":
        return this.forwardMessage(params, userId, identityMode);
      case "feishu_plus_message_get":
        return this.getMessage(params, userId, identityMode);
      default:
        throw new Error(`Unknown chat tool: ${toolName}`);
    }
  }

  private async listChats(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return listChats({
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
  }

  private async getChat(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return getChat({
      chatId: String(params.chat_id),
      userId,
      identityMode,
    });
  }

  private async sendMessage(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return sendMessageToChat({
      chatId: String(params.chat_id),
      msgType: String(params.msg_type),
      content: String(params.content),
      userId,
      identityMode,
    });
  }

  private async listMessages(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return listMessagesInChat({
      chatId: String(params.chat_id),
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      sortType: params.sort_type ? String(params.sort_type) : undefined,
      updateTimeStart: params.update_time_start
        ? String(params.update_time_start)
        : undefined,
      updateTimeEnd: params.update_time_end
        ? String(params.update_time_end)
        : undefined,
      userId,
      identityMode,
    });
  }

  private async replyMessage(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return replyToMessage({
      messageId: String(params.message_id),
      msgType: String(params.msg_type),
      content: String(params.content),
      userId,
      identityMode,
    });
  }

  private async deleteMessage(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return deleteMessage({
      messageId: String(params.message_id),
      userId,
      identityMode,
    });
  }

  private async forwardMessage(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return forwardMessage({
      messageId: String(params.message_id),
      receiveId: String(params.receive_id),
      receiveIdType: params.receive_id_type
        ? String(params.receive_id_type)
        : undefined,
      userId,
      identityMode,
    });
  }

  private async getMessage(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return getMessage({
      messageId: String(params.message_id),
      userId,
      identityMode,
    });
  }
}

// ─── 注册辅助 ───

export function registerChatTools(
  tools: ChatTools,
  registerTool: (
    toolDef: (typeof CHAT_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  CHAT_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) =>
      tools.execute(toolDef.name, args, userId),
    );
  });
}
