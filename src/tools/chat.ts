/**
 * chat.ts — 飞书群聊/消息工具 (Lark SDK)
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

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
        reply_to_message_id: { type: "string", description: "回复的消息 ID" },
        reply_in_thread: { type: "boolean", description: "是否在主题内回复" },
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
        sort_type: { type: "string", description: "排序方式（asc_by_update_time/desc_by_update_time）" },
        update_time_start: { type: "string", description: "起始更新时间戳（毫秒）" },
        update_time_end: { type: "string", description: "结束更新时间戳（毫秒）" },
      },
      required: ["chat_id"],
    },
  },
];

export class ChatTools {
  private client: InstanceType<typeof lark.Client>;

  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      domain: config.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu,
      disableTokenCache: false,
    });
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_chat_list":
        return this.listChats(params);
      case "feishu_plus_chat_get":
        return this.getChat(params);
      case "feishu_plus_message_send":
        return this.sendMessage(params);
      case "feishu_plus_message_list":
        return this.listMessages(params);
      default:
        throw new Error(`Unknown chat tool: ${toolName}`);
    }
  }

  private async listChats(params: Record<string, unknown>) {
    return this.client.im.v1.chat.list({
      params: {
        page_size: params.page_size ? Number(params.page_size) : 20,
        page_token: params.page_token ? String(params.page_token) : undefined,
        user_id_type: params.user_id_type ? String(params.user_id_type) as any : undefined,
      },
    });
  }

  private async getChat(params: Record<string, unknown>) {
    return this.client.im.v1.chat.get({
      path: { chat_id: String(params.chat_id) },
    });
  }

  private async sendMessage(params: Record<string, unknown>) {
    return this.client.im.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: String(params.chat_id),
        msg_type: String(params.msg_type) as any,
        content: String(params.content),
      },
    });
  }

  private async listMessages(params: Record<string, unknown>) {
    return this.client.im.v1.message.list({
      params: {
        container_id_type: "chat",
        container_id: String(params.chat_id),
        page_size: params.page_size ? Number(params.page_size) : 20,
        page_token: params.page_token ? String(params.page_token) : undefined,
        sort_type: params.sort_type ? String(params.sort_type) as any : undefined,
      },
    });
  }
}

export function registerChatTools(
  tools: ChatTools,
  registerTool: (toolDef: typeof CHAT_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  CHAT_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
