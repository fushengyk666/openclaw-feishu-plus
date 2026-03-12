/**
 * policy.ts — DM/Group Policy & Gate
 *
 * 处理消息准入策略判断：
 * - DM: open / pairing / allowlist
 * - Group: open / allowlist / disabled
 *
 * 对标 OpenClaw 官方 feishu 扩展的 policy.ts
 */

import { resolveFeishuPlusAccount } from "./accounts.js";
import { resolveChannelConfig } from "./config.js";

/**
 * Resolve group tool policy for a given account.
 *
 * Used by the channel plugin's `groups.resolveToolPolicy`.
 */
export function resolveFeishuPlusGroupToolPolicy(
  cfg: any,
  accountId: string
): "allow" | "deny" {
  const account = resolveFeishuPlusAccount(cfg, accountId);
  const groupPolicy = account.config?.groupPolicy ?? "disabled";

  if (groupPolicy === "open") {
    return "allow";
  }

  if (groupPolicy === "disabled") {
    return "deny";
  }

  // "allowlist" mode
  const groupAllowFrom = account.config?.groupAllowFrom ?? [];
  if (groupAllowFrom.length === 0) {
    return "deny";
  }

  return "allow";
}

/**
 * Check if a sender is allowed to DM based on DM policy.
 *
 * @returns true if message should be processed, false if rejected
 */
export function isDmAllowed(params: {
  cfg: any;
  accountId: string;
  senderId: string;
  pairedIds?: string[];
}): boolean {
  const { cfg, accountId, senderId, pairedIds } = params;
  const account = resolveFeishuPlusAccount(cfg, accountId);
  const dmPolicy = account.config?.dmPolicy ?? "pairing";

  switch (dmPolicy) {
    case "open":
      return true;

    case "pairing":
      // Pairing mode: OpenClaw handles pairing via the channel plugin's pairing config
      // If paired IDs are provided, check membership; otherwise allow (pairing handled upstream)
      if (pairedIds) {
        return pairedIds.includes(senderId);
      }
      return true; // pairing enforcement is done by OpenClaw runtime

    case "allowlist": {
      const allowFrom = (account.config?.allowFrom ?? []).map(String);
      return allowFrom.includes(senderId);
    }

    default:
      return false;
  }
}

/**
 * Check if a group chat is allowed based on group policy.
 */
export function isGroupAllowed(params: {
  cfg: any;
  accountId: string;
  chatId: string;
}): boolean {
  const { cfg, accountId, chatId } = params;
  const account = resolveFeishuPlusAccount(cfg, accountId);
  const groupPolicy = account.config?.groupPolicy ?? "disabled";

  switch (groupPolicy) {
    case "open":
      return true;

    case "allowlist": {
      const groupAllowFrom = (account.config?.groupAllowFrom ?? []).map(String);
      return groupAllowFrom.includes(chatId);
    }

    case "disabled":
      return false;

    default:
      return false;
  }
}
