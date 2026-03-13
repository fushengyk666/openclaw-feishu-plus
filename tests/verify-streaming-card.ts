/**
 * verify-streaming-card.ts — Pure tests for streaming-card helpers
 */

import {
  STREAMING_ELEMENT_ID,
  buildFinalStreamingCard,
  buildStreamingContentUpdate,
  buildStreamingFinalizeUpdate,
  buildStreamingReferenceMessage,
  buildStreamingSettingsUpdate,
  buildThinkingStreamingCard,
  resolveStreamingTarget,
} from "../src/channel/streaming-card.js";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const thinking = buildThinkingStreamingCard();
  assert(thinking.schema === "2.0", "thinking: wrong schema");
  assert(thinking.config.streaming_mode === true, "thinking: streaming_mode should be true");
  assert(typeof thinking.config.summary.content === "string" && thinking.config.summary.content.length > 0, "thinking: summary should be non-empty");
  assert(thinking.body.elements.length === 1, "thinking: expected one element");
  assert(thinking.body.elements[0].element_id === STREAMING_ELEMENT_ID, "thinking: wrong element id");
  assert(typeof thinking.body.elements[0].content === "string" && thinking.body.elements[0].content.length > 0, "thinking: expected non-empty content");

  const finalCard = buildFinalStreamingCard("hello world");
  assert(finalCard.schema === "2.0", "final: wrong schema");
  assert(finalCard.config.streaming_mode === false, "final: streaming_mode should be false");
  assert(finalCard.body.elements.length === 1, "final: expected one element");
  assert(finalCard.body.elements[0].content === "hello world", "final: wrong content");

  const directTarget = resolveStreamingTarget({ isDirect: true, senderOpenId: "ou_1", chatId: "oc_1" });
  assert(directTarget.targetId === "ou_1", "target: direct targetId wrong");
  assert(directTarget.receiveIdType === "open_id", "target: direct receiveIdType wrong");

  const chatTarget = resolveStreamingTarget({ isDirect: false, senderOpenId: "ou_1", chatId: "oc_1" });
  assert(chatTarget.targetId === "oc_1", "target: chat targetId wrong");
  assert(chatTarget.receiveIdType === "chat_id", "target: chat receiveIdType wrong");

  const refMsg = buildStreamingReferenceMessage("card_1", directTarget);
  assert(refMsg.params.receive_id_type === "open_id", "refMsg: wrong receive_id_type");
  assert(refMsg.data.receive_id === "ou_1", "refMsg: wrong receive_id");
  assert(refMsg.data.msg_type === "interactive", "refMsg: wrong msg_type");
  assert(JSON.parse(refMsg.data.content).data.card_id === "card_1", "refMsg: wrong card_id");

  const contentUpdate = buildStreamingContentUpdate("card_1", 2, "abc");
  assert(contentUpdate.body.sequence === 2, "contentUpdate: wrong sequence");
  assert(contentUpdate.body.content === "abc", "contentUpdate: wrong content");
  assert(contentUpdate.url.includes("/cardkit/v1/cards/card_1"), "contentUpdate: wrong url");

  const finalizeUpdate = buildStreamingFinalizeUpdate("card_1", 3, "done");
  assert(finalizeUpdate.body.sequence === 3, "finalizeUpdate: wrong sequence");
  assert(finalizeUpdate.body.content === "done", "finalizeUpdate: wrong final content");

  const settingsUpdate = buildStreamingSettingsUpdate("card_1", 4);
  assert(settingsUpdate.body.sequence === 4, "settingsUpdate: wrong sequence");
  assert(JSON.parse(settingsUpdate.body.settings).config.streaming_mode === false, "settingsUpdate: wrong settings");

  console.log("\n═══════════════════════════════════════");
  console.log("  Streaming Card Verification Results");
  console.log("═══════════════════════════════════════\n");
  console.log("✅ buildThinkingStreamingCard");
  console.log("✅ buildFinalStreamingCard");
  console.log("✅ resolveStreamingTarget");
  console.log("✅ buildStreamingReferenceMessage");
  console.log("✅ buildStreamingContentUpdate");
  console.log("✅ buildStreamingFinalizeUpdate");
  console.log("✅ buildStreamingSettingsUpdate\n");
  console.log("───────────────────────────────────────");
  console.log("  Total: 7 | Passed: 7 | Failed: 0");
  console.log("───────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Streaming card verification failed:", err);
  process.exit(1);
});
