/**
 * perm.ts — 飞书云盘权限工具 (Lark SDK)
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "../identity/config-schema.js";
import type { ITokenStore } from "../identity/token-store.js";

export const PERM_TOOL_DEFS = [
  {
    name: "feishu_plus_drive_list_permissions",
    description: "列出文件/文件夹的权限列表",
    parameters: {
      type: "object",
      properties: {
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
      case "feishu_plus_drive_list_permissions":
        return this.listPermissions(params);
      case "feishu_plus_drive_create_permission":
        return this.createPermission(params);
      case "feishu_plus_drive_update_permission":
        return this.updatePermission(params);
      case "feishu_plus_drive_delete_permission":
        return this.deletePermission(params);
      case "feishu_plus_drive_transfer_owner":
        return this.transferOwner(params);
      default:
        throw new Error(`Unknown perm tool: ${toolName}`);
    }
  }

  private async listPermissions(params: Record<string, unknown>) {
    return this.client.drive.v1.permissionMember.list({
      path: { token: String(params.token) },
      params: {
        type: String(params.type) as any,
      },
    });
  }

  private async createPermission(params: Record<string, unknown>) {
    return this.client.drive.v1.permissionMember.create({
      path: { token: String(params.token) },
      params: {
        type: String(params.type) as any,
        need_notification: params.notify !== false,
      },
      data: {
        member_type: String(params.member_type) as any,
        member_id: String(params.member_id),
        perm: String(params.perm) as any,
      },
    });
  }

  private async updatePermission(params: Record<string, unknown>) {
    return this.client.drive.v1.permissionMember.update({
      path: {
        token: String(params.token),
        member_id: String(params.permittee_id),
      },
      params: {
        type: String(params.type) as any,
        need_notification: false,
      },
      data: {
        member_type: String(params.permittee_type) as any,
        perm: String(params.perm) as any,
      },
    });
  }

  private async deletePermission(params: Record<string, unknown>) {
    return this.client.drive.v1.permissionMember.delete({
      path: {
        token: String(params.token),
        member_id: String(params.permittee_id),
      },
      params: {
        type: String(params.type) as any,
        member_type: String(params.permittee_type) as any,
      },
    });
  }

  private async transferOwner(params: Record<string, unknown>) {
    // SDK doesn't have a direct transfer method; use permissionPublic or manual approach
    const domain = this.config.domain === "lark" ? "lark" : "feishu";
    // Fall back to REST API for owner transfer
    const resp = await fetch(
      `https://open.${domain}.cn/open-apis/drive/v1/permissions/${params.token}/members/transfer_owner`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          member_type: "user",
          member_id: String(params.to_user_id),
        }),
      }
    );
    return resp.json();
  }
}

export function registerPermTools(
  tools: PermTools,
  registerTool: (toolDef: typeof PERM_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  PERM_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
