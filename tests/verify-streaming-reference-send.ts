/**
 * verify-streaming-reference-send.ts — source-level guardrail for streaming reference message path
 *
 * Goal:
 * - Ensure streaming reference message no longer uses direct SDK send
 * - Ensure senderOpenId is forwarded as userId via sendMessageFeishu
 */

import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const source = readFileSync(new URL("../src/channel/streaming-session.ts", import.meta.url), "utf8");

  const marker = "// Send IM message referencing card_id";
  const start = source.indexOf(marker);
  assert(start >= 0, "streaming-session.ts should contain streaming reference send step");
  const end = source.indexOf("this.cardMessageId =", start);
  const snippet = source.slice(start, end + 120);

  assert(snippet.includes("await sendMessageFeishu({"), "streaming reference message should use sendMessageFeishu");
  assert(snippet.includes('msgType: "interactive"'), "streaming reference message should stay interactive");
  assert(snippet.includes("userId: this.config.senderOpenId"), "streaming reference message should forward senderOpenId as userId");
  assert(!snippet.includes("streamingSdk.sendReferenceMessage"), "streaming reference message should not call streamingSdk.sendReferenceMessage anymore");
  assert(!snippet.includes("client.im.message.create"), "streaming reference message should not call SDK IM create directly anymore");

  console.log("\n═══════════════════════════════════════");
  console.log("  Streaming Reference Send Verification Results");
  console.log("═══════════════════════════════════════\n");
  console.log("✅ streaming reference step exists");
  console.log("✅ streaming reference routes through sendMessageFeishu");
  console.log("✅ interactive message type preserved");
  console.log("✅ senderOpenId forwarded as userId");
  console.log("✅ direct SDK send removed\n");
  console.log("───────────────────────────────────────");
  console.log("  Total: 5 | Passed: 5 | Failed: 0");
  console.log("───────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Streaming reference send verification failed:", err);
  process.exit(1);
});
