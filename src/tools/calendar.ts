/**
 * calendar.ts — 飞书日历工具 (Lark SDK)
 *
 * 支持：列出日历、列出/创建/更新/删除事件、查询忙闲状态
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

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
    name: "feishu_plus_calendar_event_list",
    description: "列出日历事件",
    parameters: {
      type: "object",
      properties: {
        calendar_id: { type: "string", description: "日历 ID（主日历通常为 'primary'）" },
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
        start_time: { type: "string", description: "开始时间（Unix 秒）" },
        end_time: { type: "string", description: "结束时间（Unix 秒）" },
        timezone: { type: "string", description: "时区（如 Asia/Shanghai），默认 Asia/Shanghai" },
        attendees: { type: "string", description: "参会人 open_id 列表（JSON 数组字符串，如 [\"ou_xxx\"]）" },
        reminders: { type: "string", description: "提醒设置（JSON 数组字符串，如 [{\"minutes\":5}]）" },
        need_notification: { type: "boolean", description: "是否发送通知（默认 true）" },
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
        start_time: { type: "string", description: "开始时间（Unix 秒）" },
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
        need_notification: { type: "boolean", description: "是否发送取消通知（默认 true）" },
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
        time_min: { type: "string", description: "查询开始时间（ISO 8601 或 Unix 秒）" },
        time_max: { type: "string", description: "查询结束时间（ISO 8601 或 Unix 秒）" },
        user_ids: { type: "array", items: { type: "string" }, description: "用户 ID 列表" },
      },
      required: ["time_min", "time_max"],
    },
  },
];

export class CalendarTools {
  private client: InstanceType<typeof lark.Client>;

  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      domain: config.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu,
      disableTokenCache: false,
    });
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_calendar_list":
        return this.list(params);
      case "feishu_plus_calendar_event_list":
        return this.listEvents(params);
      case "feishu_plus_calendar_event_create":
        return this.createEvent(params);
      case "feishu_plus_calendar_event_update":
        return this.updateEvent(params);
      case "feishu_plus_calendar_event_delete":
        return this.deleteEvent(params);
      case "feishu_plus_calendar_freebusy":
        return this.getFreeBusy(params);
      default:
        throw new Error(`Unknown calendar tool: ${toolName}`);
    }
  }

  private async list(params: Record<string, unknown>) {
    return this.client.calendar.v4.calendar.list({
      params: {
        page_size: params.page_size ? Math.max(Number(params.page_size), 50) : 50,
        page_token: params.page_token ? String(params.page_token) : undefined,
      },
    });
  }

  private async listEvents(params: Record<string, unknown>) {
    try {
      return await this.client.calendar.v4.calendarEvent.list({
        path: { calendar_id: String(params.calendar_id) },
        params: {
          start_time: params.start_time ? String(params.start_time) : undefined,
          end_time: params.end_time ? String(params.end_time) : undefined,
          page_size: params.page_size ? Math.max(Number(params.page_size), 50) : 50,
          page_token: params.page_token ? String(params.page_token) : undefined,
        },
      });
    } catch (err: any) {
      const detail = err?.response?.data ? JSON.stringify(err.response.data) : err?.message ?? String(err);
      throw new Error(`calendar_event_list failed (calendar_id=${params.calendar_id}): ${detail}`);
    }
  }

  private async createEvent(params: Record<string, unknown>) {
    const tz = params.timezone ? String(params.timezone) : "Asia/Shanghai";
    const data: any = {
      summary: String(params.summary),
      start_time: { timestamp: String(params.start_time), timezone: tz },
      end_time: { timestamp: String(params.end_time), timezone: tz },
    };

    if (params.description) data.description = String(params.description);

    // Parse reminders
    if (params.reminders) {
      try {
        data.reminders = typeof params.reminders === "string" ? JSON.parse(params.reminders) : params.reminders;
      } catch { /* ignore */ }
    }

    // Parse attendees
    let attendeeList: any[] | undefined;
    if (params.attendees) {
      try {
        const ids = typeof params.attendees === "string" ? JSON.parse(params.attendees) : params.attendees;
        if (Array.isArray(ids)) {
          attendeeList = ids.map((id: string) => ({ type: "user", user_id: id }));
        }
      } catch { /* ignore */ }
    }

    const result = await this.client.calendar.v4.calendarEvent.create({
      path: { calendar_id: String(params.calendar_id) },
      params: {
        user_id_type: "open_id" as any,
      },
      data,
    });

    // Add attendees separately if provided
    if (attendeeList && attendeeList.length > 0 && result?.data?.event?.event_id) {
      try {
        await this.client.calendar.v4.calendarEventAttendee.create({
          path: {
            calendar_id: String(params.calendar_id),
            event_id: result.data.event.event_id,
          },
          params: {
            user_id_type: "open_id" as any,
          },
          data: {
            attendees: attendeeList,
            need_notification: (params.need_notification !== false ? "true" : "false") as any,
          },
        });
      } catch { /* best-effort */ }
    }

    return result;
  }

  private async updateEvent(params: Record<string, unknown>) {
    const data: any = {};
    if (params.summary) data.summary = String(params.summary);
    if (params.description) data.description = String(params.description);
    if (params.start_time) {
      const tz = params.timezone ? String(params.timezone) : "Asia/Shanghai";
      data.start_time = { timestamp: String(params.start_time), timezone: tz };
    }
    if (params.end_time) {
      const tz = params.timezone ? String(params.timezone) : "Asia/Shanghai";
      data.end_time = { timestamp: String(params.end_time), timezone: tz };
    }

    return this.client.calendar.v4.calendarEvent.patch({
      path: {
        calendar_id: String(params.calendar_id),
        event_id: String(params.event_id),
      },
      data,
    });
  }

  private async deleteEvent(params: Record<string, unknown>) {
    return this.client.calendar.v4.calendarEvent.delete({
      path: {
        calendar_id: String(params.calendar_id),
        event_id: String(params.event_id),
      },
      params: {
        need_notification: (params.need_notification !== false ? "true" : "false") as any,
      },
    });
  }

  private async getFreeBusy(params: Record<string, unknown>) {
    return this.client.calendar.v4.freebusy.list({
      data: {
        time_min: String(params.time_min),
        time_max: String(params.time_max),
        user_id: params.user_ids ? String((params.user_ids as string[])[0] ?? "") : undefined,
      },
    });
  }
}

export function registerCalendarTools(
  tools: CalendarTools,
  registerTool: (toolDef: typeof CALENDAR_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  CALENDAR_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
