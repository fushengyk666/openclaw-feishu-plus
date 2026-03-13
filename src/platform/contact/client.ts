/**
 * platform/contact/client.ts — Feishu Contact Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import { feishuGet, feishuPost, type IdentityMode } from "../../identity/feishu-api.js";

export async function getUser(params: {
  targetUserId: string;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "contact.user.get",
    `/open-apis/contact/v3/users/${params.targetUserId}`,
    {
      userId: params.userId,
      identityMode: params.identityMode,
      params: {
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function batchGetUsers(params: {
  userIds: string[];
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "contact.user.batchGet",
    "/open-apis/contact/v3/users/batch_get",
    {
      user_ids: params.userIds,
    },
    {
      userId: params.userId,
      identityMode: params.identityMode,
      params: {
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function getUserMe(params: {
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "contact.user.me",
    "/open-apis/contact/v3/users/me",
    {
      userId: params.userId,
      identityMode: params.identityMode,
      params: {
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function getDepartment(params: {
  departmentId: string;
  departmentIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "contact.department.get",
    `/open-apis/contact/v3/departments/${params.departmentId}`,
    {
      userId: params.userId,
      identityMode: params.identityMode,
      params: {
        department_id_type: params.departmentIdType,
      },
    },
  );
  return result.data;
}

export async function listDepartmentChildren(params: {
  departmentId: string;
  departmentIdType?: string;
  pageSize?: number;
  pageToken?: string;
  fetchChild?: boolean;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "contact.department.children.list",
    "/open-apis/contact/v3/departments",
    {
      userId: params.userId,
      identityMode: params.identityMode,
      params: {
        department_id: params.departmentId,
        department_id_type: params.departmentIdType,
        page_size: typeof params.pageSize === "number" ? params.pageSize : 50,
        page_token: params.pageToken,
        fetch_child: params.fetchChild !== undefined ? String(params.fetchChild) : undefined,
      },
    },
  );
  return result.data;
}

export async function listDepartmentUsers(params: {
  departmentId: string;
  departmentIdType?: string;
  userIdType?: string;
  pageSize?: number;
  pageToken?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "contact.department.user.list",
    "/open-apis/contact/v3/users/find_by_department",
    {
      userId: params.userId,
      identityMode: params.identityMode,
      params: {
        department_id: params.departmentId,
        department_id_type: params.departmentIdType,
        user_id_type: params.userIdType,
        page_size: typeof params.pageSize === "number" ? params.pageSize : 50,
        page_token: params.pageToken,
      },
    },
  );
  return result.data;
}
