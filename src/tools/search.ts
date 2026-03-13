/**
 * search.ts — 飞书搜索工具 (Dual-Auth)
 *
 * 飞书搜索业务域能力：
 * - 搜索消息（需要用户授权）
 * - 搜索云文档（需要用户授权）
 * - 搜索应用（需要用户授权）
 *
 * 飞书搜索 API 全部要求 user_access_token，
 * 因为搜索结果基于用户可见范围（权限隔离）。
 */

import { feishuPost } from "../identity/feishu-api.js";

export const SEARCH_TOOL_DEFS = [
  {
    name: "feishu_plus_search_message",
    description: "搜索飞书消息（需要用户授权，结果基于用户可见范围）",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词",
        },
        chat_ids: {
          type: "array",
          items: { type: "string" },
          description: "限定搜索的群聊 ID 列表（可选）",
        },
        message_type: {
          type: "string",
          description: "消息类型过滤（text/file/image 等，可选）",
        },
        from_ids: {
          type: "array",
          items: { type: "string" },
          description: "发送人 open_id 列表（可选）",
        },
        from_type: {
          type: "string",
          description: "发送人类型（user/bot，可选）",
        },
        start_time: {
          type: "string",
          description: "搜索开始时间（Unix 秒，可选）",
        },
        end_time: {
          type: "string",
          description: "搜索结束时间（Unix 秒，可选）",
        },
        page_size: {
          type: "number",
          description: "每页数量（默认 20，最大 50）",
        },
        page_token: {
          type: "string",
          description: "分页 token",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "feishu_plus_search_doc",
    description: "搜索飞书云文档（需要用户授权，结果基于用户可见范围）",
    parameters: {
      type: "object",
      properties: {
        search_key: {
          type: "string",
          description: "搜索关键词",
        },
        owner_ids: {
          type: "array",
          items: { type: "string" },
          description: "文档所有者 open_id 列表（可选）",
        },
        chat_ids: {
          type: "array",
          items: { type: "string" },
          description: "关联群聊 ID 列表（可选）",
        },
        docs_types: {
          type: "array",
          items: { type: "string" },
          description: "文档类型过滤（doc/docx/sheet/bitable/mindnote/slides/wiki 等）",
        },
        count: {
          type: "number",
          description: "每页数量（默认 20，最大 50）",
        },
        offset: {
          type: "number",
          description: "偏移量（默认 0）",
        },
      },
      required: ["search_key"],
    },
  },
  {
    name: "feishu_plus_search_app",
    description: "搜索飞书应用（需要用户授权）",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词",
        },
        page_size: {
          type: "number",
          description: "每页数量（默认 20，最大 50）",
        },
        page_token: {
          type: "string",
          description: "分页 token",
        },
      },
      required: ["query"],
    },
  },
];

export class SearchTools {
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    userId?: string,
  ): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_search_message":
        return this.searchMessage(params, userId);
      case "feishu_plus_search_doc":
        return this.searchDoc(params, userId);
      case "feishu_plus_search_app":
        return this.searchApp(params, userId);
      default:
        throw new Error(`Unknown search tool: ${toolName}`);
    }
  }

  private async searchMessage(params: Record<string, unknown>, userId?: string) {
    const body: Record<string, unknown> = {
      query: String(params.query),
    };
    if (Array.isArray(params.chat_ids) && params.chat_ids.length > 0) {
      body.chat_ids = params.chat_ids.map(String);
    }
    if (params.message_type) body.message_type = String(params.message_type);
    if (Array.isArray(params.from_ids) && params.from_ids.length > 0) {
      body.from_ids = params.from_ids.map(String);
    }
    if (params.from_type) body.from_type = String(params.from_type);
    if (params.start_time) body.start_time = String(params.start_time);
    if (params.end_time) body.end_time = String(params.end_time);
    if (params.page_size) body.page_size = Number(params.page_size);
    if (params.page_token) body.page_token = String(params.page_token);

    const result = await feishuPost(
      "search.message.search",
      "/open-apis/search/v2/message",
      body,
      { userId },
    );
    return result.data;
  }

  private async searchDoc(params: Record<string, unknown>, userId?: string) {
    const body: Record<string, unknown> = {
      search_key: String(params.search_key),
    };
    if (Array.isArray(params.owner_ids) && params.owner_ids.length > 0) {
      body.owner_ids = params.owner_ids.map(String);
    }
    if (Array.isArray(params.chat_ids) && params.chat_ids.length > 0) {
      body.chat_ids = params.chat_ids.map(String);
    }
    if (Array.isArray(params.docs_types) && params.docs_types.length > 0) {
      body.docs_types = params.docs_types.map(String);
    }
    if (params.count !== undefined) body.count = Number(params.count);
    if (params.offset !== undefined) body.offset = Number(params.offset);

    const result = await feishuPost(
      "search.doc.search",
      "/open-apis/suite/docs-api/search/object",
      body,
      { userId },
    );
    return result.data;
  }

  private async searchApp(params: Record<string, unknown>, userId?: string) {
    const result = await feishuPost(
      "search.app.search",
      "/open-apis/search/v1/app",
      {
        query: String(params.query),
        page_size: params.page_size ? Number(params.page_size) : 20,
        page_token: params.page_token ? String(params.page_token) : undefined,
      },
      { userId },
    );
    return result.data;
  }
}

export function registerSearchTools(
  tools: SearchTools,
  registerTool: (
    toolDef: (typeof SEARCH_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  SEARCH_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) =>
      tools.execute(toolDef.name, args, userId),
    );
  });
}
