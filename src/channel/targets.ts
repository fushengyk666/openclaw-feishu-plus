/**
 * targets.ts — Feishu Plus Target Parsing and Formatting
 *
 * 处理 Feishu ID 前缀和规范化，对标 OpenClau feishu 扩展。
 */

const CHAT_PREFIX = "oc_";
const OPEN_ID_PREFIX = "ou_";
const TAG_CHAT = "chat:";
const TAG_USER = "user:";
const TAG_OPEN_ID = "open_id:";
const TAG_FEISHU = "feishu:";

/**
 * Detect Feishu ID type from a raw identifier string.
 */
export function detectIdType(id: string): "chat_id" | "open_id" | "user_id" | null {
  if (!id) return null;
  if (id.startsWith(CHAT_PREFIX)) return "chat_id";
  if (id.startsWith(OPEN_ID_PREFIX)) return "open_id";
  if (/^[a-zA-Z0-9]+$/.test(id)) return "user_id";
  return null;
}

/**
 * Strip OpenClaw routing prefixes from a raw target string.
 */
export function normalizeFeishuPlusTarget(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Handle Feishu channel prefix
  if (trimmed.startsWith(TAG_FEISHU)) {
    const inner = trimmed.slice(TAG_FEISHU.length).trim();
    if (inner) return inner;
  }

  if (trimmed.startsWith(TAG_CHAT)) return trimmed.slice(TAG_CHAT.length);
  if (trimmed.startsWith(TAG_USER)) return trimmed.slice(TAG_USER.length);
  if (trimmed.startsWith(TAG_OPEN_ID)) return trimmed.slice(TAG_OPEN_ID.length);

  return trimmed;
}

/**
 * Add appropriate OpenClaw routing prefix to a bare Feishu identifier.
 */
export function formatFeishuPlusTarget(id: string, type?: "chat_id" | "open_id" | "user_id"): string {
  const resolved = type || detectIdType(id);
  if (resolved === "chat_id") return `${TAG_CHAT}${id}`;
  return `${TAG_USER}${id}`;
}

/**
 * Determine `receive_id_type` query parameter for Feishu send-message API.
 */
export function resolveReceiveIdType(id: string): "chat_id" | "open_id" {
  if (id.startsWith(CHAT_PREFIX)) return "chat_id";
  if (id.startsWith(OPEN_ID_PREFIX)) return "open_id";
  return "open_id";
}

/**
 * Return true when a raw string looks like it could be a Feishu target.
 */
export function looksLikeFeishuPlusId(raw: string): boolean {
  if (!raw) return false;
  return (
    raw.startsWith(TAG_CHAT) ||
    raw.startsWith(TAG_USER) ||
    raw.startsWith(TAG_OPEN_ID) ||
    raw.startsWith(TAG_FEISHU) ||
    raw.startsWith(CHAT_PREFIX) ||
    raw.startsWith(OPEN_ID_PREFIX)
  );
}
