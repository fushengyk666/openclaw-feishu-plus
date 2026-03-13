/**
 * platform/bitable/client.ts — Feishu Bitable Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import { feishuGet, feishuPost, feishuPatch, feishuDelete } from "../../identity/feishu-api.js";

export async function getBitableApp(params: {
  appToken: string;
  userId?: string;
}) {
  const result = await feishuGet(
    "bitable.app.get",
    `/open-apis/bitable/v1/apps/${params.appToken}`,
    { userId: params.userId },
  );
  return result.data;
}

export async function listBitableTables(params: {
  appToken: string;
  userId?: string;
}) {
  const result = await feishuGet(
    "bitable.appTable.list",
    `/open-apis/bitable/v1/apps/${params.appToken}/tables`,
    { userId: params.userId },
  );
  return result.data;
}

export async function listBitableRecords(params: {
  appToken: string;
  tableId: string;
  pageSize?: number;
  pageToken?: string;
  viewId?: string;
  fieldIds?: string;
  sort?: string;
  filter?: string;
  userId?: string;
}) {
  const queryParams: Record<string, string | number | boolean | undefined> = {
    page_size: typeof params.pageSize === "number" ? params.pageSize : 20,
    page_token: params.pageToken,
    view_id: params.viewId,
    sort: params.sort,
    filter: params.filter,
  };
  if (params.fieldIds) queryParams.field_names = params.fieldIds;

  const result = await feishuGet(
    "bitable.appTableRecord.list",
    `/open-apis/bitable/v1/apps/${params.appToken}/tables/${params.tableId}/records`,
    { userId: params.userId, params: queryParams },
  );
  return result.data;
}

export async function createBitableRecord(params: {
  appToken: string;
  tableId: string;
  fields: Record<string, unknown>;
  userIdType?: string;
  userId?: string;
}) {
  const result = await feishuPost(
    "bitable.appTableRecord.create",
    `/open-apis/bitable/v1/apps/${params.appToken}/tables/${params.tableId}/records`,
    { fields: params.fields },
    {
      userId: params.userId,
      params: {
        user_id_type: params.userIdType,
      },
    },
  );
  return result.data;
}

export async function updateBitableRecord(params: {
  appToken: string;
  tableId: string;
  recordId: string;
  fields: Record<string, unknown>;
  userId?: string;
}) {
  const result = await feishuPatch(
    "bitable.appTableRecord.update",
    `/open-apis/bitable/v1/apps/${params.appToken}/tables/${params.tableId}/records/${params.recordId}`,
    { fields: params.fields },
    { userId: params.userId },
  );
  return result.data;
}

export async function deleteBitableRecord(params: {
  appToken: string;
  tableId: string;
  recordId: string;
  userId?: string;
}) {
  const result = await feishuDelete(
    "bitable.appTableRecord.delete",
    `/open-apis/bitable/v1/apps/${params.appToken}/tables/${params.tableId}/records/${params.recordId}`,
    { userId: params.userId },
  );
  return result.data;
}
