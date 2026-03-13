/**
 * task.ts — 飞书任务工具 (Dual-Auth)
 *
 * 所有 API 调用经 platform 层封装，最终仍通过 identity/feishu-api 执行（双授权）。
 */

import {
  getTask,
  listTasks,
  createTask,
  updateTask,
  completeTask,
} from "../platform/task/index.js";
import { IDENTITY_MODE_SCHEMA, parseIdentityMode } from "./identity-mode.js";
import type { IdentityMode } from "../identity/feishu-api.js";

export const TASK_TOOL_DEFS = [
  {
    name: "feishu_plus_task_get",
    description: "获取任务详情",
    parameters: {
      type: "object",
      properties: {
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
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
        identity_mode: IDENTITY_MODE_SCHEMA,
        task_id: { type: "string", description: "任务 ID" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id）" },
      },
      required: ["task_id"],
    },
  },
];

export class TaskTools {
  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    const identityMode = parseIdentityMode(params.identity_mode);
    switch (toolName) {
      case "feishu_plus_task_get":
        return this.getTask(params, userId, identityMode);
      case "feishu_plus_task_list":
        return this.listTasks(params, userId, identityMode);
      case "feishu_plus_task_create":
        return this.createTask(params, userId, identityMode);
      case "feishu_plus_task_update":
        return this.updateTask(params, userId, identityMode);
      case "feishu_plus_task_complete":
        return this.completeTask(params, userId, identityMode);
      default:
        throw new Error(`Unknown task tool: ${toolName}`);
    }
  }

  private async getTask(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await getTask({
      taskId: String(params.task_id),
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
  }

  private async listTasks(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await listTasks({
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      completed: params.completed !== undefined ? Boolean(params.completed) : undefined,
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
  }

  private async createTask(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    let followerIds: string[] | undefined;
    if (params.follower_ids) {
      try {
        const parsed = typeof params.follower_ids === "string" ? JSON.parse(params.follower_ids) : params.follower_ids;
        if (Array.isArray(parsed)) followerIds = parsed.map(String);
      } catch {
        // best-effort
      }
    }

    return await createTask({
      summary: String(params.summary),
      description: params.description ? String(params.description) : undefined,
      dueTime: params.due_time ? String(params.due_time) : undefined,
      assignee: params.assignee ? String(params.assignee) : undefined,
      followerIds,
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
  }

  private async updateTask(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await updateTask({
      taskId: String(params.task_id),
      summary: params.summary !== undefined ? String(params.summary) : undefined,
      description: params.description !== undefined ? String(params.description) : undefined,
      dueTime: params.due_time !== undefined ? String(params.due_time) : undefined,
      completed: params.completed !== undefined ? Boolean(params.completed) : undefined,
      assignee: params.assignee !== undefined ? String(params.assignee) : undefined,
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
  }

  private async completeTask(params: Record<string, unknown>, userId?: string, identityMode?: IdentityMode) {
    return await completeTask({
      taskId: String(params.task_id),
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
      identityMode,
    });
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
