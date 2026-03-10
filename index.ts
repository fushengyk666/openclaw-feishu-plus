/**
 * index.ts — OpenClaw Feishu Plus Plugin Entry Point
 *
 * 完整的 OpenClaw Channel Plugin，支持：
 * - Dual-token 身份自动切换（user-if-available-else-tenant）
 * - 完整的 channel 集成（pairing, directory, messaging, onboarding, etc.）
 * - 全部工具能力（doc, calendar, wiki, drive, bitable, task, chat, perm）
 */

import { PLUGIN_ID } from "./src/constants.js";
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

    // 注册工具 — 使用 api 提供的 registerTool 回调
    const cfg = api.config || {};
    const store = {} as any;
    const reg = (toolDef: any, execute: any) => {
      api.registerTool?.({ name: toolDef.name, description: toolDef.description, parameters: toolDef.parameters, execute });
    };
    registerDocTools(new DocTools(cfg, store), reg);
    registerCalendarTools(new CalendarTools(cfg, store), reg);
    registerOAuthTools(new OAuthTools(cfg, store), reg);
    registerWikiTools(new WikiTools(cfg, store), reg);
    registerDriveTools(new DriveTools(cfg, store), reg);
    registerBitableTools(new BitableTools(cfg, store), reg);
    registerTaskTools(new TaskTools(cfg, store), reg);
    registerChatTools(new ChatTools(cfg, store), reg);
    registerPermTools(new PermTools(cfg, store), reg);
  },
};

export default plugin;
