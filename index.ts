/**
 * index.ts — OpenClaw Feishu Plus Plugin Entry Point
 *
 * 对标 OpenClaw 官方 feishu 扩展的注册模式：
 * - registerChannel + registerTool 统一注册
 * - 双授权核心层（identity）在 register 阶段初始化
 * - channel 层处理消息收发
 * - tools 层处理飞书平台能力调用
 *
 * 关键改进：
 * - doc/calendar 工具已接入双授权决策链路
 * - 工具注册时自动提取 userId 并传递
 * - NeedUserAuthorizationError → 友好授权提示
 */

import { PLUGIN_ID, CONFIG_NAMESPACE } from "./src/constants.js";
import { parseConfig } from "./src/identity/config-schema.js";
import { createTokenStore } from "./src/identity/token-store.js";
import { TokenResolver } from "./src/identity/token-resolver.js";
import { initExecutor } from "./src/identity/request-executor.js";
import { initFeishuApi, AuthRequiredError } from "./src/identity/feishu-api.js";

// Tools (dual-auth): doc, calendar, chat
import { DocTools, registerDocTools } from "./src/tools/doc.js";
import { CalendarTools, registerCalendarTools } from "./src/tools/calendar.js";
import { ChatTools, registerChatTools } from "./src/tools/chat.js";

// Tools (legacy SDK-based, will be migrated later)
import { OAuthTools, OAUTH_TOOL_DEFS } from "./src/tools/oauth-tool.js";
import { WikiTools, registerWikiTools } from "./src/tools/wiki.js";
import { DriveTools, registerDriveTools } from "./src/tools/drive.js";
import { BitableTools, registerBitableTools } from "./src/tools/bitable.js";
import { TaskTools, registerTaskTools } from "./src/tools/task.js";
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

// ─── Context userId Extraction ───

/**
 * 从 OpenClaw 工具执行上下文中提取用户 openId
 *
 * OpenClaw 传入的 ctx 可能包含以下字段（取决于入站渠道）：
 * - ctx.senderId      — 发送者 ID
 * - ctx.from          — "channel:type:senderId" 格式
 * - ctx.metadata.senderId
 *
 * 返回 openId 或 undefined
 */
function extractUserId(ctx: any): string | undefined {
  if (!ctx) return undefined;

  // Direct senderId (most reliable)
  if (ctx.senderId && typeof ctx.senderId === "string") {
    return ctx.senderId;
  }

  // From metadata
  if (ctx.metadata?.senderId && typeof ctx.metadata.senderId === "string") {
    return ctx.metadata.senderId;
  }

  // Parse from "From" field: "openclaw-feishu-plus:direct:ou_xxxxx"
  if (ctx.From && typeof ctx.From === "string") {
    const parts = ctx.From.split(":");
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.startsWith("ou_")) {
      return lastPart;
    }
  }

  // Check SenderId directly
  if (ctx.SenderId && typeof ctx.SenderId === "string") {
    return ctx.SenderId;
  }

  return undefined;
}

// ─── Dual-Auth Tool Registration ───

/**
 * 创建支持双授权的工具注册函数
 *
 * 关键改进：
 * 1. 从 OpenClaw ctx 中提取 userId 并传递给工具
 * 2. 捕获 AuthRequiredError 并转换为结构化授权提示
 * 3. 捕获其他错误并返回友好错误信息
 */
function createDualAuthToolRegistrar(api: any): (
  toolDef: { name: string; description: string; parameters: any },
  execute: (args: any, userId?: string) => Promise<any>,
) => void {
  return (toolDef, execute) => {
    if (typeof api.registerTool !== "function") return;

    api.registerTool({
      name: toolDef.name,
      description: toolDef.description,
      parameters: toolDef.parameters,
      execute: async (_toolUseId: string, params: any, ctx: any, _callback: any) => {
        const userId = extractUserId(ctx);
        try {
          return await execute(params, userId);
        } catch (err) {
          // AuthRequiredError → 返回授权提示（不抛错，让 agent 可以理解）
          if (err instanceof AuthRequiredError) {
            return {
              error: "authorization_required",
              message: err.authPrompt.message,
              authUrl: err.authPrompt.authUrl,
              operation: err.authPrompt.operation,
              requiredScopes: err.authPrompt.requiredScopes,
              hint: "请引导用户点击授权链接完成授权，授权后重试操作。",
            };
          }
          // Other errors → re-throw
          throw err;
        }
      },
    });
  };
}

// ─── Legacy Tool Registration (for tools not yet migrated) ───

function createLegacyToolRegistrar(api: any): (
  toolDef: { name: string; description: string; parameters: any },
  execute: (args: any) => Promise<any>,
) => void {
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
        redirectUri: channelCfg.auth?.redirectUri,
      },
    });

    const tokenStore = createTokenStore(
      pluginConfig.auth.store ?? "memory",
    );
    const resolver = new TokenResolver(pluginConfig, tokenStore);

    // Initialize both the request executor and the feishu-api module
    initExecutor(resolver);
    initFeishuApi(pluginConfig);

    // 4. Register tools

    // ── Dual-auth tools (doc, calendar) ──
    const dualAuthReg = createDualAuthToolRegistrar(api);
    registerDocTools(new DocTools(), dualAuthReg);
    registerCalendarTools(new CalendarTools(), dualAuthReg);
    registerChatTools(new ChatTools(), dualAuthReg);

    // ── OAuth management tools (pass userId from ctx) ──
    const oauthTools = new OAuthTools(pluginConfig, tokenStore);
    if (typeof api.registerTool === "function") {
      for (const toolDef of OAUTH_TOOL_DEFS) {
        api.registerTool({
          name: toolDef.name,
          description: toolDef.description,
          parameters: toolDef.parameters,
          execute: async (_toolUseId: string, params: any, ctx: any, _callback: any) => {
            const userId = extractUserId(ctx);
            return oauthTools.execute(toolDef.name, params, userId);
          },
        });
      }
    }

    // ── Legacy tools (not yet migrated to dual-auth) ──
    const legacyReg = createLegacyToolRegistrar(api);
    registerWikiTools(new WikiTools(pluginConfig, tokenStore), legacyReg);
    registerDriveTools(new DriveTools(pluginConfig, tokenStore), legacyReg);
    registerBitableTools(new BitableTools(pluginConfig, tokenStore), legacyReg);
    registerTaskTools(new TaskTools(pluginConfig, tokenStore), legacyReg);
    registerPermTools(new PermTools(pluginConfig, tokenStore), legacyReg);
    registerSheetsTools(new SheetsTools(pluginConfig, tokenStore), legacyReg);

    console.log(
      `[feishu-plus] registered (appId=${pluginConfig.appId?.slice(0, 10)}…, ` +
      `dual-auth-tools=doc,calendar,chat, ` +
      `legacy-tools=wiki,drive,bitable,task,perm,sheets)`,
    );
  },
};

export default plugin;
