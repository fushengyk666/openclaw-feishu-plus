/**
 * contact.ts — 飞书通讯录工具 (Dual-Auth)
 *
 * 当前优先补齐核心高频只读能力：
 * - 获取用户详情
 * - 批量获取用户详情
 * - 获取部门详情
 * - 列出部门子部门
 * - 列出部门用户
 * - 获取当前用户 me（user_only）
 */

import { feishuGet, feishuPost } from "../identity/feishu-api.js";

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
    const targetUserId = String(params.user_id);
    const result = await feishuGet(
      "contact.user.get",
      `/open-apis/contact/v3/users/${targetUserId}`,
      {
        userId,
        params: {
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
        },
      },
    );
    return result.data;
  }

  private async batchGetUsers(params: Record<string, unknown>, userId?: string) {
    const body = {
      user_ids: Array.isArray(params.user_ids)
        ? params.user_ids.map((v) => String(v))
        : [],
    };

    const result = await feishuPost(
      "contact.user.batchGet",
      "/open-apis/contact/v3/users/batch_get",
      body,
      {
        userId,
        params: {
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
        },
      },
    );
    return result.data;
  }

  private async getUserMe(params: Record<string, unknown>, userId?: string) {
    const result = await feishuGet(
      "contact.user.me",
      "/open-apis/contact/v3/users/me",
      {
        userId,
        params: {
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
        },
      },
    );
    return result.data;
  }

  private async getDepartment(params: Record<string, unknown>, userId?: string) {
    const departmentId = String(params.department_id);
    const result = await feishuGet(
      "contact.department.get",
      `/open-apis/contact/v3/departments/${departmentId}`,
      {
        userId,
        params: {
          department_id_type: params.department_id_type ? String(params.department_id_type) : undefined,
        },
      },
    );
    return result.data;
  }

  private async listDepartmentChildren(params: Record<string, unknown>, userId?: string) {
    const result = await feishuGet(
      "contact.department.children.list",
      "/open-apis/contact/v3/departments",
      {
        userId,
        params: {
          department_id: String(params.department_id),
          department_id_type: params.department_id_type ? String(params.department_id_type) : undefined,
          page_size: params.page_size ? Number(params.page_size) : 50,
          page_token: params.page_token ? String(params.page_token) : undefined,
          fetch_child: params.fetch_child !== undefined ? String(Boolean(params.fetch_child)) : undefined,
        },
      },
    );
    return result.data;
  }

  private async listDepartmentUsers(params: Record<string, unknown>, userId?: string) {
    const result = await feishuGet(
      "contact.department.user.list",
      "/open-apis/contact/v3/users/find_by_department",
      {
        userId,
        params: {
          department_id: String(params.department_id),
          department_id_type: params.department_id_type ? String(params.department_id_type) : undefined,
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
          page_size: params.page_size ? Number(params.page_size) : 50,
          page_token: params.page_token ? String(params.page_token) : undefined,
        },
      },
    );
    return result.data;
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
