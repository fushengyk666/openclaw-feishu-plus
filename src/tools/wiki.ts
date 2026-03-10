/**
 * wiki.ts — 飞书 Wiki 知识库工具 (Lark SDK)
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

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
  private client: InstanceType<typeof lark.Client>;

  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      domain: config.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu,
      disableTokenCache: false,
    });
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_wiki_list_spaces":
        return this.listSpaces(params);
      case "feishu_plus_wiki_get_node":
        return this.getNode(params);
      case "feishu_plus_wiki_list_nodes":
        return this.listNodes(params);
      case "feishu_plus_wiki_create_space":
        return this.createSpace(params);
      default:
        throw new Error(`Unknown wiki tool: ${toolName}`);
    }
  }

  private async listSpaces(params: Record<string, unknown>) {
    return this.client.wiki.v2.space.list({
      params: {
        page_size: params.page_size ? Number(params.page_size) : 50,
        page_token: params.page_token ? String(params.page_token) : undefined,
      },
    });
  }

  private async getNode(params: Record<string, unknown>) {
    return this.client.wiki.v2.space.getNode({
      params: {
        token: String(params.token),
      },
    });
  }

  private async listNodes(params: Record<string, unknown>) {
    return this.client.wiki.v2.spaceNode.list({
      path: { space_id: String(params.space_id) },
      params: {
        parent_node_token: params.parent_node_token ? String(params.parent_node_token) : undefined,
        page_size: params.page_size ? Number(params.page_size) : 50,
        page_token: params.page_token ? String(params.page_token) : undefined,
      },
    });
  }

  private async createSpace(params: Record<string, unknown>) {
    return this.client.wiki.v2.space.create({
      data: {
        name: String(params.name),
        description: params.description ? String(params.description) : undefined,
      },
    });
  }
}

export function registerWikiTools(
  tools: WikiTools,
  registerTool: (toolDef: typeof WIKI_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  WIKI_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
