/**
 * wiki.ts — 飞书 Wiki 知识库工具
 *
 * 支持：列出知识库空间、获取空间节点、列出节点、创建知识库空间
 * 身份：由 request-executor 自动决定（user-if-available-else-tenant）
 */

import { executeFeishuRequest } from "../core/request-executor.js";
import type { PluginConfig } from "../core/config-schema.js";
import type { ITokenStore } from "../core/token-store.js";

// ─── 工具定义 ───

export const WIKI_TOOL_DEFS = [
  {
    name: "feishu_wiki_list_spaces",
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
    name: "feishu_wiki_get_node",
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
    name: "feishu_wiki_list_nodes",
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
    name: "feishu_wiki_create_space",
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

// ─── 工具执行器类 ───

export class WikiTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, params: Record<string, unknown>, userId?: string): Promise<unknown> {
    switch (toolName) {
      case "feishu_wiki_list_spaces":
        return this.listSpaces(params, userId);

      case "feishu_wiki_get_node":
        return this.getNode(params, userId);

      case "feishu_wiki_list_nodes":
        return this.listNodes(params, userId);

      case "feishu_wiki_create_space":
        return this.createSpace(params, userId);

      default:
        throw new Error(`Unknown wiki tool: ${toolName}`);
    }
  }

  private async listSpaces(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "wiki.space.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/wiki/v2/spaces`);
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list wiki spaces: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async getNode(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "wiki.space.getNode",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/wiki/v2/spaces/get_node`);
        url.searchParams.set("token", String(params.token));
        if (params.user_id_type) url.searchParams.set("user_id_type", String(params.user_id_type));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to get wiki node: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async listNodes(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "wiki.spaceNode.list",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const url = new URL(`https://open.${this.config.domain}.cn/open-apis/wiki/v2/spaces/${params.space_id}/nodes`);
        if (params.parent_node_token) url.searchParams.set("parent_node_token", String(params.parent_node_token));
        if (params.page_size) url.searchParams.set("page_size", String(params.page_size));
        if (params.page_token) url.searchParams.set("page_token", String(params.page_token));

        const resp = await fetch(url.toString(), {
          headers: {
            "Authorization": authorizationHeader,
          },
        });

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to list wiki nodes: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }

  private async createSpace(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "wiki.space.create",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(
          `https://open.${this.config.domain}.cn/open-apis/wiki/v2/spaces`,
          {
            method: "POST",
            headers: {
              "Authorization": authorizationHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: params.name,
              description: params.description || "",
            }),
          }
        );

        if (!resp.ok) {
          const error = await resp.json();
          throw new Error(`Failed to create wiki space: ${JSON.stringify(error)}`);
        }

        return resp.json();
      },
    });
  }
}

// ─── 注册辅助函数 ───

export function registerWikiTools(
  tools: WikiTools,
  registerTool: (toolDef: typeof WIKI_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  WIKI_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
