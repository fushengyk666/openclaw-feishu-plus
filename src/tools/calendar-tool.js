import { FeishuPlusCalendarSchema } from "../calendar-schemas.js";
import { createFeishuClient } from "../core/client.js";
import { runCalendarAction } from "../calendar-actions.js";
import { asToolError } from "../core/errors.js";
import { asTextResult } from "../core/result.js";

export function registerCalendarTool(api) {
  api.registerTool(
    {
      name: "feishu_plus_calendar",
      label: "Feishu Plus Calendar",
      description: "Feishu Calendar enhancement actions. Supports calendar/event CRUD.",
      parameters: FeishuPlusCalendarSchema,
      async execute(_toolCallId, params) {
        try {
          const client = await createFeishuClient(api);
          const result = await runCalendarAction(client, params);
          return asTextResult(result);
        } catch (err) {
          return asTextResult(asToolError(err));
        }
      },
    },
    { name: "feishu_plus_calendar" },
  );
  api.logger?.info?.("[feishu-plus] registered tool: feishu_plus_calendar");
}
