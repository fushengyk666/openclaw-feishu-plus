/**
 * verify-streaming-dispatch-executor.ts — contract tests for streaming side-effect orchestration
 *
 * Updated: createStreamingCard now returns cardId (string | null) instead of boolean.
 * This fixes the critical bug where cardKitCardId was never propagated through state.
 */

import { executeStreamingDispatch } from "../src/channel/streaming-dispatch-executor.js";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

let passed = 0;
const total = 8;

async function main() {
  const calls: string[] = [];

  const makeDeps = (opts?: { createCardId?: string | null }) => ({
    createStreamingCard: async () => {
      calls.push("create");
      // Use explicit undefined check since null is a valid "failure" return value
      return opts && "createCardId" in opts ? opts.createCardId! : "card_123";
    },
    updateStreamingContent: async (text: string) => {
      calls.push(`update:${text}`);
    },
    finalizeCard: async (text: string) => {
      calls.push(`finalize:${text}`);
    },
    sendPlainText: async (text: string) => {
      calls.push(`plain:${text}`);
    },
  });

  // ── Test 1: First chunk creates card AND pushes initial content ──
  calls.length = 0;
  let result = await executeStreamingDispatch(
    {
      useStreaming: true,
      text: "hi",
      state: { accumulatedText: "", streamingCardCreated: false, cardKitCardId: null },
    },
    makeDeps({ createCardId: "card_abc" }),
  );
  assert(calls.join(",") === "create,update:hi", "first chunk should create card then push initial content");
  assert(result.state.streamingCardCreated === true, "first chunk should persist created state");
  assert(result.state.cardKitCardId === "card_abc", "first chunk should propagate cardKitCardId through state");
  assert(result.state.accumulatedText === "hi", "first chunk should accumulate text after card creation");
  assert(result.actions.includes("create-card"), "actions should include create-card");
  assert(result.actions.includes("initial-content-push"), "actions should include initial-content-push");
  console.log("✅ first chunk: card creation + cardId propagation + initial content push");
  passed++;

  // ── Test 2: Subsequent chunk updates existing card ──
  calls.length = 0;
  result = await executeStreamingDispatch(
    {
      useStreaming: true,
      text: " there",
      state: { accumulatedText: "hi", streamingCardCreated: true, cardKitCardId: "card_abc" },
    },
    makeDeps(),
  );
  assert(calls.join(",") === "update:hi there", "existing card should update content");
  assert(result.state.accumulatedText === "hi there", "update should persist accumulated text");
  assert(result.state.cardKitCardId === "card_abc", "cardKitCardId should stay unchanged");
  console.log("✅ subsequent chunk: update existing card");
  passed++;

  // ── Test 3: Final chunk updates then finalizes ──
  calls.length = 0;
  result = await executeStreamingDispatch(
    {
      useStreaming: true,
      text: "!",
      infoKind: "final",
      state: { accumulatedText: "hi there", streamingCardCreated: true, cardKitCardId: "card_abc" },
    },
    makeDeps(),
  );
  assert(calls.join(",") === "update:hi there!,finalize:hi there!", "final chunk should update then finalize");
  assert(result.state.accumulatedText === "hi there!", "final should persist accumulated text");
  console.log("✅ final chunk: update + finalize ordering");
  passed++;

  // ── Test 4: Non-streaming sends plain text ──
  calls.length = 0;
  result = await executeStreamingDispatch(
    {
      useStreaming: false,
      text: "plain hello",
      state: { accumulatedText: "", streamingCardCreated: false, cardKitCardId: null },
    },
    makeDeps(),
  );
  assert(calls.join(",") === "plain:plain hello", "non-streaming should send plain text");
  assert(result.state.streamingCardCreated === false, "non-streaming should keep state");
  console.log("✅ non-streaming: plain text fallback");
  passed++;

  // ── Test 5: Missing cardId falls back to plain text ──
  calls.length = 0;
  result = await executeStreamingDispatch(
    {
      useStreaming: true,
      text: "fallback",
      state: { accumulatedText: "", streamingCardCreated: true, cardKitCardId: null },
    },
    makeDeps(),
  );
  assert(calls.join(",") === "plain:fallback", "missing card id should fallback to plain text");
  console.log("✅ missing cardId: plain text fallback");
  passed++;

  // ── Test 6: Card creation failure returns null ──
  calls.length = 0;
  result = await executeStreamingDispatch(
    {
      useStreaming: true,
      text: "create fail",
      state: { accumulatedText: "", streamingCardCreated: false, cardKitCardId: null },
    },
    makeDeps({ createCardId: null }),
  );
  assert(calls.join(",") === "create", "create failure should not emit unexpected side effects");
  assert(result.state.streamingCardCreated === false, "create failure should preserve false state");
  assert(result.state.cardKitCardId === null, "create failure should not set cardKitCardId");
  assert(result.actions.includes("create-card-failed"), "actions should include create-card-failed");
  console.log("✅ card creation failure: contained, no side effects");
  passed++;

  // ── Test 7: Empty text is ignored ──
  calls.length = 0;
  result = await executeStreamingDispatch(
    {
      useStreaming: true,
      text: "   ",
      state: { accumulatedText: "existing", streamingCardCreated: true, cardKitCardId: "card_1" },
    },
    makeDeps(),
  );
  assert(calls.length === 0, "empty text should trigger no calls");
  assert(result.state.accumulatedText === "existing", "empty text should preserve existing accumulated text");
  console.log("✅ empty text: ignored, state preserved");
  passed++;

  // ── Test 8: Full E2E streaming lifecycle ──
  calls.length = 0;
  let state = { accumulatedText: "", streamingCardCreated: false, cardKitCardId: null as string | null };

  // Chunk 1: create
  result = await executeStreamingDispatch(
    { useStreaming: true, text: "Hello", state },
    makeDeps({ createCardId: "card_e2e" }),
  );
  state = result.state;

  // Chunk 2: update
  result = await executeStreamingDispatch(
    { useStreaming: true, text: " world", state },
    makeDeps(),
  );
  state = result.state;

  // Chunk 3: final
  result = await executeStreamingDispatch(
    { useStreaming: true, text: "!", infoKind: "final", state },
    makeDeps(),
  );
  state = result.state;

  assert(state.accumulatedText === "Hello world!", "E2E: final accumulated text should be complete");
  assert(state.cardKitCardId === "card_e2e", "E2E: cardId should persist through lifecycle");
  assert(calls.includes("create"), "E2E: should have created card");
  assert(calls.includes("finalize:Hello world!"), "E2E: should have finalized with full text");
  console.log("✅ E2E lifecycle: create → update → finalize");
  passed++;

  console.log("\n═══════════════════════════════════════");
  console.log("  Streaming Dispatch Executor Verification");
  console.log("═══════════════════════════════════════\n");
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log("───────────────────────────────────────\n");

  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error("Streaming dispatch executor verification failed:", err);
  process.exit(1);
});
