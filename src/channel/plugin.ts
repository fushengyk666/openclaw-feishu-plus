/**
 * plugin.ts — 飞书 Channel 辅助逻辑
 *
 * 本文件仅包含飞书消息通道的辅助函数。
 * 不作为插件总入口——插件入口统一为 index.ts。
 *
 * Channel 功能：
 * - WebSocket/Webhook 消息监听
 * - 消息入站处理（飞书 → OpenClaw）
 * - 消息出站处理（OpenClaw → 飞书）
 */

import * as lark from "@larksuiteoapi/node-sdk";
import { getLarkClient } from "../core/client.js";
import type { PluginConfig } from "../core/config-schema.js";

// ─── Channel 相关类型 ───

export interface FeishuChannel {
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

// ─── Channel 创建辅助 ───

/**
 * 创建飞书消息通道（根据配置的连接模式）
 *
 * @param config 插件配置
 * @param onMessage 收到消息时的回调函数
 * @returns Channel 实例
 */
export async function createFeishuChannel(
  config: PluginConfig,
  onMessage: (data: unknown) => Promise<void>
): Promise<FeishuChannel> {
  const client = getLarkClient(config);

  if (config.connectionMode === "websocket") {
    return await createWebSocketChannel(client, config, onMessage);
  } else {
    // Webhook 模式
    return await createWebhookChannel(client, config, onMessage);
  }
}

// ─── WebSocket 模式实现 ───

async function createWebSocketChannel(
  client: lark.Client,
  config: PluginConfig,
  onMessage: (data: unknown) => Promise<void>
): Promise<FeishuChannel> {
  // TODO: 使用 Lark SDK 的 WebSocket 客户端建立长连接
  // 当前为骨架实现
  console.warn("[FeishuChannel] WebSocket mode not yet implemented");

  return {
    isConnected: () => false,
    disconnect: async () => {
      console.log("[FeishuChannel] Disconnect");
    },
  };
}

// ─── Webhook 模式实现 ───

async function createWebhookChannel(
  client: lark.Client,
  config: PluginConfig,
  onMessage: (data: unknown) => Promise<void>
): Promise<FeishuChannel> {
  // TODO: 实现 webhook 模式
  // 需要配置一个公开可访问的 HTTP 端点
  console.warn("[FeishuChannel] Webhook mode not yet implemented");

  return {
    isConnected: () => false,
    disconnect: async () => {
      console.log("[FeishuChannel] Disconnect");
    },
  };
}
