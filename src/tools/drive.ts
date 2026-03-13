/**
 * drive.ts — 飞书云盘工具 (Dual-Auth)
 *
 * 所有 API 调用经 platform 层封装，最终仍通过 identity/feishu-api 执行（双授权）。
 */

import {
  listDriveFiles,
  getDriveFile,
  downloadDriveFile,
  uploadDriveFile,
  createDriveFolder,
  deleteDriveFile,
  copyDriveFile,
  moveDriveFile,
} from "../platform/drive/index.js";
import { IDENTITY_MODE_SCHEMA, parseIdentityMode } from "./identity-mode.js";
import type { IdentityMode } from "../identity/feishu-api.js";

export const DRIVE_TOOL_DEFS = [
  {
    name: "feishu_plus_drive_list_files",
    description: "列出云盘文件",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
        file_token: { type: "string", description: "文件 token" },
        type: { type: "string", description: "文件类型（file/doc/docx/bitable/sheet/mindnote/slides）" },
        folder_token: { type: "string", description: "目标文件夹 token" },
      },
      required: ["file_token", "type", "folder_token"],
    },
  },
];

export class DriveTools {
  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    const identityMode = parseIdentityMode(params.identity_mode);
    switch (toolName) {
      case "feishu_plus_drive_list_files":
        return this.listFiles(params, userId, identityMode);
      case "feishu_plus_drive_get_file":
        return this.getFile(params, userId, identityMode);
      case "feishu_plus_drive_download_file":
        return this.downloadFile(params, userId, identityMode);
      case "feishu_plus_drive_upload_file":
        return this.uploadFile(params, userId, identityMode);
      case "feishu_plus_drive_create_folder":
        return this.createFolder(params, userId, identityMode);
      case "feishu_plus_drive_delete_file":
        return this.deleteFile(params, userId, identityMode);
      case "feishu_plus_drive_copy_file":
        return this.copyFile(params, userId, identityMode);
      case "feishu_plus_drive_move_file":
        return this.moveFile(params, userId, identityMode);
      default:
        throw new Error(`Unknown drive tool: ${toolName}`);
    }
  }

  private async listFiles(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await listDriveFiles({
      folderToken: params.folder_token ? String(params.folder_token) : undefined,
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      orderBy: params.order_by ? String(params.order_by) : undefined,
      direction: params.direction ? String(params.direction) : undefined,
      userId,
      identityMode,
    });
  }

  private async getFile(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await getDriveFile({
      fileToken: String(params.file_token),
      userId,
      identityMode,
    });
  }

  private async downloadFile(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await downloadDriveFile({
      fileToken: String(params.file_token),
      userId,
      identityMode,
    });
  }

  private async uploadFile(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await uploadDriveFile({
      parentToken: String(params.parent_token),
      fileName: String(params.file_name),
      fileSize: Number(params.file_size),
      userId,
      identityMode,
    });
  }

  private async createFolder(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await createDriveFolder({
      parentToken: String(params.parent_token),
      folderName: String(params.folder_name),
      userId,
      identityMode,
    });
  }

  private async deleteFile(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await deleteDriveFile({
      fileToken: String(params.file_token),
      type: String(params.type),
      userId,
      identityMode,
    });
  }

  private async copyFile(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await copyDriveFile({
      fileToken: String(params.file_token),
      name: String(params.name),
      type: String(params.type),
      folderToken: String(params.folder_token),
      userId,
      identityMode,
    });
  }

  private async moveFile(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await moveDriveFile({
      fileToken: String(params.file_token),
      type: String(params.type),
      folderToken: String(params.folder_token),
      userId,
      identityMode,
    });
  }
}

export function registerDriveTools(
  tools: DriveTools,
  registerTool: (
    toolDef: (typeof DRIVE_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  DRIVE_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) => tools.execute(toolDef.name, args, userId));
  });
}
