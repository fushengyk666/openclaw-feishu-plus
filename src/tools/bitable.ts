/**
 * bitable.ts — 飞书多维表格工具 (Dual-Auth)
 *
 * 所有 API 调用经 platform 层封装，最终仍通过 identity/feishu-api 执行（双授权）。
 */

import {
  getBitableApp,
  listBitableTables,
  listBitableRecords,
  createBitableRecord,
  updateBitableRecord,
  deleteBitableRecord,
} from "../platform/bitable/index.js";
import { IDENTITY_MODE_SCHEMA, parseIdentityMode } from "./identity-mode.js";
import type { IdentityMode } from "../identity/feishu-api.js";

export const BITABLE_TOOL_DEFS = [
  {
    name: "feishu_plus_bitable_get_app",
    description: "获取多维表格应用信息",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
    const identityMode = parseIdentityMode(params.identity_mode);
    switch (toolName) {
      case "feishu_plus_bitable_get_app":
        return this.getApp(params, userId, identityMode);
      case "feishu_plus_bitable_list_tables":
        return this.listTables(params, userId, identityMode);
      case "feishu_plus_bitable_list_records":
        return this.listRecords(params, userId, identityMode);
      case "feishu_plus_bitable_create_record":
        return this.createRecord(params, userId, identityMode);
      case "feishu_plus_bitable_update_record":
        return this.updateRecord(params, userId, identityMode);
      case "feishu_plus_bitable_delete_record":
        return this.deleteRecord(params, userId, identityMode);
      default:
        throw new Error(`Unknown bitable tool: ${toolName}`);
    }
  }

  private async getApp(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await getBitableApp({
      appToken: String(params.app_token),
      userId,
      identityMode,
    });
  }

  private async listTables(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await listBitableTables({
      appToken: String(params.app_token),
      userId,
      identityMode,
    });
  }

  private async listRecords(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await listBitableRecords({
      appToken: String(params.app_token),
      tableId: String(params.table_id),
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      viewId: params.view_id ? String(params.view_id) : undefined,
      fieldIds: params.field_ids ? String(params.field_ids) : undefined,
      sort: params.sort ? String(params.sort) : undefined,
      filter: params.filter ? String(params.filter) : undefined,
      userId,
      identityMode,
    });
  }

  private async createRecord(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    const fields = typeof params.fields === "string" ? JSON.parse(params.fields) : params.fields;
    return await createBitableRecord({
      appToken: String(params.app_token),
      tableId: String(params.table_id),
      fields,
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
  }

  private async updateRecord(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    const fields = typeof params.fields === "string" ? JSON.parse(params.fields) : params.fields;
    return await updateBitableRecord({
      appToken: String(params.app_token),
      tableId: String(params.table_id),
      recordId: String(params.record_id),
      fields,
      userId,
      identityMode,
    });
  }

  private async deleteRecord(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await deleteBitableRecord({
      appToken: String(params.app_token),
      tableId: String(params.table_id),
      recordId: String(params.record_id),
      userId,
      identityMode,
    });
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
