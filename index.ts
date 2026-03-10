/**
 * index.ts — 插件唯一入口
 *
 * 负责插件初始化、注册 Channel 和 Tools。
 *
 * 插件遵循以下原则：
 * 1. 唯一入口：index.ts 是唯一的插件入口
 * 2. Token-first 设计：user-if-available-else-tenant
 * 3. 独立命名空间：PLUGIN_ID、CHANNEL_ID、CONFIG_NAMESPACE
 * 4. 最小闭环：优先实现 oauth-tool、doc、calendar
 */

import { parseConfig, type PluginConfig } from "./src/core/config-schema.js";
import { clearClientCache } from "./src/core/client.js";
import { createTokenStore, type ITokenStore } from "./src/core/token-store.js";
import { TokenResolver } from "./src/core/token-resolver.js";
import { initExecutor } from "./src/core/request-executor.js";
import { createFeishuChannel, type FeishuChannel } from "./src/channel/plugin.js";
import { runOnboarding } from "./src/channel/onboarding.js";

import { PLUGIN_ID, CHANNEL_ID, CONFIG_NAMESPACE } from "./src/constants.js";

// Tool modules
import { DocTools, registerDocTools } from "./src/tools/doc.js";
import { CalendarTools, registerCalendarTools } from "./src/tools/calendar.js";
import { OAuthTools, registerOAuthTools } from "./src/tools/oauth-tool.js";
import { WikiTools, registerWikiTools } from "./src/tools/wiki.js";
import { DriveTools, registerDriveTools } from "./src/tools/drive.js";
import { BitableTools, registerBitableTools } from "./src/tools/bitable.js";
import { TaskTools, registerTaskTools } from "./src/tools/task.js";
import { ChatTools, registerChatTools } from "./src/tools/chat.js";
import { PermTools, registerPermTools } from "./src/tools/perm.js";

// ─── 插件上下文 ───

type ToolDef = {
  name: string;
  description: string;
  parameters: unknown;
};

type ToolExecute = (args: Record<string, unknown>) => Promise<unknown>;

// ─── 入站消息桥接接口 ───

/**
 * 入站消息桥接处理器接口
 *
 * 当 OpenClaw 提供消息总线 API 时，通过此接口将飞书消息注入 OpenClaw
 * 当前是预留接口，实际注入待 OpenClaw 侧实现
 */
export interface InboundMessageBridge {
  /**
   * 将飞书消息注入到 OpenClaw
   * @param message 规范化的飞书消息对象
   */
  handleInbound(message: FeishuInboundMessage): Promise<void>;
}

/**
 * 规范化的飞书入站消息对象
 * 设计为 OpenClaw 可消费的标准格式
 */
export interface FeishuInboundMessage {
  /** 来源通道 ID */
  channelId: string;
  /** 消息类型：text, interactive, image 等 */
  messageType: string;
  /** 消息内容（已解析） */
  content: {
    text?: string;
    rawData?: Record<string, unknown>;
  };
  /** 发送者信息 */
  sender: {
    openId: string;
    userId?: string;
    unionId?: string;
    senderType: "user" | "app";
  };
  /** 目标群聊/会话 */
  chatId: string;
  /** 原始飞书事件（用于调试或扩展） */
  rawEvent: any;
  /** 时间戳 */
  timestamp: number;
}

// ─── Channel Handler 接口 ───

/**
 * Channel Handler 接口定义
 *
 * 这是插件向 OpenClaw 暴露的完整 channel handler 接口。
 * OpenClaw 可以调用这些方法来与飞书 channel 交互。
 */
export interface FeishuChannelHandler {
  /** 当前连接状态 */
  isConnected(): boolean;
  /** 断开连接 */
  disconnect(): Promise<void>;
  /**
   * 发送消息到飞书（出站）
   *
   * @param chatId 群聊或会话 ID
   * @param msgType 消息类型（text/post/image/file/card等）
   * @param content 消息内容（JSON 字符串）
   * @param userId 可选的用户 ID，用于决定使用 user token 还是 tenant token
   * @returns Promise<unknown> 飞书 API 响应
   */
  sendMessage?(chatId: string, msgType: string, content: string, userId?: string): Promise<unknown>;

  /**
   * Webhook HTTP handlers（仅在 webhook 模式下可用）
   *
   * 注意：这些属性是动态添加的，仅在 connectionMode === "webhook" 时存在
   */
  expressHandler?: any;
  koaHandler?: any;

