export const FeishuPlusDocsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: ["list_permissions", "add_permission", "remove_permission"],
    },
    token: {
      type: "string",
      minLength: 1,
      description: "Feishu file token (doc/docx/sheet/bitable/folder/file/wiki/mindnote)",
    },
    type: {
      type: "string",
      enum: ["doc", "docx", "sheet", "bitable", "folder", "file", "wiki", "mindnote"],
      description: "Feishu drive object type",
    },
    member_type: {
      type: "string",
      enum: ["email", "openid", "userid", "unionid", "openchat", "opendepartmentid"],
    },
    member_id: { type: "string" },
    perm: {
      type: "string",
      enum: ["view", "edit", "full_access"],
    },
    need_notification: { type: "boolean" },
  },
  required: ["action"],
};
