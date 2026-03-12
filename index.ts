/**
 * index.ts — OpenClaw Feishu Plus Plugin Entry Point
 *
 * 对标 OpenClaw 官方 feishu 扩展的注册模式：
 * - registerChannel + registerTool 统一注册
 * - 双授权核心层（identity）在 register 阶段初始化
 * - channel 层处理消息收发
 * - tools 层处理飞书平台能力调用
 */

import { PLUGIN_ID, CONFIG_NAMESPACE } from "./src/constants.js";
import { parseConfig } from "./src/identity/config-schema.js";
import { createTokenStore } from "./src/identity/token-store.js";
import { TokenResolver } from "./src/identity/token-resolver.js";
import { initExecutor } from "./src/identity/request-executor.js";
import { DocTools, registerDocTools } from "./src/tools/doc.js";
import { CalendarTools, registerCalendarTools } from "./src/tools/calendar.js";
import { OAuthTools, registerOAuthTools } from "./src/tools/oauth-tool.js";
import { WikiTools, registerWikiTools } from "./src/tools/wiki.js";
import { DriveTools, registerDriveTools } from "./src/tools/drive.js";
import { BitableTools, registerBitableTools } from "./src/tools/bitable.js";
import { TaskTools, registerTaskTools } from "./src/tools/task.js";
import { ChatTools, registerChatTools } from "./src/tools/chat.js";
import { PermTools, registerPermTools } from "./src/tools/perm.js";
import { SheetsTools, registerSheetsTools } from "./src/tools/sheets.js";
import { feishuPlusPlugin } from "./src/channel/plugin.js";
import { setFeishuPlusRuntime } from "./src/channel/runtime.js";

// ─── Re-exports (public API) ───

export { feishuPlusPlugin } from "./src/channel/plugin.js";
export { probeFeishuPlus } from "./src/channel/probe.js";
export {
  sendMessageFeishu,
  sendCardFeishu,
  updateCardFeishu,
  editMessageFeishu,
  getMessageFeishu,
} from "./src/channel/send.js";
export {
  uploadImageFeishu,
  uploadFileFeishu,
  sendImageFeishu,
  sendFileFeishu,
  sendMediaFeishu,
} from "./src/channel/media.js";
export {
  addReactionFeishu,
  removeReactionFeishu,
  listReactionsFeishu,
  FeishuEmoji,
} from "./src/channel/reactions.js";
export {
  extractMentionTargets,
  extractMessageBody,
  formatMentionForText,
  formatMentionForCard,
} from "./src/channel/mention.js";

// ─── Tool Registration Helper ───

type ToolRegFn = (
  toolDef: { name: string; description: string; parameters: any },
  execute: (args: any) => Promise<any>,
) => void;

/**
 * Build a tool registration function compatible with OpenClaw plugin API.
 */
function createToolRegistrar(api: any): ToolRegFn {
  return (toolDef, execute) => {
    if (typeof api.registerTool !== "function") return;

    api.registerTool({
      name: toolDef.name,
      description: toolDef.description,
      parameters: toolDef.parameters,
      execute: async (_toolUseId: string, params: any, _ctx: any, _callback: any) => {
        return execute(params);
      },
    });
  };
}

// ─── Plugin Definition ───

const plugin = {
  id: PLUGIN_ID,
  name: "Feishu Plus",
  description:
    "飞书增强插件：dual-token 自动切换（user-if-available-else-tenant），支持完整飞书平台能力。",
  version: "0.2.0",

  register(api: any): void {
    // 1. Set runtime reference for channel layer
    setFeishuPlusRuntime(api.runtime);

    // 2. Register channel plugin
    api.registerChannel({ plugin: feishuPlusPlugin });

    // 3. Initialize identity layer (dual-token core)
    const rawCfg = api.config ?? {};
    const channelCfg = rawCfg?.channels?.[CONFIG_NAMESPACE] ?? {};

    const pluginConfig = parseConfig({
      appId: channelCfg.appId ?? "",
      appSecret: channelCfg.appSecret ?? "",
      domain: channelCfg.domain ?? "feishu",
      auth: {
        preferUserToken: channelCfg.auth?.preferUserToken ?? true,
        autoPromptUserAuth: channelCfg.auth?.autoPromptUserAuth ?? true,
        store: channelCfg.auth?.store ?? "file",
      },
    });

    const tokenStore = createTokenStore(
      pluginConfig.auth.store ?? "memory",
    );
    const resolver = new TokenResolver(pluginConfig, tokenStore);
    initExecutor(resolver);

    // 4. Register tools
    const reg = createToolRegistrar(api);

    registerDocTools(new DocTools(pluginConfig, tokenStore), reg);
    registerCalendarTools(new CalendarTools(pluginConfig, tokenStore), reg);
    registerOAuthTools(new OAuthTools(pluginConfig, tokenStore), reg);
    registerWikiTools(new WikiTools(pluginConfig, tokenStore), reg);
    registerDriveTools(new DriveTools(pluginConfig, tokenStore), reg);
    registerBitableTools(new BitableTools(pluginConfig, tokenStore), reg);
    registerTaskTools(new TaskTools(pluginConfig, tokenStore), reg);
    registerChatTools(new ChatTools(pluginConfig, tokenStore), reg);
    registerPermTools(new PermTools(pluginConfig, tokenStore), reg);
    registerSheetsTools(new SheetsTools(pluginConfig, tokenStore), reg);

    console.log(
      `[feishu-plus] registered (appId=${pluginConfig.appId?.slice(0, 10)}…, tools=${typeof api.registerTool === "function" ? "yes" : "no"})`,
    );
  },
};

export default plugin;
