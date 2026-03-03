export const FeishuPlusCalendarSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: [
        "list_calendars",
        "list_events",
        "get_event",
        "create_event",
        "update_event",
        "delete_event"
      ]
    },
    calendar_id: { type: "string" },
    event_id: { type: "string" },
    summary: { type: "string" },
    description: { type: "string" },
    location: { type: "string" },
    start_time: {
      description: "Unix 秒时间戳，或 Feishu start_time 对象",
      anyOf: [{ type: "integer" }, { type: "string" }, { type: "object" }]
    },
    end_time: {
      description: "Unix 秒时间戳，或 Feishu end_time 对象",
      anyOf: [{ type: "integer" }, { type: "string" }, { type: "object" }]
    },
    timezone: { type: "string", default: "Asia/Shanghai" },
    page_token: { type: "string" },
    page_size: { type: "integer", minimum: 1, maximum: 500 },
    attendees: {
      type: "array",
      items: { type: "object" },
      description: "可选，原样透传给 Feishu API"
    },
    reminders: {
      type: "array",
      items: { type: "object" },
      description: "可选，原样透传给 Feishu API"
    },
    visibility: { type: "string" },
    extra_fields: {
      type: "object",
      description: "可选，透传附加字段"
    }
  },
  required: ["action"]
};