  /**
   * Channel 元数据（供 OpenClaw 了解 channel 能力）
   */
  metadata?: {
    connectionMode: "websocket" | "webhook";
    capabilities: string[];
    supportsInbound: boolean;
    supportsOutbound: boolean;
  };
}

export interface PluginContext {
  config: PluginConfig;
  tokenStore: ITokenStore;
  tokenResolver: TokenResolver;
  docTools: DocTools;
  calendarTools: CalendarTools;
  oauthTools: OAuthTools;
  // 骨架工具（未启用）
  wikiTools?: WikiTools;
  driveTools?: DriveTools;
  bitableTools?: BitableTools;
  taskTools?: TaskTools;
  chatTools?: ChatTools;
  permTools?: PermTools;
  channel?: FeishuChannel;
  /** 入站消息桥接（由 OpenClaw 注入，当前为可选） */
  inboundBridge?: InboundMessageBridge;
}

// ─── 插件初始化 ───

/**
 * 初始化插件
 *
 * @param configRaw 原始配置对象
 * @param storagePath 持久化存储路径
 * @returns 插件上下文
 */
export async function initPlugin(
  configRaw: unknown,
  storagePath?: string
): Promise<PluginContext> {
  // 1. 解析并校验配置
  const config = parseConfig(configRaw);

  // 2. 执行 onboarding 检查
  const onboarding = await runOnboarding(config);
  if (!onboarding.success) {
    throw new Error(
      "Plugin configuration is invalid. Please fix the errors above."
    );
  }

  // 3. 创建核心组件
  const tokenStore = createTokenStore(config.auth.store, storagePath);
  const tokenResolver = new TokenResolver(config, tokenStore);

  // 4. 初始化执行器（绑定 TokenResolver）
  initExecutor(tokenResolver);

  // 5. 初始化 P1 最小闭环工具
  const docTools = new DocTools(config, tokenStore);
  const calendarTools = new CalendarTools(config, tokenStore);
  const oauthTools = new OAuthTools(config, tokenStore);

  // 6. 初始化骨架工具（仅在配置中启用时）
  let wikiTools: WikiTools | undefined;
  let driveTools: DriveTools | undefined;
  let bitableTools: BitableTools | undefined;
  let taskTools: TaskTools | undefined;
  let chatTools: ChatTools | undefined;
  let permTools: PermTools | undefined;

  if (config.tools.wiki) {
    wikiTools = new WikiTools(config, tokenStore);
  }
  if (config.tools.drive) {
    driveTools = new DriveTools(config, tokenStore);
  }
  if (config.tools.bitable) {
    bitableTools = new BitableTools(config, tokenStore);
  }
  if (config.tools.task) {
    taskTools = new TaskTools(config, tokenStore);
  }
  if (config.tools.chat) {
    chatTools = new ChatTools(config, tokenStore);
  }
  if (config.tools.perm) {
    permTools = new PermTools(config, tokenStore);
  }

  // 7. 初始化 Channel（仅 full 模式）
  let channel: FeishuChannel | undefined;
  if (config.mode === "full") {
    // Channel 的实际注册由 registerChannel 处理
    // 这里只准备好 onMessage 回调
  }

  return {
    config,
    tokenStore,
    tokenResolver,
    docTools,
    calendarTools,
    oauthTools,
    wikiTools,
    driveTools,
    bitableTools,
    taskTools,
    chatTools,
    permTools,
    channel,
  };
}

// ─── 消息入站处理 ───

/**
 * 处理从飞书收到的消息
 * 这个函数会在 WebSocket/Webhook 收到消息时被调用
 *
 * 当前实现：
 * 1. 解析并规范化消息为 FeishuInboundMessage
 * 2. 通过 InboundMessageBridge 注入到 OpenClaw（如果可用）
 * 3. 如果没有 bridge，则记录日志（当前默认行为）
 */
