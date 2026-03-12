/**
 * config.ts — Channel-level Config Resolution
 *
 * 统一解析 channel 配置，为 channel 内各模块提供一致的配置入口。
 * 职责：从 OpenClaw 全局 cfg 中提取 feishu-plus 相关配置。
 */

import { CONFIG_NAMESPACE } from "../constants.js";
import type { FeishuAccountConfig } from "./accounts.js";

/**
 * 从全局 cfg 中提取 feishu-plus channel section
 */
export function resolveChannelConfig(cfg: any): FeishuAccountConfig | undefined {
  return cfg?.channels?.[CONFIG_NAMESPACE];
}

/**
 * 解析 DM policy
 */
export function resolveDmPolicy(cfg: any, accountId?: string): "open" | "pairing" | "allowlist" {
  const section = resolveChannelConfig(cfg);
  if (!section) return "pairing";

  const accountOverride = accountId && section.accounts?.[accountId];
  const merged = accountOverride ? { ...section, ...accountOverride } : section;

  return (merged as any).dmPolicy ?? "pairing";
}

/**
 * 解析 group policy
 */
export function resolveGroupPolicy(cfg: any, accountId?: string): "open" | "allowlist" | "disabled" {
  const section = resolveChannelConfig(cfg);
  if (!section) return "disabled";

  const accountOverride = accountId && section.accounts?.[accountId];
  const merged = accountOverride ? { ...section, ...accountOverride } : section;

  return (merged as any).groupPolicy ?? "disabled";
}

/**
 * 解析 connection mode
 */
export function resolveConnectionMode(cfg: any, accountId?: string): "websocket" | "webhook" {
  const section = resolveChannelConfig(cfg);
  if (!section) return "websocket";

  const accountOverride = accountId && section.accounts?.[accountId];
  const merged = accountOverride ? { ...section, ...accountOverride } : section;

  return (merged as any).connectionMode ?? "websocket";
}

/**
 * 解析 auth 策略配置
 */
export function resolveAuthConfig(cfg: any): {
  preferUserToken: boolean;
  autoPromptUserAuth: boolean;
  store: string;
  redirectUri: string;
} {
  const section = resolveChannelConfig(cfg);
  const auth = (section as any)?.auth ?? {};

  return {
    preferUserToken: auth.preferUserToken ?? true,
    autoPromptUserAuth: auth.autoPromptUserAuth ?? true,
    store: auth.store ?? "file",
    redirectUri: auth.redirectUri ?? "https://open.feishu.cn/oauth/callback",
  };
}
