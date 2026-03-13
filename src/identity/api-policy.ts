/**
 * api-policy.ts — API Policy Registry
 *
 * 声明每个飞书 Open API operation 支持的 token 类型。
 * 这是 Token-first 架构的核心注册表。
 *
 * 规则：
 * - tenant_only: 仅支持 tenant_access_token
 * - user_only:   仅支持 user_access_token
 * - both:        两种 token 均可，由 TokenResolver 按策略选择
 */

// ─── 类型定义 ───

export type TokenSupport = "tenant_only" | "user_only" | "both";

export interface ApiPolicy {
  /** 该接口支持的 token 类型 */
  support: TokenSupport;
  /** 使用 user token 时需要的 OAuth scope */
  userScopes?: string[];
  /** 使用 tenant token 时需要的应用权限 */
  tenantScopes?: string[];
  /** 备注说明 */
  note?: string;
}

// ─── Policy Registry ───

/**
 * 飞书 API Policy 注册表
 *
 * key 格式：`{namespace}.{resource}.{action}`
 * 例如：`docx.document.create`
 *
 * 维护指南：
 * - 新增 API 能力时，在此注册 operation 的 token 支持情况
 * - 参考飞书开放平台文档中每个接口的「请求头」说明
 * - 未注册的 operation 将抛出错误，防止静默错误
 */
