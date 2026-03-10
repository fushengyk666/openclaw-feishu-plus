/**
 * drive.ts — 飞书云盘工具
 *
 * 支持：列出文件、获取文件信息、下载文件、上传文件、创建文件夹
 * 身份：由 request-executor 自动决定（user-if-available-else-tenant）
 */

import { executeFeishuRequest } from "../core/request-executor.js";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义 ───

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
];

// ─── 工具执行器类 ───

export class DriveTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_drive_list_files":
        return this.listFiles(params, userId);

      case "feishu_plus_drive_get_file":
        return this.getFile(params, userId);

      case "feishu_plus_drive_download_file":
        return this.downloadFile(params, userId);

      case "feishu_plus_drive_upload_file":
        return this.uploadFile(params, userId);

      case "feishu_plus_drive_create_folder":
        return this.createFolder(params, userId);

      default:
        throw new Error(`Unknown drive tool: ${toolName}`);
    }
  }

  private async listFiles(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "drive.file.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/drive/v1/files`);
        if (params.folder_token) url.searchParams.set("parent_token", String(params.folder_token));
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));
        if (params.order_by) url.searchParams.set("order_by", String(params.order_by));
        if (params.direction) url.searchParams.set("direction", String(params.direction));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list files: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async getFile(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "drive.file.get",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/drive/v1/files/${params.file_token}`,
          {
            headers: {
              "Authorization": authorizationHeader,
            },
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to get file: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async downloadFile(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "drive.file.download",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/drive/v1/files/${params.file_token}/download_info`,
          {
            headers: {
              "Authorization": authorizationHeader,
            },
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to get download info: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async uploadFile(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "drive.file.upload",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/drive/v1/files/upload_all`,
          {
            method: "POST",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              parent_type: "explorer",
              parent_node: params.parent_token,
              size: params.file_size,
              name: params.file_name,
            }),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to upload file: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async createFolder(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "drive.file.createFolder",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/drive/v1/files/create_folder`,
          {
            method: "POST",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              parent_type: "explorer",
              parent_node: params.parent_token,
              name: params.folder_name,
            }),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to create folder: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }
}

// ─── 注册辅助函数 ───

export function registerDriveTools(
  tools: DriveTools,
  registerTool: (toolDef: typeof DRIVE_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  DRIVE_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
