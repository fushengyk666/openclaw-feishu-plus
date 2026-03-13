/**
 * verify-streaming-dispatch.ts — Pure tests for streaming dispatch decision helper
 */

import { decideStreamingDispatch } from "../src/channel/streaming-card-dispatch.js";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const empty = decideStreamingDispatch({
    useStreaming: true,
    text: "   ",
    state: { accumulatedText: "a", streamingCardCreated: false, cardKitCardId: null },
  });
  assert(empty.shouldCreateCard === false, "empty: should not create card");
  assert(empty.plainTextToSend === null, "empty: should not send text");

  const staticMode = decideStreamingDispatch({
    useStreaming: false,
    text: "hello",
    state: { accumulatedText: "", streamingCardCreated: false, cardKitCardId: null },
  });
  assert(staticMode.shouldFallbackToPlainText === true, "static: should fallback");
  assert(staticMode.plainTextToSend === "hello", "static: wrong plain text");

  const firstStreamingChunk = decideStreamingDispatch({
    useStreaming: true,
    text: "hi",
    state: { accumulatedText: "", streamingCardCreated: false, cardKitCardId: null },
  });
  assert(firstStreamingChunk.shouldCreateCard === true, "first chunk: should create card");
  assert(firstStreamingChunk.shouldUpdateContent === false, "first chunk: should not update content before card exists");
  assert(firstStreamingChunk.nextAccumulatedText === "hi", "first chunk: wrong accumulated text");

  const streamingUpdate = decideStreamingDispatch({
    useStreaming: true,
    text: " there",
    state: { accumulatedText: "hi", streamingCardCreated: true, cardKitCardId: "card_1" },
  });
  assert(streamingUpdate.shouldUpdateContent === true, "update: should update content");
  assert(streamingUpdate.shouldFinalizeCard === false, "update: should not finalize");
  assert(streamingUpdate.nextAccumulatedText === "hi there", "update: wrong accumulated text");

  const finalChunk = decideStreamingDispatch({
    useStreaming: true,
    text: "!",
    infoKind: "final",
    state: { accumulatedText: "hi there", streamingCardCreated: true, cardKitCardId: "card_1" },
  });
  assert(finalChunk.shouldUpdateContent === true, "final: should update content");
  assert(finalChunk.shouldFinalizeCard === true, "final: should finalize");
  assert(finalChunk.nextAccumulatedText === "hi there!", "final: wrong accumulated text");

  const createdButNoCardId = decideStreamingDispatch({
    useStreaming: true,
    text: "oops",
    state: { accumulatedText: "", streamingCardCreated: true, cardKitCardId: null },
  });
  assert(createdButNoCardId.shouldFallbackToPlainText === true, "noCardId: should fallback");
  assert(createdButNoCardId.plainTextToSend === "oops", "noCardId: wrong fallback text");

  console.log("\n═══════════════════════════════════════");
  console.log("  Streaming Dispatch Verification Results");
  console.log("═══════════════════════════════════════\n");
  console.log("✅ empty chunk ignored");
  console.log("✅ static mode fallback");
  console.log("✅ first streaming chunk create-card decision");
  console.log("✅ streaming update decision");
  console.log("✅ final chunk finalize decision");
  console.log("✅ fallback when card missing\n");
  console.log("───────────────────────────────────────");
  console.log("  Total: 6 | Passed: 6 | Failed: 0");
  console.log("───────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Streaming dispatch verification failed:", err);
  process.exit(1);
});
