/**
 * client.ts — Lark SDK 客户端工厂 + Tenant Token 缓存
 *
 * 管理 Lark SDK 实例与 tenant_access_token 的获取/缓存。
 *
 * 设计：
 * - SDK Client 用于 channel 层（消息收发、事件监听等）
 * - tenant_access_token 有内存缓存（含过期检查），减少 API 调用
 * - user_access_token 由 TokenStore 管理，不在此处
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "./config-schema.js";

// ─── SDK Client Cache ───

/** 缓存 SDK 实例，key = appId */
const clientCache = new Map<string, lark.Client>();

/**
 * 获取或创建 Lark SDK Client（channel 层使用）
 */
export function getLarkClient(config: PluginConfig | { appId: string; appSecret: string; domain?: string }): lark.Client {
  const appId = config.appId;
  const cached = clientCache.get(appId);
  if (cached) return cached;

  const appSecret = config.appSecret;
  const domain = ("domain" in config ? config.domain : "feishu") ?? "feishu";

  const client = new lark.Client({
    appId,
    appSecret,
    domain: domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.warn,
  });

  clientCache.set(appId, client);
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

// ─── Tenant Token Cache ───

interface CachedTenantToken {
  token: string;
  /** 过期时间戳（ms），提前 60s 失效 */
  expiresAt: number;
}

/** 缓存 tenant token，key = appId */
const tenantTokenCache = new Map<string, CachedTenantToken>();

/** Buffer: 提前 60s 认为过期 */
const EXPIRY_BUFFER_MS = 60_000;

/**
 * 获取 tenant_access_token（带缓存）
 *
 * 缓存策略：
 * - 首次调用发起 HTTP 请求
 * - 后续调用使用缓存，直到距过期不足 60s
 * - 过期后自动重新获取
 */
export async function getTenantAccessToken(
  config: PluginConfig
): Promise<string> {
  const cached = tenantTokenCache.get(config.appId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

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

  // Cache with expiry buffer
  tenantTokenCache.set(config.appId, {
    token: data.tenant_access_token,
    expiresAt: Date.now() + data.expire * 1000 - EXPIRY_BUFFER_MS,
  });

  return data.tenant_access_token;
}

/**
 * 使 tenant token 缓存失效（401 重试时调用）
 */
export function invalidateTenantTokenCache(appId: string): void {
  tenantTokenCache.delete(appId);
}
