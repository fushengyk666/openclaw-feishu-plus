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
 * @param registerChannel 注册函数（由 OpenClaw 提供）
 */
export async function registerChannel(
  context: PluginContext,
  registerChannel: (
    channelId: string,
    handler: any
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
    async (data: unknown) => {
      // 消息入站处理：飞书 → OpenClaw
      // TODO: 解析飞书消息并转发到 OpenClaw
      console.log(`[${PLUGIN_ID}] Received message from Feishu:`, data);
    }
  );

  context.channel = channel;

  // 注册 channel 到 OpenClaw
  // TODO: 根据 OpenClaw 实际 API 调整
  // registerChannel(CHANNEL_ID, handler);
  console.log(`[${PLUGIN_ID}] Channel registered: ${CHANNEL_ID}`);
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
 * OpenClaw 插件入口
 *
 * 这个函数会被 OpenClaw 调用，完成插件注册。
 *
 * @param config 原始配置
 * @param api OpenClaw API 对象
 */
export default async function register(
  config: unknown,
  api: {
    registerTool: (tool: { name: string; description: string; parameters: unknown; execute: ToolExecute }) => void;
    registerChannel: (channelId: string, handler: unknown) => void;
    storagePath?: string;
  }
): Promise<{ shutdown: () => Promise<void> }> {
  console.log(`[${PLUGIN_ID}] Initializing...`);

  // 初始化插件
  const context = await initPlugin(config, api.storagePath);

  // 注册 Tools
  registerTools(context, api.registerTool);

  // 注册 Channel
  await registerChannel(context, api.registerChannel);

  console.log(`[${PLUGIN_ID}] Registration complete`);

  return {
    shutdown: () => shutdown(context),
  };
}
