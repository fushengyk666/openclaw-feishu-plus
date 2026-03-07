import { FeishuPlusDocsSchema } from "../domains/docs/tool-schema.js";
import { createFeishuClient } from "../core/client.js";
import { runDocsAction } from "../domains/docs/actions.js";
import { asToolError } from "../core/errors.js";
import { asTextResult } from "../core/result.js";

export function registerDocsTool(api, pluginCfg) {
  api.registerTool(
    {
      name: "feishu_plus_docs",
      label: "Feishu Plus Docs",
      description: "Feishu Docs/Drive/Wiki enhancement actions. Currently focuses on permission management.",
      parameters: FeishuPlusDocsSchema,
      async execute(_toolCallId, params) {
        try {
          const client = await createFeishuClient(api);
          const result = await runDocsAction(client, pluginCfg, params);
          return asTextResult(result);
        } catch (err) {
          return asTextResult(asToolError(err));
        }
      },
    },
    { name: "feishu_plus_docs" },
  );
  api.logger?.info?.("[feishu-plus] registered tool: feishu_plus_docs");
}
