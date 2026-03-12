/**
 * bitable.ts — 飞书多维表格工具 (Lark SDK)
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "../identity/config-schema.js";
import type { ITokenStore } from "../identity/token-store.js";

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
      case "feishu_plus_bitable_get_app":
        return this.getApp(params);
      case "feishu_plus_bitable_list_tables":
        return this.listTables(params);
      case "feishu_plus_bitable_list_records":
        return this.listRecords(params);
      case "feishu_plus_bitable_create_record":
        return this.createRecord(params);
      case "feishu_plus_bitable_update_record":
        return this.updateRecord(params);
      case "feishu_plus_bitable_delete_record":
        return this.deleteRecord(params);
      default:
        throw new Error(`Unknown bitable tool: ${toolName}`);
    }
  }

  private async getApp(params: Record<string, unknown>) {
    return this.client.bitable.v1.app.get({
      path: { app_token: String(params.app_token) },
    });
  }

  private async listTables(params: Record<string, unknown>) {
    return this.client.bitable.v1.appTable.list({
      path: { app_token: String(params.app_token) },
    });
  }

  private async listRecords(params: Record<string, unknown>) {
    return this.client.bitable.v1.appTableRecord.list({
      path: {
        app_token: String(params.app_token),
        table_id: String(params.table_id),
      },
      params: {
        page_size: params.page_size ? Number(params.page_size) : 20,
        page_token: params.page_token ? String(params.page_token) : undefined,
        view_id: params.view_id ? String(params.view_id) : undefined,
        filter: params.filter ? String(params.filter) : undefined,
        sort: params.sort ? String(params.sort) : undefined,
      },
    });
  }

  private async createRecord(params: Record<string, unknown>) {
    const fields = typeof params.fields === "string" ? JSON.parse(params.fields) : params.fields;
    return this.client.bitable.v1.appTableRecord.create({
      path: {
        app_token: String(params.app_token),
        table_id: String(params.table_id),
      },
      params: {
        user_id_type: params.user_id_type ? String(params.user_id_type) as any : undefined,
      },
      data: { fields },
    });
  }

  private async updateRecord(params: Record<string, unknown>) {
    const fields = typeof params.fields === "string" ? JSON.parse(params.fields) : params.fields;
    return this.client.bitable.v1.appTableRecord.update({
      path: {
        app_token: String(params.app_token),
        table_id: String(params.table_id),
        record_id: String(params.record_id),
      },
      data: { fields },
    });
  }

  private async deleteRecord(params: Record<string, unknown>) {
    return this.client.bitable.v1.appTableRecord.delete({
      path: {
        app_token: String(params.app_token),
        table_id: String(params.table_id),
        record_id: String(params.record_id),
      },
    });
  }
}

export function registerBitableTools(
  tools: BitableTools,
  registerTool: (toolDef: typeof BITABLE_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  BITABLE_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
