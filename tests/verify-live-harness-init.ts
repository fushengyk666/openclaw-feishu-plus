/**
 * verify-live-harness-init.ts — Self-validation of live harness initialization chain
 *
 * Purpose:
 * - Verify the entire initialization chain (config → tokenStore → resolver → executor → feishu-api)
 *   works correctly WITHOUT needing real Feishu credentials
 * - Catch import errors, type mismatches, and broken wiring before real env testing
 * - Validate that all 9 tool families can be instantiated and have expected methods
 * - Ensure the harness itself can run in dry-run mode (no API calls)
 *
 * This test gives confidence that when real credentials are provided,
 * the only failure modes are credential/permission issues — not code issues.
 */

import { parseConfig } from "../src/identity/config-schema.js";
import { createTokenStore } from "../src/identity/token-store.js";
import { TokenResolver } from "../src/identity/token-resolver.js";
import { initExecutor } from "../src/identity/request-executor.js";
import { initFeishuApi, feishuGet } from "../src/identity/feishu-api.js";
import { getApiPolicy, API_POLICY } from "../src/identity/api-policy.js";

// Tool families
import { DocTools, DOC_TOOL_DEFS } from "../src/tools/doc.js";
import { CalendarTools } from "../src/tools/calendar.js";
import { ChatTools } from "../src/tools/chat.js";
import { WikiTools } from "../src/tools/wiki.js";
import { DriveTools } from "../src/tools/drive.js";
import { BitableTools } from "../src/tools/bitable.js";
import { TaskTools } from "../src/tools/task.js";
import { PermTools } from "../src/tools/perm.js";
import { SheetsTools } from "../src/tools/sheets.js";
import { ContactTools } from "../src/tools/contact.js";
import { ApprovalTools } from "../src/tools/approval.js";
import { SearchTools } from "../src/tools/search.js";

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

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Live Harness Init Self-Validation");
  console.log("═══════════════════════════════════════\n");

  // ── 1. Config parsing ──
  console.log("── Config Parsing ──");

  check("parseConfig with minimal valid config", () => {
    const config = parseConfig({
      appId: "cli_test_12345",
      appSecret: "test_secret_value",
    });
    assert(config.appId === "cli_test_12345", "appId mismatch");
    assert(config.appSecret === "test_secret_value", "appSecret mismatch");
    assert(config.domain === "feishu", "default domain should be feishu");
    assert(config.auth.preferUserToken === true, "preferUserToken should default true");
    assert(config.auth.autoPromptUserAuth === true, "autoPromptUserAuth should default true");
  });

  check("parseConfig with full config", () => {
    const config = parseConfig({
      appId: "cli_test_12345",
      appSecret: "test_secret_value",
      domain: "lark",
      auth: {
        preferUserToken: false,
        autoPromptUserAuth: false,
        store: "memory",
        redirectUri: "https://example.com/callback",
      },
      tools: {
        doc: false,
        calendar: true,
      },
    });
    assert(config.domain === "lark", "domain should be lark");
    assert(config.auth.preferUserToken === false, "preferUserToken override");
    assert(config.auth.store === "memory", "store override");
    assert(config.tools.doc === false, "doc tool disabled");
    assert(config.tools.calendar === true, "calendar tool enabled");
    assert(config.tools.sheets === true, "sheets tool should default true");
    assert(config.tools.contact === true, "contact tool should default true");
  });

  check("parseConfig rejects missing appId", () => {
    let threw = false;
    try {
      parseConfig({ appSecret: "xxx" });
    } catch {
      threw = true;
    }
    assert(threw, "should reject missing appId");
  });

  check("parseConfig rejects missing appSecret", () => {
    let threw = false;
    try {
      parseConfig({ appId: "cli_xxx" });
    } catch {
      threw = true;
    }
    assert(threw, "should reject missing appSecret");
  });

  // ── 2. Token Store ──
  console.log("\n── Token Store ──");

  check("createTokenStore('memory') works", () => {
    const store = createTokenStore("memory");
    assert(store, "store should be created");
    assert(typeof store.get === "function", "store.get should be a function");
    assert(typeof store.set === "function", "store.set should be a function");
    assert(typeof store.delete === "function", "store.delete should be a function");
  });

  check("createTokenStore('file') works", () => {
    const store = createTokenStore("file");
    assert(store, "store should be created");
  });

  // ── 3. TokenResolver ──
  console.log("\n── TokenResolver ──");

  check("TokenResolver can be instantiated", () => {
    const config = parseConfig({
      appId: "cli_test_12345",
      appSecret: "test_secret_value",
    });
    const store = createTokenStore("memory");
    const resolver = new TokenResolver(config, store);
    assert(resolver, "resolver should be created");
    assert(typeof resolver.resolve === "function", "resolve should be a function");
    assert(typeof resolver.invalidate === "function", "invalidate should be a function");
  });

  // ── 4. Request Executor & Feishu API ──
  console.log("\n── Request Executor & Feishu API ──");

  check("initExecutor accepts TokenResolver", () => {
    const config = parseConfig({
      appId: "cli_test_12345",
      appSecret: "test_secret_value",
    });
    const store = createTokenStore("memory");
    const resolver = new TokenResolver(config, store);
    initExecutor(resolver);
    // No error means success
  });

  check("initFeishuApi accepts config", () => {
    const config = parseConfig({
      appId: "cli_test_12345",
      appSecret: "test_secret_value",
    });
    initFeishuApi(config);
    // No error means success
  });

  check("feishuGet is a callable function", () => {
    assert(typeof feishuGet === "function", "feishuGet should be a function");
  });

  // ── 5. API Policy Registry ──
  console.log("\n── API Policy Registry ──");

  check("API_POLICY has registered operations", () => {
    const ops = Object.keys(API_POLICY);
    assert(ops.length >= 30, `expected ≥30 operations, got ${ops.length}`);
  });

  check("all registered operations have valid support values", () => {
    const validSupports = ["tenant_only", "user_only", "both"];
    for (const [op, policy] of Object.entries(API_POLICY)) {
      assert(
        validSupports.includes(policy.support),
        `${op} has invalid support: ${policy.support}`,
      );
    }
  });

  check("getApiPolicy returns for known operation", () => {
    const policy = getApiPolicy("docx.document.create");
    assert(policy.support === "both", "docx.document.create should be both");
  });

  check("getApiPolicy throws for unknown operation", () => {
    let threw = false;
    try {
      getApiPolicy("nonexistent.operation.fake");
    } catch {
      threw = true;
    }
    assert(threw, "should throw for unregistered operation");
  });

  // Check critical operations are registered
  const criticalOps = [
    "docx.document.create", "docx.document.get",
    "calendar.calendar.list", "calendar.calendarEvent.create",
    "im.chat.list", "im.message.create",
    "wiki.space.list", "wiki.spaceNode.list",
    "drive.file.list", "drive.file.upload",
    "bitable.app.get", "bitable.appTableRecord.list",
    "task.task.list", "task.task.create",
    "drive.permission.list", "drive.permission.transferOwner",
    "contact.user.get", "contact.user.me",
    "approval.definition.get", "approval.instance.create",
    "search.message.search", "search.doc.search",
  ];

  check("all critical operations registered in API_POLICY", () => {
    const missing = criticalOps.filter(op => !API_POLICY[op]);
    assert(missing.length === 0, `missing operations: ${missing.join(", ")}`);
  });

  // ── 6. Tool Families Instantiation ──
  console.log("\n── Tool Families ──");

  const families: Array<{ name: string; ctor: new () => any; method: string }> = [
    { name: "DocTools", ctor: DocTools, method: "execute" },
    { name: "CalendarTools", ctor: CalendarTools, method: "execute" },
    { name: "ChatTools", ctor: ChatTools, method: "execute" },
    { name: "WikiTools", ctor: WikiTools, method: "execute" },
    { name: "DriveTools", ctor: DriveTools, method: "execute" },
    { name: "BitableTools", ctor: BitableTools, method: "execute" },
    { name: "TaskTools", ctor: TaskTools, method: "execute" },
    { name: "PermTools", ctor: PermTools, method: "execute" },
    { name: "SheetsTools", ctor: SheetsTools, method: "execute" },
    { name: "ContactTools", ctor: ContactTools, method: "execute" },
    { name: "ApprovalTools", ctor: ApprovalTools, method: "execute" },
    { name: "SearchTools", ctor: SearchTools, method: "execute" },
  ];

  for (const { name, ctor, method } of families) {
    check(`${name} can be instantiated with execute()`, () => {
      const instance = new ctor();
      assert(instance, `${name} instance should be created`);
      assert(typeof instance[method] === "function", `${name}.${method} should be a function`);
    });
  }

  // ── 7. Full initialization chain ──
  console.log("\n── Full Init Chain (dry-run) ──");

  await checkAsync("full init chain completes without errors", async () => {
    const config = parseConfig({
      appId: "cli_dryrun_test",
      appSecret: "dryrun_secret",
      domain: "feishu",
      auth: { store: "memory", preferUserToken: true, autoPromptUserAuth: true },
    });
    const tokenStore = createTokenStore(config.auth.store);
    const resolver = new TokenResolver(config, tokenStore);
    initExecutor(resolver);
    initFeishuApi(config);

    // Verify all tool families can be instantiated after init
    const doc = new DocTools();
    const calendar = new CalendarTools();
    const chat = new ChatTools();
    const wiki = new WikiTools();
    const drive = new DriveTools();
    const bitable = new BitableTools();
    const task = new TaskTools();
    const perm = new PermTools();
    const sheets = new SheetsTools();
    const contact = new ContactTools();
    const approval = new ApprovalTools();
    const search = new SearchTools();

    // All should have execute method
    for (const t of [doc, calendar, chat, wiki, drive, bitable, task, perm, sheets, contact, approval, search]) {
      assert(typeof t.execute === "function", "missing execute method");
    }
  });

  await checkAsync("feishuGet fails gracefully (network error, not crash)", async () => {
    // This should throw a network error (because cli_dryrun_test is not a real app),
    // NOT a crash or unhandled exception
    try {
      await feishuGet("docx.document.get", "/open-apis/docx/v1/documents/test_doc_id");
      // If it somehow succeeds (shouldn't happen), that's fine too
    } catch (err: any) {
      // Expected: either network error or token error, NOT a TypeError or import error
      assert(
        err.message && typeof err.message === "string",
        "error should have a message string",
      );
      // Should not be an import/type error
      assert(
        !err.message.includes("is not a function"),
        "should not be a type error — indicates broken wiring",
      );
      assert(
        !err.message.includes("Cannot read properties"),
        "should not be a null dereference — indicates broken wiring",
      );
    }
  });

  // ── Summary ──
  console.log("\n═══════════════════════════════════════");
  console.log("  Live Harness Init Self-Validation");
  console.log("═══════════════════════════════════════");
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  if (passed === total) {
    console.log("\n  ✅ All initialization chain components verified");
    console.log("  ✅ When real credentials are provided, only auth/permission failures expected");
  }
  console.log("═══════════════════════════════════════\n");

  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error("Live harness init validation failed:", err);
  process.exit(1);
});
