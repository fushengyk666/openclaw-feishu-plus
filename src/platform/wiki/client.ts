/**
 * platform/wiki/client.ts — Feishu Wiki Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import { feishuGet, feishuPost, type IdentityMode } from "../../identity/feishu-api.js";

export async function listWikiSpaces(params: {
  pageSize?: number;
  pageToken?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "wiki.space.list",
    "/open-apis/wiki/v2/spaces",
    {
      userId: params.userId,
      params: {
        page_size: typeof params.pageSize === "number" ? params.pageSize : 50,
        page_token: params.pageToken,
      },
    },
  );

  return result.data;
}

export async function getWikiNode(params: {
  token: string;
  userIdType?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "wiki.space.getNode",
    "/open-apis/wiki/v2/nodes/get_node",
    {
      userId: params.userId,
      params: {
        token: params.token,
        user_id_type: params.userIdType,
      },
    },
  );

  return result.data;
}

export async function listWikiSpaceNodes(params: {
  spaceId: string;
  parentNodeToken?: string;
  pageSize?: number;
  pageToken?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "wiki.spaceNode.list",
    "/open-apis/wiki/v2/spaces/get_node",
    {
      userId: params.userId,
      params: {
        space_id: params.spaceId,
        parent_node_token: params.parentNodeToken,
        page_size: typeof params.pageSize === "number" ? params.pageSize : 50,
        page_token: params.pageToken,
      },
    },
  );

  return result.data;
}

export async function createWikiSpace(params: {
  name: string;
  description?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "wiki.space.create",
    "/open-apis/wiki/v2/spaces",
    {
      name: params.name,
      description: params.description,
    },
    { userId: params.userId, identityMode: params.identityMode },
  );

  return result.data;
}
