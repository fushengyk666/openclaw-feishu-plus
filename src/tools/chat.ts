/**
 * chat.ts — 飞书群聊/消息工具
 *
 * 支持：列出群聊、获取群聊信息、发送消息、列出消息
 * 身份：由 request-executor 自动决定（user-if-available-else-tenant）
 */

import { executeFeishuRequest } from "../core/request-executor.js";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义 ───

export const CHAT_TOOL_DEFS = [
  {
    name: "feishu_plus_chat_list",
    description: "列出群聊列表",
    parameters: {
      type: "object",
      properties: {
        page_size: { type: "number", description: "每页数量（默认 20）" },
        page_token: { type: "string", description: "分页 token" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id），默认 open_id" },
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
        msg_type: { type: "string", description: "消息类型（text/post/image/file/card等）" },
        content: { type: "string", description: "消息内容（JSON 字符串）" },
        reply_in_thread: { type: "boolean", description: "是否在主题内回复" },
        reply_to_message_id: { type: "string", description: "回复的消息 ID" },
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
        page_size: { type: "number", description: "每页数量（默认 20）" },
        page_token: { type: "string", description: "分页 token" },
        update_time_start: { type: "string", description: "起始更新时间戳（毫秒）" },
        update_time_end: { type: "string", description: "结束更新时间戳（毫秒）" },
        sort_type: { type: "string", description: "排序方式（asc_by_update_time/desc_by_update_time）" },
      },
      required: ["chat_id"],
    },
  },
];

// ─── 工具执行器类 ───

export class ChatTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_chat_list":
        return this.list(params, userId);

      case "feishu_plus_chat_get":
        return this.get(params, userId);

      case "feishu_plus_message_send":
        return this.send(params, userId);

      case "feishu_plus_message_list":
        return this.listMessages(params, userId);

      default:
        throw new Error(`Unknown chat tool: ${toolName}`);
    }
  }

  private async list(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "im.chat.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/im/v3/chats`);
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));
        if (params.user_id_type) url.searchParams.set("user_id_type", String(params.user_id_type));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list chats: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async get(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "im.chat.get",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/im/v3/chats/${params.chat_id}`,
          {
            headers: {
              "Authorization": authorizationHeader,
            },
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to get chat: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async send(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "im.message.create",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/im/v1/messages`);
        if (params.reply_in_thread) url.searchParams.set("reply_in_thread", "true");
        if (params.reply_to_message_id) url.searchParams.set("reply_to_message_id", String(params.reply_to_message_id));

        const resp = await fetch(url.toString(), {
          method: "POST",
          headers: {
            "Authorization": authorizationHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receive_id: params.chat_id,
            msg_type: params.msg_type,
            content: params.content,
          }),
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to send message: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async listMessages(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "im.message.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/im/v1/messages`);
        url.searchParams.set("container_id_type", "chat");
        url.searchParams.set("container_id", String(params.chat_id));
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));
        if (params.update_time_start) url.searchParams.set("update_time_start", String(params.update_time_start));
        if (params.update_time_end) url.searchParams.set("update_time_end", String(params.update_time_end));
        if (params.sort_type) url.searchParams.set("sort_type", String(params.sort_type));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list messages: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }
}

// ─── 注册辅助函数 ───

export function registerChatTools(
  tools: ChatTools,
  registerTool: (toolDef: typeof CHAT_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  CHAT_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