async function handleIncomingMessage(context: PluginContext, data: any): Promise<void> {
  console.log(`[${PLUGIN_ID}] Handling incoming message:`, JSON.stringify(data, null, 2));

  const message = data;

  // 忽略自己发送的消息
  if (message.message?.sender?.sender_type === "app") {
    console.log(`[${PLUGIN_ID}] Ignoring message sent by self`);
    return;
  }

  // 解析消息内容
  let parsedContent: any;
  try {
    parsedContent = JSON.parse(message.message?.content || "{}");
  } catch (e) {
    console.error(`[${PLUGIN_ID}] Failed to parse message content:`, e);
    return;
  }

  // 构建规范的入站消息对象
  const inboundMessage: FeishuInboundMessage = {
    channelId: CHANNEL_ID,
    messageType: message.message?.msg_type || "unknown",
    content: {
      text: parsedContent.text,
      rawData: parsedContent,
    },
    sender: {
      openId: message.message?.sender?.sender_id?.open_id || "",
      userId: message.message?.sender?.sender_id?.user_id,
      unionId: message.message?.sender?.sender_id?.union_id,
      senderType: message.message?.sender?.sender_type || "user",
    },
    chatId: message.message?.chat_id || "",
    rawEvent: message,
    timestamp: Date.now(),
  };

  // 尝试通过 bridge 注入到 OpenClaw
  if (context.inboundBridge) {
    try {
      console.log(`[${PLUGIN_ID}] Injecting message to OpenClaw via InboundMessageBridge`);
      await context.inboundBridge.handleInbound(inboundMessage);
    } catch (error) {
      console.error(`[${PLUGIN_ID}] Failed to inject message via bridge:`, error);
      // bridge 调用失败时回退到日志记录
      logInboundMessage(inboundMessage);
    }
  } else {
    // 没有 bridge 时记录日志（当前默认行为）
    console.log(`[${PLUGIN_ID}] No InboundMessageBridge available, logging message only`);
    logInboundMessage(inboundMessage);
  }
}

/**
 * 记录入站消息的辅助函数
 * 当没有 bridge 时使用，保持向后兼容
 */
function logInboundMessage(inbound: FeishuInboundMessage): void {
  console.log(`[${PLUGIN_ID}] ========== Inbound Message ==========`);
  console.log(`[${PLUGIN_ID}] Type: ${inbound.messageType}`);
  console.log(`[${PLUGIN_ID}] From: ${inbound.sender.openId} (${inbound.sender.senderType})`);
  console.log(`[${PLUGIN_ID}] Chat: ${inbound.chatId}`);

  switch (inbound.messageType) {
    case "text":
      console.log(`[${PLUGIN_ID}] Content: ${inbound.content.text || "<empty>"}`);
      break;
    case "interactive":
      console.log(`[${PLUGIN_ID}] Interactive card action detected`);
      console.log(`[${PLUGIN_ID}] Raw data:`, JSON.stringify(inbound.content.rawData, null, 2));
      break;
    default:
      console.log(`[${PLUGIN_ID}] Unsupported message type: ${inbound.messageType}`);
      console.log(`[${PLUGIN_ID}] Raw data:`, JSON.stringify(inbound.content.rawData, null, 2));
      break;
  }

  console.log(`[${PLUGIN_ID}] ========================================`);
}

// ─── 消息出站处理 ───

/**
 * 发送消息到飞书
 * 这个函数可以被 OpenClaw 调用，用于向飞书发送消息
 *
 * Token-first 设计：
 * - 自动使用 token-resolver 决定使用 user 还是 tenant token
 * - 如果提供了 userId 且有有效的 user token，优先使用 user token
 * - 否则回退到 tenant token
 */
async function handleOutgoingMessage(
  context: PluginContext,
  chatId: string,
  msgType: string,
  content: string,
  userId?: string
): Promise<unknown> {
  console.log(`[${PLUGIN_ID}] Sending message to ${chatId}:`, content);

  try {
    // Import sendMessage function
    const { sendMessage } = await import("./src/channel/plugin.js");
    return await sendMessage(
      context.config,
      chatId,
      msgType,
      content,
      context.tokenResolver,
      userId
    );
  } catch (error) {
    console.error(`[${PLUGIN_ID}] Failed to send message:`, error);
    throw error;
  }
}

// ─── 注册 Tools ───

/**
 * 注册所有启用的 Tools 到 OpenClaw
 *
 * @param context 插件上下文
 * @param registerTool 注册函数（由 OpenClaw 提供）
 */
