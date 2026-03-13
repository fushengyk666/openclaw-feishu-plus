/**
 * task.ts — 飞书任务工具 (Dual-Auth)
 */

import { feishuGet, feishuPost, feishuPatch } from "../identity/feishu-api.js";

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
  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_task_get":
        return this.getTask(params, userId);
      case "feishu_plus_task_list":
        return this.listTasks(params, userId);
      case "feishu_plus_task_create":
        return this.createTask(params, userId);
      case "feishu_plus_task_update":
        return this.updateTask(params, userId);
      case "feishu_plus_task_complete":
        return this.completeTask(params, userId);
      default:
        throw new Error(`Unknown task tool: ${toolName}`);
    }
  }

  private async getTask(params: Record<string, unknown>, userId?: string) {
    const result = await feishuGet(
      "task.task.get",
      `/open-apis/task/v2/tasks/${String(params.task_id)}`,
      {
        userId,
        params: {
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
        },
      },
    );
    return result.data;
  }

  private async listTasks(params: Record<string, unknown>, userId?: string) {
    const result = await feishuGet(
      "task.task.list",
      "/open-apis/task/v2/tasks",
      {
        userId,
        params: {
          page_size: params.page_size ? Number(params.page_size) : 50,
          page_token: params.page_token ? String(params.page_token) : undefined,
          completed: params.completed !== undefined ? Boolean(params.completed) : undefined,
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
        },
      },
    );
    return result.data;
  }

  private async createTask(params: Record<string, unknown>, userId?: string) {
    const body: any = { summary: String(params.summary) };
    if (params.description) body.description = String(params.description);
    if (params.due_time) body.due = { timestamp: String(params.due_time) };
    if (params.assignee) body.members = [{ id: String(params.assignee), role: "assignee" }];
    if (params.follower_ids) {
      try {
        const followerIds = typeof params.follower_ids === "string" ? JSON.parse(params.follower_ids) : params.follower_ids;
        if (Array.isArray(followerIds)) {
          const followers = followerIds.map((id: string) => ({ id, role: "follower" }));
          body.members = [...(body.members ?? []), ...followers];
        }
      } catch {
        // best-effort
      }
    }

    const result = await feishuPost(
      "task.task.create",
      "/open-apis/task/v2/tasks",
      body,
      {
        userId,
        params: {
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
        },
      },
    );
    return result.data;
  }

  private async updateTask(params: Record<string, unknown>, userId?: string) {
    const task: any = {};
    const updateFields: string[] = [];
    if (params.summary !== undefined) { task.summary = String(params.summary); updateFields.push("summary"); }
    if (params.description !== undefined) { task.description = String(params.description); updateFields.push("description"); }
    if (params.due_time !== undefined) { task.due = { timestamp: String(params.due_time) }; updateFields.push("due"); }
    if (params.completed !== undefined && Boolean(params.completed)) {
      task.completed_at = String(Math.floor(Date.now() / 1000));
      updateFields.push("completed_at");
    }
    if (params.assignee !== undefined) {
      task.members = [{ id: String(params.assignee), role: "assignee" }];
      updateFields.push("members");
    }

    const result = await feishuPatch(
      "task.task.update",
      `/open-apis/task/v2/tasks/${String(params.task_id)}`,
      { task, update_fields: updateFields },
      {
        userId,
        params: {
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
        },
      },
    );
    return result.data;
  }

  private async completeTask(params: Record<string, unknown>, userId?: string) {
    const result = await feishuPatch(
      "task.task.complete",
      `/open-apis/task/v2/tasks/${String(params.task_id)}`,
      {
        task: { completed_at: String(Math.floor(Date.now() / 1000)) },
        update_fields: ["completed_at"],
      },
      {
        userId,
        params: {
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
        },
      },
    );
    return result.data;
  }
}

export function registerTaskTools(
  tools: TaskTools,
  registerTool: (
    toolDef: (typeof TASK_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  TASK_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) => tools.execute(toolDef.name, args, userId));
  });
}
