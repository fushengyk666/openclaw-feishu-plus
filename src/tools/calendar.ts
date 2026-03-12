/**
 * calendar.ts — 飞书日历工具 (Dual-Auth)
 *
 * 所有 API 调用经过 identity 层的双授权决策链路：
 * - 有 user token → 用 user token
 * - 无 user token → 回退 tenant token
 * - user_only 接口（如 freebusy）→ 生成授权提示
 */

import {
  feishuGet,
  feishuPost,
  feishuPatch,
  feishuDelete,
} from "../identity/feishu-api.js";

// ─── 工具定义 ───

export const CALENDAR_TOOL_DEFS = [
  {
    name: "feishu_plus_calendar_list",
    description: "列出日历",
    parameters: {
      type: "object",
      properties: {
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
    switch (toolName) {
      case "feishu_plus_calendar_list":
        return this.list(params, userId);
      case "feishu_plus_calendar_create":
        return this.createCalendar(params, userId);
      case "feishu_plus_calendar_delete":
        return this.deleteCalendar(params, userId);
      case "feishu_plus_calendar_update":
        return this.updateCalendar(params, userId);
      case "feishu_plus_calendar_event_list":
        return this.listEvents(params, userId);
      case "feishu_plus_calendar_event_create":
        return this.createEvent(params, userId);
      case "feishu_plus_calendar_event_update":
        return this.updateEvent(params, userId);
      case "feishu_plus_calendar_event_delete":
        return this.deleteEvent(params, userId);
      case "feishu_plus_calendar_freebusy":
        return this.getFreeBusy(params, userId);
      default:
        throw new Error(`Unknown calendar tool: ${toolName}`);
    }
  }

  private async list(params: Record<string, unknown>, userId?: string) {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.page_size) qp.page_size = Math.min(Number(params.page_size), 50);
    if (params.page_token) qp.page_token = String(params.page_token);

    const result = await feishuGet(
      "calendar.calendar.list",
      "/open-apis/calendar/v4/calendars",
      { userId, params: qp },
    );
    return result.data;
  }

  private async createCalendar(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const body: Record<string, unknown> = {
      summary: String(params.summary),
    };
    if (params.description) body.description = String(params.description);
    if (params.permissions) body.permissions = String(params.permissions);
    if (params.color !== undefined) body.color = Number(params.color);

    const result = await feishuPost(
      "calendar.calendar.create",
      "/open-apis/calendar/v4/calendars",
      body,
      { userId },
    );
    return result.data;
  }

  private async deleteCalendar(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const calendarId = String(params.calendar_id);
    const result = await feishuDelete(
      "calendar.calendar.delete",
      `/open-apis/calendar/v4/calendars/${calendarId}`,
      { userId },
    );
    return result.data;
  }

  private async updateCalendar(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const calendarId = String(params.calendar_id);
    const body: Record<string, unknown> = {};
    if (params.summary) body.summary = String(params.summary);
    if (params.description) body.description = String(params.description);
    if (params.permissions) body.permissions = String(params.permissions);
    if (params.color !== undefined) body.color = Number(params.color);

    const result = await feishuPatch(
      "calendar.calendar.update",
      `/open-apis/calendar/v4/calendars/${calendarId}`,
      body,
      { userId },
    );
    return result.data;
  }

  private async listEvents(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const calendarId = String(params.calendar_id);
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.start_time) qp.start_time = String(params.start_time);
    if (params.end_time) qp.end_time = String(params.end_time);
    if (params.page_size) qp.page_size = Math.min(Number(params.page_size), 50);
    if (params.page_token) qp.page_token = String(params.page_token);

    const result = await feishuGet(
      "calendar.calendarEvent.list",
      `/open-apis/calendar/v4/calendars/${calendarId}/events`,
      { userId, params: qp },
    );
    return result.data;
  }

  private async createEvent(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const calendarId = String(params.calendar_id);
    const tz = params.timezone ? String(params.timezone) : "Asia/Shanghai";

    const body: Record<string, unknown> = {
      summary: String(params.summary),
      start_time: { timestamp: String(params.start_time), timezone: tz },
      end_time: { timestamp: String(params.end_time), timezone: tz },
    };

    if (params.description) body.description = String(params.description);

    // Parse reminders
    if (params.reminders) {
      try {
        body.reminders =
          typeof params.reminders === "string"
            ? JSON.parse(params.reminders)
            : params.reminders;
      } catch {
        /* ignore parse error */
      }
    }

    const qp: Record<string, string | number | boolean | undefined> = {
      user_id_type: "open_id",
    };

    const result = await feishuPost(
      "calendar.calendarEvent.create",
      `/open-apis/calendar/v4/calendars/${calendarId}/events`,
      body,
      { userId, params: qp },
    );

    // Add attendees separately if provided
    if (params.attendees && (result.data as any)?.event?.event_id) {
      const eventId = (result.data as any).event.event_id;
      try {
        const ids =
          typeof params.attendees === "string"
            ? JSON.parse(params.attendees as string)
            : params.attendees;
        if (Array.isArray(ids) && ids.length > 0) {
          const attendeeList = ids.map((id: string) => ({
            type: "user",
            user_id: id,
          }));
          await feishuPost(
            "calendar.calendarEvent.create", // reuse the same operation
            `/open-apis/calendar/v4/calendars/${calendarId}/events/${eventId}/attendees`,
            {
              attendees: attendeeList,
              need_notification:
                params.need_notification !== false,
            },
            { userId, params: { user_id_type: "open_id" } },
          );
        }
      } catch {
        /* best-effort */
      }
    }

    return result.data;
  }

  private async updateEvent(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const calendarId = String(params.calendar_id);
    const eventId = String(params.event_id);
    const body: Record<string, unknown> = {};

    if (params.summary) body.summary = String(params.summary);
    if (params.description) body.description = String(params.description);
    if (params.start_time) {
      const tz = params.timezone ? String(params.timezone) : "Asia/Shanghai";
      body.start_time = { timestamp: String(params.start_time), timezone: tz };
    }
    if (params.end_time) {
      const tz = params.timezone ? String(params.timezone) : "Asia/Shanghai";
      body.end_time = { timestamp: String(params.end_time), timezone: tz };
    }

    const result = await feishuPatch(
      "calendar.calendarEvent.update",
      `/open-apis/calendar/v4/calendars/${calendarId}/events/${eventId}`,
      body,
      { userId },
    );
    return result.data;
  }

  private async deleteEvent(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    const calendarId = String(params.calendar_id);
    const eventId = String(params.event_id);
    const needNotification =
      params.need_notification !== false ? "true" : "false";

    const result = await feishuDelete(
      "calendar.calendarEvent.delete",
      `/open-apis/calendar/v4/calendars/${calendarId}/events/${eventId}`,
      { userId, params: { need_notification: needNotification } },
    );
    return result.data;
  }

  private async getFreeBusy(
    params: Record<string, unknown>,
    userId?: string,
  ) {
    // freebusy is user_only — will automatically trigger auth prompt if no user token
    const body: Record<string, unknown> = {
      time_min: String(params.time_min),
      time_max: String(params.time_max),
    };

    if (params.user_ids) {
      const userIds = params.user_ids as string[];
      if (userIds.length > 0) {
        body.user_id = String(userIds[0]);
      }
    }

    const result = await feishuPost(
      "calendar.freebusy.list",
      "/open-apis/calendar/v4/freebusy/list",
      body,
      { userId },
    );
    return result.data;
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
