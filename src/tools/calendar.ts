/**
 * calendar.ts — 飞书日历工具 (Dual-Auth)
 *
 * 所有 API 调用经过 identity 层的双授权决策链路：
 * - 有 user token → 用 user token
 * - 无 user token → 回退 tenant token
 * - user_only 接口（如 freebusy）→ 生成授权提示
 */

import {
  listCalendars,
  createCalendar,
  deleteCalendar,
  updateCalendar,
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  listFreeBusy,
} from "../platform/calendar/index.js";
import { IDENTITY_MODE_SCHEMA, parseIdentityMode } from "./identity-mode.js";
import type { IdentityMode } from "../identity/feishu-api.js";

// ─── 工具定义 ───

export const CALENDAR_TOOL_DEFS = [
  {
    name: "feishu_plus_calendar_list",
    description: "列出日历",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        page_size: { type: "number" },
        page_token: { type: "string" },
      },
    },
  },
  {
    name: "feishu_plus_calendar_create",
    description: "创建日历",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        summary: { type: "string", description: "日历名称" },
        description: { type: "string", description: "日历描述" },
        permissions: {
          type: "string",
          description: "权限（private/show_only_free_busy/reader/writer）",
        },
        color: { type: "number", description: "日历颜色（整数）" },
      },
      required: ["summary"],
    },
  },
  {
    name: "feishu_plus_calendar_delete",
    description: "删除日历",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        calendar_id: { type: "string", description: "日历 ID" },
      },
      required: ["calendar_id"],
    },
  },
  {
    name: "feishu_plus_calendar_update",
    description: "更新日历信息",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        calendar_id: { type: "string", description: "日历 ID" },
        summary: { type: "string", description: "日历名称" },
        description: { type: "string", description: "日历描述" },
        permissions: {
          type: "string",
          description: "权限（private/show_only_free_busy/reader/writer）",
        },
        color: { type: "number", description: "日历颜色（整数）" },
      },
      required: ["calendar_id"],
    },
  },
  {
    name: "feishu_plus_calendar_event_list",
    description: "列出日历事件",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        calendar_id: {
          type: "string",
          description: "日历 ID（主日历通常为 'primary'）",
        },
        start_time: { type: "string", description: "开始时间（Unix 秒）" },
        end_time: { type: "string", description: "结束时间（Unix 秒）" },
        page_size: { type: "number" },
        page_token: { type: "string" },
      },
      required: ["calendar_id"],
    },
  },
  {
    name: "feishu_plus_calendar_event_create",
    description: "创建日历事件",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        calendar_id: { type: "string", description: "日历 ID" },
        summary: { type: "string", description: "事件标题" },
        description: { type: "string", description: "事件描述" },
        start_time: {
          type: "string",
          description: "开始时间（Unix 秒）",
        },
        end_time: { type: "string", description: "结束时间（Unix 秒）" },
        timezone: {
          type: "string",
          description: "时区（如 Asia/Shanghai），默认 Asia/Shanghai",
        },
        attendees: {
          type: "string",
          description:
            '参会人 open_id 列表（JSON 数组字符串，如 ["ou_xxx"]）',
        },
        reminders: {
          type: "string",
          description:
            '提醒设置（JSON 数组字符串，如 [{"minutes":5}]）',
        },
        recurrence: {
          type: "string",
          description:
            '重复规则（RFC5545 RRULE，如 FREQ=DAILY;INTERVAL=1）',
        },
        need_notification: {
          type: "boolean",
          description: "是否发送通知（默认 true）",
        },
      },
      required: ["calendar_id", "summary", "start_time", "end_time"],
    },
  },
  {
    name: "feishu_plus_calendar_event_update",
    description: "更新日历事件",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        calendar_id: { type: "string", description: "日历 ID" },
        event_id: { type: "string", description: "事件 ID" },
        summary: { type: "string", description: "事件标题" },
        description: { type: "string", description: "事件描述" },
        start_time: {
          type: "string",
          description: "开始时间（Unix 秒）",
        },
        end_time: { type: "string", description: "结束时间（Unix 秒）" },
        timezone: { type: "string", description: "时区" },
        recurrence: {
          type: "string",
          description:
            '重复规则（RFC5545 RRULE，如 FREQ=DAILY;INTERVAL=1）',
        },
      },
      required: ["calendar_id", "event_id"],
    },
  },
  {
    name: "feishu_plus_calendar_event_delete",
    description: "删除日历事件",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        calendar_id: { type: "string", description: "日历 ID" },
        event_id: { type: "string", description: "事件 ID" },
        need_notification: {
          type: "boolean",
          description: "是否发送取消通知（默认 true）",
        },
      },
      required: ["calendar_id", "event_id"],
    },
  },
  {
    name: "feishu_plus_calendar_freebusy",
    description: "查询忙闲状态（需要用户授权）",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
        time_min: {
          type: "string",
          description: "查询开始时间（ISO 8601 或 Unix 秒）",
        },
        time_max: {
          type: "string",
          description: "查询结束时间（ISO 8601 或 Unix 秒）",
        },
        user_ids: {
          type: "array",
          items: { type: "string" },
          description: "用户 ID 列表",
        },
      },
      required: ["time_min", "time_max"],
    },
  },
];

// ─── 工具执行器 ───

