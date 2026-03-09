/**
 * bitable.ts — 飞书多维表格工具（骨架实现）
 *
 * TODO: 实现 Bitable 相关 API 调用
 * 当前：仅作为骨架，不在 index.ts 中注册
 */

import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义（骨架） ───

export const BITABLE_TOOL_DEFS = [
  {
    name: "feishu_bitable_get",
    description: "获取多维表格信息（骨架）",
    parameters: {
      type: "object",
      properties: {
        app_token: { type: "string" },
      },
      required: ["app_token"],
    },
  },
  {
    name: "feishu_bitable_list_records",
    description: "列出记录（骨架）",
    parameters: {
      type: "object",
      properties: {
        app_token: { type: "string" },
        table_id: { type: "string" },
      },
      required: ["app_token", "table_id"],
    },
  },
];

// ─── 工具执行器类（骨架） ───

export class BitableTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, _params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "feishu_bitable_get":
      case "feishu_bitable_list_records":
        throw new Error(`Bitable tool "${toolName}" is not yet implemented. Please remove bitable from config.tools.bitable to disable.`);

      default:
        throw new Error(`Unknown bitable tool: ${toolName}`);
    }
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
