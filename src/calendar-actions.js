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

export async function runCalendarAction(client, params) {
  const action = params.action;

  if (action === "list_calendars") {
    const res = await client.calendarListCalendars({
      page_token: params.page_token,
      page_size: params.page_size,
    });
    return {
      ok: true,
      action,
      items: res?.data?.items || [],
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

  if (action === "get_event") {
    need(params, ["calendar_id", "event_id"], action);
    const res = await client.calendarGetEvent(params.calendar_id, params.event_id);
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      event_id: params.event_id,
      event: res?.data || null,
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
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      event: res?.data || null,
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
    return {
      ok: true,
      action,
      calendar_id: params.calendar_id,
      event_id: params.event_id,
      event: res?.data || null,
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
