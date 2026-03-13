/**
 * platform/perm/client.ts — Feishu Drive Permission Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import { feishuGet, feishuPost, feishuDelete, type IdentityMode } from "../../identity/feishu-api.js";

export async function listPermissions(params: {
  token: string;
  type: string;
  pageSize?: number;
  pageToken?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "drive.permission.list",
    `/open-apis/drive/v1/permissions/${params.token}/members`,
    {
      userId: params.userId,
      params: {
        type: params.type,
        page_size: typeof params.pageSize === "number" ? params.pageSize : 50,
        page_token: params.pageToken,
      },
    },
  );
  return result.data;
}

export async function createPermission(params: {
  token: string;
  type: string;
  memberType: string;
  memberId: string;
  perm: string;
  notify?: boolean;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "drive.permission.create",
    `/open-apis/drive/v1/permissions/${params.token}/members`,
    {
      member_type: params.memberType,
      member_id: params.memberId,
      perm: params.perm,
    },
    {
      userId: params.userId,
      params: {
        type: params.type,
        need_notification: params.notify !== false,
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function updatePermission(params: {
  token: string;
  type: string;
  permitteeId: string;
  permitteeType: string;
  perm: string;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "drive.permission.update",
    `/open-apis/drive/v1/permissions/${params.token}/members/${params.permitteeId}`,
    {
      member_type: params.permitteeType,
      perm: params.perm,
    },
    {
      userId: params.userId,
      params: {
        type: params.type,
        need_notification: false,
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function deletePermission(params: {
  token: string;
  type: string;
  permitteeId: string;
  permitteeType: string;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuDelete(
    "drive.permission.delete",
    `/open-apis/drive/v1/permissions/${params.token}/members/${params.permitteeId}`,
    {
      userId: params.userId,
      params: {
        type: params.type,
        member_type: params.permitteeType,
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function transferOwner(params: {
  token: string;
  type: string;
  toUserId: string;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "drive.permission.transferOwner",
    `/open-apis/drive/v1/permissions/${params.token}/members/transfer_owner`,
    {
      member_type: "user",
      member_id: params.toUserId,
    },
    {
      userId: params.userId,
      params: {
        type: params.type,
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}
