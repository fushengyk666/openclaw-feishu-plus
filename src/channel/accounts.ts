/**
 * accounts.ts — Feishu Plus Account Management
 *
 * 管理 multi-account 生命周期，对标 OpenClau feishu 扩展。
 */

import { CONFIG_NAMESPACE } from "../constants.js";

const DEFAULT_ACCOUNT_ID = "default";

export interface FeishuAccountConfig {
  enabled?: boolean;
  name?: string;
  appId?: string;
  appSecret?: string;
  encryptKey?: string;
  verificationToken?: string;
  domain?: "feishu" | "lark";
  connectionMode?: "websocket" | "webhook";
  webhookHost?: string;
  webhookPath?: string;
  /** Optional card action webhook path; defaults to `${webhookPath}/card-action` */
  cardActionPath?: string;
  webhookPort?: number;
  dmPolicy?: "open" | "pairing" | "allowlist";
  allowFrom?: Array<string | number>;
  groupPolicy?: "open" | "allowlist" | "disabled";
  groupAllowFrom?: Array<string | number>;
  requireMention?: boolean;
  typingIndicator?: boolean;
  resolveSenderNames?: boolean;
  historyLimit?: number;
  textChunkLimit?: number;
  mediaMaxMb?: number;
  streaming?: boolean;
  streamingInGroup?: boolean;
  accounts?: Record<string, FeishuAccountConfig>;
}

export interface ResolvedFeishuAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  name?: string;
  appId?: string;
  appSecret?: string;
  domain?: "feishu" | "lark";
  config: FeishuAccountConfig;
}

/**
 * List all account IDs defined in Feishu Plus config.
 */
export function getFeishuPlusAccountIds(cfg: any): string[] {
  const section = cfg?.channels?.[CONFIG_NAMESPACE];
  if (!section) {
    return [DEFAULT_ACCOUNT_ID];
  }

  const accountMap = section.accounts;
  if (!accountMap || Object.keys(accountMap).length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }

  return Object.keys(accountMap);
}

/**
 * Return first (default) account ID.
 */
export function getDefaultFeishuPlusAccountId(cfg: any): string {
  return getFeishuPlusAccountIds(cfg)[0];
}

/**
 * Resolve a single account by merging top-level config with account-level overrides.
 */
export function resolveFeishuPlusAccount(cfg: any, accountId: string): ResolvedFeishuAccount {
  const requestedId = accountId || DEFAULT_ACCOUNT_ID;
  const section = cfg?.channels?.[CONFIG_NAMESPACE];

  if (!section) {
    return {
      accountId: requestedId,
      enabled: false,
      configured: false,
      config: {},
    };
  }

  // Merge account-level overrides
  const accountOverride =
    requestedId !== DEFAULT_ACCOUNT_ID ? section.accounts?.[requestedId] : undefined;

  const merged: FeishuAccountConfig = accountOverride
    ? { ...section, ...accountOverride }
    : { ...section };

  const appId = merged.appId;
  const appSecret = merged.appSecret;
  const configured = !!(appId && appSecret);
  const enabled = !!(merged.enabled ?? configured);

  return {
    accountId: requestedId,
    enabled,
    configured,
    name: merged.name,
    appId,
    appSecret,
    domain: merged.domain,
    config: merged,
  };
}
