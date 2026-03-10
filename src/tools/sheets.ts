/**
 * sheets.ts — 飞书电子表格工具 (Lark SDK)
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

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
      case "feishu_plus_sheets_get":
        return this.getSpreadsheet(params);
      case "feishu_plus_sheets_create":
        return this.createSpreadsheet(params);
      case "feishu_plus_sheets_query":
        return this.querySheet(params);
      case "feishu_plus_sheets_find":
        return this.findInSheet(params);
      case "feishu_plus_sheets_list":
        return this.listSheets(params);
      default:
        throw new Error(`Unknown sheets tool: ${toolName}`);
    }
  }

  private async getSpreadsheet(params: Record<string, unknown>) {
    return this.client.sheets.v3.spreadsheet.get({
      path: { spreadsheet_token: String(params.spreadsheet_token) },
    });
  }

  private async createSpreadsheet(params: Record<string, unknown>) {
    return this.client.sheets.v3.spreadsheet.create({
      data: {
        title: String(params.title),
        folder_token: params.folder_token ? String(params.folder_token) : undefined,
      },
    });
  }

  private async querySheet(params: Record<string, unknown>) {
    return this.client.sheets.v3.spreadsheetSheet.get({
      path: {
        spreadsheet_token: String(params.spreadsheet_token),
        sheet_id: String(params.sheet_id),
      },
    });
  }

  private async findInSheet(params: Record<string, unknown>) {
    return this.client.sheets.v3.spreadsheetSheet.find({
      path: {
        spreadsheet_token: String(params.spreadsheet_token),
        sheet_id: String(params.sheet_id),
      },
      data: {
        find_condition: {
          range: params.range ? String(params.range) : `${params.sheet_id}`,
        },
        find: String(params.find),
      },
    });
  }

  private async listSheets(params: Record<string, unknown>) {
    return this.client.sheets.v3.spreadsheetSheet.get({
      path: {
        spreadsheet_token: String(params.spreadsheet_token),
        sheet_id: "",
      },
    });
  }
}

export function registerSheetsTools(
  tools: SheetsTools,
  registerTool: (toolDef: typeof SHEETS_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  SHEETS_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
