/**
 * token-resolver.ts — Token-first Identity Resolver
 *
 * 这是整个插件的核心决策引擎。
 *
 * 职责：根据 API Policy + 当前用户授权状态 + 身份模式，决定本次请求使用哪个 Token。
 *
 * 决策逻辑：
 * 1. 查询 operation 的 API policy
 * 2. policy = tenant_only → 用 tenant token
 * 3. policy = user_only  → 用 user token；没有则抛出需要授权的错误
 * 4. policy = both:
 *    4.1 identityMode = "user" → 强制用 user token（没有则抛错）
 *    4.2 identityMode = "app"  → 强制用 tenant token
 *    4.3 identityMode = "auto" (默认) → 默认 tenant token（应用身份）
 *
 * 可观测性：每次决策输出 identity selection log，记录选择原因。
 */

import { getApiPolicy, getRequiredScopes } from "./api-policy.js";
import type { ITokenStore, StoredUserToken } from "./token-store.js";
import { isTokenExpired, isRefreshTokenExpired, hasRequiredScopes } from "./token-store.js";
import { getTenantAccessToken } from "./client.js";
import { refreshUserAccessToken } from "./oauth.js";
import type { PluginConfig } from "./config-schema.js";

// ─── 类型定义 ───

export type TokenKind = "tenant" | "user";

/**
 * 身份模式：
 * - "auto" — 默认应用身份；仅当策略为 user_only 时走用户身份
 * - "user" — 强制走用户身份（both/user_only 场景生效）
 * - "app"  — 强制走应用身份（both/tenant_only 场景生效）
 */
export type IdentityMode = "auto" | "user" | "app";

export interface ResolveTokenInput {
  /** API operation 标识，如 "docx.document.create" */
  operation: string;
  /** 当前用户的 openId（可选，无则只能用 tenant） */
  userId?: string;
  /** 身份模式覆盖（可选，默认 auto） */
  identityMode?: IdentityMode;
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

// ─── Identity Selection Log ───

export interface IdentitySelectionLog {
  operation: string;
  policy: string;
  identityMode: IdentityMode;
  selectedKind: TokenKind;
  reason: string;
  userId?: string;
  timestamp: number;
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
    const identityMode = input.identityMode ?? "auto";

    // ── tenant_only: 直接用应用 token ──
    if (policy.support === "tenant_only") {
      if (identityMode === "user") {
        // 用户显式要求 user 身份，但 API 不支持
        this.logSelection({
          operation: input.operation,
          policy: policy.support,
          identityMode,
          selectedKind: "tenant",
          reason: "API is tenant_only, ignoring user identity_mode override",
          userId: input.userId,
        });
      } else {
        this.logSelection({
          operation: input.operation,
          policy: policy.support,
          identityMode,
          selectedKind: "tenant",
          reason: "API is tenant_only → tenant token",
          userId: input.userId,
        });
      }
      return {
        kind: "tenant",
        accessToken: await this.getTenantToken(),
      };
    }

    // ── user_only: 必须有用户 token ──
    if (policy.support === "user_only") {
      if (identityMode === "app") {
        // 用户显式要求 app 身份，但 API 只支持 user
        this.logSelection({
          operation: input.operation,
          policy: policy.support,
          identityMode,
          selectedKind: "user",
          reason: "API is user_only, ignoring app identity_mode override",
          userId: input.userId,
        });
      }
      return this.resolveUserOnly(input, identityMode);
    }

    // ── both: 按策略选择 ──
    return this.resolveBoth(input, identityMode);
  }

  /**
   * 使指定类型的 token 失效
   */
  async invalidate(kind: TokenKind, userId?: string): Promise<void> {
    if (kind === "user" && userId) {
      await this.tokenStore.delete(this.config.appId, userId);
    }
  }

