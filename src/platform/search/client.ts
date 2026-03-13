/**
 * platform/search/client.ts — Feishu Search Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 *
 * All search APIs require user_access_token (search results are scoped
 * to the user's visible range for permission isolation).
 */

import { feishuPost, type IdentityMode } from "../../identity/feishu-api.js";

export async function searchMessage(params: {
  query: string;
  chatIds?: string[];
  messageType?: string;
  fromIds?: string[];
  fromType?: string;
  startTime?: string;
  endTime?: string;
  pageSize?: number;
  pageToken?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const body: Record<string, unknown> = {
    query: params.query,
  };
  if (params.chatIds?.length) body.chat_ids = params.chatIds;
  if (params.messageType) body.message_type = params.messageType;
  if (params.fromIds?.length) body.from_ids = params.fromIds;
  if (params.fromType) body.from_type = params.fromType;
  if (params.startTime) body.start_time = params.startTime;
  if (params.endTime) body.end_time = params.endTime;
  if (params.pageSize) body.page_size = params.pageSize;
  if (params.pageToken) body.page_token = params.pageToken;

  const result = await feishuPost(
    "search.message.search",
    "/open-apis/search/v2/message",
    body,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function searchDoc(params: {
  searchKey: string;
  ownerIds?: string[];
  chatIds?: string[];
  docsTypes?: string[];
  count?: number;
  offset?: number;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const body: Record<string, unknown> = {
    search_key: params.searchKey,
  };
  if (params.ownerIds?.length) body.owner_ids = params.ownerIds;
  if (params.chatIds?.length) body.chat_ids = params.chatIds;
  if (params.docsTypes?.length) body.docs_types = params.docsTypes;
  if (params.count !== undefined) body.count = params.count;
  if (params.offset !== undefined) body.offset = params.offset;

  const result = await feishuPost(
    "search.doc.search",
    "/open-apis/suite/docs-api/search/object",
    body,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function searchApp(params: {
  query: string;
  pageSize?: number;
  pageToken?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "search.app.search",
    "/open-apis/search/v1/app",
    {
      query: params.query,
      page_size: typeof params.pageSize === "number" ? params.pageSize : 20,
      page_token: params.pageToken,
    },
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}
