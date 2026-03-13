/**
 * platform/docs/client.ts — Feishu Docs (Docx) Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import { feishuGet, feishuPost } from "../../identity/feishu-api.js";

export async function createDocxDocument(params: {
  title: string;
  folderToken?: string;
  userId?: string;
}) {
  const body: Record<string, unknown> = { title: params.title };
  if (params.folderToken) body.folder_token = params.folderToken;

  const result = await feishuPost(
    "docx.document.create",
    "/open-apis/docx/v1/documents",
    body,
    { userId: params.userId },
  );

  return result.data;
}

export async function getDocxDocument(params: {
  documentId: string;
  userId?: string;
}) {
  const result = await feishuGet(
    "docx.document.get",
    `/open-apis/docx/v1/documents/${params.documentId}`,
    { userId: params.userId },
  );

  return result.data;
}

export async function listDocxBlocks(params: {
  documentId: string;
  pageSize?: number;
  pageToken?: string;
  userId?: string;
}) {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (typeof params.pageSize === "number") queryParams.page_size = params.pageSize;
  if (params.pageToken) queryParams.page_token = params.pageToken;

  const result = await feishuGet(
    "docx.documentBlock.list",
    `/open-apis/docx/v1/documents/${params.documentId}/blocks`,
    { userId: params.userId, params: queryParams },
  );

  return result.data;
}

export async function getDocxRawContent(params: {
  documentId: string;
  userId?: string;
}) {
  const result = await feishuGet(
    "docx.document.rawContent",
    `/open-apis/docx/v1/documents/${params.documentId}/raw_content`,
    { userId: params.userId },
  );

  return result.data;
}