export function registerTools(
  context: PluginContext,
  registerTool: (tool: {
    name: string;
    description: string;
    parameters: unknown;
    execute: ToolExecute;
  }) => void
): void {
  const { config } = context;

  // P0: OAuth 工具（默认启用，用于授权管理）
  if (config.tools.oauth) {
    registerOAuthTools(context.oauthTools, (toolDef: ToolDef, execute: ToolExecute) => {
      registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute,
      });
    });
  }

  // P0: Doc 工具（默认启用）
  if (config.tools.doc) {
    registerDocTools(context.docTools, (toolDef: ToolDef, execute: ToolExecute) => {
      registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute,
      });
    });
  }

  // P0: Calendar 工具（默认启用）
  if (config.tools.calendar) {
    registerCalendarTools(context.calendarTools, (toolDef: ToolDef, execute: ToolExecute) => {
      registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute,
      });
    });
  }

  // P1: 骨架工具（仅在配置中显式启用时注册）
  if (config.tools.wiki && context.wikiTools) {
    registerWikiTools(context.wikiTools, (toolDef: ToolDef, execute: ToolExecute) => {
      registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute,
      });
    });
  }

  if (config.tools.drive && context.driveTools) {
    registerDriveTools(context.driveTools, (toolDef: ToolDef, execute: ToolExecute) => {
      registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute,
      });
    });
  }

  if (config.tools.bitable && context.bitableTools) {
    registerBitableTools(context.bitableTools, (toolDef: ToolDef, execute: ToolExecute) => {
      registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute,
      });
    });
  }

  if (config.tools.task && context.taskTools) {
    registerTaskTools(context.taskTools, (toolDef: ToolDef, execute: ToolExecute) => {
      registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute,
      });
    });
  }

  if (config.tools.chat && context.chatTools) {
    registerChatTools(context.chatTools, (toolDef: ToolDef, execute: ToolExecute) => {
      registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute,
      });
    });
  }

  if (config.tools.perm && context.permTools) {
    registerPermTools(context.permTools, (toolDef: ToolDef, execute: ToolExecute) => {
      registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute,
      });
    });
  }
}

// ─── 注册 Channel ───

/**
 * 注册飞书 Channel 到 OpenClaw
 *
 * @param context 插件上下文
 * @param registerChannelFn 注册函数（由 OpenClaw 提供）
 */
export async function registerChannel(
  context: PluginContext,
  registerChannelFn: (
    channelId: string,
    handler: FeishuChannelHandler
  ) => void
): Promise<void> {
  if (context.config.mode === "tools-only") {
    console.log(
      `[${PLUGIN_ID}] Running in tools-only mode, skipping channel registration`
    );
    return;
  }

  // 创建 channel
  const channel = await createFeishuChannel(
    context.config,
    async (data: any) => {
      await handleIncomingMessage(context, data);
    }
  );

  context.channel = channel;

  // 构建完整的 channel handler
  const handler: FeishuChannelHandler = {
    // 基础连接方法
    isConnected: () => channel.isConnected(),
    disconnect: async () => {
      await channel.disconnect();
    },

    // 出站消息方法（通过 handleOutgoingMessage 间接调用）
    sendMessage: async (chatId: string, msgType: string, content: string, userId?: string) => {
      return handleOutgoingMessage(context, chatId, msgType, content, userId);
    },

    // Channel 元数据
    metadata: {
      connectionMode: context.config.connectionMode,
      capabilities: ["receive_messages", "send_messages", "webhook", "websocket"],
      supportsInbound: true,  // 接收飞书消息
      supportsOutbound: true, // 发送飞书消息
    },
  };

  // 如果是 webhook 模式，添加 HTTP handlers
  if (context.config.connectionMode === "webhook" && "expressHandler" in channel) {
    handler.expressHandler = (channel as any).expressHandler;
    handler.koaHandler = (channel as any).koaHandler;
  }

  // 注册 channel 到 OpenClaw
  try {
    registerChannelFn(CHANNEL_ID, handler);
    console.log(`[${PLUGIN_ID}] Channel registered: ${CHANNEL_ID}`);
    console.log(`[${PLUGIN_ID}] Connection mode: ${context.config.connectionMode}`);
    console.log(`[${PLUGIN_ID}] Capabilities: ${handler.metadata?.capabilities.join(", ")}`);

    // 如果是 webhook 模式，打印如何使用的提示
    if (context.config.connectionMode === "webhook") {
      console.log(`[${PLUGIN_ID}] === Webhook Integration Guide ===`);
      console.log(`[${PLUGIN_ID}] Express handler available: handler.expressHandler`);
      console.log(`[${PLUGIN_ID}] Koa handler available: handler.koaHandler`);
      console.log(`[${PLUGIN_ID}]`);
      console.log(`[${PLUGIN_ID}] Example for Express:`);
      console.log(`[${PLUGIN_ID}]   app.use('/webhook/feishu', handler.expressHandler)`);
      console.log(`[${PLUGIN_ID}]`);
      console.log(`[${PLUGIN_ID}] Example for Koa:`);
      console.log(`[${PLUGIN_ID}]   app.use(handler.koaHandler)`);
      console.log(`[${PLUGIN_ID}] ====================================`);
    }
  } catch (error) {
    console.error(`[${PLUGIN_ID}] Failed to register channel:`, error);
    // 不抛出错误，允许插件继续运行
  }
}

