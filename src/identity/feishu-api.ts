/**
 * feishu-api.ts — High-level Feishu HTTP Client (Dual-Auth Aware)
 *
 * 所有工具层通过这个模块调用飞书 API。
 * 内部自动经过 executeFeishuRequest → TokenResolver → 决定用 user / tenant token。
 *
 * 替代直接使用 lark.Client 的方式，确保每个 API 调用都经过双授权决策链路。
 */

import { executeFeishuRequest } from "./request-executor.js";
import { NeedUserAuthorizationError } from "./token-resolver.js";
import type { IdentityMode } from "./token-resolver.js";
export type { IdentityMode } from "./token-resolver.js";
import { generateAuthPrompt } from "./auth-prompt.js";
import type { PluginConfig } from "./config-schema.js";

// ─── 类型定义 ───

export interface FeishuApiOptions {
  /** API operation 标识（必须在 api-policy.ts 中注册） */
  operation: string;
  /** HTTP 方法 */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** API 路径（不含域名前缀，如 /open-apis/docx/v1/documents） */
  path: string;
  /** 当前用户 openId（可选） */
  userId?: string;
  /** 身份模式覆盖（可选，默认 auto）*/
  identityMode?: IdentityMode;
  /** 请求体（POST/PUT/PATCH） */
  body?: unknown;
  /** URL query 参数 */
  params?: Record<string, string | number | boolean | undefined>;
  /** 额外 headers */
  headers?: Record<string, string>;
}

export interface FeishuApiResult<T = unknown> {
  /** 飞书 API 返回码（0 = 成功） */
  code: number;
  /** 飞书 API 返回消息 */
  msg: string;
  /** 返回数据 */
  data: T;
  /** 使用的 token 类型 */
  tokenKind: "tenant" | "user";
}

// ─── 授权提示错误（工具层可直接返回给用户） ───

export class AuthRequiredError extends Error {
  public readonly authPrompt: {
    message: string;
    authUrl?: string;
    requiredScopes: string[];
    operation: string;
  };

  constructor(prompt: {
    message: string;
    authUrl?: string;
    requiredScopes: string[];
    operation: string;
  }) {
    super(prompt.message);
    this.name = "AuthRequiredError";
    this.authPrompt = prompt;
  }
}

// ─── 模块级配置 ───

let _config: PluginConfig | null = null;

/**
 * 初始化 feishu-api 模块（插件启动时调用一次）
 */
export function initFeishuApi(config: PluginConfig): void {
  _config = config;
}

function getConfig(): PluginConfig {
  if (!_config) {
    throw new Error("[FeishuApi] Not initialized. Call initFeishuApi() first.");
  }
  return _config;
}

function getBaseUrl(): string {
  const config = getConfig();
  const domain = config.domain === "lark" ? "lark" : "feishu";
  return `https://open.${domain}.cn`;
}

// ─── 核心请求函数 ───

/**
 * 发起飞书 API 请求（经过双授权决策链路）
 *
 * 这是工具层调用飞书 API 的唯一入口。
 *
 * 流程：
 * 1. 通过 executeFeishuRequest 解析 token（user / tenant）
 * 2. 构建 HTTP 请求并执行
 * 3. 解析返回值
 * 4. 如果遇到 NeedUserAuthorizationError，生成授权提示
 */
export async function feishuRequest<T = unknown>(
  opts: FeishuApiOptions,
): Promise<FeishuApiResult<T>> {
  const config = getConfig();

  try {
    return await executeFeishuRequest<FeishuApiResult<T>>({
      operation: opts.operation,
      userId: opts.userId,
      identityMode: opts.identityMode,
      invoke: async (ctx) => {
        const url = buildUrl(opts.path, opts.params);
        const headers: Record<string, string> = {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: ctx.authorizationHeader,
          ...opts.headers,
        };

        const fetchOpts: RequestInit = {
          method: opts.method,
          headers,
        };

        if (opts.body !== undefined && opts.method !== "GET" && opts.method !== "DELETE") {
          fetchOpts.body = JSON.stringify(opts.body);
        }

        const resp = await fetch(url, fetchOpts);
        const json = (await resp.json()) as {
          code: number;
          msg: string;
          data?: T;
        };

        // 飞书 token 无效/过期错误码 → 抛出让 request-executor 重试
        if (json.code === 99991663 || json.code === 99991664) {
          const err = new Error(`Token invalid/expired: [${json.code}] ${json.msg}`);
          (err as any).code = json.code;
          throw err;
        }

        // 非 token 错误但非成功
        if (json.code !== 0) {
          const err = new Error(`Feishu API error: [${json.code}] ${json.msg}`);
          (err as any).code = json.code;
          (err as any).feishuCode = json.code;
          (err as any).feishuMsg = json.msg;
          throw err;
        }

        return {
          code: json.code,
          msg: json.msg,
          data: json.data as T,
          tokenKind: ctx.tokenKind,
        };
      },
    });
  } catch (err) {
    // 捕获 NeedUserAuthorizationError → 转换为用户友好的授权提示
    if (err instanceof NeedUserAuthorizationError) {
      const prompt = generateAuthPrompt({
        config,
        operation: err.operation,
        requiredScopes: err.requiredScopes,
      });
      throw new AuthRequiredError(prompt);
    }
    throw err;
  }
}

// ─── 便捷方法 ───

export async function feishuGet<T = unknown>(
  operation: string,
  path: string,
  opts?: {
    userId?: string;
    identityMode?: IdentityMode;
    params?: Record<string, string | number | boolean | undefined>;
  },
): Promise<FeishuApiResult<T>> {
  return feishuRequest<T>({
    operation,
    method: "GET",
    path,
    userId: opts?.userId,
    identityMode: opts?.identityMode,
    params: opts?.params,
  });
}

export async function feishuPost<T = unknown>(
  operation: string,
  path: string,
  body?: unknown,
  opts?: {
    userId?: string;
    identityMode?: IdentityMode;
    params?: Record<string, string | number | boolean | undefined>;
  },
): Promise<FeishuApiResult<T>> {
  return feishuRequest<T>({
    operation,
    method: "POST",
    path,
    body,
    userId: opts?.userId,
    identityMode: opts?.identityMode,
    params: opts?.params,
  });
}

export async function feishuPatch<T = unknown>(
  operation: string,
  path: string,
  body?: unknown,
  opts?: {
    userId?: string;
    identityMode?: IdentityMode;
    params?: Record<string, string | number | boolean | undefined>;
  },
): Promise<FeishuApiResult<T>> {
  return feishuRequest<T>({
    operation,
    method: "PATCH",
    path,
    body,
    userId: opts?.userId,
    identityMode: opts?.identityMode,
    params: opts?.params,
  });
}

export async function feishuDelete<T = unknown>(
  operation: string,
  path: string,
  opts?: {
    userId?: string;
    identityMode?: IdentityMode;
    params?: Record<string, string | number | boolean | undefined>;
  },
): Promise<FeishuApiResult<T>> {
  return feishuRequest<T>({
    operation,
    method: "DELETE",
    path,
    userId: opts?.userId,
    identityMode: opts?.identityMode,
    params: opts?.params,
  });
}

export async function feishuPut<T = unknown>(
  operation: string,
  path: string,
  body?: unknown,
  opts?: {
    userId?: string;
    identityMode?: IdentityMode;
  },
): Promise<FeishuApiResult<T>> {
  return feishuRequest<T>({
    operation,
    method: "PUT",
    path,
    body,
    userId: opts?.userId,
    identityMode: opts?.identityMode,
  });
}

// ─── 内部辅助 ───

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const base = getBaseUrl();
  const url = new URL(path, base);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}
