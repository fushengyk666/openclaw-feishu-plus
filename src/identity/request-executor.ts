/**
 * request-executor.ts — 统一请求执行器
 *
 * 工具层唯一的 API 调用入口。
 * 自动完成：token 解析 → Authorization 注入 → 请求执行 → 401 重试
 */

import { TokenResolver, NeedUserAuthorizationError } from "./token-resolver.js";
import type { ResolveTokenResult, IdentityMode } from "./token-resolver.js";

// ─── 类型定义 ───

export interface ExecuteOptions<T> {
  /** API operation 标识，如 "docx.document.create" */
  operation: string;
  /** 当前用户 openId（可选） */
  userId?: string;
  /** 身份模式覆盖（可选，默认 auto） */
  identityMode?: IdentityMode;
  /** 实际执行函数，接收 token 上下文 */
  invoke: (ctx: InvokeContext) => Promise<T>;
  /** 401 时是否自动重试一次（默认 true） */
  retryOn401?: boolean;
}

export interface InvokeContext {
  /** 实际的 access_token */
  accessToken: string;
  /** token 类型 */
  tokenKind: "tenant" | "user";
  /** 构造好的 Authorization header 值 */
  authorizationHeader: string;
}

// ─── 执行器 ───

let _resolver: TokenResolver | null = null;

/**
 * 初始化执行器（插件启动时调用一次）
 */
export function initExecutor(resolver: TokenResolver): void {
  _resolver = resolver;
}

function getResolver(): TokenResolver {
  if (!_resolver) {
    throw new Error(
      "[RequestExecutor] Not initialized. Call initExecutor() first."
    );
  }
  return _resolver;
}

/**
 * 统一请求执行器
 *
 * 工具层调用示例：
 * ```ts
 * const result = await executeFeishuRequest({
 *   operation: "docx.document.create",
 *   userId: currentUserId,
 *   identityMode: "user",
 *   invoke: async ({ accessToken, authorizationHeader }) => {
 *     return await fetch(url, {
 *       headers: { Authorization: authorizationHeader },
 *       body: JSON.stringify(payload),
 *     });
 *   },
 * });
 * ```
 *
 * 失败重试策略：
 * 1. 首次调用失败（401 或 token invalid）
 * 2. 触发 tokenResolver.invalidate() 清除可能的缓存
 * 3. 重新解析 token（会触发刷新或重新获取）
 * 4. 使用新 token 重试一次
 */
export async function executeFeishuRequest<T>(
  opts: ExecuteOptions<T>,
): Promise<T> {
  const resolver = getResolver();
  const resolved = await resolver.resolve({
    operation: opts.operation,
    userId: opts.userId,
    identityMode: opts.identityMode,
  });

  const ctx = buildInvokeContext(resolved);

  try {
    return await opts.invoke(ctx);
  } catch (err: unknown) {
    // 401 或 token 无效错误时自动重试一次
    if (opts.retryOn401 !== false && isAuthError(err)) {
      // 第一步：使当前 token 失效，强制重新解析
      await resolver.invalidate(resolved.kind, opts.userId);

      // 第二步：重新解析 token（可能触发刷新或获取新 token）
      const retryResolved = await resolver.resolve({
        operation: opts.operation,
        userId: opts.userId,
        identityMode: opts.identityMode,
      });

      // 第三步：使用新 token 重试
      const retryCtx = buildInvokeContext(retryResolved);
      return await opts.invoke(retryCtx);
    }
    throw err;
  }
}

// ─── 内部辅助 ───

function buildInvokeContext(resolved: ResolveTokenResult): InvokeContext {
  return {
    accessToken: resolved.accessToken,
    tokenKind: resolved.kind,
    authorizationHeader: `Bearer ${resolved.accessToken}`,
  };
}

function isAuthError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    // HTTP 401
    if (e.status === 401 || e.statusCode === 401) return true;
    // 飞书 token 无效/过期错误码
    if (e.code === 99991663 || e.code === 99991664) return true;
  }
  return false;
}
