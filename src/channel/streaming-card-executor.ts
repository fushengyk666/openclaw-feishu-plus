/**
 * streaming-card-executor.ts — CardKit streaming card side-effect executor
 *
 * Aligned with the official OpenClaw feishu plugin:
 * Uses raw HTTP calls (fetch) instead of SDK wrapper methods,
 * since the SDK doesn't reliably expose all CardKit v1 endpoints.
 *
 * All CardKit calls use tenant_access_token (bot context).
 */

export interface StreamingCardTarget {
  targetId: string;
  receiveIdType: "open_id" | "chat_id";
}

export interface StreamingCardSdk {
  createCard(payload: any): Promise<any>;
  updateElementContent(cardId: string, elementId: string, body: any): Promise<void>;
  updateSettings(cardId: string, body: any): Promise<void>;
}

/** Token cache for CardKit HTTP calls (keyed by appId) */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function resolveApiBase(domain?: string): string {
  if (domain === "lark") return "https://open.larksuite.com/open-apis";
  if (domain && domain !== "feishu" && domain.startsWith("http")) {
    return `${domain.replace(/\/+$/, "")}/open-apis`;
  }
  return "https://open.feishu.cn/open-apis";
}

async function getTenantToken(creds: { appId: string; appSecret: string; domain?: string }): Promise<string> {
  const key = `${creds.domain ?? "feishu"}|${creds.appId}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const apiBase = resolveApiBase(creds.domain);
  const res = await fetch(`${apiBase}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: creds.appId, app_secret: creds.appSecret }),
  });
  if (!res.ok) throw new Error(`Token request failed with HTTP ${res.status}`);
  const data = await res.json() as {
    code: number; msg: string;
    tenant_access_token?: string; expire?: number;
  };
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Token error: ${data.msg}`);
  }
  tokenCache.set(key, {
    token: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire ?? 7200) * 1000,
  });
  return data.tenant_access_token;
}

/**
 * Create a StreamingCardSdk using raw HTTP calls.
 * This bypasses the Lark SDK and directly calls CardKit v1 endpoints,
 * matching the official OpenClaw feishu plugin pattern.
 */
export function createStreamingCardSdk(
  _client: any,
  creds?: { appId: string; appSecret: string; domain?: string },
): StreamingCardSdk {
  // If no creds provided, fall back to SDK methods (legacy path)
  if (!creds) {
    return createSdkFallbackStreamingCardSdk(_client);
  }

  const apiBase = resolveApiBase(creds.domain);

  return {
    createCard: async (payload: any) => {
      const token = await getTenantToken(creds);
      const res = await fetch(`${apiBase}/cardkit/v1/cards`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload.data ?? payload),
      });
      if (!res.ok) throw new Error(`Create card HTTP ${res.status}`);
      const json = await res.json() as any;
      if (json.code !== 0) throw new Error(`Create card failed: ${json.msg}`);
      return json;
    },

    updateElementContent: async (cardId: string, elementId: string, body: any) => {
      const token = await getTenantToken(creds);
      const res = await fetch(
        `${apiBase}/cardkit/v1/cards/${cardId}/elements/${elementId}/content`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        // Best-effort: log but don't throw for content updates
        const text = await res.text().catch(() => "");
        throw new Error(`Update content HTTP ${res.status}: ${text}`);
      }
    },

    updateSettings: async (cardId: string, body: any) => {
      const token = await getTenantToken(creds);
      const res = await fetch(
        `${apiBase}/cardkit/v1/cards/${cardId}/settings`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Update settings HTTP ${res.status}: ${text}`);
      }
    },
  };
}

/**
 * Legacy SDK fallback — used when creds aren't available.
 * Maps to the old SDK wrapper approach (may not work for all CardKit endpoints).
 */
function createSdkFallbackStreamingCardSdk(client: any): StreamingCardSdk {
  return {
    createCard: (payload) => client.cardkit.v1.card.create(payload),
    updateElementContent: async (cardId, elementId, body) => {
      await (client.cardkit as any).v1.cardElement.content({
        data: body,
        path: { card_id: cardId, element_id: elementId },
      });
    },
    updateSettings: async (cardId, body) => {
      await (client.cardkit as any).v1.card.settings({
        data: body,
        path: { card_id: cardId },
      });
    },
  };
}
