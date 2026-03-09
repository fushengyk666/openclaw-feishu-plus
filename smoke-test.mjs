import assert from "node:assert/strict";

import { parseConfig } from "./dist/src/core/config-schema.js";
import { getApiPolicy, isTokenSupported } from "./dist/src/core/api-policy.js";
import { MemoryTokenStore } from "./dist/src/core/token-store.js";
import { TokenResolver } from "./dist/src/core/token-resolver.js";
import { DocTools } from "./dist/src/tools/doc.js";
import { CalendarTools } from "./dist/src/tools/calendar.js";
import { OAuthTools } from "./dist/src/tools/oauth-tool.js";
import { DriveTools } from "./dist/src/tools/drive.js";
import { PLUGIN_ID, CHANNEL_ID, CONFIG_NAMESPACE } from "./dist/src/constants.js";

const config = parseConfig({
  appId: "cli_test",
  appSecret: "secret_test",
});

assert.equal(config.mode, "tools-only");
assert.equal(config.tools.doc, true);
assert.equal(config.tools.calendar, true);
assert.equal(config.tools.oauth, true);
assert.equal(config.tools.drive, false);
assert.equal(config.auth.preferUserToken, true);

const cfg2 = parseConfig({
  appId: "cli_test",
  appSecret: "secret_test",
  auth: {
    redirectUri: "https://example.com/callback",
  },
});
assert.equal(cfg2.auth.redirectUri, "https://example.com/callback");

assert.equal(getApiPolicy("docx.document.create").support, "both");
assert.equal(getApiPolicy("calendar.freebusy.list").support, "user_only");
assert.equal(isTokenSupported("calendar.freebusy.list", "user"), true);
assert.equal(isTokenSupported("calendar.freebusy.list", "tenant"), false);

const store = new MemoryTokenStore();
await store.set("cli_test", "ou_xxx", {
  accessToken: "uat_123",
  refreshToken: "rt_123",
  expiresAt: Date.now() + 3600_000,
  refreshExpiresAt: Date.now() + 86400_000,
  scopes: ["calendar:calendar:readonly"],
  userOpenId: "ou_xxx",
  updatedAt: Date.now(),
});
const token = await store.get("cli_test", "ou_xxx");
assert.equal(token?.accessToken, "uat_123");

const resolver = new TokenResolver(config, store);
assert.ok(resolver);

const docTools = new DocTools(config, store);
const calendarTools = new CalendarTools(config, store);
const oauthTools = new OAuthTools(config, store);
assert.ok(docTools && calendarTools && oauthTools);

const driveTools = new DriveTools(config, store);
let threw = false;
try {
  await driveTools.execute("feishu_drive_list_files", {});
} catch (err) {
  threw = true;
  assert.match(String(err), /not yet implemented/i);
}
assert.equal(threw, true);

assert.equal(PLUGIN_ID, "openclaw-feishu-plus");
assert.equal(CHANNEL_ID, "openclaw-feishu-plus");
assert.equal(CONFIG_NAMESPACE, "openclaw-feishu-plus");

console.log("smoke-test: ok");
