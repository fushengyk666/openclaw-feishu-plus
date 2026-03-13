/**
 * search.ts — 飞书搜索工具 (Dual-Auth)
 *
 * 所有 API 调用经 platform 层封装，最终仍通过 identity/feishu-api 执行（双授权）。
 *
 * 飞书搜索 API 全部要求 user_access_token，
 * 因为搜索结果基于用户可见范围（权限隔离）。
 */

import {
  searchMessage,
  searchDoc,
  searchApp,
} from "../platform/search/index.js";

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
    return await searchMessage({
      query: String(params.query),
      chatIds: Array.isArray(params.chat_ids) ? params.chat_ids.map(String) : undefined,
      messageType: params.message_type ? String(params.message_type) : undefined,
      fromIds: Array.isArray(params.from_ids) ? params.from_ids.map(String) : undefined,
      fromType: params.from_type ? String(params.from_type) : undefined,
      startTime: params.start_time ? String(params.start_time) : undefined,
      endTime: params.end_time ? String(params.end_time) : undefined,
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      userId,
    });
  }

  private async searchDoc(params: Record<string, unknown>, userId?: string) {
    return await searchDoc({
      searchKey: String(params.search_key),
      ownerIds: Array.isArray(params.owner_ids) ? params.owner_ids.map(String) : undefined,
      chatIds: Array.isArray(params.chat_ids) ? params.chat_ids.map(String) : undefined,
      docsTypes: Array.isArray(params.docs_types) ? params.docs_types.map(String) : undefined,
      count: params.count !== undefined ? Number(params.count) : undefined,
      offset: params.offset !== undefined ? Number(params.offset) : undefined,
      userId,
    });
  }

  private async searchApp(params: Record<string, unknown>, userId?: string) {
    return await searchApp({
      query: String(params.query),
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      userId,
    });
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
