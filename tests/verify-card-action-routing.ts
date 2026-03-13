/**
 * verify-card-action-routing.ts
 *
 * Ensures Feishu card action callbacks can be routed into the OpenClaw agent runtime
 * (minimal implementation), and that the resulting agent output can be sent back
 * via sendMessageFeishu.
 */

import assert from "node:assert/strict";

import { routeCardActionToAgent } from "../src/channel/card-action.js";
import { setFeishuPlusRuntime } from "../src/channel/runtime.js";
import { __setSendRequestLikeForTests, __resetSendRequestLikeForTests } from "../src/channel/send.js";

function createFakeChannelRuntime() {
  const calls: any[] = [];

  return {
    calls,
    routing: {
      resolveAgentRoute: (_: any) => ({
        sessionKey: "sess_test",
        agentId: "agent_test",
        accountId: "default",
      }),
    },
    reply: {
      formatAgentEnvelope: ({ body }: any) => ({ body }),
      finalizeInboundContext: (ctx: any) => ctx,
      dispatchReplyWithBufferedBlockDispatcher: async ({ dispatcherOptions }: any) => {
        calls.push({ kind: "dispatch" });
        await dispatcherOptions.deliver({ text: "hello " }, { kind: "chunk" });
        await dispatcherOptions.deliver({ text: "world" }, { kind: "final" });
        return { ok: true };
      },
    },
  };
}

async function main() {
  const sendCalls: any[] = [];

  __setSendRequestLikeForTests({
    post: async (operation: string, path: string, body?: any, opts?: any) => {
      sendCalls.push({ operation, path, body, opts });
      return { data: { message_id: "m_test" } } as any;
    },
    patch: async () => ({ data: {} } as any),
    put: async () => ({ data: {} } as any),
    get: async () => ({ data: {} } as any),
    delete: async () => ({ data: {} } as any),
  });

  const channelRuntime = createFakeChannelRuntime();
  setFeishuPlusRuntime({ routing: channelRuntime.routing, reply: channelRuntime.reply });

  await routeCardActionToAgent({
    cfg: {},
    accountId: "default",
    channelRuntime,
    event: {
      open_id: "ou_test",
      tenant_key: "t_test",
      open_message_id: "om_test",
      token: "tok_test",
      action: {
        tag: "button",
        value: { a: 1 },
      },
    },
    log: {
      info: () => undefined,
      error: () => undefined,
    },
  });

  assert.equal(channelRuntime.calls.filter((c) => c.kind === "dispatch").length, 1);
  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0].operation, "im.message.create");
  assert.equal(sendCalls[0].path, "/open-apis/im/v1/messages");
  assert.equal(sendCalls[0].body.receive_id, "ou_test");
  assert.equal(sendCalls[0].body.msg_type, "text");
  assert.equal(sendCalls[0].body.content, JSON.stringify({ text: "hello world" }));
  assert.equal(sendCalls[0].opts?.params?.receive_id_type, "open_id");

  __resetSendRequestLikeForTests();

  console.log("✅ card action routes to agent and sends final text reply");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
