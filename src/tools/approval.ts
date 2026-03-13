/**
 * approval.ts — 飞书审批工具 (Dual-Auth)
 *
 * 审批业务域核心能力：
 * - 获取审批定义
 * - 列出审批实例
 * - 获取审批实例详情
 * - 创建审批实例（user_only）
 * - 审批同意/拒绝（user_only）
 * - 撤回审批（user_only）
 *
 * 审批是强用户态业务域：创建/审批/撤回均需用户身份。
 */

import { feishuGet, feishuPost } from "../identity/feishu-api.js";

export const APPROVAL_TOOL_DEFS = [
  {
    name: "feishu_plus_approval_get_definition",
    description: "获取审批定义详情（含表单字段定义）",
    parameters: {
      type: "object",
      properties: {
        approval_code: {
          type: "string",
          description: "审批定义 Code",
        },
        locale: {
          type: "string",
          description: "语言（zh-CN/en-US/ja-JP），默认 zh-CN",
        },
      },
      required: ["approval_code"],
    },
  },
  {
    name: "feishu_plus_approval_list_instances",
    description: "批量获取审批实例 ID 列表",
    parameters: {
      type: "object",
      properties: {
        approval_code: {
          type: "string",
          description: "审批定义 Code",
        },
        start_time: {
          type: "string",
          description: "查询开始时间（Unix 毫秒）",
        },
        end_time: {
          type: "string",
          description: "查询结束时间（Unix 毫秒）",
        },
        page_size: {
          type: "number",
          description: "每页数量（默认 100，最大 100）",
        },
        page_token: {
          type: "string",
          description: "分页 token",
        },
      },
      required: ["approval_code", "start_time", "end_time"],
    },
  },
  {
    name: "feishu_plus_approval_get_instance",
    description: "获取审批实例详情",
    parameters: {
      type: "object",
      properties: {
        instance_id: {
          type: "string",
          description: "审批实例 ID",
        },
        locale: {
          type: "string",
          description: "语言（zh-CN/en-US/ja-JP），默认 zh-CN",
        },
        user_id_type: {
          type: "string",
          description: "用户 ID 类型（open_id/user_id/union_id），默认 open_id",
        },
      },
      required: ["instance_id"],
    },
  },
  {
    name: "feishu_plus_approval_create_instance",
    description: "创建审批实例（需要用户授权）",
    parameters: {
      type: "object",
      properties: {
        approval_code: {
          type: "string",
          description: "审批定义 Code",
        },
        form: {
          type: "string",
          description: "表单数据（JSON 字符串，需按审批定义的控件格式填写）",
        },
        open_id: {
          type: "string",
          description: "发起人 open_id（不填则用当前授权用户）",
        },
        department_id: {
          type: "string",
          description: "发起人部门 ID（可选）",
        },
        node_approver_open_id_list: {
          type: "string",
          description: "指定审批人 open_id 列表（JSON 数组字符串，格式：[{\"key\":\"node_key\",\"value\":[\"ou_xxx\"]}]）",
        },
      },
      required: ["approval_code", "form"],
    },
  },
  {
    name: "feishu_plus_approval_approve",
    description: "同意审批任务（需要用户授权）",
    parameters: {
      type: "object",
      properties: {
        approval_code: {
          type: "string",
          description: "审批定义 Code",
        },
        instance_code: {
          type: "string",
          description: "审批实例 Code",
        },
        task_id: {
          type: "string",
          description: "审批任务 ID",
        },
        comment: {
          type: "string",
          description: "审批意见",
        },
        user_id: {
          type: "string",
          description: "操作人 user_id（不填则用当前授权用户）",
        },
      },
      required: ["approval_code", "instance_code", "task_id"],
    },
  },
  {
    name: "feishu_plus_approval_reject",
    description: "拒绝审批任务（需要用户授权）",
    parameters: {
      type: "object",
      properties: {
        approval_code: {
          type: "string",
          description: "审批定义 Code",
        },
        instance_code: {
          type: "string",
          description: "审批实例 Code",
        },
        task_id: {
          type: "string",
          description: "审批任务 ID",
        },
        comment: {
          type: "string",
          description: "拒绝意见",
        },
        user_id: {
          type: "string",
          description: "操作人 user_id（不填则用当前授权用户）",
        },
      },
      required: ["approval_code", "instance_code", "task_id"],
    },
  },
  {
    name: "feishu_plus_approval_cancel",
    description: "撤回审批实例（需要用户授权，仅发起人可撤回）",
    parameters: {
      type: "object",
      properties: {
        approval_code: {
          type: "string",
          description: "审批定义 Code",
        },
        instance_code: {
          type: "string",
          description: "审批实例 Code",
        },
        user_id: {
          type: "string",
          description: "操作人 user_id（不填则用当前授权用户）",
        },
      },
      required: ["approval_code", "instance_code"],
    },
  },
];

