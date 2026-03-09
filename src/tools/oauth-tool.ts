/**
 * oauth-tool.ts — 用户授权管理工具
 *
 * 供用户手动触发授权、查看授权状态、撤销授权
 */

import { buildAuthorizationUrl } from "../core/oauth.js";
import type { ITokenStore } from "../core/token-store.js";
import type { PluginConfig } from "../core/config-schema.js";

// ─── 工具定义 ───

export const OAUTH_TOOL_DEFS = [
  {
    name: "feishu_auth_status",
    description: "查看当前用户的飞书授权状态",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "feishu_auth_authorize",
    description: "触发飞书用户授权流程",
    parameters: {
      type: "object",
      properties: {
        scopes: {
          type: "array",
          items: { type: "string" },
          description: "要申请的权限范围（可选，默认申请常用权限）",
        },
      },
    },
  },
  {
    name: "feishu_auth_revoke",
    description: "撤销当前用户的飞书授权",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

// ─── 工具执行器类 ───

export class OAuthTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_auth_status":
        return this.getStatus(params, userId);

      case "feishu_auth_authorize":
        return this.authorize(params);

      case "feishu_auth_revoke":
        return this.revoke(params, userId);

      default:
        throw new Error(`Unknown oauth tool: ${toolName}`);
    }
  }

  private async getStatus(_params: Record<string, unknown>, userId?: string) {
    if (!userId) {
      return { authorized: false, reason: "no_user_context" };
    }
    const stored = await this.tokenStore.get(this.config.appId, userId);
    if (!stored) {
      return { authorized: false, reason: "not_authorized" };
    }
    return {
      authorized: true,
      scopes: stored.scopes,
      expiresAt: new Date(stored.expiresAt).toISOString(),
      refreshExpiresAt: new Date(stored.refreshExpiresAt).toISOString(),
    };
  }

  private async authorize(params: Record<string, unknown>) {
    const scopes = (params.scopes as string[]) ?? [
      "docx:document",
      "drive:drive",
      "calendar:calendar",
      "task:task",
      "wiki:wiki",
      "bitable:bitable",
      "im:message",
      "im:chat:readonly",
    ];

    // TODO: 实际实现中应使用 Device Flow 或回调方式
    // 这里先返回授权链接供用户点击
    const authUrl = buildAuthorizationUrl(
      this.config,
      "https://open.feishu.cn/oauth/callback", // TODO: 配置实际回调地址
      scopes,
    );

    return {
      action: "authorize",
      url: authUrl.url,
      state: authUrl.state,
      scopes,
      message: "请点击链接完成授权",
    };
  }

  private async revoke(_params: Record<string, unknown>, userId?: string) {
    if (!userId) {
      return { success: false, reason: "no_user_context" };
    }
    await this.tokenStore.delete(this.config.appId, userId);
    return { success: true, message: "授权已撤销" };
  }
}

// ─── 注册辅助函数（用于 index.ts 统一注册） ───

/**
 * 注册 OAuth 工具到 OpenClaw
 */
export function registerOAuthTools(
  tools: OAuthTools,
  registerTool: (toolDef: typeof OAUTH_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  OAUTH_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