// ─── 插件关闭 ───

/**
 * 清理资源
 */
export async function shutdown(context: PluginContext): Promise<void> {
  if (context.channel) {
    await context.channel.disconnect();
  }
  clearClientCache();
  console.log(`[${PLUGIN_ID}] Shutdown complete`);
}

// ─── 导出常量（供外部使用） ───

export { PLUGIN_ID, CHANNEL_ID, CONFIG_NAMESPACE };

// ─── 导出供 OpenClaw 调用的入口 ───

/**
 * OpenClaw Plugin API 接口定义
 *
 * 这是 OpenClaw 提供给插件的接口。插件通过此接口注册工具和 channel。
 */
export interface OpenClawPluginAPI {
  /**
   * 注册工具到 OpenClaw
   * @param tool 工具定义（包含 name, description, parameters, execute）
   */
  registerTool: (tool: {
    name: string;
    description: string;
    parameters: unknown;
    execute: ToolExecute;
  }) => void;

  /**
   * 注册消息 channel 到 OpenClaw
   * @param channelId Channel ID（如 "openclaw-feishu-plus"）
   * @param handler Channel handler（插件提供的 FeishuChannelHandler）
   */
  registerChannel: (channelId: string, handler: FeishuChannelHandler) => void;

  /**
   * 持久化存储路径（可选）
   * OpenClaw 提供的路径，插件用于存储 token 等数据
   */
  storagePath?: string;

  /**
   * 入站消息桥接处理器（可选，但强烈建议提供）
   *
   * 如果 OpenClaw 提供 InboundMessageBridge，插件可以将飞书消息注入到 OpenClaw 消息总线。
   * 如果不提供，插件仍可正常工作，但消息只会被记录到日志。
   *
   * 实现 InboundMessageBridge 需要的接口：
   * - handleInbound(message: FeishuInboundMessage): Promise<void>
   */
  inboundBridge?: InboundMessageBridge;
}

/**
 * OpenClaw Plugin Entry Point
 *
 * This function is called by OpenClaw to register the plugin.
 *
 * @param config Raw configuration (from openclaw.json or other config source)
 * @param api OpenClaw API object
 * @returns Plugin control object (contains shutdown method)
 */
export default async function register(
  config: unknown,
  api: OpenClawPluginAPI
): Promise<{ shutdown: () => Promise<void> }> {
  console.log(`[${PLUGIN_ID}] ====================================`);
  console.log(`[${PLUGIN_ID}] OpenClaw Feishu Plus v0.1.0`);
  console.log(`[${PLUGIN_ID}] Initializing...`);
  console.log(`[${PLUGIN_ID}] ====================================`);

  // 初始化插件
  const context = await initPlugin(config, api.storagePath);

  // 注入 inboundBridge（如果 OpenClaw 提供）
  if (api.inboundBridge) {
    context.inboundBridge = api.inboundBridge;
    console.log(`[${PLUGIN_ID}] [OK] InboundMessageBridge provided by OpenClaw`);
    console.log(`[${PLUGIN_ID}]    -> Feishu messages will be injected to OpenClaw message bus`);
  } else {
    console.log(`[${PLUGIN_ID}] [WARN] No InboundMessageBridge provided`);
    console.log(`[${PLUGIN_ID}]    -> Feishu messages will be logged only (not injected to OpenClaw)`);
    console.log(`[${PLUGIN_ID}]    -> To enable full integration, implement InboundMessageBridge`);
  }

  // 注册 Tools
  console.log(`[${PLUGIN_ID}] Registering tools...`);
  registerTools(context, api.registerTool);

  // 注册 Channel
  console.log(`[${PLUGIN_ID}] Registering channel...`);
  await registerChannel(context, api.registerChannel);

  console.log(`[${PLUGIN_ID}] ====================================`);
  console.log(`[${PLUGIN_ID}] [OK] Registration complete`);
  console.log(`[${PLUGIN_ID}] ====================================`);

  return {
    shutdown: () => shutdown(context),
  };
}