  /**
   * 处理 user_only 接口
   */
  private async resolveUserOnly(
    input: ResolveTokenInput,
    identityMode: IdentityMode,
  ): Promise<ResolveTokenResult> {
    if (!input.userId) {
      this.logSelection({
        operation: input.operation,
        policy: "user_only",
        identityMode,
        selectedKind: "user",
        reason: "user_only API but no userId → need authorization",
        userId: input.userId,
      });
      throw new NeedUserAuthorizationError(
        input.operation,
        getRequiredScopes(input.operation, "user")
      );
    }

    const userToken = await this.getValidUserToken(input.userId, input.operation);
    if (!userToken) {
      this.logSelection({
        operation: input.operation,
        policy: "user_only",
        identityMode,
        selectedKind: "user",
        reason: "user_only API but no valid user token → need authorization",
        userId: input.userId,
      });
      throw new NeedUserAuthorizationError(
        input.operation,
        getRequiredScopes(input.operation, "user")
      );
    }

    this.logSelection({
      operation: input.operation,
      policy: "user_only",
      identityMode,
      selectedKind: "user",
      reason: "user_only API → user token",
      userId: input.userId,
    });
    return {
      kind: "user",
      accessToken: userToken,
    };
  }

  /**
   * 处理 both 接口：基于 identityMode 决策
   *
   * 新策略（v2）：
   * - auto（默认）→ 默认应用身份（tenant token）
   * - user → 强制用户身份（没有则报错）
   * - app  → 强制应用身份
   */
  private async resolveBoth(
    input: ResolveTokenInput,
    identityMode: IdentityMode,
  ): Promise<ResolveTokenResult> {

    // ── 显式 user 模式 ──
    if (identityMode === "user") {
      if (!input.userId) {
        this.logSelection({
          operation: input.operation,
          policy: "both",
          identityMode,
          selectedKind: "user",
          reason: "identity_mode=user but no userId → need authorization",
          userId: input.userId,
        });
        throw new NeedUserAuthorizationError(
          input.operation,
          getRequiredScopes(input.operation, "user")
        );
      }

      const userToken = await this.getValidUserToken(input.userId, input.operation);
      if (!userToken) {
        this.logSelection({
          operation: input.operation,
          policy: "both",
          identityMode,
          selectedKind: "user",
          reason: "identity_mode=user but no valid user token → need authorization",
          userId: input.userId,
        });
        throw new NeedUserAuthorizationError(
          input.operation,
          getRequiredScopes(input.operation, "user")
        );
      }

      this.logSelection({
        operation: input.operation,
        policy: "both",
        identityMode,
        selectedKind: "user",
        reason: "identity_mode=user → user token (explicit override)",
        userId: input.userId,
      });
      return {
        kind: "user",
        accessToken: userToken,
      };
    }

    // ── 显式 app 模式 或 auto 模式 → 默认应用身份 ──
    this.logSelection({
      operation: input.operation,
      policy: "both",
      identityMode,
      selectedKind: "tenant",
      reason: identityMode === "app"
        ? "identity_mode=app → tenant token (explicit override)"
        : "identity_mode=auto, both-capable API → tenant token (default)",
      userId: input.userId,
    });

    return {
      kind: "tenant",
      accessToken: await this.getTenantToken(),
    };
  }

  /**
   * 获取有效的 user access token
   */
  private async getValidUserToken(
    userId: string,
    operation: string
  ): Promise<string | null> {
    const stored = await this.tokenStore.get(this.config.appId, userId);
    if (!stored) return null;

    const requiredScopes = getRequiredScopes(operation, "user");
    if (!hasRequiredScopes(stored, requiredScopes)) {
      return null;
    }

    if (!isTokenExpired(stored)) {
      return stored.accessToken;
    }

    if (!isRefreshTokenExpired(stored)) {
      return this.tryRefreshUserToken(userId, stored);
    }

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

  /**
   * 身份选择日志（可观测性）
   */
  private logSelection(log: Omit<IdentitySelectionLog, "timestamp">): void {
    const entry: IdentitySelectionLog = {
      ...log,
      timestamp: Date.now(),
    };
    // 使用结构化日志输出，便于排查
    console.log(
      `[IdentityRouter] ${entry.operation}: ${entry.selectedKind} ` +
      `(policy=${entry.policy}, mode=${entry.identityMode}` +
      `${entry.userId ? `, user=${entry.userId.slice(0, 10)}…` : ""}) — ${entry.reason}`
    );
  }
}
