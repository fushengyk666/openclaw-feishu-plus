/**
 * src/index.ts - 插件唯一入口
 *
 * 注意：这是 src/ 目录下的入口文件，项目根目录也有一个 index.ts。
 * 本文件主要用于 src/ 内部的导出和组织。
 */

// 导出核心模块
export * from "./core/config-schema.js";
export * from "./core/client.js";
export * from "./core/token-store.js";
export * from "./core/token-resolver.js";
export * from "./core/request-executor.js";

// 导出 Channel 相关
export * from "./channel/plugin.js";
export * from "./channel/onboarding.js";

// 导出常量
export { PLUGIN_ID, CHANNEL_ID, CONFIG_NAMESPACE } from "./constants.js";

// 导出类型定义（供外部使用）
export type { FeishuChannel, FeishuMessage } from "./channel/plugin.js";
