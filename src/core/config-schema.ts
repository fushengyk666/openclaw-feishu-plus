/**
 * config-schema.ts — 插件配置 Schema
 *
 * 使用 zod 定义完整的配置结构，包含：
 * - 飞书应用凭证（appId / appSecret）
 * - 域名选择（feishu / lark）
 * - 运行模式（full / tools-only）
 * - 身份策略配置
 * - 各工具开关
 */

import { z } from "zod";

// ─── 身份策略配置 ───
export const AuthConfigSchema = z.object({
  /** 对 support=both 的接口，是否优先使用 user token */
  preferUserToken: z.boolean().default(true),
  /** 当遇到 user_only 接口且无 user token 时，是否自动提示授权 */
  autoPromptUserAuth: z.boolean().default(true),
  /** token 持久化方式 */
  store: z
    .enum(["keychain-first", "file", "memory"])
    .default("keychain-first"),
});

// ─── 工具开关 ───
export const ToolsToggleSchema = z.object({
  doc: z.boolean().default(true),
  wiki: z.boolean().default(true),
  drive: z.boolean().default(true),
  bitable: z.boolean().default(true),
  calendar: z.boolean().default(true),
  task: z.boolean().default(true),
  chat: z.boolean().default(true),
  perm: z.boolean().default(true),
  approval: z.boolean().default(false),
  mail: z.boolean().default(false),
  contact: z.boolean().default(false),
});

// ─── 插件主配置 ───
export const PluginConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** 运行模式：full = channel + tools，tools-only = 仅注册工具 */
  mode: z.enum(["full", "tools-only"]).default("full"),
  /** 飞书自建应用 App ID */
  appId: z.string().min(1, "appId is required"),
  /** 飞书自建应用 App Secret */
  appSecret: z.string().min(1, "appSecret is required"),
  /** 域名：feishu（飞书）或 lark（海外） */
  domain: z.enum(["feishu", "lark"]).default("feishu"),
  /** 消息通道连接方式 */
  connectionMode: z.enum(["websocket", "webhook"]).default("websocket"),
  /** 身份策略 */
  auth: AuthConfigSchema.default({}),
  /** 工具开关 */
  tools: ToolsToggleSchema.default({}),
});

// ─── 导出类型 ───
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type ToolsToggle = z.infer<typeof ToolsToggleSchema>;
export type PluginConfig = z.infer<typeof PluginConfigSchema>;

/**
 * 解析并校验插件配置
 */
export function parseConfig(raw: unknown): PluginConfig {
  return PluginConfigSchema.parse(raw);
}
