/**
 * verify-plugin-send-paths.ts — source-level guardrail for plugin outbound paths
 *
 * Goal:
 * - Ensure plugin reply helper now routes through sendMessageFeishu instead of direct client.im.message.create
 */

import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const pluginSource = readFileSync(new URL("../src/channel/plugin.ts", import.meta.url), "utf8");

  const hasReplyHelper = pluginSource.includes("const sendReply = async (text: string) => {");
  assert(hasReplyHelper, "plugin.ts should contain sendReply helper");

  const helperSliceStart = pluginSource.indexOf("const sendReply = async (text: string) => {");
  const helperSliceEnd = pluginSource.indexOf("// ── Streaming card constants ──", helperSliceStart);
  const helperSource = pluginSource.slice(helperSliceStart, helperSliceEnd);

  assert(helperSource.includes("await sendMessageFeishu({"), "sendReply helper should use sendMessageFeishu");
  assert(helperSource.includes("userId: senderOpenId"), "sendReply helper should forward senderOpenId as userId");
  assert(!helperSource.includes("client.im.message.create"), "sendReply helper should not call client.im.message.create directly anymore");

  console.log("\n═══════════════════════════════════════");
  console.log("  Plugin Send Path Verification Results");
  console.log("═══════════════════════════════════════\n");
  console.log("✅ sendReply helper exists");
  console.log("✅ sendReply helper routes through sendMessageFeishu");
  console.log("✅ sendReply helper forwards senderOpenId as userId");
  console.log("✅ sendReply helper no longer uses direct SDK send\n");
  console.log("───────────────────────────────────────");
  console.log("  Total: 4 | Passed: 4 | Failed: 0");
  console.log("───────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Plugin send path verification failed:", err);
  process.exit(1);
});
