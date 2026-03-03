import { FeishuPlusError } from "./errors.js";

function need(params, fields, action) {
  for (const f of fields) {
    if (params[f] === undefined || params[f] === null || params[f] === "") {
      throw new FeishuPlusError("invalid_params", `${action} 缺少必填参数: ${f}`);
    }
  }
}

function normalizeTime(value, timezone = "Asia/Shanghai") {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object") return value;
  // accept unix seconds as number/string
  const ts = Number(value);
  if (!Number.isFinite(ts)) {
    throw new FeishuPlusError("invalid_params", `时间参数无效: ${value}`);
  }
  return {
    timestamp: String(Math.floor(ts)),
    timezone,
  };
}

function unwrapEvent(data) {
  // Feishu calendar event responses are typically:
  // { data: { event: {...} } }
  // keep compatibility if upstream already returns event object directly.
  return data?.event || data || null;
}

function pickEventId(event) {
  if (!event || typeof event !== "object") return null;
  return event.event_id || event.id || event.uid || null;
}

export async function runCalendarAction(client, params) {
  const action = params.action;

  if (action === "list_calendars") {
    const res = await client.calendarListCalendars({
      page_token: params.page_token,
      page_size: params.page_size,
    });

    // Feishu v4 returns `calendar_list`; keep backward compatibility with `items`.
    const items = res?.data?.calendar_list || res?.data?.items || [];

    return {
      ok: true,
      action,
      items,
      has_more: Boolean(res?.data?.has_more),
      page_token: res?.data?.page_token || null,
    };
  }

  if (action === "list_events") {
    need(params, ["calendar_id"], action);
    const res = await client.calendarListEvents(params.calendar_id, {
      page_token: params.page_token,
      page_size: params.page_size,
    });
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      items: res?.data?.items || [],
      has_more: Boolean(res?.data?.has_more),
      page_token: res?.data?.page_token || null,
    };
  }

  if (action === "list_acls") {
    need(params, ["calendar_id"], action);
    const res = await client.calendarListAcls(params.calendar_id, {
      page_token: params.page_token,
      page_size: params.page_size,
      user_id_type: params.user_id_type,
    });
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      items: res?.data?.acls || [],
      has_more: Boolean(res?.data?.has_more),
      page_token: res?.data?.page_token || null,
    };
  }

  if (action === "create_acl") {
    need(params, ["calendar_id", "role", "scope_user_id"], action);
    const userIdType = params.user_id_type || "open_id";
    const res = await client.calendarCreateAcl(
      params.calendar_id,
      {
        role: params.role,
        scope: {
          type: "user",
          user_id: params.scope_user_id,
        },
      },
      { user_id_type: userIdType },
    );
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      acl: res?.data || null,
    };
  }

  if (action === "delete_acl") {
    need(params, ["calendar_id", "acl_id"], action);
    await client.calendarDeleteAcl(params.calendar_id, params.acl_id);
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      acl_id: params.acl_id,
      deleted: true,
    };
  }

  if (action === "get_event") {
    need(params, ["calendar_id", "event_id"], action);
    const res = await client.calendarGetEvent(params.calendar_id, params.event_id);
    const event = unwrapEvent(res?.data);
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      event_id: pickEventId(event) || params.event_id,
      event,
    };
  }

  if (action === "create_event") {
    need(params, ["calendar_id", "summary", "start_time", "end_time"], action);
    const timezone = params.timezone || "Asia/Shanghai";
    const body = {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start_time: normalizeTime(params.start_time, timezone),
      end_time: normalizeTime(params.end_time, timezone),
      attendees: params.attendees,
      reminders: params.reminders,
      visibility: params.visibility,
      ...(params.extra_fields || {}),
    };
    // remove undefined keys
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
    const res = await client.calendarCreateEvent(params.calendar_id, body);
    const event = unwrapEvent(res?.data);
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      event_id: pickEventId(event),
      event,
    };
  }

  if (action === "update_event") {
    need(params, ["calendar_id", "event_id"], action);
    const timezone = params.timezone || "Asia/Shanghai";
    const body = {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start_time:
        params.start_time !== undefined ? normalizeTime(params.start_time, timezone) : undefined,
      end_time:
        params.end_time !== undefined ? normalizeTime(params.end_time, timezone) : undefined,
      attendees: params.attendees,
      reminders: params.reminders,
      visibility: params.visibility,
      ...(params.extra_fields || {}),
    };
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
    if (Object.keys(body).length === 0) {
      throw new FeishuPlusError("invalid_params", "update_event 至少需要一个可更新字段");
    }
    const res = await client.calendarUpdateEvent(params.calendar_id, params.event_id, body);
    const event = unwrapEvent(res?.data);
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      event_id: pickEventId(event) || params.event_id,
      event,
    };
  }

  if (action === "delete_event") {
    need(params, ["calendar_id", "event_id"], action);
    await client.calendarDeleteEvent(params.calendar_id, params.event_id);
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      event_id: params.event_id,
      deleted: true,
    };
  }

  throw new FeishuPlusError("invalid_action", `不支持的 calendar action: ${action}`);
}
