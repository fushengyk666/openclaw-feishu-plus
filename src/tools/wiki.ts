/**
 * wiki.ts — 飞书 Wiki 知识库工具（骨架实现）
 *
 * TODO: 实现 Wiki 相关 API 调用
 * 当前：仅作为骨架，不在 index.ts 中注册
 */

import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义（骨架） ───

export const WIKI_TOOL_DEFS = [
  {
    name: "feishu_wiki_list_spaces",
    description: "列出知识库空间（骨架）",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "feishu_wiki_get_node",
    description: "获取知识库节点信息（骨架）",
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

export class WikiTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, _params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "feishu_wiki_list_spaces":
      case "feishu_wiki_get_node":
        throw new Error(`Wiki tool "${toolName}" is not yet implemented. Please remove wiki from config.tools.wiki to disable.`);

      default:
        throw new Error(`Unknown wiki tool: ${toolName}`);
    }
  }
}

// ─── 注册辅助函数 ───

export function registerWikiTools(
  tools: WikiTools,
  registerTool: (toolDef: typeof WIKI_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  WIKI_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
