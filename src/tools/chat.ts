/**
 * chat.ts — 飞书群聊/消息工具 (Dual-Auth)
 *
 * 所有 API 调用经过 identity 层的双授权决策链路。
 * 涵盖消息发送、回复、撤回、转发等高频 IM 操作。
 */

import {
  feishuGet,
  feishuPost,
  feishuDelete,
} from "../identity/feishu-api.js";

// ─── 工具定义 ───

export const CHAT_TOOL_DEFS = [
  {
    name: "feishu_plus_chat_list",
    description: "列出群聊列表",
    parameters: {
      type: "object",
      properties: {
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
    switch (toolName) {
      case "feishu_plus_chat_list":
        return this.listChats(params, userId);
      case "feishu_plus_chat_get":
        return this.getChat(params, userId);
      case "feishu_plus_message_send":
        return this.sendMessage(params, userId);
      case "feishu_plus_message_list":
        return this.listMessages(params, userId);
      case "feishu_plus_message_reply":
        return this.replyMessage(params, userId);
      case "feishu_plus_message_delete":
        return this.deleteMessage(params, userId);
      case "feishu_plus_message_forward":
        return this.forwardMessage(params, userId);
      case "feishu_plus_message_get":
        return this.getMessage(params, userId);
      default:
        throw new Error(`Unknown chat tool: ${toolName}`);
    }
  }

  private async listChats(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.page_size) qp.page_size = Number(params.page_size);
    if (params.page_token) qp.page_token = String(params.page_token);
    if (params.user_id_type)
      qp.user_id_type = String(params.user_id_type);

    const result = await feishuGet(
      "im.chat.list",
      "/open-apis/im/v1/chats",
      { userId, params: qp },
    );
    return result.data;
  }

  private async getChat(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const chatId = String(params.chat_id);
    const result = await feishuGet(
      "im.chat.get",
      `/open-apis/im/v1/chats/${chatId}`,
      { userId },
    );
    return result.data;
  }

  private async sendMessage(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const chatId = String(params.chat_id);
    const body: Record<string, unknown> = {
      receive_id: chatId,
      msg_type: String(params.msg_type),
      content: String(params.content),
    };

    const result = await feishuPost(
      "im.message.create",
      "/open-apis/im/v1/messages",
      body,
      { userId, params: { receive_id_type: "chat_id" } },
    );
    return result.data;
  }

  private async listMessages(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const qp: Record<string, string | number | boolean | undefined> = {
      container_id_type: "chat",
      container_id: String(params.chat_id),
    };
    if (params.page_size) qp.page_size = Number(params.page_size);
    if (params.page_token) qp.page_token = String(params.page_token);
    if (params.sort_type) qp.sort_type = String(params.sort_type);
    if (params.update_time_start)
      qp.start_time = String(params.update_time_start);
    if (params.update_time_end)
      qp.end_time = String(params.update_time_end);

    const result = await feishuGet(
      "im.message.list",
      "/open-apis/im/v1/messages",
      { userId, params: qp },
    );
    return result.data;
  }

  private async replyMessage(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const messageId = String(params.message_id);
    const body = {
      msg_type: String(params.msg_type),
      content: String(params.content),
    };

    const result = await feishuPost(
      "im.message.reply",
      `/open-apis/im/v1/messages/${messageId}/reply`,
      body,
      { userId },
    );
    return result.data;
  }

  private async deleteMessage(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const messageId = String(params.message_id);
    const result = await feishuDelete(
      "im.message.delete",
      `/open-apis/im/v1/messages/${messageId}`,
      { userId },
    );
    return result.data;
  }

  private async forwardMessage(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const messageId = String(params.message_id);
    const receiveIdType = params.receive_id_type
      ? String(params.receive_id_type)
      : "chat_id";

    const body = {
      receive_id: String(params.receive_id),
    };

    const result = await feishuPost(
      "im.message.forward",
      `/open-apis/im/v1/messages/${messageId}/forward`,
      body,
      { userId, params: { receive_id_type: receiveIdType } },
    );
    return result.data;
  }

  private async getMessage(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const messageId = String(params.message_id);
    const result = await feishuGet(
      "im.message.get",
      `/open-apis/im/v1/messages/${messageId}`,
      { userId },
    );
    return result.data;
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
