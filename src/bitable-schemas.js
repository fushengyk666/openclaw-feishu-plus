export const FeishuPlusBitableSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: [
        "list_tables",
        "create_table",
        "delete_record",
        "batch_create_records",
        "batch_update_records",
        "batch_delete_records"
      ]
    },
    app_token: { type: "string", minLength: 1 },
    table_id: { type: "string" },
    table_name: { type: "string" },
    record_id: { type: "string" },
    record_ids: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 1,
      maxItems: 500
    },
    records: {
      type: "array",
      minItems: 1,
      maxItems: 500,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          record_id: { type: "string" },
          fields: { type: "object" }
        },
        required: ["fields"]
      }
    }
  },
  required: ["action", "app_token"]
};
