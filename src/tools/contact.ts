/**
 * contact.ts — 飞书通讯录工具 (Dual-Auth)
 *
 * 所有 API 调用经 platform 层封装，最终仍通过 identity/feishu-api 执行（双授权）。
 */

import {
  getUser,
  batchGetUsers,
  getUserMe,
  getDepartment,
  listDepartmentChildren,
  listDepartmentUsers,
} from "../platform/contact/index.js";

export const CONTACT_TOOL_DEFS = [
  {
    name: "feishu_plus_contact_user_get",
    description: "获取用户详情",
    parameters: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "用户 ID" },
        user_id_type: {
          type: "string",
          description: "用户 ID 类型（open_id/user_id/union_id），默认 open_id",
        },
      },
      required: ["user_id"],
    },
  },
  {
    name: "feishu_plus_contact_user_batch_get",
    description: "批量获取用户详情",
    parameters: {
      type: "object",
      properties: {
        user_ids: {
          type: "array",
          items: { type: "string" },
          description: "用户 ID 列表",
        },
        user_id_type: {
          type: "string",
          description: "用户 ID 类型（open_id/user_id/union_id），默认 open_id",
        },
      },
      required: ["user_ids"],
    },
  },
  {
    name: "feishu_plus_contact_user_me",
    description: "获取当前授权用户信息（需要用户授权）",
    parameters: {
      type: "object",
      properties: {
        user_id_type: {
          type: "string",
          description: "用户 ID 类型（open_id/user_id/union_id），默认 open_id",
        },
      },
    },
  },
  {
    name: "feishu_plus_contact_department_get",
    description: "获取部门详情",
    parameters: {
      type: "object",
      properties: {
        department_id: { type: "string", description: "部门 ID" },
        department_id_type: {
          type: "string",
          description: "部门 ID 类型（department_id/open_department_id），默认 department_id",
        },
      },
      required: ["department_id"],
    },
  },
  {
    name: "feishu_plus_contact_department_list_children",
    description: "列出部门子部门",
    parameters: {
      type: "object",
      properties: {
        department_id: { type: "string", description: "父部门 ID" },
        department_id_type: {
          type: "string",
          description: "部门 ID 类型（department_id/open_department_id），默认 department_id",
        },
        page_size: { type: "number", description: "每页数量（默认 50）" },
        page_token: { type: "string", description: "分页 token" },
        fetch_child: { type: "boolean", description: "是否递归获取子部门" },
      },
      required: ["department_id"],
    },
  },
  {
    name: "feishu_plus_contact_department_list_users",
    description: "列出部门用户",
    parameters: {
      type: "object",
      properties: {
        department_id: { type: "string", description: "部门 ID" },
        department_id_type: {
          type: "string",
          description: "部门 ID 类型（department_id/open_department_id），默认 department_id",
        },
        user_id_type: {
          type: "string",
          description: "返回用户 ID 类型（open_id/user_id/union_id），默认 open_id",
        },
        page_size: { type: "number", description: "每页数量（默认 50）" },
        page_token: { type: "string", description: "分页 token" },
      },
      required: ["department_id"],
    },
  },
];

export class ContactTools {
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    userId?: string,
  ): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_contact_user_get":
        return this.getUser(params, userId);
      case "feishu_plus_contact_user_batch_get":
        return this.batchGetUsers(params, userId);
      case "feishu_plus_contact_user_me":
        return this.getUserMe(params, userId);
      case "feishu_plus_contact_department_get":
        return this.getDepartment(params, userId);
      case "feishu_plus_contact_department_list_children":
        return this.listDepartmentChildren(params, userId);
      case "feishu_plus_contact_department_list_users":
        return this.listDepartmentUsers(params, userId);
      default:
        throw new Error(`Unknown contact tool: ${toolName}`);
    }
  }

  private async getUser(params: Record<string, unknown>, userId?: string) {
    return await getUser({
      targetUserId: String(params.user_id),
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
    });
  }

  private async batchGetUsers(params: Record<string, unknown>, userId?: string) {
    return await batchGetUsers({
      userIds: Array.isArray(params.user_ids) ? params.user_ids.map((v) => String(v)) : [],
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
    });
  }

  private async getUserMe(params: Record<string, unknown>, userId?: string) {
    return await getUserMe({
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
    });
  }

  private async getDepartment(params: Record<string, unknown>, userId?: string) {
    return await getDepartment({
      departmentId: String(params.department_id),
      departmentIdType: params.department_id_type ? String(params.department_id_type) : undefined,
      userId,
    });
  }

  private async listDepartmentChildren(params: Record<string, unknown>, userId?: string) {
    return await listDepartmentChildren({
      departmentId: String(params.department_id),
      departmentIdType: params.department_id_type ? String(params.department_id_type) : undefined,
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      fetchChild: params.fetch_child !== undefined ? Boolean(params.fetch_child) : undefined,
      userId,
    });
  }

  private async listDepartmentUsers(params: Record<string, unknown>, userId?: string) {
    return await listDepartmentUsers({
      departmentId: String(params.department_id),
      departmentIdType: params.department_id_type ? String(params.department_id_type) : undefined,
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      userId,
    });
  }
}

export function registerContactTools(
  tools: ContactTools,
  registerTool: (
    toolDef: (typeof CONTACT_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  CONTACT_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) =>
      tools.execute(toolDef.name, args, userId),
    );
  });
}
