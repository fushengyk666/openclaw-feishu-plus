/**
 * verify-approval-search-tools.ts — Contract smoke tests for approval & search tools
 *
 * Verifies:
 * - approval tools go through feishu-api with correct operations
 * - search tools go through feishu-api with correct operations
 * - user_only operations correctly route
 * - API paths are semantically correct
 */

import { initExecutor } from "../src/identity/request-executor.js";
import { initFeishuApi } from "../src/identity/feishu-api.js";
import { TokenResolver } from "../src/identity/token-resolver.js";
import { MemoryTokenStore } from "../src/identity/token-store.js";
import type { PluginConfig } from "../src/identity/config-schema.js";
import { ApprovalTools } from "../src/tools/approval.js";
import { SearchTools } from "../src/tools/search.js";

const mockConfig: PluginConfig = {
  enabled: true,
  mode: "tools-only",
  appId: "cli_test_app_id",
  appSecret: "test_secret",
  domain: "feishu",
  connectionMode: "websocket",
  auth: {
    preferUserToken: true,
    autoPromptUserAuth: true,
    store: "memory",
    redirectUri: "https://open.feishu.cn/oauth/callback",
  },
  tools: {
    doc: true, calendar: true, oauth: true, wiki: true, drive: true,
    bitable: true, task: true, chat: true, perm: true, approval: true,
    mail: false, contact: true, sheets: true, search: true,
  },
};

type FetchCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
};

const calls: FetchCall[] = [];
const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

function installFetchMock() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(
      Object.entries((init?.headers as Record<string, string>) ?? {}).map(([k, v]) => [k, String(v)]),
    );
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ url, method, headers, body });

    if (url.includes("/open-apis/auth/v3/tenant_access_token/internal")) {
      return jsonResponse({
        code: 0,
        msg: "success",
        tenant_access_token: "t-mock-tenant-token",
        expire: 7200,
      });
    }

    return jsonResponse({
      code: 0,
      msg: "success",
      data: { echoedUrl: url, echoedMethod: method },
    });
  }) as typeof fetch;
}

function restoreFetchMock() {
  globalThis.fetch = originalFetch;
}

function resetCalls() {
  calls.length = 0;
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

let passed = 0;
let total = 0;

async function runCase(
  name: string,
  fn: () => Promise<unknown>,
  expected: { method: string; pathIncludes: string },
) {
  total++;
  resetCalls();
  try {
    await fn();
    assert(calls.length >= 1, `expected at least 1 fetch call, got ${calls.length}`);
    const apiCall = calls[calls.length - 1];
    assert(apiCall.method === expected.method, `expected ${expected.method}, got ${apiCall.method}`);
    assert(apiCall.url.includes(expected.pathIncludes), `url mismatch: ${apiCall.url}`);
    assert(apiCall.headers.Authorization === "Bearer t-mock-tenant-token", `missing/invalid Authorization`);
    console.log(`✅ ${name}`);
    console.log(`   ${apiCall.method} ${apiCall.url}`);
    passed++;
  } catch (err: any) {
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
  }
}

async function runUserOnlyCase(
  name: string,
  fn: () => Promise<unknown>,
) {
  total++;
  resetCalls();
  try {
    await fn();
    // Should have failed with NeedUserAuthorizationError → AuthRequiredError
    console.log(`❌ ${name} — expected AuthRequiredError but succeeded`);
  } catch (err: any) {
    if (err.name === "AuthRequiredError" || err.message?.includes("user_access_token")) {
      console.log(`✅ ${name} — correctly requires user auth`);
      passed++;
    } else {
      console.log(`❌ ${name} — unexpected error: ${err.message}`);
    }
  }
}

async function main() {
  installFetchMock();
  try {
    const store = new MemoryTokenStore();
    const resolver = new TokenResolver(mockConfig, store);
    initExecutor(resolver);
    initFeishuApi(mockConfig);

    const approval = new ApprovalTools();
    const search = new SearchTools();

    console.log("═══════════════════════════════════════");
    console.log("  Approval & Search Tool Verification");
    console.log("═══════════════════════════════════════\n");

    // ── Approval tools (both-mode operations use tenant token) ──
    console.log("── Approval Tools ──\n");

    await runCase(
      "approval.getDefinition",
      () => approval.execute("feishu_plus_approval_get_definition", { approval_code: "APPROVAL_XXX" }),
      { method: "POST", pathIncludes: "/open-apis/approval/v4/approvals" },
    );

    await runCase(
      "approval.listInstances",
      () => approval.execute("feishu_plus_approval_list_instances", {
        approval_code: "APPROVAL_XXX",
        start_time: "1700000000000",
        end_time: "1710000000000",
      }),
      { method: "POST", pathIncludes: "/open-apis/approval/v4/instances" },
    );

    await runCase(
      "approval.getInstance",
      () => approval.execute("feishu_plus_approval_get_instance", { instance_id: "inst_xxx" }),
      { method: "GET", pathIncludes: "/open-apis/approval/v4/instances/inst_xxx" },
    );

    // user_only operations → should fail without user token
    await runUserOnlyCase(
      "approval.createInstance (user_only)",
      () => approval.execute("feishu_plus_approval_create_instance", {
        approval_code: "APPROVAL_XXX",
        form: "[]",
      }),
    );

    await runUserOnlyCase(
      "approval.approve (user_only)",
      () => approval.execute("feishu_plus_approval_approve", {
        approval_code: "APPROVAL_XXX",
        instance_code: "inst_xxx",
        task_id: "task_xxx",
      }),
    );

    await runUserOnlyCase(
      "approval.reject (user_only)",
      () => approval.execute("feishu_plus_approval_reject", {
        approval_code: "APPROVAL_XXX",
        instance_code: "inst_xxx",
        task_id: "task_xxx",
      }),
    );

    await runUserOnlyCase(
      "approval.cancel (user_only)",
      () => approval.execute("feishu_plus_approval_cancel", {
        approval_code: "APPROVAL_XXX",
        instance_code: "inst_xxx",
      }),
    );

    // ── Search tools (all user_only) ──
    console.log("\n── Search Tools ──\n");

    await runUserOnlyCase(
      "search.searchMessage (user_only)",
      () => search.execute("feishu_plus_search_message", { query: "test" }),
    );

    await runUserOnlyCase(
      "search.searchDoc (user_only)",
      () => search.execute("feishu_plus_search_doc", { search_key: "design doc" }),
    );

    await runUserOnlyCase(
      "search.searchApp (user_only)",
      () => search.execute("feishu_plus_search_app", { query: "feishu" }),
    );

    // ── Summary ──
    console.log("\n═══════════════════════════════════════");
    console.log("  Approval & Search Results");
    console.log("═══════════════════════════════════════");
    console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
    console.log("═══════════════════════════════════════\n");

    if (passed !== total) process.exit(1);
  } finally {
    restoreFetchMock();
  }
}

main().catch((err) => {
  restoreFetchMock();
  console.error("Tool verification failed:", err);
  process.exit(1);
});
