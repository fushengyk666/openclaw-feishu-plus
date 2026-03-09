/**
 * drive.ts — 飞书云盘工具（骨架实现）
 *
 * TODO: 实现 Drive 相关 API 调用
 * 当前：仅作为骨架，不在 index.ts 中注册
 */

import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义（骨架） ───

export const DRIVE_TOOL_DEFS = [
  {
    name: "feishu_drive_list_files",
    description: "列出云盘文件（骨架）",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "feishu_drive_upload_file",
    description: "上传文件（骨架）",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

// ─── 工具执行器类（骨架） ───

export class DriveTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, _params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "feishu_drive_list_files":
      case "feishu_drive_upload_file":
        throw new Error(`Drive tool "${toolName}" is not yet implemented. Please remove drive from config.tools.drive to disable.`);

      default:
        throw new Error(`Unknown drive tool: ${toolName}`);
    }
  }
}

// ─── 注册辅助函数 ───

export function registerDriveTools(
  tools: DriveTools,
  registerTool: (toolDef: typeof DRIVE_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  DRIVE_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
