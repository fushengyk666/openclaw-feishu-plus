/**
 * platform/approval/client.ts — Feishu Approval Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import { feishuGet, feishuPost, type IdentityMode } from "../../identity/feishu-api.js";

export async function getApprovalDefinition(params: {
  approvalCode: string;
  locale?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "approval.definition.get",
    "/open-apis/approval/v4/approvals",
    {
      approval_code: params.approvalCode,
      locale: params.locale ?? "zh-CN",
    },
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function listApprovalInstances(params: {
  approvalCode: string;
  startTime: string;
  endTime: string;
  pageSize?: number;
  pageToken?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "approval.instance.list",
    "/open-apis/approval/v4/instances",
    {
      approval_code: params.approvalCode,
      start_time: params.startTime,
      end_time: params.endTime,
      page_size: typeof params.pageSize === "number" ? params.pageSize : 100,
      page_token: params.pageToken,
    },
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function getApprovalInstance(params: {
  instanceId: string;
  locale?: string;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "approval.instance.get",
    `/open-apis/approval/v4/instances/${params.instanceId}`,
    {
      userId: params.userId,
      identityMode: params.identityMode,
      params: {
        locale: params.locale,
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function createApprovalInstance(params: {
  approvalCode: string;
  form: string;
  openId?: string;
  departmentId?: string;
  nodeApproverOpenIdList?: unknown;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const body: Record<string, unknown> = {
    approval_code: params.approvalCode,
    form: params.form,
  };
  if (params.openId) body.open_id = params.openId;
  if (params.departmentId) body.department_id = params.departmentId;
  if (params.nodeApproverOpenIdList) {
    body.node_approver_open_id_list = params.nodeApproverOpenIdList;
  }

  const result = await feishuPost(
    "approval.instance.create",
    "/open-apis/approval/v4/instances",
    body,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function approveApprovalTask(params: {
  approvalCode: string;
  instanceCode: string;
  taskId: string;
  comment?: string;
  operatorUserId?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "approval.task.approve",
    "/open-apis/approval/v4/tasks/approve",
    {
      approval_code: params.approvalCode,
      instance_code: params.instanceCode,
      task_id: params.taskId,
      comment: params.comment,
      user_id: params.operatorUserId,
    },
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function rejectApprovalTask(params: {
  approvalCode: string;
  instanceCode: string;
  taskId: string;
  comment?: string;
  operatorUserId?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "approval.task.reject",
    "/open-apis/approval/v4/tasks/reject",
    {
      approval_code: params.approvalCode,
      instance_code: params.instanceCode,
      task_id: params.taskId,
      comment: params.comment,
      user_id: params.operatorUserId,
    },
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function cancelApprovalInstance(params: {
  approvalCode: string;
  instanceCode: string;
  operatorUserId?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "approval.instance.cancel",
    "/open-apis/approval/v4/instances/cancel",
    {
      approval_code: params.approvalCode,
      instance_code: params.instanceCode,
      user_id: params.operatorUserId,
    },
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}