export class CalendarTools {
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    userId?: string,
  ): Promise<unknown> {
    const identityMode = parseIdentityMode(params.identity_mode);
    switch (toolName) {
      case "feishu_plus_calendar_list":
        return this.list(params, userId, identityMode);
      case "feishu_plus_calendar_create":
        return this.createCalendar(params, userId, identityMode);
      case "feishu_plus_calendar_delete":
        return this.deleteCalendar(params, userId, identityMode);
      case "feishu_plus_calendar_update":
        return this.updateCalendar(params, userId, identityMode);
      case "feishu_plus_calendar_event_list":
        return this.listEvents(params, userId, identityMode);
      case "feishu_plus_calendar_event_create":
        return this.createEvent(params, userId, identityMode);
      case "feishu_plus_calendar_event_update":
        return this.updateEvent(params, userId, identityMode);
      case "feishu_plus_calendar_event_delete":
        return this.deleteEvent(params, userId, identityMode);
      case "feishu_plus_calendar_freebusy":
        return this.getFreeBusy(params, userId, identityMode);
      default:
        throw new Error(`Unknown calendar tool: ${toolName}`);
    }
  }

  private async list(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await listCalendars({
      pageSize:
        typeof params.page_size === "number"
          ? params.page_size
          : params.page_size
            ? Number(params.page_size)
            : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      userId,
      identityMode,
    });
  }

  private async createCalendar(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return await createCalendar({
      summary: String(params.summary),
      description: params.description ? String(params.description) : undefined,
      permissions: params.permissions ? String(params.permissions) : undefined,
      color: params.color !== undefined ? Number(params.color) : undefined,
      userId,
      identityMode,
    });
  }

  private async deleteCalendar(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return await deleteCalendar({
      calendarId: String(params.calendar_id),
      userId,
      identityMode,
    });
  }

  private async updateCalendar(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return await updateCalendar({
      calendarId: String(params.calendar_id),
      summary: params.summary ? String(params.summary) : undefined,
      description: params.description ? String(params.description) : undefined,
      permissions: params.permissions ? String(params.permissions) : undefined,
      color: params.color !== undefined ? Number(params.color) : undefined,
      userId,
      identityMode,
    });
  }

  private async listEvents(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return await listCalendarEvents({
      calendarId: String(params.calendar_id),
      startTime: params.start_time ? String(params.start_time) : undefined,
      endTime: params.end_time ? String(params.end_time) : undefined,
      pageSize:
        typeof params.page_size === "number"
          ? params.page_size
          : params.page_size
            ? Number(params.page_size)
            : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      userId,
      identityMode,
    });
  }

  private async createEvent(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    let reminders: unknown = undefined;
    if (params.reminders !== undefined) {
      try {
        reminders =
          typeof params.reminders === "string"
            ? JSON.parse(params.reminders)
            : params.reminders;
      } catch {
        // ignore parse error
      }
    }

    let attendees: string[] | undefined = undefined;
    if (params.attendees !== undefined) {
      try {
        const ids =
          typeof params.attendees === "string"
            ? JSON.parse(params.attendees as string)
            : params.attendees;
        if (Array.isArray(ids)) attendees = ids.map((x) => String(x));
      } catch {
        // ignore parse error
      }
    }

    return await createCalendarEvent({
      calendarId: String(params.calendar_id),
      summary: String(params.summary),
      description: params.description ? String(params.description) : undefined,
      startTime: String(params.start_time),
      endTime: String(params.end_time),
      timezone: params.timezone ? String(params.timezone) : undefined,
      reminders,
      recurrence: params.recurrence ? String(params.recurrence) : undefined,
      attendees,
      needNotification: params.need_notification !== false,
      userId,
      identityMode,
    });
  }

  private async updateEvent(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return await updateCalendarEvent({
      calendarId: String(params.calendar_id),
      eventId: String(params.event_id),
      summary: params.summary ? String(params.summary) : undefined,
      description: params.description ? String(params.description) : undefined,
      startTime: params.start_time ? String(params.start_time) : undefined,
      endTime: params.end_time ? String(params.end_time) : undefined,
      timezone: params.timezone ? String(params.timezone) : undefined,
      recurrence: params.recurrence ? String(params.recurrence) : undefined,
      userId,
      identityMode,
    });
  }

  private async deleteEvent(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    return await deleteCalendarEvent({
      calendarId: String(params.calendar_id),
      eventId: String(params.event_id),
      needNotification: params.need_notification !== false,
      userId,
      identityMode,
    });
  }

  private async getFreeBusy(
    params: Record<string, unknown>,
    userId?: string,
    identityMode?: IdentityMode,
  ) {
    // freebusy is user_only — will automatically trigger auth prompt if no user token
    let targetUserId: string | undefined = undefined;
    if (params.user_ids) {
      const userIds = params.user_ids as string[];
      if (Array.isArray(userIds) && userIds.length > 0) {
        targetUserId = String(userIds[0]);
      }
    }

    return await listFreeBusy({
      timeMin: String(params.time_min),
      timeMax: String(params.time_max),
      targetUserId,
      userId,
      identityMode,
    });
  }
}

// ─── 注册辅助 ───

export function registerCalendarTools(
  tools: CalendarTools,
  registerTool: (
    toolDef: (typeof CALENDAR_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  CALENDAR_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) =>
      tools.execute(toolDef.name, args, userId),
    );
  });
}