export const API_POLICY: Record<string, ApiPolicy> = {
  // ─── 文档 (Docx) ───
  "docx.document.create": {
    support: "both",
    userScopes: ["docx:document"],
    tenantScopes: ["docx:document"],
  },
  "docx.document.get": {
    support: "both",
    userScopes: ["docx:document:readonly"],
    tenantScopes: ["docx:document:readonly"],
  },
  "docx.document.rawContent": {
    support: "both",
    userScopes: ["docx:document:readonly"],
    tenantScopes: ["docx:document:readonly"],
  },
  "docx.document.list": {
    support: "both",
    userScopes: ["docx:document:readonly"],
    tenantScopes: ["docx:document:readonly"],
  },
  "docx.documentBlock.list": {
    support: "both",
    userScopes: ["docx:document:readonly"],
    tenantScopes: ["docx:document:readonly"],
  },
  "docx.documentBlock.create": {
    support: "both",
    userScopes: ["docx:document"],
    tenantScopes: ["docx:document"],
  },
  "docx.documentBlock.update": {
    support: "both",
    userScopes: ["docx:document"],
    tenantScopes: ["docx:document"],
  },
  "docx.documentBlock.delete": {
    support: "both",
    userScopes: ["docx:document"],
    tenantScopes: ["docx:document"],
  },

  // ─── Wiki 知识库 ───
  "wiki.space.list": {
    support: "both",
    userScopes: ["wiki:wiki:readonly"],
    tenantScopes: ["wiki:wiki:readonly"],
  },
  "wiki.space.getNode": {
    support: "both",
    userScopes: ["wiki:wiki:readonly"],
    tenantScopes: ["wiki:wiki:readonly"],
  },
  "wiki.spaceNode.list": {
    support: "both",
    userScopes: ["wiki:wiki:readonly"],
    tenantScopes: ["wiki:wiki:readonly"],
  },
  "wiki.space.create": {
    support: "both",
    userScopes: ["wiki:wiki"],
    tenantScopes: ["wiki:wiki"],
  },

  // ─── 云盘 (Drive) ───
  "drive.file.list": {
    support: "both",
    userScopes: ["drive:drive:readonly"],
    tenantScopes: ["drive:drive:readonly"],
  },
  "drive.file.get": {
    support: "both",
    userScopes: ["drive:drive:readonly"],
    tenantScopes: ["drive:drive:readonly"],
  },
  "drive.file.upload": {
    support: "both",
    userScopes: ["drive:drive"],
    tenantScopes: ["drive:drive"],
  },
  "drive.file.download": {
    support: "both",
    userScopes: ["drive:drive:readonly"],
    tenantScopes: ["drive:drive:readonly"],
  },
  "drive.file.createFolder": {
    support: "both",
    userScopes: ["drive:drive"],
    tenantScopes: ["drive:drive"],
  },
  "drive.file.delete": {
    support: "both",
    userScopes: ["drive:drive"],
    tenantScopes: ["drive:drive"],
  },
  "drive.file.copy": {
    support: "both",
    userScopes: ["drive:drive"],
    tenantScopes: ["drive:drive"],
  },
  "drive.file.move": {
    support: "both",
    userScopes: ["drive:drive"],
    tenantScopes: ["drive:drive"],
  },
  "drive.permission.create": {
    support: "both",
    userScopes: ["drive:drive"],
    tenantScopes: ["drive:drive"],
  },

  // ─── 多维表格 (Bitable) ───
  "bitable.app.get": {
    support: "both",
    userScopes: ["bitable:bitable:readonly"],
    tenantScopes: ["bitable:bitable:readonly"],
  },
  "bitable.appTable.list": {
    support: "both",
    userScopes: ["bitable:bitable:readonly"],
    tenantScopes: ["bitable:bitable:readonly"],
  },
  "bitable.appTableRecord.list": {
    support: "both",
    userScopes: ["bitable:bitable:readonly"],
    tenantScopes: ["bitable:bitable:readonly"],
  },
  "bitable.appTableRecord.create": {
    support: "both",
    userScopes: ["bitable:bitable"],
    tenantScopes: ["bitable:bitable"],
  },
  "bitable.appTableRecord.update": {
    support: "both",
    userScopes: ["bitable:bitable"],
    tenantScopes: ["bitable:bitable"],
  },
  "bitable.appTableRecord.delete": {
    support: "both",
    userScopes: ["bitable:bitable"],
    tenantScopes: ["bitable:bitable"],
  },

  // ─── 日历 (Calendar) ───
  "calendar.calendar.list": {
    support: "both",
    userScopes: ["calendar:calendar:readonly"],
    tenantScopes: ["calendar:calendar:readonly"],
  },
  "calendar.calendar.get": {
    support: "both",
    userScopes: ["calendar:calendar:readonly"],
    tenantScopes: ["calendar:calendar:readonly"],
  },
  "calendar.calendar.create": {
    support: "both",
    userScopes: ["calendar:calendar"],
    tenantScopes: ["calendar:calendar"],
  },
  "calendar.calendar.delete": {
    support: "both",
    userScopes: ["calendar:calendar"],
    tenantScopes: ["calendar:calendar"],
  },
  "calendar.calendar.update": {
    support: "both",
    userScopes: ["calendar:calendar"],
    tenantScopes: ["calendar:calendar"],
  },
  "calendar.calendarEvent.list": {
    support: "both",
    userScopes: ["calendar:calendar:readonly"],
    tenantScopes: ["calendar:calendar:readonly"],
  },
  "calendar.calendarEvent.create": {
    support: "both",
    userScopes: ["calendar:calendar"],
    tenantScopes: ["calendar:calendar"],
  },
  "calendar.calendarEvent.update": {
    support: "both",
    userScopes: ["calendar:calendar"],
    tenantScopes: ["calendar:calendar"],
  },
  "calendar.calendarEvent.delete": {
    support: "both",
    userScopes: ["calendar:calendar"],
    tenantScopes: ["calendar:calendar"],
  },
  "calendar.freebusy.list": {
    support: "user_only",
    userScopes: ["calendar:calendar:readonly"],
    note: "查询忙闲状态需要用户身份",
  },

  // ─── 任务 (Task v2 — user_access_token only) ───
  "task.task.create": {
    support: "user_only",
    userScopes: ["task:task"],
    note: "Task v2 API requires user_access_token",
  },
  "task.task.get": {
    support: "user_only",
    userScopes: ["task:task:readonly"],
    note: "Task v2 API requires user_access_token",
  },
  "task.task.list": {
    support: "user_only",
    userScopes: ["task:task:readonly"],
    note: "Task v2 API requires user_access_token",
  },
  "task.task.update": {
    support: "user_only",
    userScopes: ["task:task"],
    note: "Task v2 API requires user_access_token",
  },
  "task.task.complete": {
    support: "user_only",
    userScopes: ["task:task"],
    note: "Task v2 API requires user_access_token",
  },

  // ─── 群聊 (Chat / IM) ───
  "im.chat.create": {
    support: "both",
    userScopes: ["im:chat"],
    tenantScopes: ["im:chat"],
  },
  "im.chat.get": {
    support: "both",
    userScopes: ["im:chat:readonly"],
    tenantScopes: ["im:chat:readonly"],
  },
  "im.chat.list": {
    support: "both",
    userScopes: ["im:chat:readonly"],
    tenantScopes: ["im:chat:readonly"],
  },
  "im.chat.update": {
    support: "both",
    userScopes: ["im:chat"],
    tenantScopes: ["im:chat"],
  },
  "im.message.create": {
    support: "both",
    userScopes: ["im:message"],
    tenantScopes: ["im:message"],
  },
  "im.message.list": {
    support: "both",
    userScopes: ["im:message:readonly"],
    tenantScopes: ["im:message:readonly"],
  },
  "im.message.get": {
    support: "both",
    userScopes: ["im:message:readonly"],
    tenantScopes: ["im:message:readonly"],
  },
  "im.message.reply": {
    support: "both",
    userScopes: ["im:message"],
    tenantScopes: ["im:message"],
  },
  "im.message.delete": {
    support: "both",
    userScopes: ["im:message"],
    tenantScopes: ["im:message"],
  },
  "im.message.update": {
    support: "both",
    userScopes: ["im:message"],
    tenantScopes: ["im:message"],
  },
  "im.message.forward": {
    support: "both",
    userScopes: ["im:message"],
    tenantScopes: ["im:message"],
  },

  // ─── 权限管理 (Permission) ───
  "drive.permission.list": {
    support: "both",
    userScopes: ["drive:drive:readonly"],
    tenantScopes: ["drive:drive:readonly"],
  },
  "drive.permission.update": {
    support: "both",
    userScopes: ["drive:drive"],
    tenantScopes: ["drive:drive"],
  },
  "drive.permission.delete": {
    support: "both",
    userScopes: ["drive:drive"],
    tenantScopes: ["drive:drive"],
  },
  "drive.permission.transferOwner": {
    support: "user_only",
    userScopes: ["drive:drive"],
    note: "转移所有权必须使用用户身份",
  },

  // ─── 电子表格 (Sheets) ───
  "sheets.spreadsheet.get": {
    support: "both",
    userScopes: ["sheets:spreadsheet:readonly"],
    tenantScopes: ["sheets:spreadsheet:readonly"],
  },
  "sheets.spreadsheet.create": {
    support: "both",
    userScopes: ["sheets:spreadsheet"],
    tenantScopes: ["sheets:spreadsheet"],
  },
  "sheets.spreadsheet.query": {
    support: "both",
    userScopes: ["sheets:spreadsheet:readonly"],
    tenantScopes: ["sheets:spreadsheet:readonly"],
  },
  "sheets.spreadsheet.find": {
    support: "both",
    userScopes: ["sheets:spreadsheet:readonly"],
    tenantScopes: ["sheets:spreadsheet:readonly"],
  },
  "sheets.spreadsheet.listSheets": {
    support: "both",
    userScopes: ["sheets:spreadsheet:readonly"],
    tenantScopes: ["sheets:spreadsheet:readonly"],
  },

  // ─── 通讯录 (Contact) ───
  "contact.user.get": {
    support: "both",
    userScopes: ["contact:user.base:readonly"],
    tenantScopes: ["contact:user.base:readonly"],
  },
  "contact.user.batchGet": {
    support: "both",
    userScopes: ["contact:user.base:readonly"],
    tenantScopes: ["contact:user.base:readonly"],
  },
  "contact.user.me": {
    support: "user_only",
    userScopes: ["contact:user.base:readonly"],
    note: "获取当前用户信息必须使用用户身份",
  },
  "contact.department.get": {
    support: "both",
    userScopes: ["contact:department.base:readonly"],
    tenantScopes: ["contact:department.base:readonly"],
  },
  "contact.department.children.list": {
    support: "both",
    userScopes: ["contact:department.base:readonly"],
    tenantScopes: ["contact:department.base:readonly"],
  },
  "contact.department.user.list": {
    support: "both",
    userScopes: ["contact:user.base:readonly", "contact:department.base:readonly"],
    tenantScopes: ["contact:user.base:readonly", "contact:department.base:readonly"],
  },

  // ─── 审批 (Approval) ───
  "approval.definition.get": {
    support: "both",
    userScopes: ["approval:approval:readonly"],
    tenantScopes: ["approval:approval:readonly"],
  },
  "approval.instance.list": {
    support: "both",
    userScopes: ["approval:approval:readonly"],
    tenantScopes: ["approval:approval:readonly"],
  },
  "approval.instance.get": {
    support: "both",
    userScopes: ["approval:approval:readonly"],
    tenantScopes: ["approval:approval:readonly"],
  },
  "approval.instance.create": {
    support: "user_only",
    userScopes: ["approval:approval"],
    note: "创建审批实例需要用户身份",
  },
  "approval.task.approve": {
    support: "user_only",
    userScopes: ["approval:approval"],
    note: "同意审批任务需要用户身份",
  },
  "approval.task.reject": {
    support: "user_only",
    userScopes: ["approval:approval"],
    note: "拒绝审批任务需要用户身份",
  },
  "approval.instance.cancel": {
    support: "user_only",
    userScopes: ["approval:approval"],
    note: "撤回审批实例需要用户身份",
  },

  // ─── 搜索 (Search) ───
  "search.message.search": {
    support: "user_only",
    userScopes: ["search:message:readonly"],
    note: "搜索消息需要用户身份（结果基于用户可见范围）",
  },
  "search.doc.search": {
    support: "user_only",
    userScopes: ["search:docs:readonly"],
    note: "搜索云文档需要用户身份（结果基于用户可见范围）",
  },
  "search.app.search": {
    support: "user_only",
    userScopes: ["search:app:readonly"],
    note: "搜索应用需要用户身份",
  },

  // ─── 管理后台 ───
  "tenant.tenant.get": {
    support: "tenant_only",
    tenantScopes: ["tenant:tenant:readonly"],
    note: "租户信息仅应用身份可访问",
  },
};

// ─── 查询函数 ───

/**
 * 获取指定 operation 的 API Policy
 *
 * 如果 operation 未在注册表中，抛出错误，防止未经验证的操作被调用
 */
export function getApiPolicy(operation: string): ApiPolicy {
  const policy = API_POLICY[operation];
  if (!policy) {
    throw new Error(
      `Operation "${operation}" is not registered in API policy. ` +
        `Please add it to API_POLICY before use.`
    );
  }
  return policy;
}

/**
 * 获取指定 operation 在特定 token 类型下所需的 scopes
 */
export function getRequiredScopes(
  operation: string,
  tokenKind: "tenant" | "user"
): string[] {
  const policy = getApiPolicy(operation);
  return tokenKind === "user"
    ? policy.userScopes ?? []
    : policy.tenantScopes ?? [];
}

/**
 * 检查指定 operation 是否支持给定的 token 类型
 */
export function isTokenSupported(
  operation: string,
  tokenKind: "tenant" | "user"
): boolean {
  const policy = getApiPolicy(operation);
  if (policy.support === "both") return true;
  if (policy.support === "tenant_only") return tokenKind === "tenant";
  if (policy.support === "user_only") return tokenKind === "user";
  return false;
}
