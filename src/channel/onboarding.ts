/**
 * onboarding.ts — 配对引导
 *
 * 负责首次使用时的引导流程：
 * - 验证 appId / appSecret 有效性
 * - 检查应用权限配置
 * - 引导用户完成必要设置
 */

import { getTenantAccessToken } from "../core/client.js";
import type { PluginConfig } from "../core/config-schema.js";

export interface OnboardingResult {
  success: boolean;
  appName?: string;
  botName?: string;
  errors: string[];
  warnings: string[];
}

/**
 * 执行配对引导检查
 */
export async function runOnboarding(
  config: PluginConfig,
): Promise<OnboardingResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 验证凭证
  try {
    const token = await getTenantAccessToken(config);
    if (!token) {
      errors.push("无法获取 tenant_access_token，请检查 appId 和 appSecret");
    }
  } catch (err) {
    errors.push(`凭证验证失败: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. 检查应用信息
  // TODO: 调用 /open-apis/bot/v3/info 获取机器人信息
  // TODO: 检查应用是否已启用所需权限

  // 3. 检查 WebSocket / Webhook 配置
  if (config.connectionMode === "websocket") {
    // TODO: 验证 WebSocket 连接能力
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
  };
}
