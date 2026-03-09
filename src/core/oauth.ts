/**
 * oauth.ts — OAuth Authorization Code Flow 实现
 *
 * 飞书 OAuth 2.0 授权流程（Authorization Code Grant）：
 * 1. 生成授权链接
 * 2. 用户在浏览器/飞书中完成授权
 * 3. 回调获取授权码
 * 4. 用授权码换取 user_access_token + refresh_token
 * 5. 存入 TokenStore
 *
 * 参考：https://open.feishu.cn/document/common-capabilities/sso/api/get-access_token
 */

import type { PluginConfig } from "./config-schema.js";

// ─── 类型定义 ───

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  /** access_token 有效期（秒） */
  expiresIn: number;
  /** refresh_token 有效期（秒） */
  refreshExpiresIn: number;
  /** 授权的 scope 列表 */
  scopes: string[];
  /** 用户 open_id */
  openId: string;
  /** 用户 union_id */
  unionId?: string;
  /** 用户名 */
  name?: string;
}

export interface AuthorizationUrl {
  /** 授权链接 */
  url: string;
  /** 授权 state（防 CSRF） */
  state: string;
}

// ─── 构建授权链接 ───

/**
 * 生成飞书 OAuth 授权链接
 *
 * 使用 Authorization Code Flow：
 * 用户点击后在飞书中完成授权，回调后通过 code 换取 token
 */
export function buildAuthorizationUrl(
  config: PluginConfig,
  redirectUri: string,
  scopes: string[],
  state?: string,
): AuthorizationUrl {
  const authState = state ?? generateState();
  const domain = config.domain === "lark" ? "lark" : "feishu";
  const scopeStr = scopes.join(" ");

  const url = new URL(`https://open.${domain}.cn/open-apis/authen/v1/authorize`);
  url.searchParams.set("app_id", config.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopeStr);
  url.searchParams.set("state", authState);

  return { url: url.toString(), state: authState };
}

// ─── 用授权码换取 token ───

/**
 * 使用授权码（code）换取 user_access_token
 *
 * Authorization Code Flow 的第二步：用回调中的 code 换取 token
 */
export async function exchangeCodeForToken(
  config: PluginConfig,
  code: string,
): Promise<OAuthTokenResponse> {
  const domain = config.domain === "lark" ? "lark" : "feishu";

  const resp = await fetch(
    `https://open.${domain}.cn/open-apis/authen/v1/oidc/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getAppAccessToken(config)}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
      }),
    },
  );

  const data = await resp.json() as {
    code: number;
    msg: string;
    data: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      refresh_expires_in: number;
      scope: string;
      open_id: string;
      union_id?: string;
      name?: string;
    };
  };

  if (data.code !== 0) {
    throw new Error(`OAuth token exchange failed: [${data.code}] ${data.msg}`);
  }

  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresIn: data.data.expires_in,
    refreshExpiresIn: data.data.refresh_expires_in,
    scopes: data.data.scope ? data.data.scope.split(" ") : [],
    openId: data.data.open_id,
    unionId: data.data.union_id,
    name: data.data.name,
  };
}

// ─── 刷新 token ───

/**
 * 使用 refresh_token 刷新 user_access_token
 */
export async function refreshUserAccessToken(
  config: PluginConfig,
  refreshToken: string,
): Promise<OAuthTokenResponse> {
  const domain = config.domain === "lark" ? "lark" : "feishu";

  const resp = await fetch(
    `https://open.${domain}.cn/open-apis/authen/v1/oidc/refresh_access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getAppAccessToken(config)}`,
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
  );

  const data = await resp.json() as {
    code: number;
    msg: string;
    data: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      refresh_expires_in: number;
      scope: string;
      open_id: string;
      union_id?: string;
      name?: string;
    };
  };

  if (data.code !== 0) {
    throw new Error(`OAuth token refresh failed: [${data.code}] ${data.msg}`);
  }

  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresIn: data.data.expires_in,
    refreshExpiresIn: data.data.refresh_expires_in,
    scopes: data.data.scope ? data.data.scope.split(" ") : [],
    openId: data.data.open_id,
    unionId: data.data.union_id,
    name: data.data.name,
  };
}

// ─── 内部辅助 ───

/**
 * 获取 app_access_token（用于 OAuth 接口的 Authorization header）
 */
async function getAppAccessToken(config: PluginConfig): Promise<string> {
  const domain = config.domain === "lark" ? "lark" : "feishu";

  const resp = await fetch(
    `https://open.${domain}.cn/open-apis/auth/v3/app_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret,
      }),
    },
  );

  const data = await resp.json() as {
    code: number;
    msg: string;
    app_access_token: string;
  };

  if (data.code !== 0) {
    throw new Error(`Failed to get app_access_token: [${data.code}] ${data.msg}`);
  }

  return data.app_access_token;
}

function generateState(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
