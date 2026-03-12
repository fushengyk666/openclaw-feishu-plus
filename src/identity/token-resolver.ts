/**
 * token-resolver.ts — Token-first Identity Resolver
 *
 * 这是整个插件的核心决策引擎。
 *
 * 职责：根据 API Policy + 当前用户授权状态，决定本次请求使用哪个 Token。
 *
 * 决策逻辑：
 * 1. 查询 operation 的 API policy
 * 2. policy = tenant_only → 用 tenant token
 * 3. policy = user_only  → 用 user token；没有则抛出需要授权的错误
 * 4. policy = both:
 *    4.1 preferUserToken=true 且有可用 user token → 用 user token
 *    4.2 否则 → 用 tenant token
 */

import { getApiPolicy, getRequiredScopes } from "./api-policy.js";
import type { ITokenStore, StoredUserToken } from "./token-store.js";
import { isTokenExpired, isRefreshTokenExpired, hasRequiredScopes } from "./token-store.js";
import { getTenantAccessToken } from "./client.js";
import { refreshUserAccessToken } from "./oauth.js";
import type { PluginConfig } from "./config-schema.js";

// ─── 类型定义 ───

export type TokenKind = "tenant" | "user";

export interface ResolveTokenInput {
  /** API operation 标识，如 "docx.document.create" */
  operation: string;
  /** 当前用户的 openId（可选，无则只能用 tenant） */
  userId?: string;
}

export interface ResolveTokenResult {
  /** 使用的 token 类型 */
  kind: TokenKind;
  /** 实际的 access_token 值 */
  accessToken: string;
}

// ─── 错误类型 ───

export class NeedUserAuthorizationError extends Error {
  public readonly code = "NEED_USER_AUTHORIZATION";
  public readonly operation: string;
  public readonly requiredScopes: string[];

  constructor(operation: string, requiredScopes: string[] = []) {
    super(
      `Operation "${operation}" requires user authorization. ` +
        (requiredScopes.length
          ? `Required scopes: ${requiredScopes.join(", ")}`
          : "Please authorize first.")
    );
    this.name = "NeedUserAuthorizationError";
    this.operation = operation;
    this.requiredScopes = requiredScopes;
  }
}

export class TokenUnavailableError extends Error {
  public readonly code = "TOKEN_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "TokenUnavailableError";
  }
}

// ─── Token Resolver ───

export class TokenResolver {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  /**
   * 解析本次请求应使用的 Token
   *
   * 这是插件的核心决策方法。
   */
  async resolve(input: ResolveTokenInput): Promise<ResolveTokenResult> {
    const policy = getApiPolicy(input.operation);

    // ── tenant_only: 直接用应用 token ──
    if (policy.support === "tenant_only") {
      return {
        kind: "tenant",
        accessToken: await this.getTenantToken(),
      };
    }

    // ── user_only: 必须有用户 token ──
    if (policy.support === "user_only") {
      return this.resolveUserOnly(input);
    }

    // ── both: 按策略选择 ──
    return this.resolveBoth(input);
  }

  /**
   * 使指定类型的 token 失效
   *
   * 在请求失败（401）后调用，强制下次 resolve 重新获取/刷新 token
   */
  async invalidate(kind: TokenKind, userId?: string): Promise<void> {
    if (kind === "user" && userId) {
      // 删除过期的 user token，下次 resolve 会触发刷新或重新授权
      await this.tokenStore.delete(this.config.appId, userId);
    }
    // tenant token 无需处理，下次 resolve 会直接重新获取
  }

  /**
   * 处理 user_only 接口
   */
  private async resolveUserOnly(
    input: ResolveTokenInput
  ): Promise<ResolveTokenResult> {
    if (!input.userId) {
      throw new NeedUserAuthorizationError(
        input.operation,
        getRequiredScopes(input.operation, "user")
      );
    }

    const userToken = await this.getValidUserToken(input.userId, input.operation);
    if (!userToken) {
      throw new NeedUserAuthorizationError(
        input.operation,
        getRequiredScopes(input.operation, "user")
      );
    }

    return {
      kind: "user",
      accessToken: userToken,
    };
  }

  /**
   * 处理 both 接口：user-if-available-else-tenant
   */
  private async resolveBoth(
    input: ResolveTokenInput
  ): Promise<ResolveTokenResult> {
    // 如果配置了优先用户 token，且有用户上下文
    if (this.config.auth.preferUserToken && input.userId) {
      const userToken = await this.getValidUserToken(
        input.userId,
        input.operation
      );
      if (userToken) {
        return {
          kind: "user",
          accessToken: userToken,
        };
      }
    }

    // 回退到 tenant token
    return {
      kind: "tenant",
      accessToken: await this.getTenantToken(),
    };
  }

  /**
   * 获取有效的 user access token
   *
   * 处理过期检查和自动刷新
   */
  private async getValidUserToken(
    userId: string,
    operation: string
  ): Promise<string | null> {
    const stored = await this.tokenStore.get(this.config.appId, userId);
    if (!stored) return null;

    // 检查 scope 是否满足
    const requiredScopes = getRequiredScopes(operation, "user");
    if (!hasRequiredScopes(stored, requiredScopes)) {
      return null; // scope 不足，不使用此 token
    }

    // token 未过期，直接返回
    if (!isTokenExpired(stored)) {
      return stored.accessToken;
    }

    // token 已过期，尝试刷新
    if (!isRefreshTokenExpired(stored)) {
      return this.tryRefreshUserToken(userId, stored);
    }

    // refresh_token 也过期了，需要重新授权
    return null;
  }

  /**
   * 尝试刷新 user token
   */
  private async tryRefreshUserToken(
    userId: string,
    stored: StoredUserToken
  ): Promise<string | null> {
    try {
      const refreshed = await refreshUserAccessToken(
        this.config,
        stored.refreshToken
      );

      const updated: StoredUserToken = {
        ...stored,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: Date.now() + refreshed.expiresIn * 1000,
        refreshExpiresAt: Date.now() + refreshed.refreshExpiresIn * 1000,
        updatedAt: Date.now(),
      };

      await this.tokenStore.set(this.config.appId, userId, updated);
      return updated.accessToken;
    } catch (err) {
      // 刷新失败，清除无效 token
      console.warn(`[TokenResolver] Failed to refresh token for ${userId}:`, err);
      await this.tokenStore.delete(this.config.appId, userId);
      return null;
    }
  }

  /**
   * 获取 tenant access token
   */
  private async getTenantToken(): Promise<string> {
    const token = await getTenantAccessToken(this.config);
    if (!token) {
      throw new TokenUnavailableError(
        "Failed to obtain tenant_access_token. Check appId/appSecret."
      );
    }
    return token;
  }
}
