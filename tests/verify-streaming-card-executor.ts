/**
 * verify-streaming-card-executor.ts — Mock tests for streaming-card side-effect wrapper
 *
 * Tests both the new raw HTTP path (with creds) and the legacy SDK fallback path.
 */

import { createStreamingCardSdk } from "../src/channel/streaming-card-executor.js";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

let passed = 0;
const total = 4;

async function main() {
  // Test 1: Legacy SDK fallback (no creds)
  const sdkCalls: Array<{ method: string; payload: any }> = [];

  const mockClient = {
    cardkit: {
      v1: {
        card: {
          create: async (payload: any) => {
            sdkCalls.push({ method: "cardkit.v1.card.create", payload });
            return { data: { card_id: "card_1" } };
          },
          settings: async (payload: any) => {
            sdkCalls.push({ method: "cardkit.v1.card.settings", payload });
            return { data: {} };
          },
        },
        cardElement: {
          content: async (payload: any) => {
            sdkCalls.push({ method: "cardkit.v1.cardElement.content", payload });
            return { data: {} };
          },
        },
      },
    },
  };

  const fallbackSdk = createStreamingCardSdk(mockClient as any);
  await fallbackSdk.createCard({ data: { a: 1 } });
  assert(sdkCalls.length === 1, "expected 1 sdk call after createCard");
  assert(sdkCalls[0].method === "cardkit.v1.card.create", "wrong create mapping");
  console.log("✅ createCard (fallback SDK path)");
  passed++;

  // Test 2: updateElementContent (fallback)
  await fallbackSdk.updateElementContent("card_1", "content", { content: "hello", sequence: 2 });
  assert(sdkCalls.length === 2, "expected 2 sdk calls after updateElementContent");
  assert(sdkCalls[1].method === "cardkit.v1.cardElement.content", "wrong updateElementContent mapping");
  console.log("✅ updateElementContent (fallback SDK path)");
  passed++;

  // Test 3: updateSettings (fallback)
  await fallbackSdk.updateSettings("card_1", { settings: "{}", sequence: 3 });
  assert(sdkCalls.length === 3, "expected 3 sdk calls after updateSettings");
  assert(sdkCalls[2].method === "cardkit.v1.card.settings", "wrong updateSettings mapping");
  console.log("✅ updateSettings (fallback SDK path)");
  passed++;

  // Test 4: Raw HTTP SDK (with creds) — verify it creates without throwing when creds are provided
  const httpSdk = createStreamingCardSdk(mockClient as any, {
    appId: "cli_test",
    appSecret: "test_secret",
    domain: "feishu",
  });
  assert(typeof httpSdk.createCard === "function", "raw HTTP SDK has createCard");
  assert(typeof httpSdk.updateElementContent === "function", "raw HTTP SDK has updateElementContent");
  assert(typeof httpSdk.updateSettings === "function", "raw HTTP SDK has updateSettings");
  console.log("✅ createStreamingCardSdk with creds returns valid SDK interface");
  passed++;

  console.log("\n═══════════════════════════════════════");
  console.log("  Streaming Card Executor Verification Results");
  console.log("═══════════════════════════════════════\n");
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log("───────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Streaming card executor verification failed:", err);
  process.exit(1);
});
