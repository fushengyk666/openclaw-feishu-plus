/**
 * probe.ts — Feishu Plus Connection Probe
 *
 * 测试飞书 bot 连接是否正常，用于 onboarding 和 status 检查。
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { FeishuAccountConfig } from "./accounts.js";

export interface ProbeResult {
  ok: boolean;
  error?: string;
  botName?: string;
  openId?: string;
}

/**
 * Probe Feishu bot connection by calling bot/v3/info API.
 */
export async function probeFeishuPlus(
  credentials: FeishuAccountConfig
): Promise<ProbeResult> {
  if (!credentials?.appId || !credentials?.appSecret) {
    return {
      ok: false,
      error: "missing credentials (appId, appSecret)",
    };
  }

  try {
    const client = new lark.Client({
      appId: credentials.appId,
      appSecret: credentials.appSecret,
      domain:
        credentials.domain === "lark"
          ? lark.Domain.Lark
          : lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.warn,
    });

    const response = await (client as any).bot.v3.info.get({});

    if (response.code !== 0) {
      return {
        ok: false,
        error: `Feishu API error (${response.code}): ${response.msg}`,
      };
    }

    return {
      ok: true,
      botName: response.data?.bot?.name,
      openId: response.data?.bot?.open_id,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
