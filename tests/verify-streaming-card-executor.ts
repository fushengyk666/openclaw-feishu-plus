/**
 * verify-streaming-card-executor.ts — Mock tests for streaming-card side-effect wrapper
 */

import { createStreamingCardSdk } from "../src/channel/streaming-card-executor.js";

const calls: Array<{ method: string; payload: any }> = [];

const mockClient = {
  cardkit: {
    v1: {
      card: {
        create: async (payload: any) => {
          calls.push({ method: "cardkit.v1.card.create", payload });
          return { data: { card_id: "card_1" } };
        },
        update: async (payload: any) => {
          calls.push({ method: "cardkit.v1.card.update", payload });
          return { data: {} };
        },
        settings: async (payload: any) => {
          calls.push({ method: "cardkit.v1.card.settings", payload });
          return { data: {} };
        },
      },
      cardElement: {
        content: async (payload: any) => {
          calls.push({ method: "cardkit.v1.cardElement.content", payload });
          return { data: {} };
        },
      },
    },
  },
};

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const sdk = createStreamingCardSdk(mockClient as any);

  await sdk.createCard({ data: { a: 1 } });
  await sdk.updateContent({ data: { c: 3 } });
  await sdk.updateFinalCard({ data: { d: 4 } });
  await sdk.updateSettings({ data: { e: 5 } });

  assert(calls.length === 4, "expected 4 sdk calls");
  assert(calls[0].method === "cardkit.v1.card.create", "wrong create mapping");
  assert(calls[1].method === "cardkit.v1.cardElement.content", "wrong updateContent mapping");
  assert(calls[2].method === "cardkit.v1.card.update", "wrong updateFinalCard mapping");
  assert(calls[3].method === "cardkit.v1.card.settings", "wrong updateSettings mapping");

  console.log("\n═══════════════════════════════════════");
  console.log("  Streaming Card Executor Verification Results");
  console.log("═══════════════════════════════════════\n");
  console.log("✅ createCard");
  console.log("✅ updateContent");
  console.log("✅ updateFinalCard");
  console.log("✅ updateSettings\n");
  console.log("───────────────────────────────────────");
  console.log("  Total: 4 | Passed: 4 | Failed: 0");
  console.log("───────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Streaming card executor verification failed:", err);
  process.exit(1);
});
