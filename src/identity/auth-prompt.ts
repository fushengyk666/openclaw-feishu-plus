/**
 * auth-prompt.ts — 用户授权提示生成
 *
 * 当接口需要用户授权但当前没有有效 user_access_token 时，
 * 生成友好的提示消息引导用户完成授权。
 *
 * 对标飞书官方插件的授权提示体验。
 */

import { buildAuthorizationUrl } from "./oauth.js";
import type { PluginConfig } from "./config-schema.js";

export interface AuthPromptResult {
  /** 提示消息文本 */
  message: string;
  /** 授权链接（可选，嵌入消息中） */
  authUrl?: string;
  /** 所需 scopes */
  requiredScopes: string[];
  /** 触发操作名称 */
  operation: string;
}

/**
 * 生成用户授权提示
 *
 * 第一阶段策略：
 * - 生成授权链接 + 提示文案
 * - 不做授权后自动恢复
 * - 用户完成授权后需手动重试
 */
export function generateAuthPrompt(params: {
  config: PluginConfig;
  operation: string;
  requiredScopes: string[];
  redirectUri?: string;
}): AuthPromptResult {
  const { config, operation, requiredScopes, redirectUri } = params;

  const effectiveRedirectUri =
    redirectUri ?? config.auth.redirectUri ?? "https://open.feishu.cn/oauth/callback";

  const { url } = buildAuthorizationUrl(
    config,
    effectiveRedirectUri,
    requiredScopes,
  );

  const scopeList = requiredScopes.length > 0
    ? `\n需要的权限: ${requiredScopes.join(", ")}`
    : "";

  const message =
    `此操作 (${operation}) 需要用户授权才能执行。${scopeList}\n\n` +
    `请点击以下链接完成授权，授权后重试操作：\n${url}`;

  return {
    message,
    authUrl: url,
    requiredScopes,
    operation,
  };
}
