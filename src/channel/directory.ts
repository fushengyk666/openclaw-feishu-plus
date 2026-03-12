/**
 * directory.ts — Feishu Plus Directory
 *
 * 提供 peers/groups 的离线和在线查询能力。
 */

import { resolveFeishuPlusAccount } from "./accounts.js";
import { normalizeFeishuPlusTarget } from "./targets.js";
import { getLarkClient } from "../identity/client.js";

export interface DirectoryEntry {
  kind: "user" | "group";
  id: string;
  name?: string;
}

/**
 * List users known from config (allowFrom entries).
 */
export async function listFeishuPlusDirectoryPeers(params: {
  cfg: any;
  query?: string;
  limit?: number;
  accountId?: string;
}): Promise<DirectoryEntry[]> {
  const account = resolveFeishuPlusAccount(params.cfg, params.accountId || "default");
  const feishuCfg = account.config;
  const q = params.query?.trim().toLowerCase() || "";
  const ids = new Set<string>();

  for (const entry of feishuCfg?.allowFrom ?? []) {
    const trimmed = String(entry).trim();
    if (trimmed && trimmed !== "*") ids.add(trimmed);
  }

  return Array.from(ids)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => normalizeFeishuPlusTarget(raw) ?? raw)
    .filter((id) => (q ? id.toLowerCase().includes(q) : true))
    .slice(0, params.limit && params.limit > 0 ? params.limit : undefined)
    .map((id) => ({ kind: "user" as const, id }));
}

/**
 * List groups known from config (groupAllowFrom entries).
 */
export async function listFeishuPlusDirectoryGroups(params: {
  cfg: any;
  query?: string;
  limit?: number;
  accountId?: string;
}): Promise<DirectoryEntry[]> {
  const account = resolveFeishuPlusAccount(params.cfg, params.accountId || "default");
  const feishuCfg = account.config;
  const q = params.query?.trim().toLowerCase() || "";
  const ids = new Set<string>();

  for (const entry of feishuCfg?.groupAllowFrom ?? []) {
    const trimmed = String(entry).trim();
    if (trimmed && trimmed !== "*") ids.add(trimmed);
  }

  return Array.from(ids)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .filter((id) => (q ? id.toLowerCase().includes(q) : true))
    .slice(0, params.limit && params.limit > 0 ? params.limit : undefined)
    .map((id) => ({ kind: "group" as const, id }));
}

/**
 * List users via Feishu contact API (live).
 */
export async function listFeishuPlusDirectoryPeersLive(params: {
  cfg: any;
  query?: string;
  limit?: number;
  accountId?: string;
}): Promise<DirectoryEntry[]> {
  const account = resolveFeishuPlusAccount(params.cfg, params.accountId || "default");
  if (!account.configured) {
    return listFeishuPlusDirectoryPeers(params);
  }

  try {
    const client = getLarkClient(account.config as any);
    const limit = params.limit ?? 50;
    const response = await client.contact.user.list({
      params: { page_size: Math.min(limit, 50) },
    });

    const items = response?.data?.items ?? [];
    return items
      .filter((u: any) => {
        if (!params.query) return true;
        const q = params.query.toLowerCase();
        return (
          u.name?.toLowerCase().includes(q) ||
          u.open_id?.toLowerCase().includes(q)
        );
      })
      .slice(0, limit)
      .map((u: any) => ({
        kind: "user" as const,
        id: u.open_id || u.user_id || "",
        name: u.name,
      }));
  } catch {
    return listFeishuPlusDirectoryPeers(params);
  }
}

/**
 * List groups via Feishu chat API (live).
 */
export async function listFeishuPlusDirectoryGroupsLive(params: {
  cfg: any;
  query?: string;
  limit?: number;
  accountId?: string;
}): Promise<DirectoryEntry[]> {
  const account = resolveFeishuPlusAccount(params.cfg, params.accountId || "default");
  if (!account.configured) {
    return listFeishuPlusDirectoryGroups(params);
  }

  try {
    const client = getLarkClient(account.config as any);
    const limit = params.limit ?? 50;
    const response = await client.im.chat.list({
      params: { page_size: Math.min(limit, 50) },
    });

    const items = response?.data?.items ?? [];
    return items
      .filter((g: any) => {
        if (!params.query) return true;
        const q = params.query.toLowerCase();
        return (
          g.name?.toLowerCase().includes(q) ||
          g.chat_id?.toLowerCase().includes(q)
        );
      })
      .slice(0, limit)
      .map((g: any) => ({
        kind: "group" as const,
        id: g.chat_id || "",
        name: g.name,
      }));
  } catch {
    return listFeishuPlusDirectoryGroups(params);
  }
}
