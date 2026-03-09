/**
 * doc.ts — 飞书云文档工具
 *
 * 支持：创建、读取、更新、删除文档及文档块
 * 身份：由 request-executor 自动决定（user-if-available-else-tenant）
 */

import { executeFeishuRequest } from "../core/request-executor.js";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义 ───

export const DOC_TOOL_DEFS = [
  {
    name: "feishu_doc_create",
    description: "创建飞书云文档",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "文档标题" },
        folder_token: { type: "string", description: "目标文件夹 token（可选）" },
      },
      required: ["title"],
    },
  },
  {
    name: "feishu_doc_get",
    description: "获取飞书云文档内容",
    parameters: {
      type: "object",
      properties: {
        document_id: { type: "string", description: "文档 ID" },
      },
      required: ["document_id"],
    },
  },
  {
    name: "feishu_doc_list_blocks",
    description: "列出文档中的所有块",
    parameters: {
      type: "object",
      properties: {
        document_id: { type: "string", description: "文档 ID" },
        page_size: { type: "number", description: "每页数量（默认 50）" },
        page_token: { type: "string", description: "分页 token" },
      },
      required: ["document_id"],
    },
  },
];

// ─── 工具执行器类 ───

export class DocTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_doc_create":
        return this.create(params, userId);

      case "feishu_doc_get":
        return this.get(params, userId);

      case "feishu_doc_list_blocks":
        return this.listBlocks(params, userId);

      default:
        throw new Error(`Unknown doc tool: ${toolName}`);
    }
  }

  private async create(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "docx.document.create",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/docx/v1/documents`,
          {
            method: "POST",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: params.title,
              folder_token: params.folder_token,
            }),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to create document: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async get(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "docx.document.get",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/docx/v1/documents/${params.document_id}`,
          {
            headers: {
              "Authorization": authorizationHeader,
            },
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to get document: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async listBlocks(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "docx.documentBlock.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/docx/v1/documents/${params.document_id}/blocks`);
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list blocks: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }
}

// ─── 注册辅助函数（用于 index.ts 统一注册） ───

/**
 * 注册 Doc 工具到 OpenClaw
 */
export function registerDocTools(
  tools: DocTools,
  registerTool: (toolDef: typeof DOC_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  DOC_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
