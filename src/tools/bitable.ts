/**
 * bitable.ts — 飞书多维表格工具
 *
 * 支持：获取应用信息、列出表格、列出记录、创建记录、更新记录、删除记录
 * 身份：由 request-executor 自动决定（user-if-available-else-tenant）
 */

import { executeFeishuRequest } from "../core/request-executor.js";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义 ───

export const BITABLE_TOOL_DEFS = [
  {
    name: "feishu_plus_bitable_get_app",
    description: "获取多维表格应用信息",
    parameters: {
      type: "object",
      properties: {
        app_token: { type: "string", description: "应用 token" },
      },
      required: ["app_token"],
    },
  },
  {
    name: "feishu_plus_bitable_list_tables",
    description: "列出多维表格中的数据表",
    parameters: {
      type: "object",
      properties: {
        app_token: { type: "string", description: "应用 token" },
      },
      required: ["app_token"],
    },
  },
  {
    name: "feishu_plus_bitable_list_records",
    description: "列出数据表中的记录",
    parameters: {
      type: "object",
      properties: {
        app_token: { type: "string", description: "应用 token" },
        table_id: { type: "string", description: "表格 ID" },
        page_size: { type: "number", description: "每页数量（默认 20）" },
        page_token: { type: "string", description: "分页 token" },
        view_id: { type: "string", description: "视图 ID（可选）" },
        field_ids: { type: "string", description: "需要返回的字段 ID 列表（逗号分隔）" },
        sort: { type: "string", description: "排序条件（JSON 字符串）" },
        filter: { type: "string", description: "筛选条件（JSON 字符串）" },
      },
      required: ["app_token", "table_id"],
    },
  },
  {
    name: "feishu_plus_bitable_create_record",
    description: "创建记录",
    parameters: {
      type: "object",
      properties: {
        app_token: { type: "string", description: "应用 token" },
        table_id: { type: "string", description: "表格 ID" },
        fields: { type: "string", description: "记录字段（JSON 字符串）" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["app_token", "table_id", "fields"],
    },
  },
  {
    name: "feishu_plus_bitable_update_record",
    description: "更新记录",
    parameters: {
      type: "object",
      properties: {
        app_token: { type: "string", description: "应用 token" },
        table_id: { type: "string", description: "表格 ID" },
        record_id: { type: "string", description: "记录 ID" },
        fields: { type: "string", description: "更新字段（JSON 字符串）" },
      },
      required: ["app_token", "table_id", "record_id", "fields"],
    },
  },
  {
    name: "feishu_plus_bitable_delete_record",
    description: "删除记录",
    parameters: {
      type: "object",
      properties: {
        app_token: { type: "string", description: "应用 token" },
        table_id: { type: "string", description: "表格 ID" },
        record_id: { type: "string", description: "记录 ID" },
      },
      required: ["app_token", "table_id", "record_id"],
    },
  },
];

// ─── 工具执行器类 ───

export class BitableTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_bitable_get_app":
        return this.getApp(params, userId);

      case "feishu_plus_bitable_list_tables":
        return this.listTables(params, userId);

      case "feishu_plus_bitable_list_records":
        return this.listRecords(params, userId);

      case "feishu_plus_bitable_create_record":
        return this.createRecord(params, userId);

      case "feishu_plus_bitable_update_record":
        return this.updateRecord(params, userId);

      case "feishu_plus_bitable_delete_record":
        return this.deleteRecord(params, userId);

      default:
        throw new Error(`Unknown bitable tool: ${toolName}`);
    }
  }

  private async getApp(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "bitable.app.get",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/bitable/v1/apps/${params.app_token}`,
          {
            headers: {
              "Authorization": authorizationHeader,
            },
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to get bitable app: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async listTables(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "bitable.appTable.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/bitable/v1/apps/${params.app_token}/tables`,
          {
            headers: {
              "Authorization": authorizationHeader,
            },
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list tables: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async listRecords(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "bitable.appTableRecord.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/records`);
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));
        if (params.view_id) url.searchParams.set("view_id", String(params.view_id));
        if (params.field_ids) url.searchParams.set("field_ids", String(params.field_ids));
        if (params.sort) url.searchParams.set("sort", String(params.sort));
        if (params.filter) url.searchParams.set("filter", String(params.filter));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list records: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async createRecord(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "bitable.appTableRecord.create",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const body: Record<string, unknown> = {
          fields: JSON.parse(String(params.fields)),
        };
        if (params.user_id_type) body.user_id_type = params.user_id_type;

        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/records`,
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
          throw new Error(`Failed to create record: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async updateRecord(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "bitable.appTableRecord.update",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/records/${params.record_id}`,
          {
            method: "PUT",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fields: JSON.parse(String(params.fields)),
            }),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to update record: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async deleteRecord(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "bitable.appTableRecord.delete",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/bitable/v1/apps/${params.app_token}/tables/${params.table_id}/records/${params.record_id}`,
          {
            method: "DELETE",
            headers: {
              "Authorization": authorizationHeader,
            },
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to delete record: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }
}

// ─── 注册辅助函数 ───

export function registerBitableTools(
  tools: BitableTools,
  registerTool: (toolDef: typeof BITABLE_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  BITABLE_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
