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
import type { TokenResolver } from "../core/token-resolver.js";

// ─── Channel 相关类型 ───

export interface FeishuChannel {
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export interface FeishuMessage {
  event_type: string;
  message: {
    chat_id: string;
    msg_type: string;
    content: string;
    create_time: string;
    sender: {
      sender_id: {
        open_id: string;
        user_id?: string;
        union_id?: string;
      };
      sender_type: "user" | "app";
    };
  };
}

export type MessageHandler = (message: FeishuMessage) => Promise<void>;

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
  console.log("[FeishuChannel] Initializing WebSocket connection...");

  // 创建 WSClient
  const wsClient = new lark.WSClient({
    appId: config.appId,
    appSecret: config.appSecret,
    domain: config.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu,
    autoReconnect: true,
    loggerLevel: lark.LoggerLevel.warn,
  });

  // 创建 EventDispatcher 并注册事件处理器
  const eventDispatcher = new lark.EventDispatcher({
    // 验证令牌和加密密钥（可选，用于验证事件来源）
    // verificationToken: config.verificationToken,
    // encryptKey: config.encryptKey,
  }).register({
    // 处理接收到的消息事件
    "im.message.receive_v1": async (data: any) => {
      console.log("[FeishuChannel] Received message event:", JSON.stringify(data, null, 2));

      // 解析消息内容
      const message: FeishuMessage = {
        event_type: "im.message.receive_v1",
        message: data.message,
      };

      // 调用上层回调
      await onMessage(message);
    },
  });

  // 启动 WebSocket 连接
  try {
    await wsClient.start({
      eventDispatcher,
    });
    console.log("[FeishuChannel] WebSocket connection established");
  } catch (error) {
    console.error("[FeishuChannel] Failed to start WebSocket connection:", error);
    throw error;
  }

  // 返回 Channel 接口
  return {
    isConnected: () => {
      const reconnectInfo = wsClient.getReconnectInfo();
      // 简单判断：如果有重连信息，说明曾经连接过
      return reconnectInfo.lastConnectTime > 0;
    },
    disconnect: async () => {
      console.log("[FeishuChannel] Disconnecting WebSocket...");
      wsClient.close({ force: true });
      console.log("[FeishuChannel] WebSocket disconnected");
    },
  };
}

// ─── Webhook 模式实现 ───

async function createWebhookChannel(
  client: lark.Client,
  config: PluginConfig,
  onMessage: (data: unknown) => Promise<void>
): Promise<FeishuChannel> {
  console.log("[FeishuChannel] Initializing Webhook mode...");

  // 创建 EventDispatcher
  const eventDispatcher = new lark.EventDispatcher({
    // 验证令牌和加密密钥（可选，用于验证事件来源）
    // verificationToken: config.verificationToken,
    // encryptKey: config.encryptKey,
  }).register({
    // 处理接收到的消息事件
    "im.message.receive_v1": async (data: any) => {
      console.log("[FeishuChannel] Received webhook event:", JSON.stringify(data, null, 2));

      // 解析消息内容
      const message: FeishuMessage = {
        event_type: "im.message.receive_v1",
        message: data.message,
      };

      // 调用上层回调
      await onMessage(message);
    },
  });

  // 获取请求处理器（适配器）
  // 这里我们提供多种适配器，供用户选择
  const expressHandler = lark.adaptExpress(eventDispatcher, {
    autoChallenge: true,
  });

  // 将 handler 保存到全局，供外部使用
  // 注意：实际使用时，用户需要在自己的 HTTP 服务器上使用这个 handler
  // 例如：app.use('/webhook/feishu', expressHandler)
  // 这里我们只是创建一个虚拟的 Channel 接口
  console.log("[FeishuChannel] Webhook handler created");
  console.log("[FeishuChannel] NOTE: Webhook mode requires an external HTTP server");
  console.log("[FeishuChannel] Use lark.adaptExpress(eventDispatcher) or lark.adaptKoa(eventDispatcher) to integrate");

  // 导出 handler 供外部使用（通过闭包或全局变量）
  // 这里我们简单地将 handler 附加到返回的 Channel 对象上
  let _connected = false;

  const channel: FeishuChannel & { expressHandler?: any; koaHandler?: any } = {
    isConnected: () => _connected,
    disconnect: async () => {
      console.log("[FeishuChannel] Disconnecting Webhook...");
      _connected = false;
      console.log("[FeishuChannel] Webhook disconnected");
    },
    // 暴露适配器供外部使用
    expressHandler,
    koaHandler: lark.adaptKoa("/webhook/feishu", eventDispatcher, {
      autoChallenge: true,
    }),
  };

  // 标记为已连接（webhook 实际上不需要"连接"状态）
  _connected = true;

  return channel;
}

// ─── 消息发送辅助函数 ───

/**
 * 发送消息到飞书
 *
 * @param config 插件配置
 * @param chat_id 群聊 ID
 * @param msg_type 消息类型（text/post/image/file/card等）
 * @param content 消息内容（JSON 字符串）
 * @param tokenResolver Token 解析器（用于 token-first 路径）
 * @param userId 用户 ID（用于 user token，可选）
 *
 * Token-first 设计：
 * - 使用 token-resolver 决定使用 user 或 tenant token
 * - 默认策略：user-if-available-else-tenant
 * - 如果提供了 userId 且有有效的 user token，优先使用 user token
 */
export async function sendMessage(
  config: PluginConfig,
  chat_id: string,
  msg_type: string,
  content: string,
  tokenResolver: TokenResolver,
  userId?: string
): Promise<unknown> {
  // 使用 token-resolver 获取合适的 token
  const resolved = await tokenResolver.resolve({
    operation: "im.message.create",
    userId: userId,
  });

  console.log(`[FeishuChannel] Sending message with ${resolved.kind} token`);

  // 如果需要使用 user token，直接通过 HTTP API 调用
  if (resolved.kind === "user") {
    const url = `https://open.${config.domain}.cn/open-apis/im/v1/messages?receive_id_type=chat_id`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resolved.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: chat_id,
        msg_type,
        content,
      }),
    });

    if (!resp.ok) {
      const error = await resp.json();
      throw new Error(`Failed to send message: ${JSON.stringify(error)}`);
    }

    return resp.json();
  }

  // 使用 tenant token，可以用 SDK（SDK 会自动管理 tenant_access_token）
  const client = getLarkClient(config);
  const resp = await client.im.message.create({
    params: {
      receive_id_type: "chat_id",
    },
    data: {
      receive_id: chat_id,
      msg_type,
      content,
    },
  });

  return resp;
}