export class ApprovalTools {
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    userId?: string,
  ): Promise<unknown> {
    switch (toolName) {
      case "feishu_plus_approval_get_definition":
        return this.getDefinition(params, userId);
      case "feishu_plus_approval_list_instances":
        return this.listInstances(params, userId);
      case "feishu_plus_approval_get_instance":
        return this.getInstance(params, userId);
      case "feishu_plus_approval_create_instance":
        return this.createInstance(params, userId);
      case "feishu_plus_approval_approve":
        return this.approveTask(params, userId);
      case "feishu_plus_approval_reject":
        return this.rejectTask(params, userId);
      case "feishu_plus_approval_cancel":
        return this.cancelInstance(params, userId);
      default:
        throw new Error(`Unknown approval tool: ${toolName}`);
    }
  }

  private async getDefinition(params: Record<string, unknown>, userId?: string) {
    const result = await feishuPost(
      "approval.definition.get",
      "/open-apis/approval/v4/approvals",
      {
        approval_code: String(params.approval_code),
        locale: params.locale ? String(params.locale) : "zh-CN",
      },
      { userId },
    );
    return result.data;
  }

  private async listInstances(params: Record<string, unknown>, userId?: string) {
    const result = await feishuPost(
      "approval.instance.list",
      "/open-apis/approval/v4/instances",
      {
        approval_code: String(params.approval_code),
        start_time: String(params.start_time),
        end_time: String(params.end_time),
        page_size: params.page_size ? Number(params.page_size) : 100,
        page_token: params.page_token ? String(params.page_token) : undefined,
      },
      { userId },
    );
    return result.data;
  }

  private async getInstance(params: Record<string, unknown>, userId?: string) {
    const result = await feishuGet(
      "approval.instance.get",
      `/open-apis/approval/v4/instances/${String(params.instance_id)}`,
      {
        userId,
        params: {
          locale: params.locale ? String(params.locale) : undefined,
          user_id_type: params.user_id_type ? String(params.user_id_type) : undefined,
        },
      },
    );
    return result.data;
  }

  private async createInstance(params: Record<string, unknown>, userId?: string) {
    const body: Record<string, unknown> = {
      approval_code: String(params.approval_code),
      form: String(params.form),
    };
    if (params.open_id) body.open_id = String(params.open_id);
    if (params.department_id) body.department_id = String(params.department_id);
    if (params.node_approver_open_id_list) {
      try {
        body.node_approver_open_id_list =
          typeof params.node_approver_open_id_list === "string"
            ? JSON.parse(params.node_approver_open_id_list)
            : params.node_approver_open_id_list;
      } catch {
        // best-effort
      }
    }

    const result = await feishuPost(
      "approval.instance.create",
      "/open-apis/approval/v4/instances",
      body,
      { userId },
    );
    return result.data;
  }

  private async approveTask(params: Record<string, unknown>, userId?: string) {
    const result = await feishuPost(
      "approval.task.approve",
      "/open-apis/approval/v4/tasks/approve",
      {
        approval_code: String(params.approval_code),
        instance_code: String(params.instance_code),
        task_id: String(params.task_id),
        comment: params.comment ? String(params.comment) : undefined,
        user_id: params.user_id ? String(params.user_id) : undefined,
      },
      { userId },
    );
    return result.data;
  }

  private async rejectTask(params: Record<string, unknown>, userId?: string) {
    const result = await feishuPost(
      "approval.task.reject",
      "/open-apis/approval/v4/tasks/reject",
      {
        approval_code: String(params.approval_code),
        instance_code: String(params.instance_code),
        task_id: String(params.task_id),
        comment: params.comment ? String(params.comment) : undefined,
        user_id: params.user_id ? String(params.user_id) : undefined,
      },
      { userId },
    );
    return result.data;
  }

  private async cancelInstance(params: Record<string, unknown>, userId?: string) {
    const result = await feishuPost(
      "approval.instance.cancel",
      "/open-apis/approval/v4/instances/cancel",
      {
        approval_code: String(params.approval_code),
        instance_code: String(params.instance_code),
        user_id: params.user_id ? String(params.user_id) : undefined,
      },
      { userId },
    );
    return result.data;
  }
}

export function registerApprovalTools(
  tools: ApprovalTools,
  registerTool: (
    toolDef: (typeof APPROVAL_TOOL_DEFS)[0],
    execute: (args: any, userId?: string) => Promise<any>,
  ) => void,
): void {
  APPROVAL_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args, userId) =>
      tools.execute(toolDef.name, args, userId),
    );
  });
}
