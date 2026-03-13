/**
 * bitable.ts — 飞书多维表格工具 (Dual-Auth)
 */

import { feishuGet, feishuPost, feishuPatch, feishuDelete } from "../identity/feishu-api.js";

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

export class BitableTools {
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
    const result = await feishuGet(
      "bitable.app.get",
      `/open-apis/bitable/v1/apps/${String(params.app_token)}`,
      { userId },
    );
    return result.data;
  }

  private async listTables(params: Record<string, unknown>, userId?: string) {
    const result = await feishuGet(
      "bitable.appTable.list",
      `/open-apis/bitable/v1/apps/${String(params.app_token)}/tables`,
      { userId },
    );
    return result.data;
  }

  private async listRecords(params: Record<string, unknown>, userId?: string) {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      page_size: params.page_size ? Number(params.page_size) : 20,
      page_token: params.page_token ? String(params.page_token) : undefined,
      view_id: params.view_id ? String(params.view_id) : undefined,
      sort: params.sort ? String(params.sort) : undefined,
      filter: params.filter ? String(params.filter) : undefined,
    };
    if (params.field_ids) queryParams.field_names = String(params.field_ids);

    const result = await feishuGet(
      "bitable.appTableRecord.list",
      `/open-apis/bitable/v1/apps/${String(params.app_token)}/tables/${String(params.table_id)}/records`,
      { userId, params: queryParams },
    );
    return result.data;
  }

  private async createRecord(params: Record<string, unknown>, userId?: string) {
    const fields = typeof params.fields === "string" ? JSON.parse(params.fields) : params.fields;
    const result = await feishuPost(
      "bitable.appTableRecord.create",
      `/open-apis/bitable/v1/apps/${String(params.app_token)}/tables/${String(params.table_id)}/records`,
      { fields },
      {
        userId,
        params: {
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
        },
      },
    );
    return result.data;
  }

  private async updateRecord(params: Record<string, unknown>, userId?: string) {
    const fields = typeof params.fields === "string" ? JSON.parse(params.fields) : params.fields;
    const result = await feishuPatch(
      "bitable.appTableRecord.update",
      `/open-apis/bitable/v1/apps/${String(params.app_token)}/tables/${String(params.table_id)}/records/${String(params.record_id)}`,
      { fields },
      { userId },
    );
    return result.data;
  }

  private async deleteRecord(params: Record<string, unknown>, userId?: string) {
    const result = await feishuDelete(
      "bitable.appTableRecord.delete",
      `/open-apis/bitable/v1/apps/${String(params.app_token)}/tables/${String(params.table_id)}/records/${String(params.record_id)}`,
      { userId },
    );
    return result.data;
  }
}

export function registerBitableTools(
  tools: BitableTools,
  registerTool: (
    toolDef: (typeof BITABLE_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  BITABLE_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) => tools.execute(toolDef.name, args, userId));
  });
}
