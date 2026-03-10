/**
 * calendar.ts — 飞书日历工具
 *
 * 支持：列出日历、列出事件、查询忙闲状态
 * 使用 Lark SDK 调用，由 request-executor 提供 token
 */

import * as lark from "@larksuiteoapi/node-sdk";
import { executeFeishuRequest } from "../core/request-executor.js";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

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

// ─── 工具执行器类 ───

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

  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_calendar_list":
        return this.list(params);
      case "feishu_plus_calendar_event_list":
        return this.listEvents(params);
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
      const result = await this.client.calendar.v4.calendarEvent.list({
        path: {
          calendar_id: String(params.calendar_id),
        },
        params: {
          start_time: params.start_time ? String(params.start_time) : undefined,
          end_time: params.end_time ? String(params.end_time) : undefined,
          page_size: params.page_size ? Math.max(Number(params.page_size), 50) : 50,
          page_token: params.page_token ? String(params.page_token) : undefined,
        },
      });
      return result;
    } catch (err: any) {
      const detail = err?.response?.data ? JSON.stringify(err.response.data) : err?.message ?? String(err);
      throw new Error(`calendar_event_list failed (calendar_id=${params.calendar_id}): ${detail}`);
    }
  }

  private async getFreeBusy(params: Record<string, unknown>) {
    return executeFeishuRequest({
      operation: "calendar.freebusy.list",
      invoke: async ({ authorizationHeader }) => {
        const domain = this.config.domain === "lark" ? "lark" : "feishu";
        const resp = await fetch(
          `https://open.${domain}.cn/open-apis/calendar/v4/freebusy/list`,
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

// ─── 注册辅助函数 ───

export function registerCalendarTools(
  tools: CalendarTools,
  registerTool: (toolDef: typeof CALENDAR_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  CALENDAR_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
