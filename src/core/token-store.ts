/**
 * token-store.ts — User Access Token 持久化存储
 *
 * 管理 per appId × per userOpenId 的 UAT 生命周期：
 * - 存储 access_token / refresh_token / expire / scope
 * - 支持多种持久化后端（memory / file / keychain）
 * - 提供 token 有效性检查与自动刷新
 */

// ─── 类型定义 ───

export interface StoredUserToken {
  /** 用户 access_token */
  accessToken: string;
  /** 用于刷新的 refresh_token */
  refreshToken: string;
  /** access_token 过期时间（Unix ms） */
  expiresAt: number;
  /** refresh_token 过期时间（Unix ms） */
  refreshExpiresAt: number;
  /** 已授权的 scope 列表 */
  scopes: string[];
  /** 用户 open_id */
  userOpenId: string;
  /** 用户 union_id（可选） */
  userUnionId?: string;
  /** token 最后更新时间 */
  updatedAt: number;
}

/** 存储 key = `${appId}:${userOpenId}` */
export type TokenStoreKey = string;

function makeKey(appId: string, userOpenId: string): TokenStoreKey {
  return `${appId}:${userOpenId}`;
}

// ─── Token Store 接口 ───

export interface ITokenStore {
  get(appId: string, userOpenId: string): Promise<StoredUserToken | null>;
  set(
    appId: string,
    userOpenId: string,
    token: StoredUserToken
  ): Promise<void>;
  delete(appId: string, userOpenId: string): Promise<void>;
  /** 列出指定 appId 下所有已授权用户 */
  listUsers(appId: string): Promise<string[]>;
}

// ─── 内存实现（开发/测试用） ───

export class MemoryTokenStore implements ITokenStore {
  private store = new Map<TokenStoreKey, StoredUserToken>();

  async get(
    appId: string,
    userOpenId: string
  ): Promise<StoredUserToken | null> {
    return this.store.get(makeKey(appId, userOpenId)) ?? null;
  }

  async set(
    appId: string,
    userOpenId: string,
    token: StoredUserToken
  ): Promise<void> {
    this.store.set(makeKey(appId, userOpenId), token);
  }

  async delete(appId: string, userOpenId: string): Promise<void> {
    this.store.delete(makeKey(appId, userOpenId));
  }

  async listUsers(appId: string): Promise<string[]> {
    const prefix = `${appId}:`;
    const users: string[] = [];
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        users.push(key.slice(prefix.length));
      }
    }
    return users;
  }
}

// ─── 文件持久化实现 ───

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

export class FileTokenStore implements ITokenStore {
  private filePath: string;
  private cache: Record<TokenStoreKey, StoredUserToken> | null = null;

  constructor(storagePath: string) {
    this.filePath = join(storagePath, "openclaw-feishu-plus", "user-tokens.json");
  }

  private async load(): Promise<Record<TokenStoreKey, StoredUserToken>> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.filePath, "utf-8");
      this.cache = JSON.parse(raw) as Record<TokenStoreKey, StoredUserToken>;
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private async save(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.cache, null, 2), "utf-8");
  }

  async get(
    appId: string,
    userOpenId: string
  ): Promise<StoredUserToken | null> {
    const data = await this.load();
    return data[makeKey(appId, userOpenId)] ?? null;
  }

  async set(
    appId: string,
    userOpenId: string,
    token: StoredUserToken
  ): Promise<void> {
    const data = await this.load();
    data[makeKey(appId, userOpenId)] = token;
    await this.save();
  }

  async delete(appId: string, userOpenId: string): Promise<void> {
    const data = await this.load();
    delete data[makeKey(appId, userOpenId)];
    await this.save();
  }

  async listUsers(appId: string): Promise<string[]> {
    const data = await this.load();
    const prefix = `${appId}:`;
    return Object.keys(data)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }
}

// ─── 工厂函数 ───

/**
 * 根据配置创建 TokenStore 实例
 */
export function createTokenStore(
  storeType: "memory" | "file" | "keychain-first",
  storagePath?: string
): ITokenStore {
  switch (storeType) {
    case "memory":
      return new MemoryTokenStore();
    case "file":
    case "keychain-first":
      // keychain-first 暂时回退到 file 实现
      // TODO: 实现 keychain 后端（macOS Keychain / Linux Secret Service）
      return new FileTokenStore(storagePath ?? process.cwd());
    default:
      return new MemoryTokenStore();
  }
}

// ─── 辅助函数 ───

/** 检查 token 是否已过期（含 60s 缓冲） */
export function isTokenExpired(token: StoredUserToken): boolean {
  return Date.now() >= token.expiresAt - 60_000;
}

/** 检查 refresh_token 是否已过期 */
export function isRefreshTokenExpired(token: StoredUserToken): boolean {
  return Date.now() >= token.refreshExpiresAt;
}

/** 检查 token 是否包含所需 scope */
export function hasRequiredScopes(
  token: StoredUserToken,
  requiredScopes: string[]
): boolean {
  if (requiredScopes.length === 0) return true;
  return requiredScopes.every((s) => token.scopes.includes(s));
}
