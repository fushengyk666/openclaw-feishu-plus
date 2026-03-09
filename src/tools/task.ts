/**
 * task.ts — 飞书任务工具（骨架实现）
 *
 * TODO: 实现 Task 相关 API 调用
 * 当前：仅作为骨架，不在 index.ts 中注册
 */

import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义（骨架） ───

export const TASK_TOOL_DEFS = [
  {
    name: "feishu_task_get",
    description: "获取任务详情（骨架）",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "feishu_task_list",
    description: "列出任务（骨架）",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

// ─── 工具执行器类（骨架） ───

export class TaskTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, _params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "feishu_task_get":
      case "feishu_task_list":
        throw new Error(`Task tool "${toolName}" is not yet implemented. Please remove task from config.tools.task to disable.`);

      default:
        throw new Error(`Unknown task tool: ${toolName}`);
    }
  }
}

// ─── 注册辅助函数 ───

export function registerTaskTools(
  tools: TaskTools,
  registerTool: (toolDef: typeof TASK_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  TASK_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
