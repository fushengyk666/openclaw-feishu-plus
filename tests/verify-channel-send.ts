/**
 * verify-channel-send.ts — Mock tests for channel/send.ts
 *
 * Goal:
 * - Verify sendMessageFeishu / sendCardFeishu / updateCardFeishu / editMessageFeishu / getMessageFeishu
 *   dispatch to expected feishu-api operations/paths/params.
 */

import {
  __resetSendRequestLikeForTests,
  __setSendRequestLikeForTests,
  editMessageFeishu,
  getMessageFeishu,
  sendCardFeishu,
  sendMessageFeishu,
  updateCardFeishu,
} from "../src/channel/send.js";

type Call = {
  method: string;
  operation: string;
  path: string;
  body: any;
  opts: any;
};

const calls: Call[] = [];

const mockRequestLike = {
  post: async (operation: string, path: string, body?: any, opts?: any) => {
    calls.push({ method: "POST", operation, path, body, opts });
    return { data: { message_id: "om_mock_post" } };
  },
  patch: async (operation: string, path: string, body?: any, opts?: any) => {
    calls.push({ method: "PATCH", operation, path, body, opts });
    return { data: { message_id: path.split("/").pop() } };
  },
  put: async (operation: string, path: string, body?: any, opts?: any) => {
    calls.push({ method: "PUT", operation, path, body, opts });
    return { data: { message_id: path.split("/").pop() } };
  },
  get: async (operation: string, path: string, opts?: any) => {
    calls.push({ method: "GET", operation, path, body: undefined, opts });
    return { data: { message_id: path.split("/").pop() } };
  },
  delete: async (operation: string, path: string, opts?: any) => {
    calls.push({ method: "DELETE", operation, path, body: undefined, opts });
    return { data: { ok: true } };
  },
};

function reset() {
  calls.length = 0;
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  __setSendRequestLikeForTests(mockRequestLike as any);

  try {
    reset();
    await sendMessageFeishu({ cfg: {}, to: "ou_user_123", text: "hello", userId: "ou_sender_1" });
    assert(calls.length === 1, "sendMessageFeishu: expected 1 call");
    assert(calls[0].method === "POST", "sendMessageFeishu: wrong method");
    assert(calls[0].operation === "im.message.create", "sendMessageFeishu: wrong operation");
    assert(calls[0].path === "/open-apis/im/v1/messages", "sendMessageFeishu: wrong path");
    assert(calls[0].opts.params.receive_id_type === "open_id", "sendMessageFeishu: wrong receive_id_type for open_id");
    assert(calls[0].opts.userId === "ou_sender_1", "sendMessageFeishu: missing userId pass-through");
    assert(calls[0].body.msg_type === "post", "sendMessageFeishu: wrong msg_type");
    // Default path uses post format with md tag for markdown rendering
    const parsed = JSON.parse(calls[0].body.content);
    assert(parsed.zh_cn?.content?.[0]?.[0]?.tag === "md", "sendMessageFeishu: wrong content tag");
    assert(parsed.zh_cn?.content?.[0]?.[0]?.text === "hello", "sendMessageFeishu: wrong content text");

    reset();
    await sendMessageFeishu({ cfg: {}, to: "oc_chat_123", msgType: "text", content: JSON.stringify({ text: "chat" }) });
    assert(calls[0].opts.params.receive_id_type === "chat_id", "sendMessageFeishu(chat): wrong receive_id_type for chat_id");

    reset();
    await sendCardFeishu({ cfg: {}, to: "ou_user_456", card: { schema: "2.0" }, userId: "ou_sender_2" });
    assert(calls[0].method === "POST", "sendCardFeishu: wrong method");
    assert(calls[0].body.msg_type === "interactive", "sendCardFeishu: wrong msg_type");
    assert(calls[0].body.content === JSON.stringify({ schema: "2.0" }), "sendCardFeishu: wrong content");
    assert(calls[0].opts.userId === "ou_sender_2", "sendCardFeishu: missing userId pass-through");

    reset();
    await updateCardFeishu({ cfg: {}, messageId: "om_1", card: { body: [] }, userId: "ou_sender_3" });
    assert(calls[0].method === "PATCH", "updateCardFeishu: wrong method");
    assert(calls[0].operation === "im.message.update", "updateCardFeishu: wrong operation");
    assert(calls[0].path === "/open-apis/im/v1/messages/om_1", "updateCardFeishu: wrong path");
    assert(calls[0].body.content === JSON.stringify({ body: [] }), "updateCardFeishu: wrong content");
    assert(calls[0].opts.userId === "ou_sender_3", "updateCardFeishu: missing userId pass-through");

    reset();
    await editMessageFeishu({ cfg: {}, messageId: "om_2", msgType: "text", content: JSON.stringify({ text: "edited" }), userId: "ou_sender_4" });
    assert(calls[0].method === "PUT", "editMessageFeishu: wrong method");
    assert(calls[0].operation === "im.message.update", "editMessageFeishu: wrong operation");
    assert(calls[0].path === "/open-apis/im/v1/messages/om_2", "editMessageFeishu: wrong path");
    assert(calls[0].body.msg_type === "text", "editMessageFeishu: wrong msg_type");
    assert(calls[0].opts.userId === "ou_sender_4", "editMessageFeishu: missing userId pass-through");

    reset();
    await getMessageFeishu({ cfg: {}, messageId: "om_3", userId: "ou_sender_5" });
    assert(calls[0].method === "GET", "getMessageFeishu: wrong method");
    assert(calls[0].operation === "im.message.get", "getMessageFeishu: wrong operation");
    assert(calls[0].path === "/open-apis/im/v1/messages/om_3", "getMessageFeishu: wrong path");
    assert(calls[0].opts.userId === "ou_sender_5", "getMessageFeishu: missing userId pass-through");

    console.log("\n═══════════════════════════════════════");
    console.log("  Channel Send Verification Results");
    console.log("═══════════════════════════════════════\n");
    console.log("✅ sendMessageFeishu (open_id + dual-auth pass-through)");
    console.log("✅ sendMessageFeishu (chat_id)");
    console.log("✅ sendCardFeishu");
    console.log("✅ updateCardFeishu");
    console.log("✅ editMessageFeishu");
    console.log("✅ getMessageFeishu\n");
    console.log("───────────────────────────────────────");
    console.log("  Total: 6 | Passed: 6 | Failed: 0");
    console.log("───────────────────────────────────────\n");
  } finally {
    __resetSendRequestLikeForTests();
  }
}

main().catch((err) => {
  __resetSendRequestLikeForTests();
  console.error("Channel send verification failed:", err);
  process.exit(1);
});
