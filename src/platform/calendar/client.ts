/**
 * platform/calendar/client.ts — Feishu Calendar Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import {
  feishuGet,
  feishuPost,
  feishuPatch,
  feishuDelete,
  type IdentityMode,
} from "../../identity/feishu-api.js";

export async function listCalendars(params: {
  pageSize?: number;
  pageToken?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const qp: Record<string, string | number | boolean | undefined> = {};
  // Feishu calendar list API requires page_size >= 50
  if (typeof params.pageSize === "number") qp.page_size = Math.max(params.pageSize, 50);
  if (params.pageToken) qp.page_token = params.pageToken;

  const result = await feishuGet(
    "calendar.calendar.list",
    "/open-apis/calendar/v4/calendars",
    { userId: params.userId, identityMode: params.identityMode, params: qp },
  );
  return result.data;
}

export async function createCalendar(params: {
  summary: string;
  description?: string;
  permissions?: string;
  color?: number;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const body: Record<string, unknown> = { summary: params.summary };
  if (params.description) body.description = params.description;
  if (params.permissions) body.permissions = params.permissions;
  if (params.color !== undefined) body.color = params.color;

  const result = await feishuPost(
    "calendar.calendar.create",
    "/open-apis/calendar/v4/calendars",
    body,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function deleteCalendar(params: {
  calendarId: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuDelete(
    "calendar.calendar.delete",
    `/open-apis/calendar/v4/calendars/${params.calendarId}`,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function updateCalendar(params: {
  calendarId: string;
  summary?: string;
  description?: string;
  permissions?: string;
  color?: number;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const body: Record<string, unknown> = {};
  if (params.summary) body.summary = params.summary;
  if (params.description) body.description = params.description;
  if (params.permissions) body.permissions = params.permissions;
  if (params.color !== undefined) body.color = params.color;

  const result = await feishuPatch(
    "calendar.calendar.update",
    `/open-apis/calendar/v4/calendars/${params.calendarId}`,
    body,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function listCalendarEvents(params: {
  calendarId: string;
  startTime?: string;
  endTime?: string;
  pageSize?: number;
  pageToken?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const qp: Record<string, string | number | boolean | undefined> = {};
  if (params.startTime) qp.start_time = params.startTime;
  if (params.endTime) qp.end_time = params.endTime;
  // Feishu calendar event list API requires page_size >= 50
  if (typeof params.pageSize === "number") qp.page_size = Math.max(params.pageSize, 50);
  if (params.pageToken) qp.page_token = params.pageToken;

  const result = await feishuGet(
    "calendar.calendarEvent.list",
    `/open-apis/calendar/v4/calendars/${params.calendarId}/events`,
    { userId: params.userId, identityMode: params.identityMode, params: qp },
  );
  return result.data;
}

export async function createCalendarEvent(params: {
  calendarId: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  reminders?: unknown;
  recurrence?: string;
  // attendees (open_id list) handled as best-effort second call.
  attendees?: string[];
  needNotification?: boolean;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const tz = params.timezone ?? "Asia/Shanghai";

  const body: Record<string, unknown> = {
    summary: params.summary,
    start_time: { timestamp: String(params.startTime), timezone: tz },
    end_time: { timestamp: String(params.endTime), timezone: tz },
  };
  if (params.description) body.description = params.description;
  if (params.reminders !== undefined) body.reminders = params.reminders;
  if (params.recurrence) body.recurrence = params.recurrence;

  const qp: Record<string, string | number | boolean | undefined> = {
    user_id_type: "open_id",
  };

  const result = await feishuPost(
    "calendar.calendarEvent.create",
    `/open-apis/calendar/v4/calendars/${params.calendarId}/events`,
    body,
    { userId: params.userId, identityMode: params.identityMode, params: qp },
  );

  const eventId = (result.data as any)?.event?.event_id;
  if (eventId && Array.isArray(params.attendees) && params.attendees.length > 0) {
    const attendeeList = params.attendees.map((id) => ({
      type: "user",
      user_id: id,
    }));

    // Best-effort add attendees (calendar API has a separate endpoint)
    try {
      await feishuPost(
        "calendar.calendarEventAttendee.create",
        `/open-apis/calendar/v4/calendars/${params.calendarId}/events/${eventId}/attendees`,
        {
          attendees: attendeeList,
          need_notification: params.needNotification !== false,
        },
        { userId: params.userId, identityMode: params.identityMode, params: { user_id_type: "open_id" } },
      );
    } catch {
      // ignore — event itself is created.
    }
  }

  return result.data;
}

export async function updateCalendarEvent(params: {
  calendarId: string;
  eventId: string;
  summary?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  recurrence?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const body: Record<string, unknown> = {};
  if (params.summary) body.summary = params.summary;
  if (params.description) body.description = params.description;
  if (params.startTime) {
    const tz = params.timezone ?? "Asia/Shanghai";
    body.start_time = { timestamp: String(params.startTime), timezone: tz };
  }
  if (params.endTime) {
    const tz = params.timezone ?? "Asia/Shanghai";
    body.end_time = { timestamp: String(params.endTime), timezone: tz };
  }
  if (params.recurrence) body.recurrence = params.recurrence;

  const result = await feishuPatch(
    "calendar.calendarEvent.update",
    `/open-apis/calendar/v4/calendars/${params.calendarId}/events/${params.eventId}`,
    body,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function deleteCalendarEvent(params: {
  calendarId: string;
  eventId: string;
  needNotification?: boolean;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const need_notification = params.needNotification !== false ? "true" : "false";

  const result = await feishuDelete(
    "calendar.calendarEvent.delete",
    `/open-apis/calendar/v4/calendars/${params.calendarId}/events/${params.eventId}`,
    { userId: params.userId, identityMode: params.identityMode, params: { need_notification } },
  );
  return result.data;
}

export async function listFreeBusy(params: {
  timeMin: string;
  timeMax: string;
  userId?: string;
  identityMode?: IdentityMode;
  // Feishu API takes a single user_id; tools accept list
  targetUserId?: string;
}) {
  const body: Record<string, unknown> = {
    time_min: params.timeMin,
    time_max: params.timeMax,
  };

  if (params.targetUserId) body.user_id = params.targetUserId;

  const result = await feishuPost(
    "calendar.freebusy.list",
    "/open-apis/calendar/v4/freebusy/list",
    body,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}
