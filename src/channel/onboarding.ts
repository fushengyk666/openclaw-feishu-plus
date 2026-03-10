/**
 * onboarding.ts — 配对引导
 *
 * 负责首次使用时的引导流程：
 * - 验证 appId / appSecret 有效性
 * - 检查应用权限配置
 * - 引导用户完成必要设置
 */

import { getLarkClient, getTenantAccessToken } from "../core/client.js";
import type { PluginConfig } from "../core/config-schema.js";

export interface OnboardingResult {
  success: boolean;
  appName?: string;
  botName?: string;
  errors: string[];
  warnings: string[];
}

interface BotInfoResponse {
  code: number;
  msg: string;
  bot: {
    app_name: string;
    bot_name: string;
    app_id: string;
  };
}

/**
 * 执行配对引导检查
 */
export async function runOnboarding(
  config: PluginConfig,
): Promise<OnboardingResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let appName: string | undefined;
  let botName: string | undefined;

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
  if (errors.length === 0) {
    try {
      const client = getLarkClient(config);
      const token = await getTenantAccessToken(config);

      // 调用 /open-apis/bot/v3/info 获取机器人信息
      const resp = await fetch(
        `https://open.${config.domain}.cn/open-apis/bot/v3/info`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        }
      );

      if (!resp.ok) {
        warnings.push(`无法获取机器人信息: HTTP ${resp.status}`);
      } else {
        const data: unknown = await resp.json();
        const botData = data as BotInfoResponse;
        if (botData.code === 0) {
          appName = botData.bot.app_name;
          botName = botData.bot.bot_name;
          console.log(`[Onboarding] 应用名称: ${appName}, 机器人名称: ${botName}`);
        } else {
          warnings.push(`获取机器人信息失败: [${botData.code}] ${botData.msg}`);
        }
      }
    } catch (err) {
      warnings.push(`检查应用信息时出错: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. 检查 WebSocket / Webhook 配置
  if (config.connectionMode === "websocket") {
    console.log("[Onboarding] WebSocket 模式：将建立长连接接收消息");
    console.log("[Onboarding] 注意：WebSocket 模式需要在飞书开放平台开启事件订阅");
  } else {
    console.log("[Onboarding] Webhook 模式：需要配置公开可访问的 HTTP 端点");
    console.log("[Onboarding] 需要将 webhook URL 配置到飞书开放平台的事件订阅中");
    warnings.push("Webhook 模式需要配置公开可访问的 HTTP 端点，并更新到飞书开放平台");
  }

  return {
    success: errors.length === 0,
    appName,
    botName,
    errors,
    warnings,
  };
}
