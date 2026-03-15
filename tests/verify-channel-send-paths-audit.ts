/**
 * verify-channel-send-paths-audit.ts — Comprehensive channel send path audit
 *
 * Verifies three things:
 * 1. No direct SDK IM message sends outside send.ts (existing guardrail)
 * 2. All sendMessageFeishu calls in plugin.ts/media.ts pass userId
 *    (except documented exceptions)
 * 3. Documents intentional raw SDK usage (reactions, directory, probe,
 *    CardKit, media upload) that correctly use tenant token
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const channelDir = join(__dirname, "..", "src", "channel");

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

let passed = 0;
let total = 0;

function check(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
  }
}

function readChannel(name: string): string {
  return readFileSync(join(channelDir, name), "utf8");
}

async function main() {
  const files = readdirSync(channelDir).filter((name) => name.endsWith(".ts"));

  // ────────────────────────────────────────
  // GUARD 1: No direct SDK IM sends outside send.ts
  // ────────────────────────────────────────
  const forbiddenSendPatterns = [
    "client.im.message.create(",
    "client.im.message.patch(",
    "client.im.message.update(",
    "client.im.message.get(",
  ];

  for (const pattern of forbiddenSendPatterns) {
    check(`no direct ${pattern.replace("(", "")} outside send.ts`, () => {
      const violations: string[] = [];
      for (const file of files) {
        if (file === "send.ts") continue;
        const source = readFileSync(join(channelDir, file), "utf8");
        if (source.includes(pattern)) {
          violations.push(file);
        }
      }
      assert(violations.length === 0,
        `found in: ${violations.join(", ")}. All IM message sends must go through send.ts`);
    });
  }

  // ────────────────────────────────────────
  // GUARD 2: sendMessageFeishu calls pass userId
  // ────────────────────────────────────────
  check("plugin.ts outbound passes userId", () => {
    const src = readChannel("plugin.ts");
    // The outbound handler should pass userId
    assert(
      src.includes("userId: typeof senderId === \"string\" ? senderId : undefined"),
      "outbound handler must pass senderId as userId",
    );
  });

  check("plugin.ts sendReply passes userId (senderOpenId)", () => {
    const src = readChannel("plugin.ts");
    // Look for the sendReply helper inside handleInboundMessage
    const sendReplyMatch = src.match(/const sendReply[\s\S]*?userId:\s*senderOpenId/);
    assert(sendReplyMatch, "sendReply must pass senderOpenId as userId");
  });

  check("plugin.ts notifyApproval: userId absence is documented/intentional", () => {
    const src = readChannel("plugin.ts");
    // notifyApproval sends to a newly-approved user — no user OAuth context exists
    // This is intentional: the bot notifies using tenant token
    const approvalMatch = src.match(/notifyApproval[\s\S]*?sendMessageFeishu\(\{[\s\S]*?\}\)/);
    assert(approvalMatch, "notifyApproval must exist");
    // It's OK that userId is not passed here — it's a bot-initiated notification
    // Verify it doesn't accidentally pass some other userId
    assert(
      !approvalMatch[0].includes("userId:"),
      "notifyApproval should NOT pass userId (bot notification, not user-behalf)",
    );
  });

  check("media.ts sendImageFeishu passes userId through hooks", () => {
    const src = readChannel("media.ts");
    const imageMatch = src.match(/function sendImageFeishu[\s\S]*?userId:\s*params\.userId/);
    assert(imageMatch, "sendImageFeishu must forward params.userId");
  });

  check("media.ts sendFileFeishu passes userId through hooks", () => {
    const src = readChannel("media.ts");
    const fileMatch = src.match(/function sendFileFeishu[\s\S]*?userId:\s*params\.userId/);
    assert(fileMatch, "sendFileFeishu must forward params.userId");
  });

  check("media.ts sendMediaFeishu passes userId to sendImage/sendFile", () => {
    const src = readChannel("media.ts");
    // Both paths in sendMediaFeishu should pass userId
    const imagePathMatch = src.match(/sendImageFeishu\(\{[\s\S]*?userId:\s*params\.userId/);
    const filePathMatch = src.match(/sendFileFeishu\(\{[\s\S]*?userId:\s*params\.userId/);
    assert(imagePathMatch, "sendMediaFeishu image path must forward params.userId");
    assert(filePathMatch, "sendMediaFeishu file path must forward params.userId");
  });

  // ────────────────────────────────────────
  // GUARD 3: send.ts routes through feishu-api (not raw SDK)
  // ────────────────────────────────────────
  check("send.ts imports from identity/feishu-api (not lark SDK)", () => {
    const src = readChannel("send.ts");
    assert(
      src.includes("from \"../identity/feishu-api.js\""),
      "send.ts must import from identity/feishu-api",
    );
    assert(
      !src.includes("from \"@larksuiteoapi/node-sdk\""),
      "send.ts must NOT import lark SDK directly",
    );
    assert(
      !src.includes("getLarkClient"),
      "send.ts must NOT use getLarkClient",
    );
  });

  // ────────────────────────────────────────
  // DOCUMENT: Intentional raw SDK usage
  // ────────────────────────────────────────
  // These use raw SDK (tenant token) by design and are NOT send paths
  const intentionalRawSdk: Record<string, string[]> = {
    "directory.ts": [
      "client.contact.user.list — directory peer listing (bot context)",
      "client.im.chat.list — directory group listing (bot context)",
    ],
    "probe.ts": [
      "new lark.Client — health check probe (bot context)",
    ],
    "reactions.ts": [
      "client.im.messageReaction.create/delete/list — bot reactions (bot context)",
    ],
    "streaming-card-executor.ts": [
      "client.cardkit.v1.card.* — CardKit streaming (app-level, no user context needed)",
    ],
    "media.ts": [
      "client.im.image.create — multipart image upload (app-level)",
      "client.im.file.create — multipart file upload (app-level)",
    ],
    "plugin.ts": [
      "client.contact.user.get — sender name resolution in inbound handler (bot context)",
      "client.im.messageReaction.create/delete — typing indicator (bot context)",
    ],
  };

  check("intentional raw SDK usage documented and no new unexpected files", () => {
    const rawSdkFiles = new Set<string>();
    for (const file of files) {
      if (file === "send.ts") continue; // send.ts is the authorized transport boundary
      const source = readFileSync(join(channelDir, file), "utf8");
      if (
        source.includes("getLarkClient") ||
        source.includes("new lark.Client") ||
        source.includes("client.im.") ||
        source.includes("client.contact.") ||
        source.includes("client.cardkit.")
      ) {
        rawSdkFiles.add(file);
      }
    }

    const documented = new Set(Object.keys(intentionalRawSdk));
    const undocumented = [...rawSdkFiles].filter((f) => !documented.has(f));

    assert(
      undocumented.length === 0,
      `undocumented raw SDK usage in: ${undocumented.join(", ")}. ` +
        `Add to intentionalRawSdk in this test if it's intentional.`,
    );
  });

  // ────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────
  console.log("\n═══════════════════════════════════════");
  console.log("  Channel Send Path Audit");
  console.log("═══════════════════════════════════════");
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);

  if (passed === total) {
    console.log("\n  ✅ All message-level sends go through send.ts → feishu-api → dual-auth");
    console.log("  ✅ All send calls propagate userId for user-token routing");
    console.log("  ✅ Raw SDK usage is limited to documented bot-context operations");
  }

  console.log("\n  Documented intentional raw SDK usage:");
  for (const [file, reasons] of Object.entries(intentionalRawSdk)) {
    for (const reason of reasons) {
      console.log(`    ${file}: ${reason}`);
    }
  }
  console.log("═══════════════════════════════════════\n");

  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error("Channel send paths audit failed:", err);
  process.exit(1);
});
