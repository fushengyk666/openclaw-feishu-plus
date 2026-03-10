/**
 * task.ts — 飞书任务工具
 *
 * 支持：获取任务、列出任务、创建任务、更新任务、完成任务
 * 身份：由 request-executor 自动决定（user-if-available-else-tenant）
 */

import { executeFeishuRequest } from "../core/request-executor.js";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义 ───

export const TASK_TOOL_DEFS = [
  {
    name: "feishu_task_get",
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
    name: "feishu_task_list",
    description: "列出任务列表",
    parameters: {
      type: "object",
      properties: {
        page_size: { type: "number", description: "每页数量（默认 50）" },
        page_token: { type: "string", description: "分页 token" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
        completed: { type: "boolean", description: "是否已完成" },
      },
    },
  },
  {
    name: "feishu_task_create",
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
    name: "feishu_task_update",
    description: "更新任务",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "任务 ID" },
        summary: { type: "string", description: "任务标题" },
        description: { type: "string", description: "任务描述" },
        due_time: { type: "string", description: "截止时间（Unix 时间戳，秒）" },
        assignee: { type: "string", description: "负责人用户 ID" },
        follower_ids: { type: "string", description: "关注者用户 ID 列表（JSON 数组字符串）" },
        completed: { type: "boolean", description: "是否完成" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "feishu_task_complete",
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

// ─── 工具执行器类 ───

export class TaskTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_task_get":
        return this.get(params, userId);

      case "feishu_task_list":
        return this.list(params, userId);

      case "feishu_task_create":
        return this.create(params, userId);

      case "feishu_task_update":
        return this.update(params, userId);

      case "feishu_task_complete":
        return this.complete(params, userId);

      default:
        throw new Error(`Unknown task tool: ${toolName}`);
    }
  }

  private async get(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "task.task.get",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/task/v1/tasks/${params.task_id}`);
        if (params.user_id_type) url.searchParams.set("user_id_type", String(params.user_id_type));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to get task: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async list(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "task.task.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/task/v1/tasks`);
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));
        if (params.user_id_type) url.searchParams.set("user_id_type", String(params.user_id_type));
        if (params.completed !== undefined) url.searchParams.set("completed", String(params.completed));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list tasks: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async create(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "task.task.create",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const body: Record<string, unknown> = {
          summary: params.summary,
        };
        if (params.description) body.description = params.description;
        if (params.due_time) body.due_time = params.due_time;
        if (params.assignee) body.assignee = params.assignee;
        if (params.follower_ids) body.follower_ids = JSON.parse(String(params.follower_ids));
        if (params.user_id_type) body.user_id_type = params.user_id_type;

        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/task/v1/tasks`,
          {
            method: "POST",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to create task: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async update(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "task.task.update",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const body: Record<string, unknown> = {};
        if (params.summary) body.summary = params.summary;
        if (params.description) body.description = params.description;
        if (params.due_time) body.due_time = params.due_time;
        if (params.assignee) body.assignee = params.assignee;
        if (params.follower_ids) body.follower_ids = JSON.parse(String(params.follower_ids));
        if (params.completed !== undefined) body.completed = params.completed;
        if (params.user_id_type) body.user_id_type = params.user_id_type;

        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/task/v1/tasks/${params.task_id}`,
          {
            method: "PATCH",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to update task: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async complete(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "task.task.complete",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const body: Record<string, unknown> = {};
        if (params.user_id_type) body.user_id_type = params.user_id_type;

        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/task/v1/tasks/${params.task_id}/complete`,
          {
            method: "POST",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to complete task: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }
}

// ─── 注册辅助函数 ───

export function registerTaskTools(
  tools: TaskTools,
  registerTool: (toolDef: typeof TASK_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  TASK_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
