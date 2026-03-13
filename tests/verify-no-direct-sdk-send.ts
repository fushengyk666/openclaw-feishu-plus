/**
 * verify-no-direct-sdk-send.ts — source-level guardrail against channel-layer IM direct sends
 *
 * Goal:
 * - Ensure channel-layer message sending stays routed through send.ts / feishu-api
 * - Prevent accidental reintroduction of direct `client.im.message.create/patch/update/get`
 *   inside channel implementation files
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const channelDir = new URL("../src/channel/", import.meta.url);
  const files = readdirSync(channelDir).filter((name) => name.endsWith(".ts"));

  const forbidden = [
    "client.im.message.create(",
    "client.im.message.patch(",
    "client.im.message.update(",
    "client.im.message.get(",
  ];

  const violations: string[] = [];

  for (const file of files) {
    if (file === "send.ts") continue; // centralized outbound helper is the allowed transport boundary

    const fullPath = join(channelDir.pathname, file);
    const source = readFileSync(fullPath, "utf8");

    for (const token of forbidden) {
      if (source.includes(token)) {
        violations.push(`${file}: ${token}`);
      }
    }
  }

  assert(violations.length === 0, `found forbidden direct SDK sends:\n${violations.join("\n")}`);

  console.log("\n═══════════════════════════════════════");
  console.log("  No Direct SDK Send Verification Results");
  console.log("═══════════════════════════════════════\n");
  console.log("✅ no direct client.im.message.create outside send.ts");
  console.log("✅ no direct client.im.message.patch outside send.ts");
  console.log("✅ no direct client.im.message.update outside send.ts");
  console.log("✅ no direct client.im.message.get outside send.ts\n");
  console.log("───────────────────────────────────────");
  console.log("  Total: 4 | Passed: 4 | Failed: 0");
  console.log("───────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("No direct SDK send verification failed:", err);
  process.exit(1);
});
