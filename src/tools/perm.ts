/**
 * perm.ts — 飞书权限管理工具
 *
 * 支持：列出权限、更新权限、删除权限、转移所有权
 * 身份：由 request-executor 自动决定（user-if-available-else-tenant）
 *
 * 注意：transfer_owner 必须使用用户身份
 */

import { executeFeishuRequest } from "../core/request-executor.js";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义 ───

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

// ─── 工具执行器类 ───

export class PermTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_drive_list_permissions":
        return this.listPermissions(params, userId);

      case "feishu_plus_drive_create_permission":
        return this.createPermission(params, userId);

      case "feishu_plus_drive_update_permission":
        return this.updatePermission(params, userId);

      case "feishu_plus_drive_delete_permission":
        return this.deletePermission(params, userId);

      case "feishu_plus_drive_transfer_owner":
        return this.transferOwner(params, userId);

      default:
        throw new Error(`Unknown perm tool: ${toolName}`);
    }
  }

  private async listPermissions(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "drive.permission.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/drive/v1/permissions/${params.token}/${params.type}`);
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list permissions: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async createPermission(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "drive.permission.create",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const body: Record<string, unknown> = {
          member_type: params.member_type,
          member_id: params.member_id,
          perm: params.perm,
          notify: params.notify !== undefined ? params.notify : true,
        };
        if (params.user_id_type) body.user_id_type = params.user_id_type;

        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/drive/v1/permissions/${params.token}/${params.type}/members`,
          {
            method: "POST",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to create permission: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async updatePermission(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "drive.permission.update",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const body: Record<string, unknown> = {
          perm: params.perm,
        };
        if (params.user_id_type) body.user_id_type = params.user_id_type;

        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/drive/v1/permissions/${params.token}/${params.type}/members/${params.permittee_type}/${params.permittee_id}`,
          {
            method: "PATCH",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to update permission: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async deletePermission(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "drive.permission.delete",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(
          `https://open.${this.config.domain}.cn/open-apis/drive/v1/permissions/${params.token}/${params.type}/members/${params.permittee_type}/${params.permittee_id}`
        );
        if (params.user_id_type) url.searchParams.set("user_id_type", String(params.user_id_type));

        const resp = await fetch(url.toString(), {
          method: "DELETE",
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to delete permission: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async transferOwner(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "drive.permission.transferOwner",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const body: Record<string, unknown> = {
          to_user_id: params.to_user_id,
        };
        if (params.user_id_type) body.user_id_type = params.user_id_type;

        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/drive/v1/permissions/${params.token}/${params.type}/owner`,
          {
            method: "POST",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to transfer owner: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }
}

// ─── 注册辅助函数 ───

export function registerPermTools(
  tools: PermTools,
  registerTool: (toolDef: typeof PERM_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  PERM_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
