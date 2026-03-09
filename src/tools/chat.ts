/**
 * chat.ts — 飞书群聊工具（骨架实现）
 *
 * TODO: 实现 Chat/IM 相关 API 调用
 * 当前：仅作为骨架，不在 index.ts 中注册
 */

import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义（骨架） ───

export const CHAT_TOOL_DEFS = [
  {
    name: "feishu_chat_list",
    description: "列出群聊（骨架）",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "feishu_chat_send_message",
    description: "发送消息（骨架）",
    parameters: {
      type: "object",
      properties: {
        chat_id: { type: "string" },
        content: { type: "string" },
      },
      required: ["chat_id", "content"],
    },
  },
];

// ─── 工具执行器类（骨架） ───

export class ChatTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, _params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "feishu_chat_list":
      case "feishu_chat_send_message":
        throw new Error(`Chat tool "${toolName}" is not yet implemented. Please remove chat from config.tools.chat to disable.`);

      default:
        throw new Error(`Unknown chat tool: ${toolName}`);
    }
  }
}

// ─── 注册辅助函数 ───

export function registerChatTools(
  tools: ChatTools,
  registerTool: (toolDef: typeof CHAT_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  CHAT_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
