export const FeishuPlusPermSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["list", "add", "remove"] },
    token: { type: "string", minLength: 1, description: "Feishu file token (bitable/docx/sheet/wiki/...)" },
    type: {
      type: "string",
      enum: ["doc", "docx", "sheet", "bitable", "folder", "file", "wiki", "mindnote"],
      description: "Feishu drive object type"
    },
    member_type: {
      type: "string",
      enum: ["email", "openid", "userid", "unionid", "openchat", "opendepartmentid"],
      description: "Required for add/remove"
    },
    member_id: { type: "string", description: "Required for add/remove" },
    perm: {
      type: "string",
      enum: ["view", "edit", "full_access"],
      description: "Required for add"
    },
    need_notification: {
      type: "boolean",
      description: "Only applies to add. Default false."
    }
  },
  required: ["action", "token", "type"]
};
