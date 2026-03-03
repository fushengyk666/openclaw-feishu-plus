import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { FeishuPlusPermSchema } from "./src/schemas.js";
import { FeishuPlusBitableSchema } from "./src/bitable-schemas.js";
import { FeishuPlusCalendarSchema } from "./src/calendar-schemas.js";
import { createFeishuClient } from "./src/client.js";
import { runPermAction } from "./src/perm-actions.js";
import { runBitableAction } from "./src/bitable-actions.js";
import { runCalendarAction } from "./src/calendar-actions.js";
import { asToolError } from "./src/errors.js";

function asTextResult(obj) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(obj, null, 2),
      },
    ],
  };
}

const plugin = {
  id: "feishu-plus",
  name: "Feishu Plus",
  description: "Additive Feishu enhancement tools",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    const pluginCfg = api.config?.plugins?.entries?.["feishu-plus"]?.config || {};
    const enabled = pluginCfg?.enabled !== false;
    const permEnabled = pluginCfg?.tools?.perm !== false;
    const bitableEnabled = pluginCfg?.tools?.bitable !== false;
    const calendarEnabled = pluginCfg?.tools?.calendar !== false;

    if (!enabled) {
      api.logger?.info?.("[feishu-plus] disabled by config");
      return;
    }

    if (permEnabled) {
      api.registerTool(
        {
          name: "feishu_plus_perm",
          label: "Feishu Plus Permission",
          description:
            "Feishu Drive/Bitable collaborator management. Actions: list, add, remove",
          parameters: FeishuPlusPermSchema,
          async execute(_toolCallId, params) {
            try {
              const client = await createFeishuClient(api);
              const result = await runPermAction(client, pluginCfg, params);
              return asTextResult(result);
            } catch (err) {
              return asTextResult(asToolError(err));
            }
          },
        },
        { name: "feishu_plus_perm" },
      );
      api.logger?.info?.("[feishu-plus] registered tool: feishu_plus_perm");
    }

    if (bitableEnabled) {
      api.registerTool(
        {
          name: "feishu_plus_bitable",
          label: "Feishu Plus Bitable",
          description:
            "Feishu Bitable enhancement actions. Supports list/create table and record delete/batch operations.",
          parameters: FeishuPlusBitableSchema,
          async execute(_toolCallId, params) {
            try {
              const client = await createFeishuClient(api);
              const result = await runBitableAction(client, params);
              return asTextResult(result);
            } catch (err) {
              return asTextResult(asToolError(err));
            }
          },
        },
        { name: "feishu_plus_bitable" },
      );
      api.logger?.info?.("[feishu-plus] registered tool: feishu_plus_bitable");
    }

    if (calendarEnabled) {
      api.registerTool(
        {
          name: "feishu_plus_calendar",
          label: "Feishu Plus Calendar",
          description:
            "Feishu Calendar enhancement actions. Supports calendar/event CRUD.",
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
  },
};

export default plugin;
