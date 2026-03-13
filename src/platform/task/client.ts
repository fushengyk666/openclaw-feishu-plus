/**
 * platform/task/client.ts — Feishu Task Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import { feishuGet, feishuPost, feishuPatch, type IdentityMode } from "../../identity/feishu-api.js";

export async function getTask(params: {
  taskId: string;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "task.task.get",
    `/open-apis/task/v2/tasks/${params.taskId}`,
    {
      userId: params.userId,
      params: {
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function listTasks(params: {
  pageSize?: number;
  pageToken?: string;
  completed?: boolean;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "task.task.list",
    "/open-apis/task/v2/tasks",
    {
      userId: params.userId,
      params: {
        page_size: typeof params.pageSize === "number" ? params.pageSize : 50,
        page_token: params.pageToken,
        completed: params.completed,
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function createTask(params: {
  summary: string;
  description?: string;
  dueTime?: string;
  assignee?: string;
  followerIds?: string[];
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const body: any = { summary: params.summary };
  if (params.description) body.description = params.description;
  if (params.dueTime) body.due = { timestamp: params.dueTime };
  if (params.assignee) body.members = [{ id: params.assignee, role: "assignee" }];
  if (params.followerIds && params.followerIds.length > 0) {
    const followers = params.followerIds.map((id) => ({ id, role: "follower" }));
    body.members = [...(body.members ?? []), ...followers];
  }

  const result = await feishuPost(
    "task.task.create",
    "/open-apis/task/v2/tasks",
    body,
    {
      userId: params.userId,
      params: {
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function updateTask(params: {
  taskId: string;
  summary?: string;
  description?: string;
  dueTime?: string;
  completed?: boolean;
  assignee?: string;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const task: any = {};
  const updateFields: string[] = [];
  if (params.summary !== undefined) { task.summary = params.summary; updateFields.push("summary"); }
  if (params.description !== undefined) { task.description = params.description; updateFields.push("description"); }
  if (params.dueTime !== undefined) { task.due = { timestamp: params.dueTime }; updateFields.push("due"); }
  if (params.completed) {
    task.completed_at = String(Math.floor(Date.now() / 1000));
    updateFields.push("completed_at");
  }
  if (params.assignee !== undefined) {
    task.members = [{ id: params.assignee, role: "assignee" }];
    updateFields.push("members");
  }

  const result = await feishuPatch(
    "task.task.update",
    `/open-apis/task/v2/tasks/${params.taskId}`,
    { task, update_fields: updateFields },
    {
      userId: params.userId,
      params: {
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function completeTask(params: {
  taskId: string;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPatch(
    "task.task.complete",
    `/open-apis/task/v2/tasks/${params.taskId}`,
    {
      task: { completed_at: String(Math.floor(Date.now() / 1000)) },
      update_fields: ["completed_at"],
    },
    {
      userId: params.userId,
      params: {
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}
