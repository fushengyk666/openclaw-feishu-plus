/**
 * doc.ts — 飞书云文档工具 (Lark SDK)
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

export const DOC_TOOL_DEFS = [
  {
    name: "feishu_plus_doc_create",
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
    name: "feishu_plus_doc_get",
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
    name: "feishu_plus_doc_list_blocks",
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

export class DocTools {
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
      case "feishu_plus_doc_create":
        return this.create(params);
      case "feishu_plus_doc_get":
        return this.get(params);
      case "feishu_plus_doc_list_blocks":
        return this.listBlocks(params);
      default:
        throw new Error(`Unknown doc tool: ${toolName}`);
    }
  }

  private async create(params: Record<string, unknown>) {
    return this.client.docx.v1.document.create({
      data: {
        title: String(params.title ?? ""),
        folder_token: params.folder_token ? String(params.folder_token) : undefined,
      },
    });
  }

  private async get(params: Record<string, unknown>) {
    return this.client.docx.v1.document.get({
      path: { document_id: String(params.document_id) },
    });
  }

  private async listBlocks(params: Record<string, unknown>) {
    return this.client.docx.v1.documentBlock.list({
      path: { document_id: String(params.document_id) },
      params: {
        page_size: params.page_size ? Number(params.page_size) : 50,
        page_token: params.page_token ? String(params.page_token) : undefined,
      },
    });
  }
}

export function registerDocTools(
  tools: DocTools,
  registerTool: (toolDef: typeof DOC_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  DOC_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
