/**
 * index.ts — OpenClaw Feishu Plus Plugin Entry Point
 *
 * 完整的 OpenClaw Channel Plugin，支持：
 * - Dual-token 身份自动切换（user-if-available-else-tenant）
 * - 完整的 channel 集成（pairing, directory, messaging, onboarding, etc.）
 * - 全部工具能力（doc, calendar, wiki, drive, bitable, task, chat, perm）
 */

import { PLUGIN_ID, CONFIG_NAMESPACE } from "./src/constants.js";
import { parseConfig } from "./src/core/config-schema.js";
import { createTokenStore } from "./src/core/token-store.js";
import { TokenResolver } from "./src/core/token-resolver.js";
import { initExecutor } from "./src/core/request-executor.js";
import { DocTools, registerDocTools } from "./src/tools/doc.js";
import { CalendarTools, registerCalendarTools } from "./src/tools/calendar.js";
import { OAuthTools, registerOAuthTools } from "./src/tools/oauth-tool.js";
import { WikiTools, registerWikiTools } from "./src/tools/wiki.js";
import { DriveTools, registerDriveTools } from "./src/tools/drive.js";
import { BitableTools, registerBitableTools } from "./src/tools/bitable.js";
import { TaskTools, registerTaskTools } from "./src/tools/task.js";
import { ChatTools, registerChatTools } from "./src/tools/chat.js";
import { PermTools, registerPermTools } from "./src/tools/perm.js";
import { feishuPlusPlugin } from "./src/channel/plugin.js";
import { setFeishuPlusRuntime } from "./src/channel/runtime.js";

// Re-exports
export { feishuPlusPlugin } from "./src/channel/plugin.js";
export { probeFeishuPlus } from "./src/channel/probe.js";
export { sendMessageFeishu, sendCardFeishu, updateCardFeishu, editMessageFeishu, getMessageFeishu } from "./src/channel/send.js";
export { uploadImageFeishu, uploadFileFeishu, sendImageFeishu, sendFileFeishu, sendMediaFeishu } from "./src/channel/media.js";
export { addReactionFeishu, removeReactionFeishu, listReactionsFeishu, FeishuEmoji } from "./src/channel/reactions.js";
export { extractMentionTargets, extractMessageBody, formatMentionForText, formatMentionForCard } from "./src/channel/mention.js";

const plugin = {
  id: PLUGIN_ID,
  name: "Feishu Plus",
  description: "飞书增强插件：dual-token 自动切换（user-if-available-else-tenant）",
  version: "0.1.0",

  register(api: any): void {
    setFeishuPlusRuntime(api.runtime);
    api.registerChannel({ plugin: feishuPlusPlugin });

    // ── 初始化 Dual-Token 核心 ──
    const rawCfg = api.config ?? {};
    const channelCfg = rawCfg?.channels?.[CONFIG_NAMESPACE] ?? {};

    const pluginConfig = parseConfig({
      appId: channelCfg.appId ?? "",
      appSecret: channelCfg.appSecret ?? "",
      domain: channelCfg.domain ?? "feishu",
      auth: {
        preferUserToken: true,
      },
    });

    const tokenStore = createTokenStore(pluginConfig.auth.store ?? "memory");
    const resolver = new TokenResolver(pluginConfig, tokenStore);
    initExecutor(resolver);

    // ── 注册工具 ──
    const hasRegisterTool = typeof api.registerTool === "function";
    console.log(`[feishu-plus] register: hasRegisterTool=${hasRegisterTool}, appId=${pluginConfig.appId?.slice(0,10)}...`);
    
    const reg = (toolDef: any, execute: any) => {
      if (api.registerTool) {
        api.registerTool({
          name: toolDef.name,
          description: toolDef.description,
          parameters: toolDef.parameters,
          execute,
        });
        console.log(`[feishu-plus] registered tool: ${toolDef.name}`);
      }
    };

    registerDocTools(new DocTools(pluginConfig, tokenStore), reg);
    registerCalendarTools(new CalendarTools(pluginConfig, tokenStore), reg);
    registerOAuthTools(new OAuthTools(pluginConfig, tokenStore), reg);
    registerWikiTools(new WikiTools(pluginConfig, tokenStore), reg);
    registerDriveTools(new DriveTools(pluginConfig, tokenStore), reg);
    registerBitableTools(new BitableTools(pluginConfig, tokenStore), reg);
    registerTaskTools(new TaskTools(pluginConfig, tokenStore), reg);
    registerChatTools(new ChatTools(pluginConfig, tokenStore), reg);
    registerPermTools(new PermTools(pluginConfig, tokenStore), reg);
  },
};

export default plugin;
