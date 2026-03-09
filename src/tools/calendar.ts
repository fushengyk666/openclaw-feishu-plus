/**
 * calendar.ts — 飞书日历工具
 *
 * 支持：列出日历、列出事件、查询忙闲状态
 * 身份：由 request-executor 自动决定（user-if-available-else-tenant）
 */

import { executeFeishuRequest } from "../core/request-executor.js";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义 ───

export const CALENDAR_TOOL_DEFS = [
  {
    name: "feishu_calendar_list",
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
    name: "feishu_calendar_event_list",
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
    name: "feishu_calendar_freebusy",
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

// ─── 工具执行器类 ───

export class CalendarTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_calendar_list":
        return this.list(params, userId);

      case "feishu_calendar_event_list":
        return this.listEvents(params, userId);

      case "feishu_calendar_freebusy":
        return this.getFreeBusy(params, userId);

      default:
        throw new Error(`Unknown calendar tool: ${toolName}`);
    }
  }

  private async list(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "calendar.calendar.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/calendar/v4/calendars`);
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list calendars: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async listEvents(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "calendar.calendarEvent.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(
          `https://open.${this.config.domain}.cn/open-apis/calendar/v4/calendars/${params.calendar_id}/events`
        );
        if (params.start_time) url.searchParams.set("start_time", String(params.start_time));
        if (params.end_time) url.searchParams.set("end_time", String(params.end_time));
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list events: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async getFreeBusy(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "calendar.freebusy.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/calendar/v4/freebusy/list`,
          {
            method: "POST",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              time_min: params.time_min,
              time_max: params.time_max,
              user_ids: params.user_ids || [],
            }),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to get freebusy: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }
}

// ─── 注册辅助函数（用于 index.ts 统一注册） ───

/**
 * 注册 Calendar 工具到 OpenClaw
 */
export function registerCalendarTools(
  tools: CalendarTools,
  registerTool: (toolDef: typeof CALENDAR_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  CALENDAR_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
