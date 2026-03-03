import { FeishuPlusError } from "./errors.js";

function detectBaseUrl(domain) {
  if (!domain || domain === "feishu") return "https://open.feishu.cn";
  if (domain === "lark") return "https://open.larksuite.com";
  if (/^https?:\/\//.test(domain)) return domain.replace(/\/$/, "");
  return `https://${domain.replace(/\/$/, "")}`;
}

function getFeishuCfg(api) {
  const cfg = api?.config?.channels?.feishu;
  if (!cfg || cfg.enabled === false) {
    throw new FeishuPlusError("feishu_channel_missing", "channels.feishu 未配置或未启用");
  }
  // current deployment uses top-level appId/appSecret; accounts mode optional
  const appId = cfg.appId || cfg.accounts?.default?.appId;
  const appSecret = cfg.appSecret || cfg.accounts?.default?.appSecret;
  if (!appId || !appSecret) {
    throw new FeishuPlusError("feishu_credentials_missing", "缺少 Feishu appId/appSecret");
  }
  const baseUrl = detectBaseUrl(cfg.domain || cfg.accounts?.default?.domain);
  return { appId, appSecret, baseUrl };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, init, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status >= 500) {
        const body = await res.text().catch(() => "");
        lastErr = new FeishuPlusError("feishu_retryable_http", `HTTP ${res.status}`, { status: res.status, body });
        if (i < retries) {
          await sleep(300 * (i + 1));
          continue;
        }
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await sleep(300 * (i + 1));
        continue;
      }
    }
  }
  throw lastErr;
}

export async function createFeishuClient(api) {
  const { appId, appSecret, baseUrl } = getFeishuCfg(api);

  const tokenRes = await fetchWithRetry(`${baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || tokenJson?.code !== 0 || !tokenJson?.tenant_access_token) {
    throw new FeishuPlusError("feishu_auth_failed", "获取 tenant_access_token 失败", {
      status: tokenRes.status,
      body: tokenJson,
    });
  }
  const accessToken = tokenJson.tenant_access_token;

  async function call(path, { method = "GET", query, body } = {}) {
    const url = new URL(`${baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
      }
    }
    const res = await fetchWithRetry(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.code !== 0) {
      throw new FeishuPlusError("feishu_api_error", `Feishu API 调用失败: ${path}`, {
        status: res.status,
        response: json,
      });
    }
    return json;
  }

  return {
    async listPermissionMembers(token, type) {
      return call(`/open-apis/drive/v1/permissions/${encodeURIComponent(token)}/members`, {
        query: { type },
      });
    },
    async addPermissionMember(token, type, memberType, memberId, perm, needNotification = false) {
      return call(`/open-apis/drive/v1/permissions/${encodeURIComponent(token)}/members`, {
        method: "POST",
        query: { type, need_notification: needNotification ? "true" : "false" },
        body: {
          member_type: memberType,
          member_id: memberId,
          perm,
        },
      });
    },
    async deletePermissionMember(token, type, memberType, memberId) {
      return call(
        `/open-apis/drive/v1/permissions/${encodeURIComponent(token)}/members/${encodeURIComponent(memberId)}`,
        {
          method: "DELETE",
          query: { type, member_type: memberType },
        },
      );
    },

    // ===== Bitable extras =====
    async bitableListTables(appToken) {
      return call(`/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables`, {
        query: { page_size: 200 },
      });
    },
    async bitableCreateTable(appToken, tableName) {
      return call(`/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables`, {
        method: "POST",
        body: { table: { name: tableName } },
      });
    },
    async bitableDeleteRecord(appToken, tableId, recordId) {
      return call(
        `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
        { method: "DELETE" },
      );
    },
    async bitableBatchCreateRecords(appToken, tableId, records) {
      return call(
        `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/batch_create`,
        {
          method: "POST",
          body: {
            records: records.map((r) => ({ fields: r.fields })),
          },
        },
      );
    },
    async bitableBatchUpdateRecords(appToken, tableId, records) {
      return call(
        `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/batch_update`,
        {
          method: "POST",
          body: {
            records: records.map((r) => ({ record_id: r.record_id, fields: r.fields })),
          },
        },
      );
    },
    async bitableBatchDeleteRecords(appToken, tableId, recordIds) {
      return call(
        `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/batch_delete`,
        {
          method: "POST",
          body: { records: recordIds },
        },
      );
    },

    // ===== Calendar extras =====
    async calendarListCalendars(query = {}) {
      return call(`/open-apis/calendar/v4/calendars`, { query });
    },
    async calendarListEvents(calendarId, query = {}) {
      return call(`/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events`, {
        query,
      });
    },
    async calendarGetEvent(calendarId, eventId) {
      return call(
        `/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      );
    },
    async calendarCreateEvent(calendarId, body) {
      return call(`/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: "POST",
        body,
      });
    },
    async calendarUpdateEvent(calendarId, eventId, body) {
      return call(
        `/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          body,
        },
      );
    },
    async calendarDeleteEvent(calendarId, eventId) {
      return call(
        `/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
      );
    },
  };
}
