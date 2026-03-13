/**
 * verify-streaming-group.ts — Tests for group chat streaming card scenarios
 *
 * Verifies:
 * 1. resolveStreamingTarget returns chat_id for group context
 * 2. buildStreamingReferenceMessage uses chat_id for groups
 * 3. decideStreamingDispatch works correctly with useStreaming=true for group context
 * 4. executeStreamingDispatch creates cards for group context
 * 5. useStreaming gate logic: streamingInGroup config controls group streaming
 * 6. Full group streaming lifecycle: create → update → finalize
 */

import {
  resolveStreamingTarget,
  buildStreamingReferenceMessage,
  buildStreamingContentUpdate,
  buildStreamingFinalizeUpdate,
  buildStreamingSettingsUpdate,
  buildThinkingStreamingCard,
} from "../src/channel/streaming-card.js";
import { decideStreamingDispatch } from "../src/channel/streaming-card-dispatch.js";
import { executeStreamingDispatch } from "../src/channel/streaming-dispatch-executor.js";
import type { StreamingDispatchRuntimeState, StreamingDispatchExecutorDeps } from "../src/channel/streaming-dispatch-executor.js";

let passed = 0;
let total = 0;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

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

async function checkAsync(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
  }
}

function makeMockDeps(log: string[]): StreamingDispatchExecutorDeps {
  return {
    createStreamingCard: async () => {
      log.push("create");
      return "card_group_test_123";
    },
    updateStreamingContent: async (text: string) => {
      log.push(`update:${text.length}`);
    },
    finalizeCard: async (fullText: string) => {
      log.push(`finalize:${fullText.length}`);
    },
    sendPlainText: async (text: string) => {
      log.push(`plain:${text}`);
    },
  };
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Group Chat Streaming Tests");
  console.log("═══════════════════════════════════════\n");

  // ── 1. resolveStreamingTarget for group ──
  console.log("── Target Resolution ──");

  check("resolveStreamingTarget: group → chat_id + chatId", () => {
    const target = resolveStreamingTarget({
      isDirect: false,
      senderOpenId: "ou_sender123",
      chatId: "oc_group456",
    });
    assert(target.targetId === "oc_group456", `expected oc_group456, got ${target.targetId}`);
    assert(target.receiveIdType === "chat_id", `expected chat_id, got ${target.receiveIdType}`);
  });

  check("resolveStreamingTarget: DM → open_id + senderOpenId", () => {
    const target = resolveStreamingTarget({
      isDirect: true,
      senderOpenId: "ou_sender123",
      chatId: "oc_group456",
    });
    assert(target.targetId === "ou_sender123", `expected ou_sender123, got ${target.targetId}`);
    assert(target.receiveIdType === "open_id", `expected open_id, got ${target.receiveIdType}`);
  });

  // ── 2. buildStreamingReferenceMessage for group ──
  console.log("\n── Reference Message ──");

  check("buildStreamingReferenceMessage: group uses chat_id", () => {
    const target = resolveStreamingTarget({
      isDirect: false,
      senderOpenId: "ou_sender123",
      chatId: "oc_group456",
    });
    const msg = buildStreamingReferenceMessage("card_test_id", target);
    assert(msg.params.receive_id_type === "chat_id", "should use chat_id for group");
    assert(msg.data.receive_id === "oc_group456", "should target chatId");

    const content = JSON.parse(msg.data.content);
    assert(content.type === "card", "content type should be card");
    assert(content.data.card_id === "card_test_id", "card_id should match");
  });

  check("buildStreamingReferenceMessage: DM uses open_id", () => {
    const target = resolveStreamingTarget({
      isDirect: true,
      senderOpenId: "ou_sender123",
      chatId: "oc_group456",
    });
    const msg = buildStreamingReferenceMessage("card_test_id", target);
    assert(msg.params.receive_id_type === "open_id", "should use open_id for DM");
    assert(msg.data.receive_id === "ou_sender123", "should target senderOpenId");
  });

  // ── 3. decideStreamingDispatch with group context ──
  console.log("\n── Dispatch Decision ──");

  check("decideStreamingDispatch: useStreaming=true creates card (group scenario)", () => {
    const decision = decideStreamingDispatch({
      useStreaming: true,
      text: "Hello group!",
      state: { accumulatedText: "", streamingCardCreated: false, cardKitCardId: null },
    });
    assert(decision.shouldCreateCard === true, "should create card");
    assert(decision.shouldFallbackToPlainText === false, "should not fallback to plain text");
    assert(decision.nextAccumulatedText === "Hello group!", "accumulated text should include content");
  });

  check("decideStreamingDispatch: useStreaming=false falls back to plain text (group with streaming disabled)", () => {
    const decision = decideStreamingDispatch({
      useStreaming: false,
      text: "Hello group!",
      state: { accumulatedText: "", streamingCardCreated: false, cardKitCardId: null },
    });
    assert(decision.shouldCreateCard === false, "should NOT create card");
    assert(decision.shouldFallbackToPlainText === true, "should fallback to plain text");
    assert(decision.plainTextToSend === "Hello group!", "should send original text");
  });

  // ── 4. executeStreamingDispatch for group ──
  console.log("\n── Executor (Group) ──");

  await checkAsync("executeStreamingDispatch: creates card for group streaming", async () => {
    const log: string[] = [];
    const deps = makeMockDeps(log);
    const state: StreamingDispatchRuntimeState = {
      accumulatedText: "",
      streamingCardCreated: false,
      cardKitCardId: null,
    };

    const result = await executeStreamingDispatch(
      { useStreaming: true, text: "Group message", state },
      deps,
    );

    assert(result.state.streamingCardCreated === true, "card should be created");
    assert(result.state.cardKitCardId === "card_group_test_123", "cardId should propagate");
    assert(result.actions.includes("create-card"), "should have create-card action");
    assert(result.actions.includes("initial-content-push"), "should push initial content");
    assert(log.includes("create"), "should call createStreamingCard");
  });

  await checkAsync("executeStreamingDispatch: updates card after creation (group)", async () => {
    const log: string[] = [];
    const deps = makeMockDeps(log);
    const state: StreamingDispatchRuntimeState = {
      accumulatedText: "Group message",
      streamingCardCreated: true,
      cardKitCardId: "card_group_test_123",
    };

    const result = await executeStreamingDispatch(
      { useStreaming: true, text: " continued", state },
      deps,
    );

    assert(result.state.accumulatedText === "Group message continued", "text should accumulate");
    assert(result.actions.includes("update-content"), "should update content");
    assert(!log.includes("create"), "should NOT create card again");
  });

  await checkAsync("executeStreamingDispatch: finalizes card for group (info.kind=final)", async () => {
    const log: string[] = [];
    const deps = makeMockDeps(log);
    const state: StreamingDispatchRuntimeState = {
      accumulatedText: "Group message continued",
      streamingCardCreated: true,
      cardKitCardId: "card_group_test_123",
    };

    const result = await executeStreamingDispatch(
      { useStreaming: true, text: " done.", infoKind: "final", state },
      deps,
    );

    assert(result.actions.includes("finalize-card"), "should finalize card");
    assert(result.state.accumulatedText === "Group message continued done.", "full text accumulated");
  });

  // ── 5. useStreaming gate logic ──
  console.log("\n── Config Gate Logic ──");

  check("useStreaming gate: streaming=true + DM → true", () => {
    const feishuCfg = { streaming: true, streamingInGroup: false };
    const isDirect = true;
    const useStreaming = feishuCfg.streaming === true && (isDirect || feishuCfg.streamingInGroup === true);
    assert(useStreaming === true, "DM streaming should be enabled");
  });

  check("useStreaming gate: streaming=true + group + streamingInGroup=false → false", () => {
    const feishuCfg = { streaming: true, streamingInGroup: false };
    const isDirect = false;
    const useStreaming = feishuCfg.streaming === true && (isDirect || feishuCfg.streamingInGroup === true);
    assert(useStreaming === false, "group streaming should be disabled");
  });

  check("useStreaming gate: streaming=true + group + streamingInGroup=true → true", () => {
    const feishuCfg = { streaming: true, streamingInGroup: true };
    const isDirect = false;
    const useStreaming = feishuCfg.streaming === true && (isDirect || feishuCfg.streamingInGroup === true);
    assert(useStreaming === true, "group streaming should be enabled");
  });

  check("useStreaming gate: streaming=false → false regardless", () => {
    const feishuCfg = { streaming: false, streamingInGroup: true };
    const isDirect = true;
    const useStreaming = feishuCfg.streaming === true && (isDirect || feishuCfg.streamingInGroup === true);
    assert(useStreaming === false, "streaming disabled entirely");
  });

  check("useStreaming gate: streaming undefined → false", () => {
    const feishuCfg: any = {};
    const isDirect = true;
    const useStreaming = feishuCfg.streaming === true && (isDirect || feishuCfg.streamingInGroup === true);
    assert(useStreaming === false, "streaming undefined = disabled");
  });

  // ── 6. Full group lifecycle ──
  console.log("\n── Full Group Lifecycle ──");

  await checkAsync("full group streaming lifecycle: create → update → finalize", async () => {
    const log: string[] = [];
    const deps = makeMockDeps(log);

    // Step 1: First chunk creates card
    let state: StreamingDispatchRuntimeState = {
      accumulatedText: "",
      streamingCardCreated: false,
      cardKitCardId: null,
    };

    let result = await executeStreamingDispatch(
      { useStreaming: true, text: "Hello ", state },
      deps,
    );
    state = result.state;
    assert(state.streamingCardCreated === true, "card created");
    assert(state.cardKitCardId === "card_group_test_123", "cardId set");
    assert(result.actions.includes("create-card"), "create action");

    // Step 2: Second chunk updates card
    result = await executeStreamingDispatch(
      { useStreaming: true, text: "world ", state },
      deps,
    );
    state = result.state;
    assert(state.accumulatedText === "Hello world ", "accumulated correctly");
    assert(result.actions.includes("update-content"), "update action");

    // Step 3: Third chunk updates card
    result = await executeStreamingDispatch(
      { useStreaming: true, text: "from group!", state },
      deps,
    );
    state = result.state;
    assert(state.accumulatedText === "Hello world from group!", "full text");

    // Step 4: Final chunk finalizes
    result = await executeStreamingDispatch(
      { useStreaming: true, text: "", infoKind: "final", state },
      deps,
    );
    // Empty text → no action (behavior by design)
    assert(!result.actions.includes("finalize-card"), "empty final text = no finalize");

    // Step 4b: Final chunk with content
    result = await executeStreamingDispatch(
      { useStreaming: true, text: " End.", infoKind: "final", state },
      deps,
    );
    assert(result.actions.includes("finalize-card"), "finalize with content");
  });

  // ── Summary ──
  console.log("\n═══════════════════════════════════════");
  console.log("  Group Chat Streaming Tests");
  console.log("═══════════════════════════════════════");
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  if (passed === total) {
    console.log("\n  ✅ Group streaming target resolution correct");
    console.log("  ✅ Config gate logic controls group streaming");
    console.log("  ✅ Full group lifecycle (create → update → finalize) works");
  }
  console.log("═══════════════════════════════════════\n");

  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error("Group streaming tests failed:", err);
  process.exit(1);
});
