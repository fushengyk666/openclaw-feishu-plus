import { FeishuPlusDocsPermissionSchema as FeishuPlusPermSchema } from "../domains/docs/schemas.js";
import { createFeishuClient } from "../core/client.js";
import { runPermAction } from "../domains/docs/permissions.js";
import { asToolError } from "../core/errors.js";
import { asTextResult } from "../core/result.js";

export function registerPermTool(api, pluginCfg) {
  api.registerTool(
    {
      name: "feishu_plus_perm",
      label: "Feishu Plus Permission",
      description: "Feishu Drive/Bitable collaborator management. Actions: list, add, remove",
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
