/**
 * perm.ts — 飞书云盘权限工具 (Dual-Auth)
 *
 * 所有 API 调用经 platform 层封装，最终仍通过 identity/feishu-api 执行（双授权）。
 */

import {
  listPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  transferOwner,
} from "../platform/perm/index.js";
import { IDENTITY_MODE_SCHEMA, parseIdentityMode } from "./identity-mode.js";
import type { IdentityMode } from "../identity/feishu-api.js";

export const PERM_TOOL_DEFS = [
  {
    name: "feishu_plus_drive_list_permissions",
    description: "列出文件/文件夹的权限列表",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        token: { type: "string", description: "文件/文件夹 token" },
        type: { type: "string", description: "资源类型（file/folder/wiki/wiki_node）" },
        page_size: { type: "number", description: "每页数量（默认 50）" },
        page_token: { type: "string", description: "分页 token" },
      },
      required: ["token", "type"],
    },
  },
  {
    name: "feishu_plus_drive_create_permission",
    description: "添加文件/文件夹权限",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        token: { type: "string", description: "文件/文件夹 token" },
        type: { type: "string", description: "资源类型（file/folder）" },
        member_type: { type: "string", description: "成员类型（user/group/org）" },
        member_id: { type: "string", description: "成员 ID" },
        perm: { type: "string", description: "权限（view/edit/full_access）" },
        notify: { type: "boolean", description: "是否通知成员（默认 true）" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["token", "type", "member_type", "member_id", "perm"],
    },
  },
  {
    name: "feishu_plus_drive_update_permission",
    description: "更新文件/文件夹权限",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        token: { type: "string", description: "文件/文件夹 token" },
        type: { type: "string", description: "资源类型（file/folder）" },
        permittee_id: { type: "string", description: "被授权者 ID" },
        permittee_type: { type: "string", description: "被授权者类型（user/group/org）" },
        perm: { type: "string", description: "权限（view/edit/full_access）" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["token", "type", "permittee_id", "permittee_type", "perm"],
    },
  },
  {
    name: "feishu_plus_drive_delete_permission",
    description: "删除文件/文件夹权限",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        token: { type: "string", description: "文件/文件夹 token" },
        type: { type: "string", description: "资源类型（file/folder）" },
        permittee_id: { type: "string", description: "被授权者 ID" },
        permittee_type: { type: "string", description: "被授权者类型（user/group/org）" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["token", "type", "permittee_id", "permittee_type"],
    },
  },
  {
    name: "feishu_plus_drive_transfer_owner",
    description: "转移文件/文件夹所有权（必须使用用户身份）",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        token: { type: "string", description: "文件/文件夹 token" },
        type: { type: "string", description: "资源类型（file/folder）" },
        to_user_id: { type: "string", description: "新所有者用户 ID" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["token", "type", "to_user_id"],
    },
  },
];

export class PermTools {
  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    const identityMode = parseIdentityMode(params.identity_mode);
    switch (toolName) {
      case "feishu_plus_drive_list_permissions":
        return this.listPermissions(params, userId, identityMode);
      case "feishu_plus_drive_create_permission":
        return this.createPermission(params, userId, identityMode);
      case "feishu_plus_drive_update_permission":
        return this.updatePermission(params, userId, identityMode);
      case "feishu_plus_drive_delete_permission":
        return this.deletePermission(params, userId, identityMode);
      case "feishu_plus_drive_transfer_owner":
        return this.transferOwner(params, userId, identityMode);
      default:
        throw new Error(`Unknown perm tool: ${toolName}`);
    }
  }

  private async listPermissions(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await listPermissions({
      token: String(params.token),
      type: String(params.type),
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      userId,
      identityMode,
    });
  }

  private async createPermission(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await createPermission({
      token: String(params.token),
      type: String(params.type),
      memberType: String(params.member_type),
      memberId: String(params.member_id),
      perm: String(params.perm),
      notify: params.notify !== false,
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
  }

  private async updatePermission(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await updatePermission({
      token: String(params.token),
      type: String(params.type),
      permitteeId: String(params.permittee_id),
      permitteeType: String(params.permittee_type),
      perm: String(params.perm),
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
  }

  private async deletePermission(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await deletePermission({
      token: String(params.token),
      type: String(params.type),
      permitteeId: String(params.permittee_id),
      permitteeType: String(params.permittee_type),
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
  }

  private async transferOwner(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await transferOwner({
      token: String(params.token),
      type: String(params.type),
      toUserId: String(params.to_user_id),
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
  }
}

export function registerPermTools(
  tools: PermTools,
  registerTool: (
    toolDef: (typeof PERM_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  PERM_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) => tools.execute(toolDef.name, args, userId));
  });
}
