/**
 * sheets.ts — 飞书电子表格工具 (Dual-Auth)
 */

import { feishuGet, feishuPost } from "../identity/feishu-api.js";

export const SHEETS_TOOL_DEFS = [
  {
    name: "feishu_plus_sheets_get",
    description: "获取电子表格信息",
    parameters: {
      type: "object",
      properties: {
        spreadsheet_token: { type: "string", description: "电子表格 token" },
      },
      required: ["spreadsheet_token"],
    },
  },
  {
    name: "feishu_plus_sheets_create",
    description: "创建电子表格",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "表格标题" },
        folder_token: { type: "string", description: "目标文件夹 token（可选）" },
      },
      required: ["title"],
    },
  },
  {
    name: "feishu_plus_sheets_query",
    description: "查询工作表数据（读取单元格）",
    parameters: {
      type: "object",
      properties: {
        spreadsheet_token: { type: "string", description: "电子表格 token" },
        sheet_id: { type: "string", description: "工作表 ID" },
        range: { type: "string", description: "查询范围（如 A1:C10）" },
      },
      required: ["spreadsheet_token", "sheet_id"],
    },
  },
  {
    name: "feishu_plus_sheets_find",
    description: "在工作表中搜索内容",
    parameters: {
      type: "object",
      properties: {
        spreadsheet_token: { type: "string", description: "电子表格 token" },
        sheet_id: { type: "string", description: "工作表 ID" },
        find: { type: "string", description: "搜索内容" },
      },
      required: ["spreadsheet_token", "sheet_id", "find"],
    },
  },
  {
    name: "feishu_plus_sheets_list",
    description: "列出电子表格中的工作表",
    parameters: {
      type: "object",
      properties: {
        spreadsheet_token: { type: "string", description: "电子表格 token" },
      },
      required: ["spreadsheet_token"],
    },
  },
];

export class SheetsTools {
  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_sheets_get":
        return this.getSpreadsheet(params, userId);
      case "feishu_plus_sheets_create":
        return this.createSpreadsheet(params, userId);
      case "feishu_plus_sheets_query":
        return this.querySheet(params, userId);
      case "feishu_plus_sheets_find":
        return this.findInSheet(params, userId);
      case "feishu_plus_sheets_list":
        return this.listSheets(params, userId);
      default:
        throw new Error(`Unknown sheets tool: ${toolName}`);
    }
  }

  private async getSpreadsheet(params: Record<string, unknown>, userId?: string) {
    const result = await feishuGet(
      "sheets.spreadsheet.get",
      `/open-apis/sheets/v3/spreadsheets/${String(params.spreadsheet_token)}`,
      { userId },
    );
    return result.data;
  }

  private async createSpreadsheet(params: Record<string, unknown>, userId?: string) {
    const result = await feishuPost(
      "sheets.spreadsheet.create",
      "/open-apis/sheets/v3/spreadsheets",
      {
        title: String(params.title),
        folder_token: params.folder_token ? String(params.folder_token) : undefined,
      },
      { userId },
    );
    return result.data;
  }

  private async querySheet(params: Record<string, unknown>, userId?: string) {
    const range = params.range ? String(params.range) : `${String(params.sheet_id)}!A1:Z1000`;
    const result = await feishuGet(
      "sheets.spreadsheet.query",
      `/open-apis/sheets/v2/spreadsheets/${String(params.spreadsheet_token)}/values/${encodeURIComponent(range)}`,
      { userId },
    );
    return result.data;
  }

  private async findInSheet(params: Record<string, unknown>, userId?: string) {
    const range = `${String(params.sheet_id)}!A1:Z1000`;
    const result = await feishuPost(
      "sheets.spreadsheet.find",
      `/open-apis/sheets/v2/spreadsheets/${String(params.spreadsheet_token)}/find`,
      {
        find_condition: { range },
        find: String(params.find),
      },
      { userId },
    );
    return result.data;
  }

  private async listSheets(params: Record<string, unknown>, userId?: string) {
    const result = await feishuGet(
      "sheets.spreadsheet.listSheets",
      `/open-apis/sheets/v3/spreadsheets/${String(params.spreadsheet_token)}/sheets/query`,
      { userId },
    );
    return result.data;
  }
}

export function registerSheetsTools(
  tools: SheetsTools,
  registerTool: (
    toolDef: (typeof SHEETS_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  SHEETS_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) => tools.execute(toolDef.name, args, userId));
  });
}
