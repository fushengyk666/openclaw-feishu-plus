/**
 * task.ts — 飞书任务工具 (Lark SDK)
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

export const TASK_TOOL_DEFS = [
  {
    name: "feishu_plus_task_get",
    description: "获取任务详情",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "任务 ID" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "feishu_plus_task_list",
    description: "列出任务列表",
    parameters: {
      type: "object",
      properties: {
        page_size: { type: "number", description: "每页数量（默认 50）" },
        page_token: { type: "string", description: "分页 token" },
        completed: { type: "boolean", description: "是否已完成" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
    },
  },
  {
    name: "feishu_plus_task_create",
    description: "创建任务",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "任务标题" },
        description: { type: "string", description: "任务描述" },
        due_time: { type: "string", description: "截止时间（Unix 时间戳，秒）" },
        assignee: { type: "string", description: "负责人用户 ID" },
        follower_ids: { type: "string", description: "关注者用户 ID 列表（JSON 数组字符串）" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["summary"],
    },
  },
  {
    name: "feishu_plus_task_update",
    description: "更新任务",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "任务 ID" },
        summary: { type: "string", description: "任务标题" },
        description: { type: "string", description: "任务描述" },
        due_time: { type: "string", description: "截止时间（Unix 时间戳，秒）" },
        completed: { type: "boolean", description: "是否完成" },
        assignee: { type: "string", description: "负责人用户 ID" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "feishu_plus_task_complete",
    description: "标记任务为已完成",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "任务 ID" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["task_id"],
    },
  },
];

export class TaskTools {
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
      case "feishu_plus_task_get":
        return this.getTask(params);
      case "feishu_plus_task_list":
        return this.listTasks(params);
      case "feishu_plus_task_create":
        return this.createTask(params);
      case "feishu_plus_task_update":
        return this.updateTask(params);
      case "feishu_plus_task_complete":
        return this.completeTask(params);
      default:
        throw new Error(`Unknown task tool: ${toolName}`);
    }
  }

  private async getTask(params: Record<string, unknown>) {
    return this.client.task.v2.task.get({
      path: { task_guid: String(params.task_id) },
      params: {
        user_id_type: params.user_id_type ? String(params.user_id_type) as any : undefined,
      },
    });
  }

  private async listTasks(params: Record<string, unknown>) {
    return this.client.task.v2.task.list({
      params: {
        page_size: params.page_size ? Number(params.page_size) : 50,
        page_token: params.page_token ? String(params.page_token) : undefined,
        completed: params.completed !== undefined ? Boolean(params.completed) : undefined,
        user_id_type: params.user_id_type ? String(params.user_id_type) as any : undefined,
      },
    });
  }

  private async createTask(params: Record<string, unknown>) {
    const data: any = {
      summary: String(params.summary),
    };
    if (params.description) data.description = String(params.description);
    if (params.due_time) data.due = { timestamp: String(params.due_time) };
    if (params.assignee) data.members = [{ id: String(params.assignee), role: "assignee" }];

    return this.client.task.v2.task.create({
      params: {
        user_id_type: params.user_id_type ? String(params.user_id_type) as any : undefined,
      },
      data,
    });
  }

  private async updateTask(params: Record<string, unknown>) {
    const data: any = {};
    const updateFields: string[] = [];

    if (params.summary !== undefined) { data.summary = String(params.summary); updateFields.push("summary"); }
    if (params.description !== undefined) { data.description = String(params.description); updateFields.push("description"); }
    if (params.due_time !== undefined) { data.due = { timestamp: String(params.due_time) }; updateFields.push("due"); }

    return this.client.task.v2.task.patch({
      path: { task_guid: String(params.task_id) },
      params: {
        user_id_type: params.user_id_type ? String(params.user_id_type) as any : undefined,
      },
      data: {
        task: data,
        update_fields: updateFields,
      },
    });
  }

  private async completeTask(params: Record<string, unknown>) {
    return this.client.task.v2.task.patch({
      path: { task_guid: String(params.task_id) },
      data: {
        task: { completed_at: String(Math.floor(Date.now() / 1000)) },
        update_fields: ["completed_at"],
      },
    });
  }
}

export function registerTaskTools(
  tools: TaskTools,
  registerTool: (toolDef: typeof TASK_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  TASK_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
