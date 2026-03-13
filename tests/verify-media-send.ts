/**
 * verify-media-send.ts — media send path tests
 *
 * Goal:
 * - Verify sendImageFeishu / sendFileFeishu preserve userId when delegating to send.ts
 * - Verify sendMediaFeishu source forwards userId to sendImageFeishu/sendFileFeishu
 */

import {
  __resetMediaSendHooksForTests,
  __setMediaSendHooksForTests,
  sendFileFeishu,
  sendImageFeishu,
} from "../src/channel/media.js";
import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const sendCalls: Array<any> = [];

  __setMediaSendHooksForTests({
    sendMessageFeishu: async (payload: any) => {
      sendCalls.push(payload);
      return { ok: true };
    },
  });

  try {
    await sendImageFeishu({ cfg: {}, to: "ou_img", imageKey: "img_direct", userId: "ou_user_1" });
    assert(sendCalls[0].msgType === "image", "sendImageFeishu: wrong msgType");
    assert(sendCalls[0].userId === "ou_user_1", "sendImageFeishu: missing userId pass-through");

    await sendFileFeishu({ cfg: {}, to: "ou_file", fileKey: "file_direct", userId: "ou_user_2" });
    assert(sendCalls[1].msgType === "file", "sendFileFeishu: wrong msgType");
    assert(sendCalls[1].userId === "ou_user_2", "sendFileFeishu: missing userId pass-through");

    const mediaSource = readFileSync(new URL("../src/channel/media.ts", import.meta.url), "utf8");
    assert(mediaSource.includes("userId: params.userId") || mediaSource.includes("userId: params?.userId"), "media.ts should forward userId into delegated send helpers");
    assert(mediaSource.includes("return sendImageFeishu({") && mediaSource.includes("return sendFileFeishu({"), "sendMediaFeishu should delegate through sendImageFeishu/sendFileFeishu");

    console.log("\n═══════════════════════════════════════");
    console.log("  Media Send Verification Results");
    console.log("═══════════════════════════════════════\n");
    console.log("✅ sendImageFeishu userId pass-through");
    console.log("✅ sendFileFeishu userId pass-through");
    console.log("✅ sendMediaFeishu source forwards userId to delegated helpers");
    console.log("✅ sendMediaFeishu delegates via sendImageFeishu/sendFileFeishu\n");
    console.log("───────────────────────────────────────");
    console.log("  Total: 4 | Passed: 4 | Failed: 0");
    console.log("───────────────────────────────────────\n");
  } finally {
    __resetMediaSendHooksForTests();
  }
}

main().catch((err) => {
  console.error("Media send verification failed:", err);
  process.exit(1);
});
