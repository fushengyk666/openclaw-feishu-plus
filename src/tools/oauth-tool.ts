/**
 * oauth-tool.ts — 用户授权管理工具
 *
 * 供用户手动触发授权、查看授权状态、撤销授权
 *
 * 注意：完整的 OAuth 流程需要：
 * 1. 调用 authorize 获取授权链接
 * 2. 用户在浏览器中完成授权，回调到 redirectUri
 * 3. 插件接收回调（需要 HTTP 端点或手动输入 code）
 * 4. 调用 callback 处理授权码，换取并存储 token
 */

import { buildAuthorizationUrl, exchangeCodeForToken } from "../core/oauth.js";
import type { ITokenStore } from "../core/token-store.js";
import type { PluginConfig } from "../core/config-schema.js";

// ─── 工具定义 ───

export const OAUTH_TOOL_DEFS = [
  {
    name: "feishu_plus_auth_status",
    description: "查看当前用户的飞书授权状态",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "feishu_plus_auth_authorize",
    description: "触发飞书用户授权流程，返回授权链接",
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
    name: "feishu_plus_auth_callback",
    description: "处理 OAuth 回调，使用授权码换取并存储 token（用于手动输入授权码的场景）",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "从飞书授权回调中获取的授权码",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "feishu_plus_auth_revoke",
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
      case "feishu_plus_auth_status":
        return this.getStatus(params, userId);

      case "feishu_plus_auth_authorize":
        return this.authorize(params);

      case "feishu_plus_auth_callback":
        return this.handleCallback(params);

      case "feishu_plus_auth_revoke":
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

    // 使用配置中的 redirectUri
    const redirectUri = this.config.auth.redirectUri;

    const authUrl = buildAuthorizationUrl(
      this.config,
      redirectUri,
      scopes,
    );

    return {
      action: "authorize",
      url: authUrl.url,
      state: authUrl.state,
      scopes,
      redirectUri,
      message: "请点击链接完成授权，授权后将获得授权码",
      nextStep: "授权完成后，使用 feishu_auth_callback 工具传入授权码",
    };
  }

  private async handleCallback(params: Record<string, unknown>) {
    const code = params.code as string;

    if (!code) {
      return {
        success: false,
        error: "missing_code",
        message: "缺少授权码",
      };
    }

    try {
      const tokenResponse = await exchangeCodeForToken(this.config, code);

      // 存储到 token store
      const storedToken = {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt: Date.now() + tokenResponse.expiresIn * 1000,
        refreshExpiresAt: Date.now() + tokenResponse.refreshExpiresIn * 1000,
        scopes: tokenResponse.scopes,
        userOpenId: tokenResponse.openId,
        userUnionId: tokenResponse.unionId,
        updatedAt: Date.now(),
      };

      await this.tokenStore.set(this.config.appId, tokenResponse.openId, storedToken);

      return {
        success: true,
        message: "授权成功",
        openId: tokenResponse.openId,
        name: tokenResponse.name,
        scopes: tokenResponse.scopes,
      };
    } catch (err) {
      return {
        success: false,
        error: "token_exchange_failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
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
