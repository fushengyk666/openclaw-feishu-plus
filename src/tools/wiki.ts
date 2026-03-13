/**
 * wiki.ts — 飞书 Wiki 知识库工具 (Dual-Auth)
 *
 * 所有 API 调用经 platform 层封装，最终仍通过 identity/feishu-api 执行（双授权）。
 */

import {
  listWikiSpaces,
  getWikiNode,
  listWikiSpaceNodes,
  createWikiSpace,
} from "../platform/wiki/index.js";

export const WIKI_TOOL_DEFS = [
  {
    name: "feishu_plus_wiki_list_spaces",
    description: "列出知识库空间列表",
    parameters: {
      type: "object",
      properties: {
        page_size: { type: "number", description: "每页数量（默认 50）" },
        page_token: { type: "string", description: "分页 token" },
      },
    },
  },
  {
    name: "feishu_plus_wiki_get_node",
    description: "获取知识库节点信息",
    parameters: {
      type: "object",
      properties: {
        token: { type: "string", description: "节点 token" },
        user_id_type: { type: "string", description: "用户 ID 类型（open_id/user_id/union_id），默认 open_id" },
      },
      required: ["token"],
    },
  },
  {
    name: "feishu_plus_wiki_list_nodes",
    description: "列出知识库空间下的节点",
    parameters: {
      type: "object",
      properties: {
        space_id: { type: "string", description: "知识库空间 ID" },
        parent_node_token: { type: "string", description: "父节点 token（根节点为空）" },
        page_size: { type: "number", description: "每页数量（默认 50）" },
        page_token: { type: "string", description: "分页 token" },
      },
      required: ["space_id"],
    },
  },
  {
    name: "feishu_plus_wiki_create_space",
    description: "创建知识库空间",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "知识库名称" },
        description: { type: "string", description: "知识库描述" },
      },
      required: ["name"],
    },
  },
];

export class WikiTools {
  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_wiki_list_spaces":
        return this.listSpaces(params, userId);
      case "feishu_plus_wiki_get_node":
        return this.getNode(params, userId);
      case "feishu_plus_wiki_list_nodes":
        return this.listNodes(params, userId);
      case "feishu_plus_wiki_create_space":
        return this.createSpace(params, userId);
      default:
        throw new Error(`Unknown wiki tool: ${toolName}`);
    }
  }

  private async listSpaces(params: Record<string, unknown>, userId?: string) {
    return await listWikiSpaces({
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      userId,
    });
  }

  private async getNode(params: Record<string, unknown>, userId?: string) {
    return await getWikiNode({
      token: String(params.token),
      userIdType: params.user_id_type ? String(params.user_id_type) : undefined,
      userId,
    });
  }

  private async listNodes(params: Record<string, unknown>, userId?: string) {
    return await listWikiSpaceNodes({
      spaceId: String(params.space_id),
      parentNodeToken: params.parent_node_token ? String(params.parent_node_token) : undefined,
      pageSize: params.page_size ? Number(params.page_size) : undefined,
      pageToken: params.page_token ? String(params.page_token) : undefined,
      userId,
    });
  }

  private async createSpace(params: Record<string, unknown>, userId?: string) {
    return await createWikiSpace({
      name: String(params.name),
      description: params.description ? String(params.description) : undefined,
      userId,
    });
  }
}

export function registerWikiTools(
  tools: WikiTools,
  registerTool: (
    toolDef: (typeof WIKI_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  WIKI_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) => tools.execute(toolDef.name, args, userId));
  });
}
