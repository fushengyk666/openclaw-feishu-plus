import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { registerDocsTool } from "./src/tools/docs-tool.js";
import { registerBitableTool } from "./src/tools/bitable-tool.js";
import { registerCalendarTool } from "./src/tools/calendar-tool.js";

const plugin = {
  id: "feishu-plus",
  name: "Feishu Plus",
  description: "Additive Feishu enhancement tools",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    const pluginCfg = api.config?.plugins?.entries?.["feishu-plus"]?.config || {};
    const enabled = pluginCfg?.enabled !== false;
    const docsEnabled = pluginCfg?.tools?.docs !== false;
    const bitableEnabled = pluginCfg?.tools?.bitable !== false;
    const calendarEnabled = pluginCfg?.tools?.calendar !== false;

    if (!enabled) {
      api.logger?.info?.("[feishu-plus] disabled by config");
      return;
    }

    if (docsEnabled) registerDocsTool(api, pluginCfg);
    if (bitableEnabled) registerBitableTool(api);
    if (calendarEnabled) registerCalendarTool(api);
  },
};

export default plugin;
