/**
 * perm.ts — 飞书权限管理工具（骨架实现）
 *
 * TODO: 实现 Permission 相关 API 调用
 * 当前：仅作为骨架，不在 index.ts 中注册
 */

import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义（骨架） ───

export const PERM_TOOL_DEFS = [
  {
    name: "feishu_perm_list",
    description: "列出权限（骨架）",
    parameters: {
      type: "object",
      properties: {
        token: { type: "string" },
      },
      required: ["token"],
    },
  },
  {
    name: "feishu_perm_update",
    description: "更新权限（骨架）",
    parameters: {
      type: "object",
      properties: {
        token: { type: "string" },
      },
      required: ["token"],
    },
  },
];

// ─── 工具执行器类（骨架） ───

export class PermTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, _params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "feishu_perm_list":
      case "feishu_perm_update":
        throw new Error(`Perm tool "${toolName}" is not yet implemented. Please remove perm from config.tools.perm to disable.`);

      default:
        throw new Error(`Unknown perm tool: ${toolName}`);
    }
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
