/**
 * doc.ts — 飞书云文档工具 (Dual-Auth)
 *
 * 所有 API 调用经过 identity 层的双授权决策链路：
 * - 有 user token → 用 user token
 * - 无 user token → 回退 tenant token
 * - user_only 接口 → 生成授权提示
 */

import {
  createDocxDocument,
  getDocxDocument,
  listDocxBlocks,
  getDocxRawContent,
} from "../platform/docs/index.js";
import { IDENTITY_MODE_SCHEMA, parseIdentityMode } from "./identity-mode.js";
import type { IdentityMode } from "../identity/feishu-api.js";

// ─── 工具定义 ───

export const DOC_TOOL_DEFS = [
  {
    name: "feishu_plus_doc_create",
    description: "创建飞书云文档",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
        document_id: { type: "string", description: "文档 ID" },
        page_size: { type: "number", description: "每页数量（默认 50）" },
        page_token: { type: "string", description: "分页 token" },
      },
      required: ["document_id"],
    },
  },
  {
    name: "feishu_plus_doc_raw_content",
    description: "获取文档纯文本内容",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        document_id: { type: "string", description: "文档 ID" },
      },
      required: ["document_id"],
    },
  },
];

// ─── 工具执行器 ───

export class DocTools {
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    userId?: string,
  ): Promise<unknown> {
    const identityMode = parseIdentityMode(params.identity_mode);
    switch (toolName) {
      case "feishu_plus_doc_create":
        return this.create(params, userId, identityMode);
      case "feishu_plus_doc_get":
        return this.get(params, userId, identityMode);
      case "feishu_plus_doc_list_blocks":
        return this.listBlocks(params, userId, identityMode);
      case "feishu_plus_doc_raw_content":
        return this.rawContent(params, userId, identityMode);
      default:
        throw new Error(`Unknown doc tool: ${toolName}`);
    }
  }

  private async create(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    const body: Record<string, unknown> = {
      title: String(params.title ?? ""),
    };
    if (params.folder_token) {
      body.folder_token = String(params.folder_token);
    }

    return await createDocxDocument({
      title: String(body.title ?? ""),
      folderToken: typeof body.folder_token === "string" ? body.folder_token : undefined,
      userId,
      identityMode,
    });
  }

  private async get(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    const docId = String(params.document_id);
    return await getDocxDocument({ documentId: docId, userId, identityMode });
  }

  private async listBlocks(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    const docId = String(params.document_id);
    return await listDocxBlocks({
      documentId: docId,
      pageSize: typeof params.page_size === "number" ? params.page_size : params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      userId,
      identityMode,
    });
  }

  private async rawContent(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    const docId = String(params.document_id);
    return await getDocxRawContent({ documentId: docId, userId, identityMode });
  }
}

// ─── 注册辅助 ───

export function registerDocTools(
  tools: DocTools,
  registerTool: (
    toolDef: (typeof DOC_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  DOC_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) =>
      tools.execute(toolDef.name, args, userId),
    );
  });
}
