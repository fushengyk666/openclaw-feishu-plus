import { FeishuPlusBitableSchema } from "../domains/bitable/schemas.js";
import { createFeishuClient } from "../core/client.js";
import { runBitableAction } from "../domains/bitable/actions.js";
import { asToolError } from "../core/errors.js";
import { asTextResult } from "../core/result.js";

export function registerBitableTool(api) {
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
