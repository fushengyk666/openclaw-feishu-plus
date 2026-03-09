/**
 * client.ts — Lark SDK 客户端工厂
 *
 * 管理 Lark SDK 实例的创建与缓存。
 *
 * 注意：
 * - 本插件直接通过 HTTP API 获取 tenant_access_token，不依赖 SDK 的 token 管理
 * - Lark SDK 主要用于类型定义和可选的便捷调用
 * - user_access_token 由插件自己的 TokenStore 管理
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "./config-schema.js";

/** 缓存 SDK 实例，key = appId */
const clientCache = new Map<string, lark.Client>();

/**
 * 获取或创建 Lark SDK Client
 *
 * SDK Client 主要用于：
 * - 类型定义和便捷方法
 * - 可选的 API 调用封装
 *
 * 注意：我们不使用 SDK 的自动 token 管理功能。
 * tenant_access_token 通过 getTenantAccessToken() 直接获取。
 * user_access_token 由 TokenStore 管理。
 */
export function getLarkClient(config: PluginConfig): lark.Client {
  const cached = clientCache.get(config.appId);
  if (cached) return cached;

  const client = new lark.Client({
    appId: config.appId,
    appSecret: config.appSecret,
    domain: config.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.warn,
  });

  clientCache.set(config.appId, client);
  return client;
}

/**
 * 清除指定 appId 的缓存客户端
 */
export function clearClientCache(appId?: string): void {
  if (appId) {
    clientCache.delete(appId);
  } else {
    clientCache.clear();
  }
}

/**
 * 获取 tenant_access_token
 *
 * 直接通过飞书 API 获取应用级 token。
 * 当前实现：直接 HTTP 调用，不依赖 SDK 的 token 缓存。
 *
 * TODO: 考虑添加简单的内存缓存（带过期检查），减少 API 调用
 */
export async function getTenantAccessToken(
  config: PluginConfig
): Promise<string> {
  const resp = await fetch(
    `https://open.${config.domain}.cn/open-apis/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret,
      }),
    }
  );

  const data = (await resp.json()) as {
    code: number;
    msg: string;
    tenant_access_token: string;
    expire: number;
  };

  if (data.code !== 0) {
    throw new Error(
      `Failed to get tenant_access_token: [${data.code}] ${data.msg}`
    );
  }

  return data.tenant_access_token;
}
