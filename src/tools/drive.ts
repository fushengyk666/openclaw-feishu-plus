/**
 * drive.ts — 飞书云盘工具 (Lark SDK)
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "../identity/config-schema.js";
import type { ITokenStore } from "../identity/token-store.js";

export const DRIVE_TOOL_DEFS = [
  {
    name: "feishu_plus_drive_list_files",
    description: "列出云盘文件",
    parameters: {
      type: "object",
      properties: {
        folder_token: { type: "string", description: "文件夹 token（根目录为空）" },
        page_size: { type: "number", description: "每页数量（默认 50）" },
        page_token: { type: "string", description: "分页 token" },
        order_by: { type: "string", description: "排序字段（created_time/modified_time/name）" },
        direction: { type: "string", description: "排序方向（ASC/DESC）" },
      },
    },
  },
  {
    name: "feishu_plus_drive_get_file",
    description: "获取文件信息",
    parameters: {
      type: "object",
      properties: {
        file_token: { type: "string", description: "文件 token" },
      },
      required: ["file_token"],
    },
  },
  {
    name: "feishu_plus_drive_download_file",
    description: "获取文件下载信息",
    parameters: {
      type: "object",
      properties: {
        file_token: { type: "string", description: "文件 token" },
      },
      required: ["file_token"],
    },
  },
  {
    name: "feishu_plus_drive_upload_file",
    description: "上传文件（准备上传）",
    parameters: {
      type: "object",
      properties: {
        parent_token: { type: "string", description: "目标文件夹 token" },
        file_name: { type: "string", description: "文件名" },
        file_size: { type: "number", description: "文件大小（字节）" },
      },
      required: ["parent_token", "file_name", "file_size"],
    },
  },
  {
    name: "feishu_plus_drive_create_folder",
    description: "创建文件夹",
    parameters: {
      type: "object",
      properties: {
        parent_token: { type: "string", description: "目标文件夹 token" },
        folder_name: { type: "string", description: "文件夹名称" },
      },
      required: ["parent_token", "folder_name"],
    },
  },
  {
    name: "feishu_plus_drive_delete_file",
    description: "删除文件",
    parameters: {
      type: "object",
      properties: {
        file_token: { type: "string", description: "文件 token" },
        type: { type: "string", description: "文件类型（file/doc/docx/bitable/sheet/mindnote/slides）" },
      },
      required: ["file_token", "type"],
    },
  },
  {
    name: "feishu_plus_drive_copy_file",
    description: "复制文件",
    parameters: {
      type: "object",
      properties: {
        file_token: { type: "string", description: "源文件 token" },
        name: { type: "string", description: "新文件名" },
        type: { type: "string", description: "文件类型（file/doc/docx/bitable/sheet/mindnote/slides）" },
        folder_token: { type: "string", description: "目标文件夹 token" },
      },
      required: ["file_token", "name", "type", "folder_token"],
    },
  },
  {
    name: "feishu_plus_drive_move_file",
    description: "移动文件",
    parameters: {
      type: "object",
      properties: {
        file_token: { type: "string", description: "文件 token" },
        type: { type: "string", description: "文件类型（file/doc/docx/bitable/sheet/mindnote/slides）" },
        folder_token: { type: "string", description: "目标文件夹 token" },
      },
      required: ["file_token", "type", "folder_token"],
    },
  },
];

export class DriveTools {
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
      case "feishu_plus_drive_list_files":
        return this.listFiles(params);
      case "feishu_plus_drive_get_file":
        return this.getFile(params);
      case "feishu_plus_drive_download_file":
        return this.downloadFile(params);
      case "feishu_plus_drive_upload_file":
        return this.uploadFile(params);
      case "feishu_plus_drive_create_folder":
        return this.createFolder(params);
      case "feishu_plus_drive_delete_file":
        return this.deleteFile(params);
      case "feishu_plus_drive_copy_file":
        return this.copyFile(params);
      case "feishu_plus_drive_move_file":
        return this.moveFile(params);
      default:
        throw new Error(`Unknown drive tool: ${toolName}`);
    }
  }

  private async listFiles(params: Record<string, unknown>) {
    return this.client.drive.v1.file.list({
      params: {
        folder_token: params.folder_token ? String(params.folder_token) : undefined,
        page_size: params.page_size ? Number(params.page_size) : 50,
        page_token: params.page_token ? String(params.page_token) : undefined,
        order_by: params.order_by ? String(params.order_by) as any : undefined,
      },
    });
  }

  private async getFile(params: Record<string, unknown>) {
    return this.client.drive.v1.meta.batchQuery({
      data: {
        request_docs: [{ doc_token: String(params.file_token), doc_type: "doc" }],
      },
    });
  }

  private async downloadFile(params: Record<string, unknown>) {
    return this.client.drive.v1.meta.batchQuery({
      data: {
        request_docs: [{ doc_token: String(params.file_token), doc_type: "file" as any }],
      },
    });
  }

  private async uploadFile(params: Record<string, unknown>) {
    // Upload requires multipart form data with actual file content
    // This is a preparation step - return upload guidance
    return {
      message: "File upload requires actual file content. Use the Feishu drive upload API with multipart form data.",
      parent_token: params.parent_token,
      file_name: params.file_name,
      file_size: params.file_size,
    };
  }

  private async createFolder(params: Record<string, unknown>) {
    return this.client.drive.v1.file.createFolder({
      data: {
        name: String(params.folder_name),
        folder_token: String(params.parent_token),
      },
    });
  }

  private async deleteFile(params: Record<string, unknown>) {
    return this.client.drive.v1.file.delete({
      path: { file_token: String(params.file_token) },
      params: { type: String(params.type) as any },
    });
  }

  private async copyFile(params: Record<string, unknown>) {
    return this.client.drive.v1.file.copy({
      path: { file_token: String(params.file_token) },
      data: {
        name: String(params.name),
        type: String(params.type) as any,
        folder_token: String(params.folder_token),
      },
    });
  }

  private async moveFile(params: Record<string, unknown>) {
    return this.client.drive.v1.file.move({
      path: { file_token: String(params.file_token) },
      data: {
        type: String(params.type) as any,
        folder_token: String(params.folder_token),
      },
    });
  }
}

export function registerDriveTools(
  tools: DriveTools,
  registerTool: (toolDef: typeof DRIVE_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  DRIVE_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
